CREATE TABLE "provider_evidence_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"verification_id" uuid NOT NULL,
	"upload_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"status" "verification_status" DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "provider_onboarding_steps" (
	"provider_id" uuid NOT NULL,
	"step" varchar(30) NOT NULL,
	"values" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_onboarding_steps_provider_id_step_pk" PRIMARY KEY("provider_id","step")
);
--> statement-breakpoint
CREATE TABLE "provider_review_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"resource_type" varchar(40) NOT NULL,
	"resource_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"decision" varchar(40) NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "provider_profiles" ADD COLUMN "review_status" varchar(40) DEFAULT 'not_submitted' NOT NULL;--> statement-breakpoint
ALTER TABLE "provider_profiles" ADD COLUMN "review_revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "provider_profiles" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "provider_profiles" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "provider_profiles" ADD COLUMN "review_reason" text;--> statement-breakpoint
ALTER TABLE "provider_profiles" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "provider_verifications" ADD COLUMN "revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "provider_verifications" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "provider_verifications" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "provider_verification_id" uuid;--> statement-breakpoint
ALTER TABLE "provider_evidence_submissions" ADD CONSTRAINT "provider_evidence_submissions_verification_id_provider_verifications_id_fk" FOREIGN KEY ("verification_id") REFERENCES "public"."provider_verifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_evidence_submissions" ADD CONSTRAINT "provider_evidence_submissions_upload_id_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."uploads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_onboarding_steps" ADD CONSTRAINT "provider_onboarding_steps_provider_id_provider_profiles_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_review_decisions" ADD CONSTRAINT "provider_review_decisions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "provider_evidence_revision_uq" ON "provider_evidence_submissions" USING btree ("verification_id","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_evidence_upload_uq" ON "provider_evidence_submissions" USING btree ("upload_id");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_review_decision_uq" ON "provider_review_decisions" USING btree ("resource_type","resource_id","revision");--> statement-breakpoint
CREATE INDEX "provider_review_resource_idx" ON "provider_review_decisions" USING btree ("resource_id");--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_provider_verification_id_provider_verifications_id_fk" FOREIGN KEY ("provider_verification_id") REFERENCES "public"."provider_verifications"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
-- Legacy approval flags have no private scanned evidence or review history.
-- Require a fresh documented review; keep suspended profiles suspended.
INSERT INTO "audit_events" ("action", "resource_type", "resource_id", "reason", "details")
SELECT 'provider_review.migration_reset', 'provider', "id", 'Fresh review required for the new provider approval workflow.', '{"source":"migration_0004"}'::jsonb
FROM "provider_profiles" WHERE "status" IN ('active', 'paused', 'pending_verification');
--> statement-breakpoint
UPDATE "provider_profiles" SET "status" = 'draft', "review_status" = 'not_submitted', "updated_at" = now() WHERE "status" IN ('active', 'paused', 'pending_verification');
--> statement-breakpoint
UPDATE "provider_verifications" SET "status" = 'requires_more_information', "reason" = 'Resubmit scanned evidence for documented staff review.', "decided_at" = now() WHERE "status" IN ('pending', 'verified');
