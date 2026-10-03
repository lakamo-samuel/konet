CREATE TABLE "staff_authenticators" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"secret_ciphertext" text,
	"pending_ciphertext" text,
	"pending_expires_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"last_used_step" integer,
	"recovery_hashes" text[] DEFAULT '{}' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "staff_mfa_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "staff_authenticators" ADD CONSTRAINT "staff_authenticators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;