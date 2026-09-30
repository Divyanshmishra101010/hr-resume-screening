ALTER TABLE "job_criteria" ADD COLUMN IF NOT EXISTS "minimum_match" numeric DEFAULT '0' NOT NULL;
