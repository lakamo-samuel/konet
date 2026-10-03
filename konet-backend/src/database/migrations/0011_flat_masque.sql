ALTER TABLE "quotes" ADD COLUMN "commission_basis_points" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "platform_fee_minor" integer DEFAULT 0 NOT NULL;