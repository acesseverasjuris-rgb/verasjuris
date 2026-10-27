CREATE TYPE "public"."document_evidentiary_role" AS ENUM('none', 'evidence', 'supporting', 'rebuttal', 'reference');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('identification', 'evidence', 'contract', 'petition', 'decision', 'report', 'power_of_attorney', 'administrative', 'correspondence', 'other');--> statement-breakpoint
CREATE TYPE "public"."document_legal_context" AS ENUM('client', 'matter', 'judicial', 'administrative', 'internal', 'other');--> statement-breakpoint
CREATE TYPE "public"."calendar_event_status" AS ENUM('scheduled', 'confirmed', 'rescheduled', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."calendar_event_type" AS ENUM('hearing', 'expert_exam', 'meeting', 'consultation', 'oral_argument', 'internal_event', 'other');--> statement-breakpoint
CREATE TYPE "public"."calendar_location_type" AS ENUM('in_person', 'remote', 'hybrid', 'undetermined');--> statement-breakpoint
CREATE TYPE "public"."calendar_recurrence" AS ENUM('none', 'daily', 'weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."deadline_rule_type" AS ENUM('manual_date', 'calendar_days', 'business_days', 'custom');--> statement-breakpoint
CREATE TYPE "public"."deadline_source_type" AS ENUM('manual', 'judicial_movement', 'judicial_decision', 'hearing', 'administrative_requirement', 'administrative_decision', 'administrative_deadline', 'contract', 'other');--> statement-breakpoint
CREATE TYPE "public"."deadline_status" AS ENUM('draft', 'suggested', 'pending_confirmation', 'confirmed', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."task_dependency_type" AS ENUM('blocks', 'requires');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."task_sla_status" AS ENUM('running', 'paused', 'warning', 'breached', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('todo', 'in_progress', 'waiting', 'blocked', 'done', 'cancelled', 'archived');--> statement-breakpoint
CREATE TABLE "calendar_event_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"calendar_event_id" uuid NOT NULL,
	"membership_id" uuid,
	"display_name" text,
	"email" text,
	"role_label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid,
	"judicial_process_id" uuid,
	"administrative_process_id" uuid,
	"task_id" uuid,
	"judicial_hearing_id" uuid,
	"event_type" "calendar_event_type" DEFAULT 'other' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"location_type" "calendar_location_type" DEFAULT 'undetermined' NOT NULL,
	"location_text" text,
	"meeting_url" text,
	"status" "calendar_event_status" DEFAULT 'scheduled' NOT NULL,
	"recurrence" "calendar_recurrence" DEFAULT 'none' NOT NULL,
	"metadata" jsonb,
	"responsible_membership_id" uuid,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deadline_alert_dispatches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"deadline_id" uuid NOT NULL,
	"alert_rule_id" uuid,
	"channel" text DEFAULT 'in_app' NOT NULL,
	"dispatched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notification_id" uuid
);
--> statement-breakpoint
CREATE TABLE "deadline_alert_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"offset_minutes" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deadline_escalation_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"offset_minutes" integer NOT NULL,
	"escalate_to_membership_id" uuid,
	"escalate_to_role_key" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deadline_history_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"deadline_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"previous_value" text,
	"new_value" text,
	"reason" text,
	"actor_membership_id" uuid,
	"event_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deadlines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid,
	"judicial_process_id" uuid,
	"administrative_process_id" uuid,
	"source_type" "deadline_source_type" DEFAULT 'manual' NOT NULL,
	"source_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"base_date" timestamp with time zone NOT NULL,
	"base_date_label" text,
	"rule_type" "deadline_rule_type" DEFAULT 'manual_date' NOT NULL,
	"rule_description" text,
	"rule_days" integer,
	"calculated_at" timestamp with time zone,
	"calculated_due_at" timestamp with time zone,
	"confirmed_due_at" timestamp with time zone,
	"status" "deadline_status" DEFAULT 'draft' NOT NULL,
	"timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"responsible_membership_id" uuid,
	"confirmed_by_membership_id" uuid,
	"confirmed_at" timestamp with time zone,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"resource_type" text,
	"resource_id" uuid,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sla_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"target_minutes" integer NOT NULL,
	"warning_minutes" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"title" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"completed_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"author_membership_id" uuid NOT NULL,
	"body" text NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_dependencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"depends_on_task_id" uuid NOT NULL,
	"dependency_type" "task_dependency_type" DEFAULT 'blocks' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_history_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"actor_membership_id" uuid,
	"metadata" jsonb,
	"event_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_sla" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"sla_policy_id" uuid NOT NULL,
	"target_at" timestamp with time zone NOT NULL,
	"warning_at" timestamp with time zone,
	"started_at" timestamp with time zone NOT NULL,
	"paused_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"status" "task_sla_status" DEFAULT 'running' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid,
	"judicial_process_id" uuid,
	"administrative_process_id" uuid,
	"parent_task_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"status" "task_status" DEFAULT 'todo' NOT NULL,
	"priority" "task_priority" DEFAULT 'normal' NOT NULL,
	"created_by_membership_id" uuid,
	"responsible_membership_id" uuid,
	"start_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"sla_policy_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "administrative_deadlines" ADD COLUMN "central_deadline_id" uuid;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "document_kind" "document_kind" DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "legal_context" "document_legal_context" DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "evidentiary_role" "document_evidentiary_role" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_event_participants" ADD CONSTRAINT "calendar_event_participants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event_participants" ADD CONSTRAINT "calendar_event_participants_calendar_event_id_calendar_events_id_fk" FOREIGN KEY ("calendar_event_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event_participants" ADD CONSTRAINT "calendar_event_participants_membership_id_organization_members_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."organization_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_judicial_process_id_judicial_processes_id_fk" FOREIGN KEY ("judicial_process_id") REFERENCES "public"."judicial_processes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_administrative_process_id_administrative_processes_id_fk" FOREIGN KEY ("administrative_process_id") REFERENCES "public"."administrative_processes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_judicial_hearing_id_judicial_hearings_id_fk" FOREIGN KEY ("judicial_hearing_id") REFERENCES "public"."judicial_hearings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_responsible_membership_id_organization_members_id_fk" FOREIGN KEY ("responsible_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deadline_alert_dispatches" ADD CONSTRAINT "deadline_alert_dispatches_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deadline_alert_dispatches" ADD CONSTRAINT "deadline_alert_dispatches_deadline_id_deadlines_id_fk" FOREIGN KEY ("deadline_id") REFERENCES "public"."deadlines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deadline_alert_dispatches" ADD CONSTRAINT "deadline_alert_dispatches_alert_rule_id_deadline_alert_rules_id_fk" FOREIGN KEY ("alert_rule_id") REFERENCES "public"."deadline_alert_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deadline_alert_rules" ADD CONSTRAINT "deadline_alert_rules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deadline_escalation_rules" ADD CONSTRAINT "deadline_escalation_rules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deadline_escalation_rules" ADD CONSTRAINT "deadline_escalation_rules_escalate_to_membership_id_organization_members_id_fk" FOREIGN KEY ("escalate_to_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deadline_history_events" ADD CONSTRAINT "deadline_history_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deadline_history_events" ADD CONSTRAINT "deadline_history_events_deadline_id_deadlines_id_fk" FOREIGN KEY ("deadline_id") REFERENCES "public"."deadlines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deadline_history_events" ADD CONSTRAINT "deadline_history_events_actor_membership_id_organization_members_id_fk" FOREIGN KEY ("actor_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_judicial_process_id_judicial_processes_id_fk" FOREIGN KEY ("judicial_process_id") REFERENCES "public"."judicial_processes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_administrative_process_id_administrative_processes_id_fk" FOREIGN KEY ("administrative_process_id") REFERENCES "public"."administrative_processes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_responsible_membership_id_organization_members_id_fk" FOREIGN KEY ("responsible_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_confirmed_by_membership_id_organization_members_id_fk" FOREIGN KEY ("confirmed_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_completed_by_membership_id_organization_members_id_fk" FOREIGN KEY ("completed_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_author_membership_id_organization_members_id_fk" FOREIGN KEY ("author_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_depends_on_task_id_tasks_id_fk" FOREIGN KEY ("depends_on_task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_history_events" ADD CONSTRAINT "task_history_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_history_events" ADD CONSTRAINT "task_history_events_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_history_events" ADD CONSTRAINT "task_history_events_actor_membership_id_organization_members_id_fk" FOREIGN KEY ("actor_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_sla" ADD CONSTRAINT "task_sla_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_sla" ADD CONSTRAINT "task_sla_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_sla" ADD CONSTRAINT "task_sla_sla_policy_id_sla_policies_id_fk" FOREIGN KEY ("sla_policy_id") REFERENCES "public"."sla_policies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_judicial_process_id_judicial_processes_id_fk" FOREIGN KEY ("judicial_process_id") REFERENCES "public"."judicial_processes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_administrative_process_id_administrative_processes_id_fk" FOREIGN KEY ("administrative_process_id") REFERENCES "public"."administrative_processes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_responsible_membership_id_organization_members_id_fk" FOREIGN KEY ("responsible_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_sla_policy_id_sla_policies_id_fk" FOREIGN KEY ("sla_policy_id") REFERENCES "public"."sla_policies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_participants_event_idx" ON "calendar_event_participants" USING btree ("calendar_event_id");--> statement-breakpoint
CREATE INDEX "calendar_participants_org_idx" ON "calendar_event_participants" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "calendar_events_org_idx" ON "calendar_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "calendar_events_starts_idx" ON "calendar_events" USING btree ("organization_id","starts_at");--> statement-breakpoint
CREATE INDEX "calendar_events_responsible_idx" ON "calendar_events" USING btree ("organization_id","responsible_membership_id");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_events_hearing_unique" ON "calendar_events" USING btree ("judicial_hearing_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deadline_alert_dispatches_unique" ON "deadline_alert_dispatches" USING btree ("deadline_id","alert_rule_id","channel");--> statement-breakpoint
CREATE INDEX "deadline_alert_dispatches_org_idx" ON "deadline_alert_dispatches" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "deadline_alert_rules_org_idx" ON "deadline_alert_rules" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deadline_alert_rules_org_offset_unique" ON "deadline_alert_rules" USING btree ("organization_id","offset_minutes");--> statement-breakpoint
CREATE INDEX "deadline_escalation_rules_org_idx" ON "deadline_escalation_rules" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "deadline_history_deadline_idx" ON "deadline_history_events" USING btree ("deadline_id");--> statement-breakpoint
CREATE INDEX "deadline_history_event_at_idx" ON "deadline_history_events" USING btree ("deadline_id","event_at");--> statement-breakpoint
CREATE INDEX "deadlines_org_idx" ON "deadlines" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "deadlines_org_status_idx" ON "deadlines" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "deadlines_confirmed_due_idx" ON "deadlines" USING btree ("organization_id","confirmed_due_at");--> statement-breakpoint
CREATE INDEX "deadlines_matter_idx" ON "deadlines" USING btree ("legal_matter_id");--> statement-breakpoint
CREATE INDEX "deadlines_source_idx" ON "deadlines" USING btree ("organization_id","source_type","source_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "notifications_org_idx" ON "notifications" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "sla_policies_org_idx" ON "sla_policies" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sla_policies_org_name_unique" ON "sla_policies" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "task_checklist_task_idx" ON "task_checklist_items" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_checklist_org_idx" ON "task_checklist_items" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "task_comments_task_idx" ON "task_comments" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_comments_org_idx" ON "task_comments" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_dependencies_unique" ON "task_dependencies" USING btree ("task_id","depends_on_task_id");--> statement-breakpoint
CREATE INDEX "task_dependencies_org_idx" ON "task_dependencies" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "task_history_task_idx" ON "task_history_events" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_history_event_at_idx" ON "task_history_events" USING btree ("task_id","event_at");--> statement-breakpoint
CREATE UNIQUE INDEX "task_sla_task_unique" ON "task_sla" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_sla_org_idx" ON "task_sla" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "tasks_org_idx" ON "tasks" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "tasks_org_status_idx" ON "tasks" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "tasks_responsible_idx" ON "tasks" USING btree ("organization_id","responsible_membership_id");--> statement-breakpoint
CREATE INDEX "tasks_matter_idx" ON "tasks" USING btree ("legal_matter_id");--> statement-breakpoint
CREATE INDEX "tasks_due_idx" ON "tasks" USING btree ("organization_id","due_at");--> statement-breakpoint
CREATE INDEX "administrative_deadlines_central_idx" ON "administrative_deadlines" USING btree ("central_deadline_id");