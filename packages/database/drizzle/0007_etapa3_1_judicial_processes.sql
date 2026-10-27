CREATE TYPE "public"."judicial_process_status" AS ENUM('active', 'suspended', 'closed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."judicial_confidentiality_level" AS ENUM('public', 'restricted', 'secret');--> statement-breakpoint
CREATE TYPE "public"."judicial_data_source" AS ENUM('manual', 'document', 'court_provider', 'import');--> statement-breakpoint
CREATE TYPE "public"."court_branch" AS ENUM('constitutional', 'ordinary', 'labor', 'electoral', 'military', 'other');--> statement-breakpoint
CREATE TYPE "public"."court_jurisdiction_level" AS ENUM('supreme', 'superior', 'federal_regional', 'state', 'labor_regional', 'electoral_regional', 'military', 'other');--> statement-breakpoint
CREATE TYPE "public"."court_unit_type" AS ENUM('vara', 'turma', 'camara', 'secao', 'juizado', 'other');--> statement-breakpoint
CREATE TYPE "public"."judicial_party_procedural_role" AS ENUM('author', 'defendant', 'appellant', 'appellee', 'exequente', 'executado', 'impetrante', 'coatora', 'third_party', 'interested', 'other');--> statement-breakpoint
CREATE TYPE "public"."judicial_party_side" AS ENUM('active', 'passive', 'neutral', 'other');--> statement-breakpoint
CREATE TYPE "public"."judicial_lawyer_representation" AS ENUM('counsel', 'correspondent', 'public_defender', 'prosecutor', 'other');--> statement-breakpoint
CREATE TYPE "public"."judicial_hearing_type" AS ENUM('conciliation', 'instruction', 'judgment', 'una', 'other');--> statement-breakpoint
CREATE TYPE "public"."judicial_hearing_status" AS ENUM('scheduled', 'confirmed', 'rescheduled', 'held', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."judicial_hearing_location_type" AS ENUM('in_person', 'remote', 'hybrid', 'undetermined');--> statement-breakpoint
CREATE TYPE "public"."judicial_decision_type" AS ENUM('interlocutory', 'sentence', 'acordao', 'despacho', 'other');--> statement-breakpoint
CREATE TYPE "public"."judicial_appeal_status" AS ENUM('draft', 'planned', 'filed', 'pending', 'decided', 'withdrawn', 'not_filed');--> statement-breakpoint
CREATE TYPE "public"."judicial_enforcement_type" AS ENUM('compliance', 'execution', 'provisional', 'other');--> statement-breakpoint
CREATE TYPE "public"."judicial_enforcement_status" AS ENUM('planned', 'active', 'suspended', 'ended');--> statement-breakpoint
CREATE TABLE "courts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"acronym" text NOT NULL,
	"branch" "court_branch" DEFAULT 'ordinary' NOT NULL,
	"jurisdiction_level" "court_jurisdiction_level" DEFAULT 'state' NOT NULL,
	"state_code" text,
	"active" boolean DEFAULT true NOT NULL,
	"source" text DEFAULT 'seed_dev' NOT NULL,
	"source_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "judicial_districts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"state_code" text NOT NULL,
	"tribunal_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"source" text DEFAULT 'seed_dev' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "court_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tribunal_id" uuid NOT NULL,
	"code" text,
	"name" text NOT NULL,
	"unit_type" "court_unit_type" DEFAULT 'vara' NOT NULL,
	"district_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"source" text DEFAULT 'seed_dev' NOT NULL,
	"source_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "procedural_classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"source" text DEFAULT 'seed_dev' NOT NULL,
	"source_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "procedural_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text,
	"name" text NOT NULL,
	"parent_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"source" text DEFAULT 'seed_dev' NOT NULL,
	"source_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "judicial_phase_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"source" text DEFAULT 'seed_dev' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "judicial_processes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid NOT NULL,
	"cnj_number" text NOT NULL,
	"cnj_number_normalized" text NOT NULL,
	"tribunal_id" uuid NOT NULL,
	"court_unit_id" uuid,
	"court_unit_text" text,
	"district_id" uuid,
	"district_text" text,
	"procedural_class_id" uuid,
	"primary_subject_id" uuid,
	"status" "judicial_process_status" DEFAULT 'active' NOT NULL,
	"current_phase_id" uuid,
	"filing_date" timestamp with time zone,
	"distribution_date" timestamp with time zone,
	"confidentiality_level" "judicial_confidentiality_level" DEFAULT 'public' NOT NULL,
	"source" "judicial_data_source" DEFAULT 'manual' NOT NULL,
	"source_reference" text,
	"source_updated_at" timestamp with time zone,
	"last_movement_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"closure_reason" text,
	"closure_source" "judicial_data_source",
	"closure_notes" text,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "judicial_process_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"judicial_process_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "judicial_process_parties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"judicial_process_id" uuid NOT NULL,
	"matter_party_id" uuid,
	"client_id" uuid,
	"contact_id" uuid,
	"display_name" text NOT NULL,
	"document_normalized" text,
	"procedural_role" "judicial_party_procedural_role" DEFAULT 'other' NOT NULL,
	"side" "judicial_party_side" DEFAULT 'other' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "judicial_process_lawyers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"judicial_process_id" uuid NOT NULL,
	"party_id" uuid,
	"user_id" uuid,
	"professional_profile_id" uuid,
	"display_name" text NOT NULL,
	"oab_number" text,
	"oab_state" text,
	"oab_verification_status" text DEFAULT 'unverified' NOT NULL,
	"representation_type" "judicial_lawyer_representation" DEFAULT 'counsel' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"source" "judicial_data_source" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "judicial_process_phase_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"judicial_process_id" uuid NOT NULL,
	"phase_id" uuid NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"actor_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "judicial_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"judicial_process_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"sequence" integer,
	"title" text NOT NULL,
	"description" text,
	"movement_code" text,
	"source" "judicial_data_source" DEFAULT 'manual' NOT NULL,
	"source_reference" text,
	"captured_at" timestamp with time zone,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "judicial_hearings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"judicial_process_id" uuid NOT NULL,
	"type" "judicial_hearing_type" DEFAULT 'other' NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"location_type" "judicial_hearing_location_type" DEFAULT 'undetermined' NOT NULL,
	"location_text" text,
	"meeting_url" text,
	"status" "judicial_hearing_status" DEFAULT 'scheduled' NOT NULL,
	"notes" text,
	"result_summary" text,
	"source" "judicial_data_source" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "judicial_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"judicial_process_id" uuid NOT NULL,
	"decision_type" "judicial_decision_type" DEFAULT 'other' NOT NULL,
	"decided_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"title" text NOT NULL,
	"summary" text,
	"outcome" text,
	"source" "judicial_data_source" DEFAULT 'manual' NOT NULL,
	"source_reference" text,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "judicial_appeals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"judicial_process_id" uuid NOT NULL,
	"parent_decision_id" uuid,
	"appeal_type" text NOT NULL,
	"appellant_party_id" uuid,
	"appellee_party_id" uuid,
	"filed_at" timestamp with time zone,
	"protocol_reference" text,
	"status" "judicial_appeal_status" DEFAULT 'draft' NOT NULL,
	"result_decision_id" uuid,
	"source" "judicial_data_source" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "judicial_enforcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"judicial_process_id" uuid NOT NULL,
	"type" "judicial_enforcement_type" DEFAULT 'compliance' NOT NULL,
	"status" "judicial_enforcement_status" DEFAULT 'planned' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"summary" text,
	"source" "judicial_data_source" DEFAULT 'manual' NOT NULL,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "judicial_process_timeline_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"judicial_process_id" uuid NOT NULL,
	"legal_matter_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" "judicial_data_source" DEFAULT 'manual' NOT NULL,
	"actor_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "judicial_districts" ADD CONSTRAINT "judicial_districts_tribunal_id_courts_id_fk" FOREIGN KEY ("tribunal_id") REFERENCES "public"."courts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "court_units" ADD CONSTRAINT "court_units_tribunal_id_courts_id_fk" FOREIGN KEY ("tribunal_id") REFERENCES "public"."courts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "court_units" ADD CONSTRAINT "court_units_district_id_judicial_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."judicial_districts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_processes" ADD CONSTRAINT "judicial_processes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_processes" ADD CONSTRAINT "judicial_processes_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_processes" ADD CONSTRAINT "judicial_processes_tribunal_id_courts_id_fk" FOREIGN KEY ("tribunal_id") REFERENCES "public"."courts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_processes" ADD CONSTRAINT "judicial_processes_court_unit_id_court_units_id_fk" FOREIGN KEY ("court_unit_id") REFERENCES "public"."court_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_processes" ADD CONSTRAINT "judicial_processes_district_id_judicial_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."judicial_districts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_processes" ADD CONSTRAINT "judicial_processes_procedural_class_id_procedural_classes_id_fk" FOREIGN KEY ("procedural_class_id") REFERENCES "public"."procedural_classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_processes" ADD CONSTRAINT "judicial_processes_primary_subject_id_procedural_subjects_id_fk" FOREIGN KEY ("primary_subject_id") REFERENCES "public"."procedural_subjects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_processes" ADD CONSTRAINT "judicial_processes_current_phase_id_judicial_phase_catalog_id_fk" FOREIGN KEY ("current_phase_id") REFERENCES "public"."judicial_phase_catalog"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_processes" ADD CONSTRAINT "judicial_processes_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_process_subjects" ADD CONSTRAINT "judicial_process_subjects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_process_subjects" ADD CONSTRAINT "judicial_process_subjects_judicial_process_id_judicial_processes_id_fk" FOREIGN KEY ("judicial_process_id") REFERENCES "public"."judicial_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_process_subjects" ADD CONSTRAINT "judicial_process_subjects_subject_id_procedural_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."procedural_subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_process_parties" ADD CONSTRAINT "judicial_process_parties_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_process_parties" ADD CONSTRAINT "judicial_process_parties_judicial_process_id_judicial_processes_id_fk" FOREIGN KEY ("judicial_process_id") REFERENCES "public"."judicial_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_process_parties" ADD CONSTRAINT "judicial_process_parties_matter_party_id_legal_matter_parties_id_fk" FOREIGN KEY ("matter_party_id") REFERENCES "public"."legal_matter_parties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_process_parties" ADD CONSTRAINT "judicial_process_parties_client_id_crm_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."crm_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_process_parties" ADD CONSTRAINT "judicial_process_parties_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_process_lawyers" ADD CONSTRAINT "judicial_process_lawyers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_process_lawyers" ADD CONSTRAINT "judicial_process_lawyers_judicial_process_id_judicial_processes_id_fk" FOREIGN KEY ("judicial_process_id") REFERENCES "public"."judicial_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_process_lawyers" ADD CONSTRAINT "judicial_process_lawyers_party_id_judicial_process_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."judicial_process_parties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_process_lawyers" ADD CONSTRAINT "judicial_process_lawyers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_process_lawyers" ADD CONSTRAINT "judicial_process_lawyers_professional_profile_id_lawyer_profiles_user_id_fk" FOREIGN KEY ("professional_profile_id") REFERENCES "public"."lawyer_profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_process_phase_history" ADD CONSTRAINT "judicial_process_phase_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_process_phase_history" ADD CONSTRAINT "judicial_process_phase_history_judicial_process_id_judicial_processes_id_fk" FOREIGN KEY ("judicial_process_id") REFERENCES "public"."judicial_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_process_phase_history" ADD CONSTRAINT "judicial_process_phase_history_phase_id_judicial_phase_catalog_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."judicial_phase_catalog"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_process_phase_history" ADD CONSTRAINT "judicial_process_phase_history_actor_membership_id_organization_members_id_fk" FOREIGN KEY ("actor_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_movements" ADD CONSTRAINT "judicial_movements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_movements" ADD CONSTRAINT "judicial_movements_judicial_process_id_judicial_processes_id_fk" FOREIGN KEY ("judicial_process_id") REFERENCES "public"."judicial_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_movements" ADD CONSTRAINT "judicial_movements_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_hearings" ADD CONSTRAINT "judicial_hearings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_hearings" ADD CONSTRAINT "judicial_hearings_judicial_process_id_judicial_processes_id_fk" FOREIGN KEY ("judicial_process_id") REFERENCES "public"."judicial_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_decisions" ADD CONSTRAINT "judicial_decisions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_decisions" ADD CONSTRAINT "judicial_decisions_judicial_process_id_judicial_processes_id_fk" FOREIGN KEY ("judicial_process_id") REFERENCES "public"."judicial_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_decisions" ADD CONSTRAINT "judicial_decisions_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_appeals" ADD CONSTRAINT "judicial_appeals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_appeals" ADD CONSTRAINT "judicial_appeals_judicial_process_id_judicial_processes_id_fk" FOREIGN KEY ("judicial_process_id") REFERENCES "public"."judicial_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_appeals" ADD CONSTRAINT "judicial_appeals_parent_decision_id_judicial_decisions_id_fk" FOREIGN KEY ("parent_decision_id") REFERENCES "public"."judicial_decisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_appeals" ADD CONSTRAINT "judicial_appeals_appellant_party_id_judicial_process_parties_id_fk" FOREIGN KEY ("appellant_party_id") REFERENCES "public"."judicial_process_parties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_appeals" ADD CONSTRAINT "judicial_appeals_appellee_party_id_judicial_process_parties_id_fk" FOREIGN KEY ("appellee_party_id") REFERENCES "public"."judicial_process_parties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_appeals" ADD CONSTRAINT "judicial_appeals_result_decision_id_judicial_decisions_id_fk" FOREIGN KEY ("result_decision_id") REFERENCES "public"."judicial_decisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_enforcements" ADD CONSTRAINT "judicial_enforcements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_enforcements" ADD CONSTRAINT "judicial_enforcements_judicial_process_id_judicial_processes_id_fk" FOREIGN KEY ("judicial_process_id") REFERENCES "public"."judicial_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_enforcements" ADD CONSTRAINT "judicial_enforcements_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_process_timeline_events" ADD CONSTRAINT "judicial_process_timeline_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_process_timeline_events" ADD CONSTRAINT "judicial_process_timeline_events_judicial_process_id_judicial_processes_id_fk" FOREIGN KEY ("judicial_process_id") REFERENCES "public"."judicial_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_process_timeline_events" ADD CONSTRAINT "judicial_process_timeline_events_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judicial_process_timeline_events" ADD CONSTRAINT "judicial_process_timeline_events_actor_membership_id_organization_members_id_fk" FOREIGN KEY ("actor_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "courts_code_unique" ON "courts" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "courts_acronym_unique" ON "courts" USING btree ("acronym");--> statement-breakpoint
CREATE UNIQUE INDEX "judicial_districts_name_state_unique" ON "judicial_districts" USING btree ("name","state_code");--> statement-breakpoint
CREATE INDEX "judicial_districts_tribunal_idx" ON "judicial_districts" USING btree ("tribunal_id");--> statement-breakpoint
CREATE INDEX "court_units_tribunal_idx" ON "court_units" USING btree ("tribunal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "court_units_tribunal_name_unique" ON "court_units" USING btree ("tribunal_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "procedural_classes_name_unique" ON "procedural_classes" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "procedural_subjects_name_unique" ON "procedural_subjects" USING btree ("name");--> statement-breakpoint
CREATE INDEX "procedural_subjects_parent_idx" ON "procedural_subjects" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "judicial_phase_catalog_slug_unique" ON "judicial_phase_catalog" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "judicial_processes_org_cnj_unique" ON "judicial_processes" USING btree ("organization_id","cnj_number_normalized");--> statement-breakpoint
CREATE INDEX "judicial_processes_org_idx" ON "judicial_processes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "judicial_processes_matter_idx" ON "judicial_processes" USING btree ("legal_matter_id");--> statement-breakpoint
CREATE INDEX "judicial_processes_org_status_idx" ON "judicial_processes" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "judicial_processes_tribunal_idx" ON "judicial_processes" USING btree ("tribunal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "judicial_process_subjects_unique" ON "judicial_process_subjects" USING btree ("judicial_process_id","subject_id");--> statement-breakpoint
CREATE INDEX "judicial_process_subjects_org_idx" ON "judicial_process_subjects" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "judicial_process_parties_org_idx" ON "judicial_process_parties" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "judicial_process_parties_process_idx" ON "judicial_process_parties" USING btree ("judicial_process_id");--> statement-breakpoint
CREATE INDEX "judicial_process_lawyers_org_idx" ON "judicial_process_lawyers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "judicial_process_lawyers_process_idx" ON "judicial_process_lawyers" USING btree ("judicial_process_id");--> statement-breakpoint
CREATE INDEX "judicial_process_phase_history_process_idx" ON "judicial_process_phase_history" USING btree ("judicial_process_id","changed_at");--> statement-breakpoint
CREATE INDEX "judicial_movements_process_occurred_idx" ON "judicial_movements" USING btree ("judicial_process_id","occurred_at");--> statement-breakpoint
CREATE INDEX "judicial_movements_org_idx" ON "judicial_movements" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "judicial_hearings_process_idx" ON "judicial_hearings" USING btree ("judicial_process_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "judicial_hearings_org_idx" ON "judicial_hearings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "judicial_decisions_process_idx" ON "judicial_decisions" USING btree ("judicial_process_id");--> statement-breakpoint
CREATE INDEX "judicial_decisions_org_idx" ON "judicial_decisions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "judicial_appeals_process_idx" ON "judicial_appeals" USING btree ("judicial_process_id");--> statement-breakpoint
CREATE INDEX "judicial_appeals_org_idx" ON "judicial_appeals" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "judicial_enforcements_process_idx" ON "judicial_enforcements" USING btree ("judicial_process_id");--> statement-breakpoint
CREATE INDEX "judicial_enforcements_org_idx" ON "judicial_enforcements" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "judicial_process_timeline_process_idx" ON "judicial_process_timeline_events" USING btree ("judicial_process_id","occurred_at");--> statement-breakpoint
CREATE INDEX "judicial_process_timeline_matter_idx" ON "judicial_process_timeline_events" USING btree ("legal_matter_id","occurred_at");--> statement-breakpoint
CREATE INDEX "judicial_process_timeline_org_idx" ON "judicial_process_timeline_events" USING btree ("organization_id");
