CREATE TABLE "applications" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"candidate_id" text NOT NULL,
	"source" text DEFAULT 'direct_upload' NOT NULL,
	"stage" text DEFAULT 'new' NOT NULL,
	"disposition" text,
	"disposition_reason" text,
	"recruiter_override_reason" text,
	"owner_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"criteria_version_id" text NOT NULL,
	"model_version" text DEFAULT 'anthropic/claude-sonnet-4-6' NOT NULL,
	"overall_score" numeric(6, 2) DEFAULT '0' NOT NULL,
	"required_criteria_coverage" numeric(5, 4) DEFAULT '0' NOT NULL,
	"confidence" numeric(5, 4) DEFAULT '0' NOT NULL,
	"workflow_status" text DEFAULT 'human_review_required' NOT NULL,
	"ranking_explanation" text DEFAULT '' NOT NULL,
	"strengths" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"gaps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"run_at" timestamp DEFAULT now() NOT NULL,
	"owner_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"actor_type" text DEFAULT 'recruiter' NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"before_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"after_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"owner_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidates" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"display_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"normalized_email" text NOT NULL,
	"retention_state" text DEFAULT 'active' NOT NULL,
	"owner_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "criterion_scores" (
	"id" text PRIMARY KEY NOT NULL,
	"assessment_id" text NOT NULL,
	"criterion_id" text NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"evidence_excerpts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reasoning" text DEFAULT '' NOT NULL,
	"confidence" numeric(5, 4) DEFAULT '0' NOT NULL,
	"missing_evidence" boolean DEFAULT false NOT NULL,
	"uncertainty" text DEFAULT '' NOT NULL,
	"protected_attribute_excluded" boolean DEFAULT true NOT NULL,
	"owner_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"candidate_id" text,
	"job_id" text,
	"document_type" text DEFAULT 'resume' NOT NULL,
	"file_name" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text DEFAULT 'application/pdf' NOT NULL,
	"source_provider" text DEFAULT 'direct_upload' NOT NULL,
	"source_locator" text DEFAULT '' NOT NULL,
	"extracted_text" text DEFAULT '' NOT NULL,
	"parse_status" text DEFAULT 'not_run' NOT NULL,
	"owner_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"provider" text NOT NULL,
	"connection_ref" text NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'healthy' NOT NULL,
	"last_checked_at" timestamp,
	"health_message" text DEFAULT '' NOT NULL,
	"owner_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"provider" text DEFAULT 'both' NOT NULL,
	"interview_type" text DEFAULT 'Portfolio interview' NOT NULL,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"buffer_minutes" integer DEFAULT 15 NOT NULL,
	"date_range_start" date,
	"date_range_end" date,
	"working_hours_start" text DEFAULT '09:00' NOT NULL,
	"working_hours_end" text DEFAULT '16:00' NOT NULL,
	"time_zone" text DEFAULT 'America/Los_Angeles' NOT NULL,
	"participants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"candidate_availability_source" text DEFAULT 'recruiter_entered' NOT NULL,
	"approval_state" text DEFAULT 'pending' NOT NULL,
	"approval_reference" text DEFAULT '' NOT NULL,
	"selected_slot_id" text,
	"owner_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_slots" (
	"id" text PRIMARY KEY NOT NULL,
	"draft_id" text NOT NULL,
	"provider" text NOT NULL,
	"start_at" timestamp NOT NULL,
	"end_at" timestamp NOT NULL,
	"time_zone" text NOT NULL,
	"calendar_ids_checked" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"participant_availability_confirmed" boolean DEFAULT false NOT NULL,
	"freshness" text DEFAULT 'current' NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"owner_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interviews" (
	"id" text PRIMARY KEY NOT NULL,
	"draft_id" text NOT NULL,
	"application_id" text NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"event_title" text NOT NULL,
	"meeting_link" text DEFAULT '' NOT NULL,
	"message_id" text DEFAULT '' NOT NULL,
	"participants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"approved_by" text,
	"owner_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_criteria" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"label" text NOT NULL,
	"criterion_type" text DEFAULT 'required' NOT NULL,
	"weight" numeric(8, 2) DEFAULT '1' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"job_relevance_note" text DEFAULT '' NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"criteria_version_id" text,
	"owner_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"owner_id" text,
	"hiring_team" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"owner_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'recruiter' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"owner_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"retention_days" integer DEFAULT 365 NOT NULL,
	"owner_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ranking_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"criteria_version_id" text NOT NULL,
	"ordered_candidate_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"material_tie_breakers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ranking_explanation" text DEFAULT '' NOT NULL,
	"created_by" text,
	"owner_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "_users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criterion_scores" ADD CONSTRAINT "criterion_scores_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criterion_scores" ADD CONSTRAINT "criterion_scores_criterion_id_job_criteria_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."job_criteria"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_drafts" ADD CONSTRAINT "interview_drafts_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_slots" ADD CONSTRAINT "interview_slots_draft_id_interview_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."interview_drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_draft_id_interview_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."interview_drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_criteria" ADD CONSTRAINT "job_criteria_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ranking_snapshots" ADD CONSTRAINT "ranking_snapshots_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "applications_job_candidate_idx" ON "applications" USING btree ("job_id","candidate_id");--> statement-breakpoint
CREATE INDEX "applications_job_idx" ON "applications" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "applications_candidate_idx" ON "applications" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "applications_owner_idx" ON "applications" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "assessments_application_idx" ON "assessments" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "assessments_owner_idx" ON "assessments" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "audit_events_org_idx" ON "audit_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "audit_events_entity_idx" ON "audit_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_events_owner_idx" ON "audit_events" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "candidates_org_idx" ON "candidates" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "candidates_email_idx" ON "candidates" USING btree ("normalized_email");--> statement-breakpoint
CREATE INDEX "candidates_owner_idx" ON "candidates" USING btree ("owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "criterion_scores_assessment_criterion_idx" ON "criterion_scores" USING btree ("assessment_id","criterion_id");--> statement-breakpoint
CREATE INDEX "criterion_scores_owner_idx" ON "criterion_scores" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "documents_org_idx" ON "documents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "documents_candidate_idx" ON "documents" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "documents_job_idx" ON "documents" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "documents_owner_idx" ON "documents" USING btree ("owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_connections_org_provider_idx" ON "integration_connections" USING btree ("organization_id","provider");--> statement-breakpoint
CREATE INDEX "integration_connections_owner_idx" ON "integration_connections" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "interview_drafts_application_idx" ON "interview_drafts" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "interview_drafts_owner_idx" ON "interview_drafts" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "interview_slots_draft_idx" ON "interview_slots" USING btree ("draft_id");--> statement-breakpoint
CREATE INDEX "interview_slots_owner_idx" ON "interview_slots" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "interviews_draft_idx" ON "interviews" USING btree ("draft_id");--> statement-breakpoint
CREATE INDEX "interviews_application_idx" ON "interviews" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "interviews_owner_idx" ON "interviews" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "job_criteria_job_idx" ON "job_criteria" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_criteria_owner_idx" ON "job_criteria" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "jobs_org_idx" ON "jobs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "jobs_owner_idx" ON "jobs" USING btree ("owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_members_org_user_idx" ON "organization_members" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "organization_members_owner_idx" ON "organization_members" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "organization_members_org_idx" ON "organization_members" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_idx" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "organizations_owner_idx" ON "organizations" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "ranking_snapshots_job_idx" ON "ranking_snapshots" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "ranking_snapshots_owner_idx" ON "ranking_snapshots" USING btree ("owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "_users_email_unique" ON "_users" USING btree ("email");