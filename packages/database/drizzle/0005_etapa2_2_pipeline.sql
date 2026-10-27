ALTER TYPE "public"."crm_resource_type" ADD VALUE 'opportunity';--> statement-breakpoint
ALTER TYPE "public"."crm_resource_type" ADD VALUE 'case';--> statement-breakpoint
CREATE TYPE "public"."crm_opportunity_stage" AS ENUM('lead', 'intake', 'triage', 'analysis', 'proposal', 'contracting', 'client', 'case', 'lost', 'archived');--> statement-breakpoint
CREATE TYPE "public"."crm_opportunity_status" AS ENUM('active', 'won', 'lost', 'archived');--> statement-breakpoint
CREATE TYPE "public"."crm_analysis_status" AS ENUM('draft', 'in_review', 'completed');--> statement-breakpoint
CREATE TYPE "public"."crm_proposal_status" AS ENUM('draft', 'internal_review', 'approved', 'sent', 'accepted', 'rejected', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."crm_engagement_status" AS ENUM('pending', 'ready', 'active', 'cancelled', 'declined');--> statement-breakpoint
CREATE TYPE "public"."legal_case_status" AS ENUM('open', 'on_hold', 'closed', 'archived');--> statement-breakpoint
CREATE TABLE "crm_loss_reasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"lead_id" uuid,
	"intake_id" uuid,
	"triage_id" uuid,
	"client_id" uuid,
	"case_id" uuid,
	"responsible_membership_id" uuid,
	"legal_area_id" uuid,
	"stage" "crm_opportunity_stage" DEFAULT 'lead' NOT NULL,
	"status" "crm_opportunity_status" DEFAULT 'active' NOT NULL,
	"title" text NOT NULL,
	"estimated_value_cents" integer,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"loss_reason_id" uuid,
	"loss_notes" text,
	"archived_at" timestamp with time zone,
	"archive_reason" text,
	"won_at" timestamp with time zone,
	"lost_at" timestamp with time zone,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"summary" text,
	"feasibility_notes" text,
	"risk_notes" text,
	"missing_information" text,
	"recommended_next_step" text,
	"responsible_membership_id" uuid,
	"status" "crm_analysis_status" DEFAULT 'draft' NOT NULL,
	"reviewed_at" timestamp with time zone,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"lead_id" uuid,
	"client_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"title" text NOT NULL,
	"scope" text,
	"exclusions" text,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"payment_terms" text,
	"validity_until" timestamp with time zone,
	"status" "crm_proposal_status" DEFAULT 'draft' NOT NULL,
	"created_by_membership_id" uuid,
	"approved_by_membership_id" uuid,
	"sent_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_engagements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"proposal_id" uuid,
	"client_id" uuid,
	"status" "crm_engagement_status" DEFAULT 'pending' NOT NULL,
	"contract_reference" text,
	"accepted_at" timestamp with time zone,
	"effective_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"originating_opportunity_id" uuid,
	"legal_area_id" uuid,
	"responsible_membership_id" uuid,
	"title" text NOT NULL,
	"summary" text,
	"status" "legal_case_status" DEFAULT 'open' NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crm_loss_reasons" ADD CONSTRAINT "crm_loss_reasons_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_intake_id_crm_intakes_id_fk" FOREIGN KEY ("intake_id") REFERENCES "public"."crm_intakes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_triage_id_crm_triages_id_fk" FOREIGN KEY ("triage_id") REFERENCES "public"."crm_triages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_client_id_crm_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."crm_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_responsible_membership_id_organization_members_id_fk" FOREIGN KEY ("responsible_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_legal_area_id_legal_areas_id_fk" FOREIGN KEY ("legal_area_id") REFERENCES "public"."legal_areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_loss_reason_id_crm_loss_reasons_id_fk" FOREIGN KEY ("loss_reason_id") REFERENCES "public"."crm_loss_reasons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_analyses" ADD CONSTRAINT "crm_analyses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_analyses" ADD CONSTRAINT "crm_analyses_opportunity_id_crm_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."crm_opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_analyses" ADD CONSTRAINT "crm_analyses_responsible_membership_id_organization_members_id_fk" FOREIGN KEY ("responsible_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_analyses" ADD CONSTRAINT "crm_analyses_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_proposals" ADD CONSTRAINT "crm_proposals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_proposals" ADD CONSTRAINT "crm_proposals_opportunity_id_crm_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."crm_opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_proposals" ADD CONSTRAINT "crm_proposals_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_proposals" ADD CONSTRAINT "crm_proposals_client_id_crm_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."crm_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_proposals" ADD CONSTRAINT "crm_proposals_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_proposals" ADD CONSTRAINT "crm_proposals_approved_by_membership_id_organization_members_id_fk" FOREIGN KEY ("approved_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_engagements" ADD CONSTRAINT "crm_engagements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_engagements" ADD CONSTRAINT "crm_engagements_opportunity_id_crm_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."crm_opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_engagements" ADD CONSTRAINT "crm_engagements_proposal_id_crm_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."crm_proposals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_engagements" ADD CONSTRAINT "crm_engagements_client_id_crm_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."crm_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_engagements" ADD CONSTRAINT "crm_engagements_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_cases" ADD CONSTRAINT "legal_cases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_cases" ADD CONSTRAINT "legal_cases_client_id_crm_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."crm_clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_cases" ADD CONSTRAINT "legal_cases_originating_opportunity_id_crm_opportunities_id_fk" FOREIGN KEY ("originating_opportunity_id") REFERENCES "public"."crm_opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_cases" ADD CONSTRAINT "legal_cases_legal_area_id_legal_areas_id_fk" FOREIGN KEY ("legal_area_id") REFERENCES "public"."legal_areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_cases" ADD CONSTRAINT "legal_cases_responsible_membership_id_organization_members_id_fk" FOREIGN KEY ("responsible_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_cases" ADD CONSTRAINT "legal_cases_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_case_id_legal_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."legal_cases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "crm_loss_reasons_org_slug_unique" ON "crm_loss_reasons" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "crm_loss_reasons_org_idx" ON "crm_loss_reasons" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "crm_opportunities_org_idx" ON "crm_opportunities" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "crm_opportunities_org_stage_idx" ON "crm_opportunities" USING btree ("organization_id","stage");--> statement-breakpoint
CREATE INDEX "crm_opportunities_org_status_idx" ON "crm_opportunities" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "crm_opportunities_org_responsible_idx" ON "crm_opportunities" USING btree ("organization_id","responsible_membership_id");--> statement-breakpoint
CREATE INDEX "crm_opportunities_lead_idx" ON "crm_opportunities" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "crm_opportunities_intake_idx" ON "crm_opportunities" USING btree ("intake_id");--> statement-breakpoint
CREATE INDEX "crm_opportunities_client_idx" ON "crm_opportunities" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_analyses_opportunity_unique" ON "crm_analyses" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "crm_analyses_org_idx" ON "crm_analyses" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_proposals_opportunity_version_unique" ON "crm_proposals" USING btree ("opportunity_id","version");--> statement-breakpoint
CREATE INDEX "crm_proposals_org_idx" ON "crm_proposals" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "crm_proposals_org_status_idx" ON "crm_proposals" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_engagements_opportunity_unique" ON "crm_engagements" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "crm_engagements_org_idx" ON "crm_engagements" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "legal_cases_org_idx" ON "legal_cases" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "legal_cases_org_status_idx" ON "legal_cases" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "legal_cases_client_idx" ON "legal_cases" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "legal_cases_opportunity_idx" ON "legal_cases" USING btree ("originating_opportunity_id");
