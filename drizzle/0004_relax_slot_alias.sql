ALTER TABLE "interview_slots" DROP CONSTRAINT IF EXISTS "interview_slots_draft_id_interview_drafts_id_fk";
ALTER TABLE "interview_slots" ALTER COLUMN "draft_id" DROP NOT NULL;
ALTER TABLE "interview_slots" ALTER COLUMN "draft_id" DROP DEFAULT;
