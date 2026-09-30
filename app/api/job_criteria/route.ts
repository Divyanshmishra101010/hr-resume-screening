import { authMiddleware, getDb } from 'lyzr-architect-pg'
import { job_criteria, jobs, organizations } from '@/lib/db/schema'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

async function resolveOrganization(req: NextRequest) {
  const userId = (req as unknown as { userId?: string }).userId
  if (!userId) return null
  const [organization] = await getDb().select().from(organizations).where(eq(organizations.slug, `hireflow-${userId}`)).limit(1)
  return organization?.id ?? null
}

async function roleIds(organizationId: string) {
  const rows = await getDb().select({ id: jobs.id }).from(jobs).where(eq(jobs.organization_id, organizationId))
  return rows.map((row) => row.id)
}

export const GET = authMiddleware(async (req: NextRequest) => {
  try {
    const organizationId = await resolveOrganization(req)
    if (!organizationId) return NextResponse.json({ success: true, data: [] })
    const ids = await roleIds(organizationId)
    if (ids.length === 0) return NextResponse.json({ success: true, data: [] })
    const rows = await getDb().select().from(job_criteria).where(inArray(job_criteria.job_id, ids)).orderBy(desc(job_criteria.id))
    return NextResponse.json({ success: true, data: rows })
  } catch (error) {
    console.error('[API] job_criteria GET error:', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to load criteria' }, { status: 400 })
  }
})

export const POST = authMiddleware(async (req: NextRequest) => {
  try {
    const organizationId = await resolveOrganization(req)
    if (!organizationId) return NextResponse.json({ success: false, error: 'Workspace seed required' }, { status: 403 })
    const body = await req.json() as Record<string, unknown>
    const jobId = typeof body.job_id === 'string' ? body.job_id : ''
    if (!(await roleIds(organizationId)).includes(jobId)) return NextResponse.json({ success: false, error: 'Job is outside the workspace' }, { status: 403 })
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return NextResponse.json({ success: false, error: 'Criterion name is required' }, { status: 400 })
    const [row] = await getDb().insert(job_criteria).values({ job_id: jobId, name, criterion_type: typeof body.criterion_type === 'string' ? body.criterion_type : 'required', minimum_match: typeof body.minimum_match === 'number' || typeof body.minimum_match === 'string' ? String(body.minimum_match) : '0', description: typeof body.description === 'string' ? body.description : null, weight: typeof body.weight === 'number' || typeof body.weight === 'string' ? String(body.weight) : '0', approved: body.approved === true }).returning()
    return NextResponse.json({ success: true, data: row }, { status: 201 })
  } catch (error) {
    console.error('[API] job_criteria POST error:', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to create criterion' }, { status: 400 })
  }
})

export const DELETE = authMiddleware(async (req: NextRequest) => {
  try {
    const organizationId = await resolveOrganization(req)
    if (!organizationId) return NextResponse.json({ success: false, error: 'Workspace seed required' }, { status: 403 })
    const id = new URL(req.url).searchParams.get('id') ?? ''
    const ids = await roleIds(organizationId)
    const [existing] = await getDb().select().from(job_criteria).where(and(eq(job_criteria.id, id), inArray(job_criteria.job_id, ids))).limit(1)
    if (!existing) return NextResponse.json({ success: false, error: 'Criterion not found' }, { status: 404 })
    await getDb().delete(job_criteria).where(eq(job_criteria.id, id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] job_criteria DELETE error:', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to delete criterion' }, { status: 400 })
  }
})

export const PUT = authMiddleware(async (req: NextRequest) => {
  try {
    const organizationId = await resolveOrganization(req)
    if (!organizationId) return NextResponse.json({ success: false, error: 'Workspace seed required' }, { status: 403 })
    const body = await req.json() as Record<string, unknown>
    const id = typeof body.id === 'string' ? body.id : ''
    const ids = await roleIds(organizationId)
    const [existing] = await getDb().select().from(job_criteria).where(and(eq(job_criteria.id, id), inArray(job_criteria.job_id, ids))).limit(1)
    if (!existing) return NextResponse.json({ success: false, error: 'Criterion not found' }, { status: 404 })
    const [row] = await getDb().update(job_criteria).set({ ...(typeof body.name === 'string' ? { name: body.name } : {}), ...(typeof body.criterion_type === 'string' ? { criterion_type: body.criterion_type } : {}), ...(typeof body.minimum_match === 'number' || typeof body.minimum_match === 'string' ? { minimum_match: String(body.minimum_match) } : {}), ...(typeof body.description === 'string' ? { description: body.description } : {}), ...(typeof body.weight === 'number' || typeof body.weight === 'string' ? { weight: String(body.weight) } : {}), ...(typeof body.approved === 'boolean' ? { approved: body.approved } : {}) }).where(eq(job_criteria.id, id)).returning()
    return NextResponse.json({ success: true, data: row })
  } catch (error) {
    console.error('[API] job_criteria PUT error:', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to update criterion' }, { status: 400 })
  }
})
