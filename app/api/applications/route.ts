import { authMiddleware, getDb } from 'lyzr-architect-pg'
import { applications, assessments, candidates, criterion_scores, documents, jobs, organizations } from '@/lib/db/schema'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

async function context(req: NextRequest) {
  const userId = (req as unknown as { userId?: string }).userId
  if (!userId) return null
  const [organization] = await getDb().select().from(organizations).where(eq(organizations.slug, `hireflow-${userId}`)).limit(1)
  return organization ? { userId, organizationId: organization.id } : null
}

export const POST = authMiddleware(async (req: NextRequest) => {
  try {
    const ctx = await context(req)
    if (!ctx) return NextResponse.json({ success: false, error: 'Workspace seed required' }, { status: 403 })
    const body = await req.json() as Record<string, unknown>
    const jobId = typeof body.job_id === 'string' ? body.job_id : ''
    const [job] = await getDb().select({ id: jobs.id }).from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.organization_id, ctx.organizationId))).limit(1)
    if (!job) return NextResponse.json({ success: false, error: 'Job is outside the workspace' }, { status: 403 })
    const fullName = typeof body.full_name === 'string' && body.full_name.trim() ? body.full_name.trim() : 'Resume candidate'
    const email = typeof body.email === 'string' ? body.email : null
    let candidate = email ? (await getDb().select().from(candidates).where(and(eq(candidates.organization_id, ctx.organizationId), eq(candidates.email, email))).limit(1))[0] : undefined
    if (!candidate) [candidate] = await getDb().insert(candidates).values({ organization_id: ctx.organizationId, full_name: fullName, email: email ?? '', phone: typeof body.phone === 'string' ? body.phone : '', source: 'direct_upload', resume_url: '', metadata: { source_asset_id: body.asset_id ?? null } }).returning()
    if (!candidate) return NextResponse.json({ success: false, error: 'Candidate could not be created' }, { status: 500 })
    const [application] = await getDb().insert(applications).values({ organization_id: ctx.organizationId, job_id: jobId, candidate_id: candidate.id, stage: 'review', status: 'active', applied_at: new Date(), metadata: { source_ids: [body.asset_id].filter(Boolean), upload_file_name: body.file_name, screening_status: body.screening_status ?? 'pending' } }).onConflictDoNothing().returning()
    const effectiveApplication = application ?? (await getDb().select().from(applications).where(and(eq(applications.job_id, jobId), eq(applications.candidate_id, candidate.id))).limit(1))[0]
    if (!effectiveApplication) return NextResponse.json({ success: false, error: 'Application could not be created' }, { status: 500 })
    await getDb().insert(documents).values({ organization_id: ctx.organizationId, candidate_id: candidate.id, application_id: effectiveApplication.id, doc_type: 'resume', file_url: typeof body.asset_id === 'string' ? body.asset_id : '', file_name: typeof body.file_name === 'string' ? body.file_name : 'resume', parsed_content: { asset_id: body.asset_id, source_provider: 'direct_upload' }, parse_status: body.screening_status === 'completed' ? 'parsed' : 'pending' })
    let assessment = null
    if (typeof body.overall_score === 'number') {
      ;[assessment] = await getDb().insert(assessments).values({ organization_id: ctx.organizationId, application_id: effectiveApplication.id, assessment_type: 'evidence_based_screening', status: 'completed', overall_score: String(body.overall_score), notes: typeof body.notes === 'string' ? body.notes : 'Direct upload screening completed.', assessed_by_user_id: ctx.userId }).returning()
      if (assessment && Array.isArray(body.criterion_scores)) {
        const existingCriteria = await getDb().select({ id: job_criteria.id, name: job_criteria.name }).from(job_criteria).where(eq(job_criteria.job_id, jobId))
        const rows = body.criterion_scores
          .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
          .map((item) => {
            const rawId = String(item.criterion_id ?? '').trim()
            const rawName = typeof item.name === 'string' ? item.name.trim().toLowerCase() : ''
            const matched = existingCriteria.find((c) => c.id === rawId) ||
              existingCriteria.find((c) => c.name.trim().toLowerCase() === rawId.toLowerCase()) ||
              (rawName ? existingCriteria.find((c) => c.name.trim().toLowerCase() === rawName) : undefined)
            if (!matched) return null
            return {
              assessment_id: assessment.id,
              job_criterion_id: matched.id,
              score: String(typeof item.score === 'number' ? item.score : 0),
              notes: typeof item.reasoning === 'string' ? item.reasoning : null,
            }
          })
          .filter((row): row is NonNullable<typeof row> => row !== null)
        if (rows.length) await getDb().insert(criterion_scores).values(rows)
      }
    }
    return NextResponse.json({ success: true, data: { candidate, application: effectiveApplication, assessment } }, { status: 201 })
  } catch (error) {
    console.error('[API] applications POST error:', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to create uploaded application' }, { status: 400 })
  }
})

export const GET = authMiddleware(async (req: NextRequest) => {
  try {
    const ctx = await context(req)
    if (!ctx) return NextResponse.json({ success: true, data: [] })
    const jobId = new URL(req.url).searchParams.get('job_id') ?? ''
    if (!jobId) return NextResponse.json({ success: false, error: 'Job id is required' }, { status: 400 })
    const [job] = await getDb().select({ id: jobs.id }).from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.organization_id, ctx.organizationId))).limit(1)
    if (!job) return NextResponse.json({ success: false, error: 'Job is outside the workspace' }, { status: 403 })
    const appRows = await getDb().select().from(applications).where(and(eq(applications.organization_id, ctx.organizationId), eq(applications.job_id, jobId))).orderBy(desc(applications.applied_at))
    if (!appRows.length) return NextResponse.json({ success: true, data: [] })
    const candidateIds = appRows.map((row) => row.candidate_id)
    const applicationIds = appRows.map((row) => row.id)
    const [candidateRows, assessmentRows, documentRows] = await Promise.all([
      getDb().select().from(candidates).where(and(eq(candidates.organization_id, ctx.organizationId), inArray(candidates.id, candidateIds))),
      getDb().select().from(assessments).where(and(eq(assessments.organization_id, ctx.organizationId), inArray(assessments.application_id, applicationIds))),
      getDb().select().from(documents).where(and(eq(documents.organization_id, ctx.organizationId), inArray(documents.application_id, applicationIds))),
    ])
    const assessmentIds = assessmentRows.map((row) => row.id)
    const scoreRows = assessmentIds.length ? await getDb().select().from(criterion_scores).where(inArray(criterion_scores.assessment_id, assessmentIds)) : []
    const data = appRows.map((application) => ({
      application,
      candidate: candidateRows.find((row) => row.id === application.candidate_id) ?? null,
      assessment: assessmentRows.find((row) => row.application_id === application.id) ?? null,
      criterion_scores: scoreRows.filter((row) => assessmentRows.find((assessment) => assessment.id === row.assessment_id)?.application_id === application.id),
      documents: documentRows.filter((row) => row.application_id === application.id),
    }))
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[API] applications GET error:', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to load role applications' }, { status: 400 })
  }
})

export const PUT = authMiddleware(async (req: NextRequest) => {
  try {
    const ctx = await context(req)
    if (!ctx) return NextResponse.json({ success: false, error: 'Workspace seed required' }, { status: 403 })
    const body = await req.json() as Record<string, unknown>
    const id = typeof body.id === 'string' ? body.id : ''
    const [existing] = await getDb().select().from(applications).where(and(eq(applications.id, id), eq(applications.organization_id, ctx.organizationId))).limit(1)
    if (!existing) return NextResponse.json({ success: false, error: 'Application not found' }, { status: 404 })
    const existingMetadata = existing.metadata && typeof existing.metadata === 'object' ? existing.metadata as Record<string, unknown> : {}
    const incomingMetadata = body.metadata && typeof body.metadata === 'object' ? body.metadata as Record<string, unknown> : {}
    const [row] = await getDb().update(applications).set({ ...(typeof body.stage === 'string' ? { stage: body.stage } : {}), ...(typeof body.status === 'string' ? { status: body.status } : {}), metadata: { ...existingMetadata, ...incomingMetadata } }).where(and(eq(applications.id, id), eq(applications.organization_id, ctx.organizationId))).returning()
    return NextResponse.json({ success: true, data: row })
  } catch (error) {
    console.error('[API] applications PUT error:', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to update application' }, { status: 400 })
  }
})

export const DELETE = authMiddleware(async (req: NextRequest) => {
  try {
    const ctx = await context(req)
    if (!ctx) return NextResponse.json({ success: false, error: 'Workspace seed required' }, { status: 403 })
    const id = new URL(req.url).searchParams.get('id') ?? ''
    const [existing] = await getDb().select().from(applications).where(and(eq(applications.id, id), eq(applications.organization_id, ctx.organizationId))).limit(1)
    if (!existing) return NextResponse.json({ success: false, error: 'Application not found' }, { status: 404 })
    await getDb().delete(applications).where(and(eq(applications.id, id), eq(applications.organization_id, ctx.organizationId)))
    return NextResponse.json({ success: true, data: { candidate_id: existing.candidate_id, job_id: existing.job_id } })
  } catch (error) {
    console.error('[API] applications DELETE error:', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to remove candidate from role' }, { status: 400 })
  }
})
