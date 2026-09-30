import { authMiddleware, getDb } from 'lyzr-architect-pg'
import {
  applications,
  assessments,
  audit_events,
  candidates,
  criterion_scores,
  documents,
  integration_connections,
  interview_drafts,
  interview_slots,
  job_criteria,
  jobs,
  organization_members,
  organizations,
  ranking_snapshots,
} from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

export const POST = authMiddleware(async (req: NextRequest) => {
  try {
    const userId = (req as unknown as { userId?: string }).userId
    if (!userId) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    const db = getDb()
    let [organization] = await db.select().from(organizations).where(eq(organizations.slug, `hireflow-${userId}`)).limit(1)

    if (!organization) {
      const [created] = await db.insert(organizations).values({ name: 'Northstar Recruiting', slug: `hireflow-${userId}`, status: 'active' }).returning()
      organization = created
    }
    if (!organization) return NextResponse.json({ success: false, error: 'Organization could not be created' }, { status: 500 })

    const existingMembership = await db.select().from(organization_members).where(eq(organization_members.organization_id, organization.id)).limit(1)
    if (existingMembership.length === 0) await db.insert(organization_members).values({ organization_id: organization.id, role: 'recruiter', status: 'active' })

    const existingJobs = await db.select().from(jobs).where(eq(jobs.organization_id, organization.id)).limit(1)
    const existingIntegrations = await db.select().from(integration_connections).where(eq(integration_connections.organization_id, organization.id)).limit(1)
    if (existingJobs.length > 0 || existingIntegrations.length > 0) return NextResponse.json({ success: true, seeded: false, data: { organization_id: organization.id } })

    const [designJob, operationsJob, engineeringJob, successJob] = await db.insert(jobs).values([
      { organization_id: organization.id, title: 'Senior Product Designer', description: 'Lead product discovery, systems thinking, and design quality for a B2B workflow platform.', status: 'open', department: 'Product', employment_type: 'Full-time', location: 'Remote · US time zones', metadata: {} },
      { organization_id: organization.id, title: 'Revenue Operations Manager', description: 'Build the operating system for pipeline quality, forecasting, and cross-functional execution.', status: 'open', department: 'Operations', employment_type: 'Full-time', location: 'New York · Hybrid', metadata: {} },
      { organization_id: organization.id, title: 'Frontend Engineer', description: 'Ship accessible, resilient product surfaces with a TypeScript and React platform team.', status: 'open', department: 'Engineering', employment_type: 'Full-time', location: 'Remote', metadata: {} },
      { organization_id: organization.id, title: 'Customer Success Lead', description: 'Create a thoughtful customer operating model for high-growth accounts.', status: 'open', department: 'Customer', employment_type: 'Full-time', location: 'San Francisco · Hybrid', metadata: {} },
    ]).returning()
    if (!designJob || !operationsJob || !engineeringJob || !successJob) return NextResponse.json({ success: false, error: 'Starter roles could not be created' }, { status: 500 })

    const criteria = await db.insert(job_criteria).values([
      { job_id: designJob.id, name: 'Product strategy', description: 'Direct evidence of shaping product direction and discovery decisions.', weight: '30', approved: true },
      { job_id: designJob.id, name: 'Design systems', description: 'Evidence of creating or governing reusable design patterns.', weight: '25', approved: true },
      { job_id: designJob.id, name: 'User research', description: 'Evidence of research methods tied to product outcomes.', weight: '20', approved: true },
      { job_id: designJob.id, name: 'People leadership', description: 'Relevant mentoring or management scope; missing evidence stays uncertain.', weight: '15', approved: true },
      { job_id: designJob.id, name: 'B2B workflow experience', description: 'Relevant complexity and stakeholder context for this role.', weight: '10', approved: true },
      { job_id: operationsJob.id, name: 'Forecasting operations', description: 'Builds reliable forecasting and pipeline operating rhythms.', weight: '40', approved: false },
      { job_id: operationsJob.id, name: 'Cross-functional execution', description: 'Coordinates clear operating processes across teams.', weight: '35', approved: false },
      { job_id: operationsJob.id, name: 'Data quality', description: 'Creates durable definitions and quality checks for revenue data.', weight: '25', approved: false },
    ]).returning()

    const [maya, jordan, sam, elena] = await db.insert(candidates).values([
      { organization_id: organization.id, full_name: 'Maya Chen', email: 'maya.chen@example.com', phone: '+1 415 555 0142', source: 'gmail', resume_url: '', metadata: { intake_source_id: 'gmail-source-104' } },
      { organization_id: organization.id, full_name: 'Jordan Lee', email: 'jordan.lee@example.com', phone: '+1 206 555 0118', source: 'direct_upload', resume_url: '', metadata: { intake_source_id: 'upload-source-008' } },
      { organization_id: organization.id, full_name: 'Sam Okafor', email: 'sam.okafor@example.com', phone: '+1 312 555 0194', source: 'microsoft_outlook', resume_url: '', metadata: { intake_source_id: 'outlook-source-221' } },
      { organization_id: organization.id, full_name: 'Elena Petrov', email: 'elena.petrov@example.com', phone: '+1 646 555 0164', source: 'direct_upload', resume_url: '', metadata: { intake_source_id: 'upload-source-009' } },
    ]).returning()
    if (!maya || !jordan || !sam || !elena) return NextResponse.json({ success: false, error: 'Starter candidates could not be created' }, { status: 500 })

    const [mayaApplication, jordanApplication, samApplication, elenaApplication] = await db.insert(applications).values([
      { organization_id: organization.id, job_id: designJob.id, candidate_id: maya.id, status: 'active', stage: 'review', applied_at: new Date('2026-09-30T06:42:00Z'), metadata: { source_ids: ['gmail-source-104'] } },
      { organization_id: organization.id, job_id: designJob.id, candidate_id: jordan.id, status: 'active', stage: 'new', applied_at: new Date('2026-09-30T07:00:00Z'), metadata: { source_ids: ['upload-source-008'] } },
      { organization_id: organization.id, job_id: designJob.id, candidate_id: sam.id, status: 'active', stage: 'new', applied_at: new Date('2026-09-30T07:18:00Z'), metadata: { source_ids: ['outlook-source-221'] } },
      { organization_id: organization.id, job_id: designJob.id, candidate_id: elena.id, status: 'active', stage: 'needs_review', applied_at: new Date('2026-09-29T15:10:00Z'), metadata: { source_ids: ['upload-source-009'] } },
    ]).returning()

    await db.insert(documents).values([
      { organization_id: organization.id, application_id: mayaApplication.id, candidate_id: maya.id, doc_type: 'resume', file_name: 'maya-chen-resume.pdf', file_url: '', parsed_content: { parse_status: 'parsed', source_provider: 'gmail', source_id: 'gmail-source-104' } },
      { organization_id: organization.id, application_id: jordanApplication.id, candidate_id: jordan.id, doc_type: 'resume', file_name: 'jordan-lee-resume.pdf', file_url: '', parsed_content: { parse_status: 'parsed', source_provider: 'direct_upload', source_id: 'upload-source-008' } },
      { organization_id: organization.id, application_id: samApplication.id, candidate_id: sam.id, doc_type: 'resume', file_name: 'sam-okafor-resume.pdf', file_url: '', parsed_content: { parse_status: 'parsed', source_provider: 'microsoft_outlook', source_id: 'outlook-source-221' } },
      { organization_id: organization.id, application_id: elenaApplication.id, candidate_id: elena.id, doc_type: 'resume', file_name: 'elena-petrov-resume.pdf', file_url: '', parsed_content: { parse_status: 'parsed', source_provider: 'direct_upload', source_id: 'upload-source-009' } },
    ])

    const [mayaAssessment, jordanAssessment, samAssessment, elenaAssessment] = await db.insert(assessments).values([
      { organization_id: organization.id, application_id: mayaApplication.id, assessment_type: 'evidence_based_screening', status: 'completed', overall_score: '91', notes: 'High-confidence evidence; direct management scope remains uncertain.', assessed_by_user_id: userId },
      { organization_id: organization.id, application_id: jordanApplication.id, assessment_type: 'evidence_based_screening', status: 'completed', overall_score: '87', notes: 'Strong systems practice; B2B workflow context needs recruiter review.', assessed_by_user_id: userId },
      { organization_id: organization.id, application_id: samApplication.id, assessment_type: 'evidence_based_screening', status: 'completed', overall_score: '81', notes: 'One required criterion has partial evidence.', assessed_by_user_id: userId },
      { organization_id: organization.id, application_id: elenaApplication.id, assessment_type: 'evidence_based_screening', status: 'completed', overall_score: '78', notes: 'Required coverage cited; leadership evidence is limited.', assessed_by_user_id: userId },
    ]).returning()

    const designCriteria = criteria.filter((criterion) => criterion.job_id === designJob.id)
    const scoreRows = [
      { assessment_id: mayaAssessment.id, scores: ['4', '4', '4', '3', '4'] },
      { assessment_id: jordanAssessment.id, scores: ['4', '4', '3', '3', '3'] },
      { assessment_id: samAssessment.id, scores: ['3', '3', '3', '2', '2'] },
      { assessment_id: elenaAssessment.id, scores: ['3', '3', '3', '2', '2'] },
    ]
    await db.insert(criterion_scores).values(scoreRows.flatMap((row) => designCriteria.map((criterion, index) => ({ assessment_id: row.assessment_id, job_criterion_id: criterion.id, score: row.scores[index] ?? '0', notes: index < 3 ? 'Cited resume evidence available.' : 'Review missing or limited evidence; not proof of absence.' })))).returning()
    await db.insert(ranking_snapshots).values({ organization_id: organization.id, job_id: designJob.id, snapshot_data: { criteria_version_id: 'criteria-product-design-v3', ranking_snapshot_id: 'ranking-product-design-v3', candidate_assessment_ids: [mayaAssessment.id, jordanAssessment.id, samAssessment.id, elenaAssessment.id], autonomous_rejection: false }, generated_at: new Date('2026-09-30T08:45:00Z') })

    await db.insert(integration_connections).values([
      { organization_id: organization.id, provider: 'gmail', account_email: 'recruiting@northstar.co', status: 'healthy', connected_at: new Date('2026-09-28T09:00:00Z'), last_synced_at: new Date('2026-09-30T08:42:00Z'), provider_metadata: { scopes: ['mail.read'] } },
      { organization_id: organization.id, provider: 'microsoft_outlook', account_email: 'talent@northstar.co', status: 'healthy', connected_at: new Date('2026-09-28T09:12:00Z'), last_synced_at: new Date('2026-09-30T08:38:00Z'), provider_metadata: { scopes: ['mail.read'] } },
      { organization_id: organization.id, provider: 'googlecalendar', account_email: 'priya@northstar.co', status: 'healthy', connected_at: new Date('2026-09-28T09:20:00Z'), last_synced_at: new Date('2026-09-30T08:40:00Z'), provider_metadata: { scopes: ['calendar.read'] } },
      { organization_id: organization.id, provider: 'microsoft_calendar', account_email: 'alex@northstar.co', status: 'healthy', connected_at: new Date('2026-09-28T09:25:00Z'), last_synced_at: new Date('2026-09-30T08:41:00Z'), provider_metadata: { scopes: ['calendar.read'] } },
    ]).onConflictDoNothing({ target: [integration_connections.organization_id, integration_connections.provider] })

    const [draft] = await db.insert(interview_drafts).values({ organization_id: organization.id, application_id: mayaApplication.id, created_by_user_id: userId, status: 'draft', notes: 'Portfolio interview; explicit approval required before event creation.', metadata: { provider: 'both', approval_state: 'pending', scheduling_draft_id: 'draft-maya-portfolio-v1' } }).returning()
    const [firstSlot] = await db.insert(interview_slots).values({ interview_draft_id: draft.id, start_time: new Date('2026-10-06T17:30:00Z'), end_time: new Date('2026-10-06T18:30:00Z') }).returning()

    await db.insert(audit_events).values([
      { actor_user_id: userId, organization_id: organization.id, action: 'criteria_approved', entity_type: 'job', entity_id: designJob.id, details: { version: 'v3', required: 3, preferred: 2 } },
      { actor_user_id: userId, organization_id: organization.id, action: 'ranking_generated', entity_type: 'ranking_snapshot', entity_id: 'ranking-product-design-v3', details: { criteria_version_id: 'criteria-product-design-v3', candidates: 4, autonomous_rejection: false } },
      { actor_user_id: userId, organization_id: organization.id, action: 'inbox_sync_completed', entity_type: 'integration_connection', entity_id: 'integration-gmail', details: { source_provider: 'gmail', attachments_reviewed: 4 } },
      { actor_user_id: userId, organization_id: organization.id, action: 'slot_options_proposed', entity_type: 'interview_draft', entity_id: draft.id, details: { provider: 'google_and_microsoft', approval_state: 'pending', invitation_created: false, first_slot_id: firstSlot?.id ?? '' } },
    ])

    return NextResponse.json({ success: true, seeded: true, data: { organization_id: organization.id, job_id: designJob.id, candidate_ids: [maya.id, jordan.id, sam.id, elena.id], interview_draft_id: draft.id } })
  } catch (error) {
    console.error('[API] seed POST error:', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Starter workspace could not be created' }, { status: 400 })
  }
})
