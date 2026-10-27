CREATE TYPE "public"."administrative_appeal_status" AS ENUM('draft', 'review', 'approved', 'ready_to_file', 'filed', 'confirmed', 'decided', 'withdrawn', 'cancelled');
--> statement-breakpoint
CREATE TYPE "public"."administrative_body_type" AS ENUM('federal', 'state', 'municipal', 'autarchy', 'council', 'regulatory', 'administrative_court', 'other');
--> statement-breakpoint
CREATE TYPE "public"."administrative_data_source" AS ENUM('manual', 'document', 'import');
--> statement-breakpoint
CREATE TYPE "public"."administrative_deadline_status" AS ENUM('suggested', 'pending_confirmation', 'confirmed', 'completed', 'cancelled');
--> statement-breakpoint
CREATE TYPE "public"."administrative_priority" AS ENUM('low', 'normal', 'high', 'urgent');
--> statement-breakpoint
CREATE TYPE "public"."administrative_process_status" AS ENUM('draft', 'active', 'waiting_body', 'waiting_client', 'requirement_open', 'under_analysis', 'decided', 'appeal', 'suspended', 'closed', 'archived');
--> statement-breakpoint
CREATE TYPE "public"."administrative_protocol_source" AS ENUM('manual', 'document', 'import');
--> statement-breakpoint
CREATE TYPE "public"."administrative_request_status" AS ENUM('draft', 'review', 'approved', 'ready_to_submit', 'submitted', 'confirmed', 'rejected', 'cancelled');
--> statement-breakpoint
CREATE TYPE "public"."administrative_requirement_status" AS ENUM('open', 'in_progress', 'responded', 'accepted', 'not_applicable', 'cancelled', 'overdue');
--> statement-breakpoint
CREATE TYPE "public"."document_acl_permission" AS ENUM('read', 'download', 'upload_version', 'update_metadata', 'share', 'archive', 'delete');
--> statement-breakpoint
CREATE TYPE "public"."document_acl_principal_type" AS ENUM('user', 'membership', 'role', 'organization');
--> statement-breakpoint
CREATE TYPE "public"."document_confidentiality_level" AS ENUM('normal', 'restricted', 'confidential');
--> statement-breakpoint
CREATE TYPE "public"."document_owner_type" AS ENUM('organization', 'legal_matter', 'judicial_process', 'administrative_process', 'client', 'intake');
--> statement-breakpoint
CREATE TYPE "public"."document_scan_status" AS ENUM('not_configured', 'pending', 'clean', 'infected', 'error');
--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('draft', 'active', 'archived');
--> statement-breakpoint
CREATE TYPE "public"."document_version_status" AS ENUM('uploading', 'quarantined', 'available', 'rejected', 'failed');
--> statement-breakpoint
CREATE TABLE "administrative_appeals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"administrative_process_id" uuid NOT NULL,
	"parent_decision_id" uuid,
	"appeal_type" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"status" "administrative_appeal_status" DEFAULT 'draft' NOT NULL,
	"deadline_id" uuid,
	"filed_at" timestamp with time zone,
	"protocol_number" text,
	"source" "administrative_data_source" DEFAULT 'manual' NOT NULL,
	"document_id" uuid,
	"created_by_membership_id" uuid,
	"approved_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "administrative_bodies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text,
	"name" text NOT NULL,
	"acronym" text,
	"body_type" "administrative_body_type" DEFAULT 'other' NOT NULL,
	"jurisdiction" text DEFAULT 'other' NOT NULL,
	"state_code" text,
	"municipality_code" text,
	"parent_body_id" uuid,
	"source" text DEFAULT 'seed_dev' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "administrative_deadlines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"administrative_process_id" uuid NOT NULL,
	"requirement_id" uuid,
	"title" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"status" "administrative_deadline_status" DEFAULT 'suggested' NOT NULL,
	"calculation_source" text DEFAULT 'manual' NOT NULL,
	"calculation_notes" text,
	"confirmed_by_membership_id" uuid,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "administrative_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"administrative_process_id" uuid NOT NULL,
	"related_request_id" uuid,
	"decision_type" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"outcome" text,
	"decided_at" timestamp with time zone,
	"notified_at" timestamp with time zone,
	"source" "administrative_data_source" DEFAULT 'manual' NOT NULL,
	"source_reference" text,
	"document_id" uuid,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "administrative_process_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"administrative_process_id" uuid NOT NULL,
	"from_status" "administrative_process_status",
	"to_status" "administrative_process_status" NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"actor_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "administrative_process_timeline_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"administrative_process_id" uuid NOT NULL,
	"legal_matter_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" "administrative_data_source" DEFAULT 'manual' NOT NULL,
	"actor_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "administrative_processes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid NOT NULL,
	"administrative_body_id" uuid NOT NULL,
	"number" text,
	"normalized_number" text,
	"protocol_number" text,
	"protocol_date" timestamp with time zone,
	"protocol_source" "administrative_protocol_source",
	"protocol_reference" text,
	"external_reference" text,
	"subject" text NOT NULL,
	"description" text,
	"status" "administrative_process_status" DEFAULT 'draft' NOT NULL,
	"current_phase" text,
	"priority" "administrative_priority" DEFAULT 'normal' NOT NULL,
	"filed_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"last_activity_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"closure_reason" text,
	"closure_notes" text,
	"source" "administrative_data_source" DEFAULT 'manual' NOT NULL,
	"source_reference" text,
	"source_updated_at" timestamp with time zone,
	"responsible_membership_id" uuid,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "administrative_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"administrative_process_id" uuid NOT NULL,
	"request_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "administrative_request_status" DEFAULT 'draft' NOT NULL,
	"requested_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"protocol_number" text,
	"protocol_reference" text,
	"justification" text,
	"source" "administrative_data_source" DEFAULT 'manual' NOT NULL,
	"created_by_membership_id" uuid,
	"reviewed_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "administrative_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"administrative_process_id" uuid NOT NULL,
	"related_request_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"issued_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"status" "administrative_requirement_status" DEFAULT 'open' NOT NULL,
	"source" "administrative_data_source" DEFAULT 'manual' NOT NULL,
	"source_reference" text,
	"responded_at" timestamp with time zone,
	"response_summary" text,
	"responsible_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_acl_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"principal_type" "document_acl_principal_type" NOT NULL,
	"principal_id" uuid NOT NULL,
	"permission" "document_acl_permission" NOT NULL,
	"granted_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"parent_folder_id" uuid,
	"owner_type" "document_owner_type" NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"link_type" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_timeline_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"version_id" uuid,
	"actor_membership_id" uuid,
	"metadata" jsonb,
	"event_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"storage_provider" text NOT NULL,
	"storage_key" text NOT NULL,
	"original_filename" text NOT NULL,
	"safe_filename" text NOT NULL,
	"mime_type_declared" text NOT NULL,
	"mime_type_detected" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"etag" text,
	"status" "document_version_status" DEFAULT 'uploading' NOT NULL,
	"scan_status" "document_scan_status" DEFAULT 'not_configured' NOT NULL,
	"scan_provider" text,
	"scan_result" text,
	"idempotency_key" text,
	"uploaded_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"owner_type" "document_owner_type" NOT NULL,
	"owner_id" uuid NOT NULL,
	"category_id" uuid,
	"folder_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"status" "document_status" DEFAULT 'active' NOT NULL,
	"confidentiality_level" "document_confidentiality_level" DEFAULT 'normal' NOT NULL,
	"current_version_id" uuid,
	"metadata" jsonb,
	"retention_until" timestamp with time zone,
	"legal_hold" boolean DEFAULT false NOT NULL,
	"created_by_membership_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "administrative_appeals" ADD CONSTRAINT "administrative_appeals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "administrative_appeals" ADD CONSTRAINT "administrative_appeals_administrative_process_id_administrative_processes_id_fk" FOREIGN KEY ("administrative_process_id") REFERENCES "public"."administrative_processes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "administrative_appeals" ADD CONSTRAINT "administrative_appeals_parent_decision_id_administrative_decisions_id_fk" FOREIGN KEY ("parent_decision_id") REFERENCES "public"."administrative_decisions"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "administrative_appeals" ADD CONSTRAINT "administrative_appeals_deadline_id_administrative_deadlines_id_fk" FOREIGN KEY ("deadline_id") REFERENCES "public"."administrative_deadlines"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "administrative_appeals" ADD CONSTRAINT "administrative_appeals_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "administrative_appeals" ADD CONSTRAINT "administrative_appeals_approved_by_membership_id_organization_members_id_fk" FOREIGN KEY ("approved_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "administrative_deadlines" ADD CONSTRAINT "administrative_deadlines_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "administrative_deadlines" ADD CONSTRAINT "administrative_deadlines_administrative_process_id_administrative_processes_id_fk" FOREIGN KEY ("administrative_process_id") REFERENCES "public"."administrative_processes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "administrative_deadlines" ADD CONSTRAINT "administrative_deadlines_requirement_id_administrative_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."administrative_requirements"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "administrative_deadlines" ADD CONSTRAINT "administrative_deadlines_confirmed_by_membership_id_organization_members_id_fk" FOREIGN KEY ("confirmed_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "administrative_decisions" ADD CONSTRAINT "administrative_decisions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "administrative_decisions" ADD CONSTRAINT "administrative_decisions_administrative_process_id_administrative_processes_id_fk" FOREIGN KEY ("administrative_process_id") REFERENCES "public"."administrative_processes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "administrative_decisions" ADD CONSTRAINT "administrative_decisions_related_request_id_administrative_requests_id_fk" FOREIGN KEY ("related_request_id") REFERENCES "public"."administrative_requests"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "administrative_decisions" ADD CONSTRAINT "administrative_decisions_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "administrative_process_status_history" ADD CONSTRAINT "administrative_process_status_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "administrative_process_status_history" ADD CONSTRAINT "administrative_process_status_history_administrative_process_id_administrative_processes_id_fk" FOREIGN KEY ("administrative_process_id") REFERENCES "public"."administrative_processes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "administrative_process_status_history" ADD CONSTRAINT "administrative_process_status_history_actor_membership_id_organization_members_id_fk" FOREIGN KEY ("actor_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "administrative_process_timeline_events" ADD CONSTRAINT "administrative_process_timeline_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "administrative_process_timeline_events" ADD CONSTRAINT "administrative_process_timeline_events_administrative_process_id_administrative_processes_id_fk" FOREIGN KEY ("administrative_process_id") REFERENCES "public"."administrative_processes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "administrative_process_timeline_events" ADD CONSTRAINT "administrative_process_timeline_events_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "administrative_process_timeline_events" ADD CONSTRAINT "administrative_process_timeline_events_actor_membership_id_organization_members_id_fk" FOREIGN KEY ("actor_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "administrative_processes" ADD CONSTRAINT "administrative_processes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "administrative_processes" ADD CONSTRAINT "administrative_processes_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "administrative_processes" ADD CONSTRAINT "administrative_processes_administrative_body_id_administrative_bodies_id_fk" FOREIGN KEY ("administrative_body_id") REFERENCES "public"."administrative_bodies"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "administrative_processes" ADD CONSTRAINT "administrative_processes_responsible_membership_id_organization_members_id_fk" FOREIGN KEY ("responsible_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "administrative_processes" ADD CONSTRAINT "administrative_processes_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "administrative_requests" ADD CONSTRAINT "administrative_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "administrative_requests" ADD CONSTRAINT "administrative_requests_administrative_process_id_administrative_processes_id_fk" FOREIGN KEY ("administrative_process_id") REFERENCES "public"."administrative_processes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "administrative_requests" ADD CONSTRAINT "administrative_requests_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "administrative_requests" ADD CONSTRAINT "administrative_requests_reviewed_by_membership_id_organization_members_id_fk" FOREIGN KEY ("reviewed_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "administrative_requirements" ADD CONSTRAINT "administrative_requirements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "administrative_requirements" ADD CONSTRAINT "administrative_requirements_administrative_process_id_administrative_processes_id_fk" FOREIGN KEY ("administrative_process_id") REFERENCES "public"."administrative_processes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "administrative_requirements" ADD CONSTRAINT "administrative_requirements_related_request_id_administrative_requests_id_fk" FOREIGN KEY ("related_request_id") REFERENCES "public"."administrative_requests"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "administrative_requirements" ADD CONSTRAINT "administrative_requirements_responsible_membership_id_organization_members_id_fk" FOREIGN KEY ("responsible_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_acl_entries" ADD CONSTRAINT "document_acl_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_acl_entries" ADD CONSTRAINT "document_acl_entries_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_acl_entries" ADD CONSTRAINT "document_acl_entries_granted_by_membership_id_organization_members_id_fk" FOREIGN KEY ("granted_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_categories" ADD CONSTRAINT "document_categories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_folders" ADD CONSTRAINT "document_folders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_folders" ADD CONSTRAINT "document_folders_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_timeline_events" ADD CONSTRAINT "document_timeline_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_timeline_events" ADD CONSTRAINT "document_timeline_events_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_timeline_events" ADD CONSTRAINT "document_timeline_events_actor_membership_id_organization_members_id_fk" FOREIGN KEY ("actor_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_uploaded_by_membership_id_organization_members_id_fk" FOREIGN KEY ("uploaded_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_category_id_document_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."document_categories"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_folder_id_document_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."document_folders"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "administrative_appeals_process_idx" ON "administrative_appeals" USING btree ("administrative_process_id");
--> statement-breakpoint
CREATE INDEX "administrative_appeals_org_idx" ON "administrative_appeals" USING btree ("organization_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "administrative_bodies_name_unique" ON "administrative_bodies" USING btree ("name");
--> statement-breakpoint
CREATE INDEX "administrative_bodies_parent_idx" ON "administrative_bodies" USING btree ("parent_body_id");
--> statement-breakpoint
CREATE INDEX "administrative_bodies_code_idx" ON "administrative_bodies" USING btree ("code");
--> statement-breakpoint
CREATE INDEX "administrative_deadlines_process_idx" ON "administrative_deadlines" USING btree ("administrative_process_id");
--> statement-breakpoint
CREATE INDEX "administrative_deadlines_org_idx" ON "administrative_deadlines" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "administrative_decisions_process_idx" ON "administrative_decisions" USING btree ("administrative_process_id");
--> statement-breakpoint
CREATE INDEX "administrative_decisions_org_idx" ON "administrative_decisions" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "administrative_process_status_history_process_idx" ON "administrative_process_status_history" USING btree ("administrative_process_id","changed_at");
--> statement-breakpoint
CREATE INDEX "administrative_process_timeline_process_idx" ON "administrative_process_timeline_events" USING btree ("administrative_process_id","occurred_at");
--> statement-breakpoint
CREATE INDEX "administrative_process_timeline_matter_idx" ON "administrative_process_timeline_events" USING btree ("legal_matter_id","occurred_at");
--> statement-breakpoint
CREATE INDEX "administrative_process_timeline_org_idx" ON "administrative_process_timeline_events" USING btree ("organization_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "administrative_processes_org_number_unique" ON "administrative_processes" USING btree ("organization_id","normalized_number") WHERE "administrative_processes"."normalized_number" is not null;
--> statement-breakpoint
CREATE INDEX "administrative_processes_org_idx" ON "administrative_processes" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "administrative_processes_matter_idx" ON "administrative_processes" USING btree ("legal_matter_id");
--> statement-breakpoint
CREATE INDEX "administrative_processes_org_status_idx" ON "administrative_processes" USING btree ("organization_id","status");
--> statement-breakpoint
CREATE INDEX "administrative_processes_body_idx" ON "administrative_processes" USING btree ("administrative_body_id");
--> statement-breakpoint
CREATE INDEX "administrative_requests_process_idx" ON "administrative_requests" USING btree ("administrative_process_id");
--> statement-breakpoint
CREATE INDEX "administrative_requests_org_idx" ON "administrative_requests" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "administrative_requirements_process_idx" ON "administrative_requirements" USING btree ("administrative_process_id");
--> statement-breakpoint
CREATE INDEX "administrative_requirements_org_idx" ON "administrative_requirements" USING btree ("organization_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "document_acl_unique" ON "document_acl_entries" USING btree ("document_id","principal_type","principal_id","permission");
--> statement-breakpoint
CREATE INDEX "document_acl_org_idx" ON "document_acl_entries" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "document_acl_document_idx" ON "document_acl_entries" USING btree ("document_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "document_categories_org_slug_unique" ON "document_categories" USING btree ("organization_id","slug");
--> statement-breakpoint
CREATE INDEX "document_categories_org_idx" ON "document_categories" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "document_folders_org_idx" ON "document_folders" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "document_folders_parent_idx" ON "document_folders" USING btree ("parent_folder_id");
--> statement-breakpoint
CREATE INDEX "document_folders_owner_idx" ON "document_folders" USING btree ("organization_id","owner_type","owner_id");
--> statement-breakpoint
CREATE INDEX "document_links_org_idx" ON "document_links" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "document_links_document_idx" ON "document_links" USING btree ("document_id");
--> statement-breakpoint
CREATE INDEX "document_links_target_idx" ON "document_links" USING btree ("organization_id","target_type","target_id");
--> statement-breakpoint
CREATE INDEX "document_timeline_document_idx" ON "document_timeline_events" USING btree ("document_id");
--> statement-breakpoint
CREATE INDEX "document_timeline_event_at_idx" ON "document_timeline_events" USING btree ("document_id","event_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "document_versions_doc_version_unique" ON "document_versions" USING btree ("document_id","version_number");
--> statement-breakpoint
CREATE INDEX "document_versions_idempotency_idx" ON "document_versions" USING btree ("organization_id","document_id","idempotency_key");
--> statement-breakpoint
CREATE INDEX "document_versions_org_idx" ON "document_versions" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "document_versions_document_idx" ON "document_versions" USING btree ("document_id");
--> statement-breakpoint
CREATE INDEX "document_versions_sha256_idx" ON "document_versions" USING btree ("organization_id","sha256");
--> statement-breakpoint
CREATE INDEX "documents_org_idx" ON "documents" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "documents_owner_idx" ON "documents" USING btree ("organization_id","owner_type","owner_id");
--> statement-breakpoint
CREATE INDEX "documents_org_status_idx" ON "documents" USING btree ("organization_id","status");
--> statement-breakpoint
CREATE INDEX "documents_category_idx" ON "documents" USING btree ("category_id");
--> statement-breakpoint
CREATE INDEX "documents_folder_idx" ON "documents" USING btree ("folder_id");
