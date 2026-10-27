CREATE TYPE "public"."profile_visibility" AS ENUM('public', 'organization', 'private', 'internal');--> statement-breakpoint
CREATE TYPE "public"."partner_category" AS ENUM('correspondent', 'accountant', 'expert', 'translator', 'dispatcher', 'teacher', 'specialist', 'supplier', 'other');--> statement-breakpoint
CREATE TYPE "public"."employee_status" AS ENUM('active', 'inactive', 'left');--> statement-breakpoint
CREATE TYPE "public"."crm_person_type" AS ENUM('person', 'organization');--> statement-breakpoint
CREATE TYPE "public"."crm_lead_status" AS ENUM('new', 'contacted', 'qualifying', 'qualified', 'unqualified', 'converted', 'archived');--> statement-breakpoint
CREATE TYPE "public"."crm_client_status" AS ENUM('active', 'inactive', 'archived');--> statement-breakpoint
CREATE TYPE "public"."crm_note_visibility" AS ENUM('organization', 'internal', 'private');--> statement-breakpoint
CREATE TYPE "public"."crm_interaction_type" AS ENUM('note', 'call', 'email', 'meeting', 'message', 'status_change', 'assignment', 'lead_conversion');--> statement-breakpoint
CREATE TYPE "public"."crm_interaction_origin" AS ENUM('manual', 'system', 'integration');--> statement-breakpoint
CREATE TYPE "public"."crm_resource_type" AS ENUM('lead', 'client', 'contact');--> statement-breakpoint
CREATE TABLE "lawyer_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"professional_name" text,
	"bio" text,
	"oab_number" text,
	"oab_uf" text,
	"oab_section" text,
	"oab_subsection" text,
	"inscription_date" timestamp with time zone,
	"declared_situation" text,
	"practice_areas" text,
	"languages" text,
	"remote_available" boolean DEFAULT false NOT NULL,
	"in_person_available" boolean DEFAULT false NOT NULL,
	"service_regions" text,
	"visibility" "profile_visibility" DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"category" "partner_category" DEFAULT 'other' NOT NULL,
	"presentation" text,
	"services" text,
	"regions" text,
	"remote_available" boolean DEFAULT false NOT NULL,
	"in_person_available" boolean DEFAULT false NOT NULL,
	"availability_notes" text,
	"public_info" text,
	"internal_info" text,
	"operational_status" text DEFAULT 'active' NOT NULL,
	"visibility" "profile_visibility" DEFAULT 'organization' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"membership_id" uuid,
	"job_title" text NOT NULL,
	"department" text,
	"internal_code" text,
	"manager_user_id" uuid,
	"started_at" timestamp with time zone,
	"status" "employee_status" DEFAULT 'active' NOT NULL,
	"internal_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_client_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"crm_client_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"color" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"person_type" "crm_person_type" DEFAULT 'person' NOT NULL,
	"name" text NOT NULL,
	"trade_name" text,
	"email" text,
	"phone" text,
	"summary" text,
	"status" "crm_lead_status" DEFAULT 'new' NOT NULL,
	"source_id" uuid,
	"channel_id" uuid,
	"owner_membership_id" uuid,
	"created_by_user_id" uuid,
	"converted_at" timestamp with time zone,
	"converted_client_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"person_type" "crm_person_type" NOT NULL,
	"status" "crm_client_status" DEFAULT 'active' NOT NULL,
	"full_name" text,
	"social_name" text,
	"cpf_normalized" text,
	"birth_date" timestamp with time zone,
	"legal_name" text,
	"trade_name" text,
	"cnpj_normalized" text,
	"website" text,
	"email" text,
	"phone" text,
	"notes" text,
	"source_id" uuid,
	"channel_id" uuid,
	"owner_membership_id" uuid,
	"created_by_user_id" uuid,
	"converted_from_lead_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"lead_id" uuid,
	"client_id" uuid,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"job_title" text,
	"notes" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"contact_preferences" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_lead_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_client_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"author_membership_id" uuid,
	"resource_type" "crm_resource_type" NOT NULL,
	"resource_id" uuid NOT NULL,
	"content" text NOT NULL,
	"visibility" "crm_note_visibility" DEFAULT 'organization' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"resource_type" "crm_resource_type" NOT NULL,
	"resource_id" uuid NOT NULL,
	"type" "crm_interaction_type" NOT NULL,
	"origin" "crm_interaction_origin" DEFAULT 'manual' NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"actor_user_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lawyer_profiles" ADD CONSTRAINT "lawyer_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_profiles" ADD CONSTRAINT "partner_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_membership_id_organization_members_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_manager_user_id_users_id_fk" FOREIGN KEY ("manager_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_client_users" ADD CONSTRAINT "organization_client_users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_client_users" ADD CONSTRAINT "organization_client_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_sources" ADD CONSTRAINT "crm_sources_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_channels" ADD CONSTRAINT "crm_channels_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tags" ADD CONSTRAINT "crm_tags_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tags" ADD CONSTRAINT "crm_tags_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_source_id_crm_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."crm_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_channel_id_crm_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."crm_channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_owner_membership_id_organization_members_id_fk" FOREIGN KEY ("owner_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_clients" ADD CONSTRAINT "crm_clients_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_clients" ADD CONSTRAINT "crm_clients_source_id_crm_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."crm_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_clients" ADD CONSTRAINT "crm_clients_channel_id_crm_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."crm_channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_clients" ADD CONSTRAINT "crm_clients_owner_membership_id_organization_members_id_fk" FOREIGN KEY ("owner_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_clients" ADD CONSTRAINT "crm_clients_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_clients" ADD CONSTRAINT "crm_clients_converted_from_lead_id_crm_leads_id_fk" FOREIGN KEY ("converted_from_lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_client_users" ADD CONSTRAINT "organization_client_users_crm_client_id_crm_clients_id_fk" FOREIGN KEY ("crm_client_id") REFERENCES "public"."crm_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_converted_client_id_crm_clients_id_fk" FOREIGN KEY ("converted_client_id") REFERENCES "public"."crm_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_client_id_crm_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."crm_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_lead_tags" ADD CONSTRAINT "crm_lead_tags_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_lead_tags" ADD CONSTRAINT "crm_lead_tags_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_lead_tags" ADD CONSTRAINT "crm_lead_tags_tag_id_crm_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."crm_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_client_tags" ADD CONSTRAINT "crm_client_tags_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_client_tags" ADD CONSTRAINT "crm_client_tags_client_id_crm_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."crm_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_client_tags" ADD CONSTRAINT "crm_client_tags_tag_id_crm_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."crm_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_notes" ADD CONSTRAINT "crm_notes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_notes" ADD CONSTRAINT "crm_notes_author_membership_id_organization_members_id_fk" FOREIGN KEY ("author_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_interactions" ADD CONSTRAINT "crm_interactions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_interactions" ADD CONSTRAINT "crm_interactions_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "employee_profiles_org_user_unique" ON "employee_profiles" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "employee_profiles_org_idx" ON "employee_profiles" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "employee_profiles_user_idx" ON "employee_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_client_users_org_user_unique" ON "organization_client_users" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "organization_client_users_org_idx" ON "organization_client_users" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_sources_org_key_unique" ON "crm_sources" USING btree ("organization_id","key");--> statement-breakpoint
CREATE INDEX "crm_sources_org_idx" ON "crm_sources" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_channels_org_key_unique" ON "crm_channels" USING btree ("organization_id","key");--> statement-breakpoint
CREATE INDEX "crm_channels_org_idx" ON "crm_channels" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_tags_org_slug_unique" ON "crm_tags" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "crm_tags_org_idx" ON "crm_tags" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "crm_leads_org_idx" ON "crm_leads" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "crm_leads_org_status_idx" ON "crm_leads" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "crm_leads_org_owner_idx" ON "crm_leads" USING btree ("organization_id","owner_membership_id");--> statement-breakpoint
CREATE INDEX "crm_leads_org_name_idx" ON "crm_leads" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "crm_clients_org_idx" ON "crm_clients" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "crm_clients_org_type_idx" ON "crm_clients" USING btree ("organization_id","person_type");--> statement-breakpoint
CREATE INDEX "crm_clients_org_cpf_idx" ON "crm_clients" USING btree ("organization_id","cpf_normalized");--> statement-breakpoint
CREATE INDEX "crm_clients_org_cnpj_idx" ON "crm_clients" USING btree ("organization_id","cnpj_normalized");--> statement-breakpoint
CREATE INDEX "crm_clients_org_name_idx" ON "crm_clients" USING btree ("organization_id","full_name");--> statement-breakpoint
CREATE INDEX "crm_clients_org_legal_idx" ON "crm_clients" USING btree ("organization_id","legal_name");--> statement-breakpoint
CREATE INDEX "crm_contacts_org_idx" ON "crm_contacts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "crm_contacts_lead_idx" ON "crm_contacts" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "crm_contacts_client_idx" ON "crm_contacts" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_lead_tags_unique" ON "crm_lead_tags" USING btree ("lead_id","tag_id");--> statement-breakpoint
CREATE INDEX "crm_lead_tags_org_idx" ON "crm_lead_tags" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_client_tags_unique" ON "crm_client_tags" USING btree ("client_id","tag_id");--> statement-breakpoint
CREATE INDEX "crm_client_tags_org_idx" ON "crm_client_tags" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "crm_notes_org_resource_idx" ON "crm_notes" USING btree ("organization_id","resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "crm_interactions_org_resource_idx" ON "crm_interactions" USING btree ("organization_id","resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "crm_interactions_occurred_idx" ON "crm_interactions" USING btree ("organization_id","occurred_at");
