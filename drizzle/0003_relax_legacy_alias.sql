ALTER TABLE "criterion_scores" DROP CONSTRAINT IF EXISTS "criterion_scores_criterion_id_job_criteria_id_fk";
ALTER TABLE "criterion_scores" ALTER COLUMN "criterion_id" DROP NOT NULL;
ALTER TABLE "criterion_scores" ALTER COLUMN "criterion_id" DROP DEFAULT;
