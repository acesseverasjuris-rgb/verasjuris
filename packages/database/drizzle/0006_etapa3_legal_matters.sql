CREATE TYPE "public"."legal_matter_status" AS ENUM('draft', 'open', 'active', 'waiting', 'suspended', 'closed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."legal_matter_priority" AS ENUM('normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."legal_matter_party_position" AS ENUM('client', 'opposing', 'interested', 'claimant', 'respondent', 'third_party', 'beneficiary', 'representative', 'other');--> statement-breakpoint
CREATE TYPE "public"."legal_matter_party_person_type" AS ENUM('person', 'organization', 'public_body', 'other');--> statement-breakpoint
CREATE TYPE "public"."legal_matter_team_role" AS ENUM('responsible', 'lawyer', 'collaborator', 'intern', 'paralegal', 'reviewer', 'coordinator', 'other');--> statement-breakpoint
CREATE TYPE "public"."legal_matter_fee_type" AS ENUM('fixed', 'success', 'percentage', 'hourly', 'monthly', 'hybrid', 'pro_bono', 'other');--> statement-breakpoint
CREATE TYPE "public"."legal_matter_fee_status" AS ENUM('draft', 'active', 'superseded', 'cancelled');--> statement-breakpoint
CREATE TABLE "legal_demand_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_subareas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_area_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_matter_sequences" (
	"organization_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"last_value" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "legal_cases" RENAME TO "legal_matters";--> statement-breakpoint
ALTER TABLE "legal_matters" ADD COLUMN "intake_id" uuid;--> statement-breakpoint
ALTER TABLE "legal_matters" ADD COLUMN "internal_reference" text;--> statement-breakpoint
ALTER TABLE "legal_matters" ADD COLUMN "demand_type_id" uuid;--> statement-breakpoint
ALTER TABLE "legal_matters" ADD COLUMN "legal_subarea_id" uuid;--> statement-breakpoint
ALTER TABLE "legal_matters" ADD COLUMN "priority" "legal_matter_priority" DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "legal_matters" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "legal_matters" ADD COLUMN "status_new" "legal_matter_status";--> statement-breakpoint
UPDATE "legal_matters" SET "status_new" = CASE
	WHEN "status"::text = 'on_hold' THEN 'waiting'::"legal_matter_status"
	WHEN "status"::text = 'open' THEN 'open'::"legal_matter_status"
	WHEN "status"::text = 'closed' THEN 'closed'::"legal_matter_status"
	WHEN "status"::text = 'archived' THEN 'archived'::"legal_matter_status"
	ELSE 'open'::"legal_matter_status"
END;--> statement-breakpoint
ALTER TABLE "legal_matters" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "legal_matters" RENAME COLUMN "status_new" TO "status";--> statement-breakpoint
ALTER TABLE "legal_matters" ALTER COLUMN "status" SET DEFAULT 'open'::"legal_matter_status";--> statement-breakpoint
ALTER TABLE "legal_matters" ALTER COLUMN "status" SET NOT NULL;--> statement-breakpoint
DROP TYPE "public"."legal_case_status";--> statement-breakpoint
UPDATE "legal_matters" SET "internal_reference" = 'VJ-LEGACY-' || upper(substring(replace("id"::text, '-', ''), 1, 8)) WHERE "internal_reference" IS NULL;--> statement-breakpoint
ALTER TABLE "legal_matters" ALTER COLUMN "internal_reference" SET NOT NULL;--> statement-breakpoint
CREATE TABLE "legal_matter_parties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid NOT NULL,
	"party_type" text DEFAULT 'party' NOT NULL,
	"position" "legal_matter_party_position" DEFAULT 'other' NOT NULL,
	"person_type" "legal_matter_party_person_type" DEFAULT 'person' NOT NULL,
	"client_id" uuid,
	"contact_id" uuid,
	"display_name" text NOT NULL,
	"document_normalized" text,
	"role_description" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_matter_team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"team_role" "legal_matter_team_role" DEFAULT 'collaborator' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"assigned_by_membership_id" uuid,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_matter_fee_arrangements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid NOT NULL,
	"type" "legal_matter_fee_type" NOT NULL,
	"fixed_amount_cents" integer,
	"percentage_basis_points" integer,
	"hourly_rate_cents" integer,
	"success_fee_basis_points" integer,
	"description" text,
	"status" "legal_matter_fee_status" DEFAULT 'active' NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_until" timestamp with time zone,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_matter_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_matter_timeline_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"actor_membership_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "legal_demand_types" ADD CONSTRAINT "legal_demand_types_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_subareas" ADD CONSTRAINT "legal_subareas_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_subareas" ADD CONSTRAINT "legal_subareas_legal_area_id_legal_areas_id_fk" FOREIGN KEY ("legal_area_id") REFERENCES "public"."legal_areas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_matter_sequences" ADD CONSTRAINT "legal_matter_sequences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_matters" ADD CONSTRAINT "legal_matters_intake_id_crm_intakes_id_fk" FOREIGN KEY ("intake_id") REFERENCES "public"."crm_intakes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_matters" ADD CONSTRAINT "legal_matters_demand_type_id_legal_demand_types_id_fk" FOREIGN KEY ("demand_type_id") REFERENCES "public"."legal_demand_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_matters" ADD CONSTRAINT "legal_matters_legal_subarea_id_legal_subareas_id_fk" FOREIGN KEY ("legal_subarea_id") REFERENCES "public"."legal_subareas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_matter_parties" ADD CONSTRAINT "legal_matter_parties_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_matter_parties" ADD CONSTRAINT "legal_matter_parties_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_matter_parties" ADD CONSTRAINT "legal_matter_parties_client_id_crm_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."crm_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_matter_parties" ADD CONSTRAINT "legal_matter_parties_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_matter_team_members" ADD CONSTRAINT "legal_matter_team_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_matter_team_members" ADD CONSTRAINT "legal_matter_team_members_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_matter_team_members" ADD CONSTRAINT "legal_matter_team_members_membership_id_organization_members_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."organization_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_matter_team_members" ADD CONSTRAINT "legal_matter_team_members_assigned_by_membership_id_organization_members_id_fk" FOREIGN KEY ("assigned_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_matter_fee_arrangements" ADD CONSTRAINT "legal_matter_fee_arrangements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_matter_fee_arrangements" ADD CONSTRAINT "legal_matter_fee_arrangements_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_matter_fee_arrangements" ADD CONSTRAINT "legal_matter_fee_arrangements_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_matter_tags" ADD CONSTRAINT "legal_matter_tags_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_matter_tags" ADD CONSTRAINT "legal_matter_tags_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_matter_tags" ADD CONSTRAINT "legal_matter_tags_tag_id_crm_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."crm_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_matter_timeline_events" ADD CONSTRAINT "legal_matter_timeline_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_matter_timeline_events" ADD CONSTRAINT "legal_matter_timeline_events_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_matter_timeline_events" ADD CONSTRAINT "legal_matter_timeline_events_actor_membership_id_organization_members_id_fk" FOREIGN KEY ("actor_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_opportunities" DROP CONSTRAINT "crm_opportunities_case_id_legal_cases_id_fk";--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_case_id_legal_matters_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."legal_matters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "legal_demand_types_org_slug_unique" ON "legal_demand_types" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "legal_demand_types_org_idx" ON "legal_demand_types" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_subareas_org_area_slug_unique" ON "legal_subareas" USING btree ("organization_id","legal_area_id","slug");--> statement-breakpoint
CREATE INDEX "legal_subareas_org_idx" ON "legal_subareas" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "legal_subareas_area_idx" ON "legal_subareas" USING btree ("legal_area_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_matter_sequences_org_year_unique" ON "legal_matter_sequences" USING btree ("organization_id","year");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_matters_org_ref_unique" ON "legal_matters" USING btree ("organization_id","internal_reference");--> statement-breakpoint
ALTER INDEX IF EXISTS "legal_cases_org_idx" RENAME TO "legal_matters_org_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "legal_cases_client_idx" RENAME TO "legal_matters_client_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "legal_cases_opportunity_idx" RENAME TO "legal_matters_opportunity_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "legal_cases_org_status_idx";--> statement-breakpoint
CREATE INDEX "legal_matters_org_status_idx" ON "legal_matters" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "legal_matters_responsible_idx" ON "legal_matters" USING btree ("organization_id","responsible_membership_id");--> statement-breakpoint
CREATE INDEX "legal_matter_parties_org_idx" ON "legal_matter_parties" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "legal_matter_parties_matter_idx" ON "legal_matter_parties" USING btree ("legal_matter_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_matter_team_matter_member_unique" ON "legal_matter_team_members" USING btree ("legal_matter_id","membership_id");--> statement-breakpoint
CREATE INDEX "legal_matter_team_org_idx" ON "legal_matter_team_members" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "legal_matter_fees_org_idx" ON "legal_matter_fee_arrangements" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "legal_matter_fees_matter_idx" ON "legal_matter_fee_arrangements" USING btree ("legal_matter_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_matter_tags_unique" ON "legal_matter_tags" USING btree ("legal_matter_id","tag_id");--> statement-breakpoint
CREATE INDEX "legal_matter_tags_org_idx" ON "legal_matter_tags" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "legal_matter_timeline_matter_idx" ON "legal_matter_timeline_events" USING btree ("legal_matter_id","occurred_at");--> statement-breakpoint
CREATE INDEX "legal_matter_timeline_org_idx" ON "legal_matter_timeline_events" USING btree ("organization_id");
