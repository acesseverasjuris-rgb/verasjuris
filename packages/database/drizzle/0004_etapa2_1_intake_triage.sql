ALTER TYPE "public"."crm_resource_type" ADD VALUE 'intake';--> statement-breakpoint
CREATE TYPE "public"."crm_intake_status" AS ENUM('open', 'triage', 'waiting_client', 'under_review', 'qualified', 'not_qualified', 'converted', 'closed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."crm_triage_status" AS ENUM('draft', 'in_progress', 'waiting_information', 'ready_for_analysis', 'reviewed', 'closed');--> statement-breakpoint
CREATE TYPE "public"."crm_intake_urgency" AS ENUM('normal', 'attention', 'urgent', 'critical');--> statement-breakpoint
CREATE TYPE "public"."crm_intake_service_mode" AS ENUM('online', 'in_person', 'phone', 'video', 'message', 'other');--> statement-breakpoint
CREATE TYPE "public"."crm_intake_document_status" AS ENUM('pending', 'received', 'unavailable', 'rejected');--> statement-breakpoint
CREATE TABLE "legal_areas" (
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
CREATE TABLE "crm_intakes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"lead_id" uuid,
	"client_id" uuid,
	"contact_id" uuid,
	"created_by_membership_id" uuid,
	"responsible_membership_id" uuid,
	"source_id" uuid,
	"channel_id" uuid,
	"legal_area_id" uuid,
	"title" text NOT NULL,
	"summary" text,
	"service_mode" "crm_intake_service_mode" DEFAULT 'online' NOT NULL,
	"urgency" "crm_intake_urgency" DEFAULT 'normal' NOT NULL,
	"status" "crm_intake_status" DEFAULT 'open' NOT NULL,
	"preferred_contact_method" text,
	"external_reference" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"converted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_triages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"intake_id" uuid NOT NULL,
	"legal_area_id" uuid,
	"urgency" "crm_intake_urgency" DEFAULT 'normal' NOT NULL,
	"summary" text,
	"facts" text,
	"request_need" text,
	"relevant_dates" text,
	"risk_notes" text,
	"missing_information" text,
	"next_action" text,
	"responsible_membership_id" uuid,
	"status" "crm_triage_status" DEFAULT 'draft' NOT NULL,
	"created_by_membership_id" uuid,
	"reviewed_by_membership_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_intake_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"intake_id" uuid NOT NULL,
	"uploaded_by_user_id" uuid,
	"filename" text NOT NULL,
	"mime_type" text,
	"size_bytes" integer,
	"storage_key" text,
	"content_hash" text,
	"status" "crm_intake_document_status" DEFAULT 'pending' NOT NULL,
	"unavailable_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "legal_areas" ADD CONSTRAINT "legal_areas_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_intakes" ADD CONSTRAINT "crm_intakes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_intakes" ADD CONSTRAINT "crm_intakes_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_intakes" ADD CONSTRAINT "crm_intakes_client_id_crm_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."crm_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_intakes" ADD CONSTRAINT "crm_intakes_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_intakes" ADD CONSTRAINT "crm_intakes_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_intakes" ADD CONSTRAINT "crm_intakes_responsible_membership_id_organization_members_id_fk" FOREIGN KEY ("responsible_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_intakes" ADD CONSTRAINT "crm_intakes_source_id_crm_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."crm_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_intakes" ADD CONSTRAINT "crm_intakes_channel_id_crm_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."crm_channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_intakes" ADD CONSTRAINT "crm_intakes_legal_area_id_legal_areas_id_fk" FOREIGN KEY ("legal_area_id") REFERENCES "public"."legal_areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_triages" ADD CONSTRAINT "crm_triages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_triages" ADD CONSTRAINT "crm_triages_intake_id_crm_intakes_id_fk" FOREIGN KEY ("intake_id") REFERENCES "public"."crm_intakes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_triages" ADD CONSTRAINT "crm_triages_legal_area_id_legal_areas_id_fk" FOREIGN KEY ("legal_area_id") REFERENCES "public"."legal_areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_triages" ADD CONSTRAINT "crm_triages_responsible_membership_id_organization_members_id_fk" FOREIGN KEY ("responsible_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_triages" ADD CONSTRAINT "crm_triages_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_triages" ADD CONSTRAINT "crm_triages_reviewed_by_membership_id_organization_members_id_fk" FOREIGN KEY ("reviewed_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_intake_documents" ADD CONSTRAINT "crm_intake_documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_intake_documents" ADD CONSTRAINT "crm_intake_documents_intake_id_crm_intakes_id_fk" FOREIGN KEY ("intake_id") REFERENCES "public"."crm_intakes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_intake_documents" ADD CONSTRAINT "crm_intake_documents_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "legal_areas_org_slug_unique" ON "legal_areas" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "legal_areas_org_idx" ON "legal_areas" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "crm_intakes_org_idx" ON "crm_intakes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "crm_intakes_org_status_idx" ON "crm_intakes" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "crm_intakes_org_urgency_idx" ON "crm_intakes" USING btree ("organization_id","urgency");--> statement-breakpoint
CREATE INDEX "crm_intakes_org_responsible_idx" ON "crm_intakes" USING btree ("organization_id","responsible_membership_id");--> statement-breakpoint
CREATE INDEX "crm_intakes_org_legal_area_idx" ON "crm_intakes" USING btree ("organization_id","legal_area_id");--> statement-breakpoint
CREATE INDEX "crm_intakes_lead_idx" ON "crm_intakes" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "crm_intakes_client_idx" ON "crm_intakes" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_triages_intake_unique" ON "crm_triages" USING btree ("intake_id");--> statement-breakpoint
CREATE INDEX "crm_triages_org_idx" ON "crm_triages" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "crm_triages_org_status_idx" ON "crm_triages" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "crm_intake_documents_org_idx" ON "crm_intake_documents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "crm_intake_documents_intake_idx" ON "crm_intake_documents" USING btree ("intake_id");
