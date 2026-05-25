CREATE TABLE "business_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"business_type" text DEFAULT 'restaurant' NOT NULL,
	"has_table_management" boolean DEFAULT false NOT NULL,
	"country" text DEFAULT 'CR' NOT NULL,
	"tax_rate" integer DEFAULT 13 NOT NULL,
	"tax_name" text DEFAULT 'IVA' NOT NULL,
	"fiscal_enabled" boolean DEFAULT false NOT NULL,
	"fiscal_rnc" text,
	"onboarding_done" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_settings_business_id_unique" UNIQUE("business_id")
);
