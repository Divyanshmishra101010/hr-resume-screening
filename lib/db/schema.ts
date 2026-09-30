export { users } from 'lyzr-architect-pg/schema'

import {
  boolean,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  generateId,
} from 'lyzr-architect-pg/schema'

export const organizations = pgTable(
  'organizations',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    status: text('status').notNull().default('active'),
  },
  (t) => [uniqueIndex('organizations_slug_idx').on(t.slug), index('organizations_status_idx').on(t.status)],
)

export const organization_members = pgTable(
  'organization_members',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    organization_id: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('recruiter'),
    status: text('status').notNull().default('active'),
  },
  (t) => [index('organization_members_org_idx').on(t.organization_id), index('organization_members_org_role_idx').on(t.organization_id, t.role)],
)

export const jobs = pgTable(
  'jobs',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    organization_id: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    department: text('department'),
    location: text('location'),
    employment_type: text('employment_type'),
    status: text('status').notNull().default('open'),
    hiring_manager_user_id: text('hiring_manager_user_id'),
    recruiter_user_id: text('recruiter_user_id'),
    metadata: jsonb('metadata'),
  },
  (t) => [index('jobs_org_idx').on(t.organization_id), index('jobs_org_status_idx').on(t.organization_id, t.status)],
)

export const job_criteria = pgTable(
  'job_criteria',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    job_id: text('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    criterion_type: text('criterion_type').notNull().default('required'),
    minimum_match: numeric('minimum_match').notNull().default('0'),
    weight: numeric('weight').notNull().default('0'),
    description: text('description'),
    approved: boolean('approved').notNull().default(false),
  },
  (t) => [index('job_criteria_job_idx').on(t.job_id)],
)

export const candidates = pgTable(
  'candidates',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    organization_id: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    full_name: text('full_name').notNull(),
    email: text('email'),
    phone: text('phone'),
    source: text('source'),
    resume_url: text('resume_url'),
    metadata: jsonb('metadata'),
  },
  (t) => [index('candidates_org_idx').on(t.organization_id), index('candidates_email_idx').on(t.email)],
)

export const applications = pgTable(
  'applications',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    organization_id: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    job_id: text('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
    candidate_id: text('candidate_id').notNull().references(() => candidates.id, { onDelete: 'cascade' }),
    stage: text('stage').notNull().default('applied'),
    status: text('status').notNull().default('active'),
    applied_at: timestamp('applied_at', { withTimezone: true }),
    metadata: jsonb('metadata'),
  },
  (t) => [index('applications_org_idx').on(t.organization_id), index('applications_job_idx').on(t.job_id), index('applications_candidate_idx').on(t.candidate_id), index('applications_job_stage_idx').on(t.job_id, t.stage)],
)

export const documents = pgTable(
  'documents',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    organization_id: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    candidate_id: text('candidate_id').references(() => candidates.id, { onDelete: 'set null' }),
    application_id: text('application_id').references(() => applications.id, { onDelete: 'set null' }),
    doc_type: text('doc_type').notNull().default('resume'),
    file_url: text('file_url').notNull(),
    file_name: text('file_name'),
    parsed_content: jsonb('parsed_content'),
    parse_status: text('parse_status').notNull().default('pending'),
  },
  (t) => [index('documents_org_idx').on(t.organization_id), index('documents_candidate_idx').on(t.candidate_id), index('documents_application_idx').on(t.application_id)],
)

export const assessments = pgTable(
  'assessments',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    organization_id: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    application_id: text('application_id').notNull().references(() => applications.id, { onDelete: 'cascade' }),
    assessment_type: text('assessment_type'),
    status: text('status').notNull().default('pending'),
    overall_score: numeric('overall_score'),
    notes: text('notes'),
    assessed_by_user_id: text('assessed_by_user_id'),
  },
  (t) => [index('assessments_org_idx').on(t.organization_id), index('assessments_application_idx').on(t.application_id)],
)

export const criterion_scores = pgTable(
  'criterion_scores',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    assessment_id: text('assessment_id').notNull().references(() => assessments.id, { onDelete: 'cascade' }),
    job_criterion_id: text('job_criterion_id').notNull().references(() => job_criteria.id, { onDelete: 'cascade' }),
    score: numeric('score').notNull(),
    notes: text('notes'),
  },
  (t) => [index('criterion_scores_assessment_idx').on(t.assessment_id), index('criterion_scores_criterion_idx').on(t.job_criterion_id)],
)

export const ranking_snapshots = pgTable(
  'ranking_snapshots',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    organization_id: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    job_id: text('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
    snapshot_data: jsonb('snapshot_data').notNull().default({}),
    generated_at: timestamp('generated_at', { withTimezone: true }),
  },
  (t) => [index('ranking_snapshots_org_idx').on(t.organization_id), index('ranking_snapshots_job_idx').on(t.job_id)],
)

export const integration_connections = pgTable(
  'integration_connections',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    organization_id: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    status: text('status').notNull().default('disconnected'),
    account_email: text('account_email'),
    provider_metadata: jsonb('provider_metadata'),
    connected_at: timestamp('connected_at', { withTimezone: true }),
    last_synced_at: timestamp('last_synced_at', { withTimezone: true }),
  },
  (t) => [index('integration_connections_org_idx').on(t.organization_id), index('integration_connections_provider_status_idx').on(t.provider, t.status)],
)

export const interview_drafts = pgTable(
  'interview_drafts',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    organization_id: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    application_id: text('application_id').notNull().references(() => applications.id, { onDelete: 'cascade' }),
    created_by_user_id: text('created_by_user_id'),
    status: text('status').notNull().default('draft'),
    notes: text('notes'),
    metadata: jsonb('metadata'),
  },
  (t) => [index('interview_drafts_org_idx').on(t.organization_id), index('interview_drafts_application_idx').on(t.application_id)],
)

export const interview_slots = pgTable(
  'interview_slots',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    interview_draft_id: text('interview_draft_id').notNull().references(() => interview_drafts.id, { onDelete: 'cascade' }),
    start_time: timestamp('start_time', { withTimezone: true }).notNull(),
    end_time: timestamp('end_time', { withTimezone: true }).notNull(),
    status: text('status').notNull().default('proposed'),
  },
  (t) => [index('interview_slots_draft_idx').on(t.interview_draft_id)],
)

export const interviews = pgTable(
  'interviews',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    organization_id: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    application_id: text('application_id').notNull().references(() => applications.id, { onDelete: 'cascade' }),
    interview_draft_id: text('interview_draft_id'),
    interview_slot_id: text('interview_slot_id'),
    scheduled_start: timestamp('scheduled_start', { withTimezone: true }),
    scheduled_end: timestamp('scheduled_end', { withTimezone: true }),
    status: text('status').notNull().default('pending_approval'),
    location: text('location'),
    meeting_link: text('meeting_link'),
    calendar_event_id: text('calendar_event_id'),
    provider_metadata: jsonb('provider_metadata'),
  },
  (t) => [index('interviews_org_idx').on(t.organization_id), index('interviews_application_idx').on(t.application_id), index('interviews_org_status_idx').on(t.organization_id, t.status)],
)

export const audit_events = pgTable(
  'audit_events',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    organization_id: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    actor_user_id: text('actor_user_id'),
    entity_type: text('entity_type').notNull(),
    entity_id: text('entity_id'),
    action: text('action').notNull(),
    details: jsonb('details'),
    occurred_at: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_events_org_idx').on(t.organization_id), index('audit_events_org_occurred_idx').on(t.organization_id, t.occurred_at), index('audit_events_entity_idx').on(t.entity_type, t.entity_id)],
)
