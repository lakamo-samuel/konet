CREATE TABLE "uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"purpose" varchar(30) NOT NULL,
	"content_type" varchar(100) NOT NULL,
	"expected_bytes" integer NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"asset_id" text,
	"version" integer,
	"expires_at" timestamp with time zone NOT NULL,
	"retain_until" timestamp with time zone NOT NULL,
	"verification_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"verification_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"university_id" uuid NOT NULL,
	"campus_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"verification_id" uuid NOT NULL,
	"actor_id" uuid,
	"decision" varchar(40) NOT NULL,
	"reason" text NOT NULL,
	"source" varchar(30) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student_verifications" ADD COLUMN "university_id" uuid;--> statement-breakpoint
ALTER TABLE "student_verifications" ADD COLUMN "campus_id" uuid;--> statement-breakpoint
ALTER TABLE "student_verifications" ADD COLUMN "verified_email" varchar(255);--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_verification_id_student_verifications_id_fk" FOREIGN KEY ("verification_id") REFERENCES "public"."student_verifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_challenges" ADD CONSTRAINT "verification_challenges_verification_id_student_verifications_id_fk" FOREIGN KEY ("verification_id") REFERENCES "public"."student_verifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_challenges" ADD CONSTRAINT "verification_challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_challenges" ADD CONSTRAINT "verification_challenges_university_id_universities_id_fk" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_challenges" ADD CONSTRAINT "verification_challenges_campus_id_campuses_id_fk" FOREIGN KEY ("campus_id") REFERENCES "public"."campuses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_decisions" ADD CONSTRAINT "verification_decisions_verification_id_student_verifications_id_fk" FOREIGN KEY ("verification_id") REFERENCES "public"."student_verifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_decisions" ADD CONSTRAINT "verification_decisions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "upload_object_key_uq" ON "uploads" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "upload_owner_idx" ON "uploads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_challenge_user_idx" ON "verification_challenges" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_decision_uq" ON "verification_decisions" USING btree ("verification_id");--> statement-breakpoint
ALTER TABLE "student_verifications" ADD CONSTRAINT "student_verifications_university_id_universities_id_fk" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_verifications" ADD CONSTRAINT "student_verifications_campus_id_campuses_id_fk" FOREIGN KEY ("campus_id") REFERENCES "public"."campuses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Preserve a single latest pending submission when upgrading legacy data.
UPDATE "student_verifications" SET "university_id" = u."university_id", "campus_id" = u."campus_id" FROM "users" u WHERE "student_verifications"."user_id" = u."id";
--> statement-breakpoint
WITH ranked AS (SELECT "id", row_number() OVER (PARTITION BY "user_id" ORDER BY "created_at" DESC, "id" DESC) AS position FROM "student_verifications" WHERE "status" = 'pending')
UPDATE "student_verifications" SET "status" = 'requires_more_information', "decided_at" = now() WHERE "id" IN (SELECT "id" FROM ranked WHERE position > 1);
--> statement-breakpoint
CREATE UNIQUE INDEX "student_verification_pending_uq" ON "student_verifications" USING btree ("user_id") WHERE "student_verifications"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "student_verified_email_uq" ON "student_verifications" USING btree ("verified_email") WHERE "student_verifications"."status" = 'verified';