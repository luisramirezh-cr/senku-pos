ALTER TABLE "sales" ADD COLUMN "customer_name" text;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "discount" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "loyalty_points_redeemed" integer DEFAULT 0;