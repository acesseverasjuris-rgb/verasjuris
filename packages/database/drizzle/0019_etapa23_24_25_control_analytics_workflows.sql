-- Etapa 23+24+25 — Control, Analytics, Workflows foundation
-- Hand-written: do not regenerate via drizzle-kit generate (enum regeneration).

ALTER TABLE "organizations" ADD COLUMN "internal_company" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE INDEX "organizations_internal_company_idx" ON "organizations" USING btree ("internal_company");
--> statement-breakpoint
CREATE TYPE "public"."legal_matter_scope" AS ENUM('customer', 'internal_company');
--> statement-breakpoint
ALTER TABLE "legal_matters" ADD COLUMN "matter_scope" "legal_matter_scope" DEFAULT 'customer' NOT NULL;
--> statement-breakpoint
CREATE INDEX "legal_matters_org_scope_idx" ON "legal_matters" USING btree ("organization_id","matter_scope");
--> statement-breakpoint
ALTER TABLE "cost_records" ADD COLUMN "cost_center_id" uuid;
--> statement-breakpoint
CREATE INDEX "cost_records_cost_center_idx" ON "cost_records" USING btree ("cost_center_id");
--> statement-breakpoint
CREATE TYPE "public"."control_goal_status" AS ENUM('draft', 'active', 'at_risk', 'achieved', 'missed', 'cancelled', 'archived');
--> statement-breakpoint
CREATE TYPE "public"."control_goal_target_type" AS ENUM('absolute', 'percentage', 'currency', 'count', 'custom');
--> statement-breakpoint
CREATE TYPE "public"."control_kpi_direction" AS ENUM('higher_is_better', 'lower_is_better', 'target_range');
--> statement-breakpoint
CREATE TYPE "public"."control_kpi_source_type" AS ENUM('internal_query', 'manual', 'external_provider');
--> statement-breakpoint
CREATE TYPE "public"."control_approval_status" AS ENUM('pending', 'partially_approved', 'approved', 'rejected', 'cancelled', 'expired');
--> statement-breakpoint
CREATE TYPE "public"."control_approval_policy" AS ENUM('single', 'sequential', 'parallel', 'threshold_based');
--> statement-breakpoint
CREATE TYPE "public"."control_approval_decision" AS ENUM('approved', 'rejected');
--> statement-breakpoint
CREATE TYPE "public"."control_employee_status" AS ENUM('preboarding', 'active', 'on_leave', 'suspended', 'terminated', 'archived');
--> statement-breakpoint
CREATE TYPE "public"."control_employment_type" AS ENUM('employee', 'intern', 'contractor', 'partner', 'temporary', 'other');
--> statement-breakpoint
CREATE TYPE "public"."employee_onboarding_item_type" AS ENUM('documents', 'access', 'training', 'equipment', 'policies', 'meetings', 'security', 'lgpd', 'other');
--> statement-breakpoint
CREATE TYPE "public"."employee_onboarding_item_status" AS ENUM('pending', 'in_progress', 'completed', 'skipped', 'blocked');
--> statement-breakpoint
CREATE TYPE "public"."employee_onboarding_plan_status" AS ENUM('draft', 'active', 'completed', 'cancelled');
--> statement-breakpoint
CREATE TYPE "public"."employee_performance_review_status" AS ENUM('draft', 'in_progress', 'completed', 'cancelled');
--> statement-breakpoint
CREATE TYPE "public"."employee_leave_type" AS ENUM('vacation', 'medical', 'personal', 'parental', 'other');
--> statement-breakpoint
CREATE TYPE "public"."employee_leave_status" AS ENUM('draft', 'requested', 'approved', 'rejected', 'cancelled', 'taken');
--> statement-breakpoint
CREATE TYPE "public"."internal_budget_status" AS ENUM('draft', 'under_review', 'approved', 'revised', 'closed');
--> statement-breakpoint
CREATE TYPE "public"."expense_report_status" AS ENUM('draft', 'submitted', 'under_review', 'approved', 'rejected', 'reimbursed');
--> statement-breakpoint
CREATE TYPE "public"."expense_report_item_status" AS ENUM('pending', 'approved', 'rejected');
--> statement-breakpoint
CREATE TYPE "public"."intellectual_property_type" AS ENUM('trademark', 'patent', 'software', 'domain', 'copyright', 'trade_secret', 'design', 'other');
--> statement-breakpoint
CREATE TYPE "public"."intellectual_property_status" AS ENUM('draft', 'filed', 'pending', 'registered', 'rejected', 'expired', 'abandoned');
--> statement-breakpoint
CREATE TYPE "public"."due_diligence_case_status" AS ENUM('draft', 'open', 'in_progress', 'completed', 'cancelled');
--> statement-breakpoint
CREATE TYPE "public"."due_diligence_case_type" AS ENUM('corporate', 'vendor', 'investment', 'm_and_a', 'partner', 'other');
--> statement-breakpoint
CREATE TYPE "public"."due_diligence_item_area" AS ENUM('corporate', 'legal', 'tax', 'labor', 'privacy', 'security', 'financial', 'sanctions', 'ip', 'contracts', 'other');
--> statement-breakpoint
CREATE TYPE "public"."due_diligence_item_status" AS ENUM('pending', 'in_progress', 'completed', 'not_applicable', 'blocked');
--> statement-breakpoint
CREATE TYPE "public"."internal_policy_status" AS ENUM('draft', 'under_review', 'approved', 'active', 'superseded', 'archived');
--> statement-breakpoint
CREATE TYPE "public"."compliance_risk_category" AS ENUM('legal', 'regulatory', 'privacy', 'security', 'financial', 'operational', 'reputational', 'vendor', 'ai', 'fraud', 'other');
--> statement-breakpoint
CREATE TYPE "public"."compliance_risk_status" AS ENUM('open', 'monitoring', 'mitigated', 'accepted', 'closed');
--> statement-breakpoint
CREATE TYPE "public"."compliance_control_type" AS ENUM('preventive', 'detective', 'corrective', 'compensating');
--> statement-breakpoint
CREATE TYPE "public"."compliance_control_status" AS ENUM('draft', 'active', 'inactive', 'retired');
--> statement-breakpoint
CREATE TYPE "public"."compliance_control_frequency" AS ENUM('continuous', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'ad_hoc');
--> statement-breakpoint
CREATE TYPE "public"."compliance_incident_type" AS ENUM('privacy', 'security', 'fraud', 'financial', 'regulatory', 'operational', 'vendor', 'ai', 'other');
--> statement-breakpoint
CREATE TYPE "public"."compliance_incident_status" AS ENUM('open', 'triaged', 'investigating', 'contained', 'remediating', 'monitoring', 'closed');
--> statement-breakpoint
CREATE TYPE "public"."compliance_incident_severity" AS ENUM('critical', 'high', 'medium', 'low');
--> statement-breakpoint
CREATE TYPE "public"."compliance_audit_type" AS ENUM('internal', 'external', 'regulatory', 'vendor', 'security', 'financial', 'privacy');
--> statement-breakpoint
CREATE TYPE "public"."compliance_audit_status" AS ENUM('planned', 'in_progress', 'completed', 'cancelled');
--> statement-breakpoint
CREATE TYPE "public"."compliance_finding_severity" AS ENUM('critical', 'high', 'medium', 'low');
--> statement-breakpoint
CREATE TYPE "public"."compliance_finding_status" AS ENUM('open', 'in_remediation', 'resolved', 'accepted', 'deferred');
--> statement-breakpoint
CREATE TYPE "public"."compliance_obligation_status" AS ENUM('open', 'in_progress', 'completed', 'overdue', 'waived');
--> statement-breakpoint
CREATE TYPE "public"."control_vendor_status" AS ENUM('prospect', 'under_review', 'approved', 'active', 'suspended', 'terminated', 'archived');
--> statement-breakpoint
CREATE TYPE "public"."control_vendor_risk_level" AS ENUM('low', 'medium', 'high', 'critical');
--> statement-breakpoint
CREATE TYPE "public"."vendor_onboarding_status" AS ENUM('not_started', 'in_progress', 'completed', 'blocked');
--> statement-breakpoint
CREATE TYPE "public"."vendor_sla_status" AS ENUM('active', 'breached', 'paused', 'expired');
--> statement-breakpoint
CREATE TYPE "public"."vendor_sla_result_status" AS ENUM('met', 'missed', 'partial', 'not_measured');
--> statement-breakpoint
CREATE TYPE "public"."roadmap_item_type" AS ENUM('feature', 'improvement', 'tech_debt', 'bug', 'security', 'compliance', 'infrastructure');
--> statement-breakpoint
CREATE TYPE "public"."roadmap_item_status" AS ENUM('proposed', 'planned', 'in_progress', 'done', 'deferred', 'cancelled');
--> statement-breakpoint
CREATE TYPE "public"."roadmap_item_priority" AS ENUM('low', 'medium', 'high', 'critical');
--> statement-breakpoint
CREATE TYPE "public"."product_bug_status" AS ENUM('open', 'triaged', 'in_progress', 'blocked', 'fixed', 'verified', 'closed', 'wont_fix');
--> statement-breakpoint
CREATE TYPE "public"."product_bug_severity" AS ENUM('critical', 'high', 'medium', 'low');
--> statement-breakpoint
CREATE TYPE "public"."technology_incident_severity" AS ENUM('sev1', 'sev2', 'sev3', 'sev4');
--> statement-breakpoint
CREATE TYPE "public"."technology_incident_status" AS ENUM('open', 'investigating', 'mitigated', 'resolved', 'closed');
--> statement-breakpoint
CREATE TYPE "public"."product_release_status" AS ENUM('planned', 'ready', 'deploying', 'released', 'failed', 'rolled_back', 'cancelled');
--> statement-breakpoint
CREATE TYPE "public"."product_feature_status" AS ENUM('discovery', 'planned', 'in_development', 'testing', 'released', 'deprecated', 'retired');
--> statement-breakpoint
CREATE TYPE "public"."control_project_status" AS ENUM('proposed', 'approved', 'active', 'at_risk', 'blocked', 'completed', 'cancelled');
--> statement-breakpoint
CREATE TYPE "public"."analytics_export_status" AS ENUM('pending', 'running', 'completed', 'failed', 'cancelled');
--> statement-breakpoint
CREATE TYPE "public"."analytics_export_format" AS ENUM('csv', 'xlsx');
--> statement-breakpoint
CREATE TYPE "public"."workflow_definition_status" AS ENUM('draft', 'published', 'paused', 'archived');
--> statement-breakpoint
CREATE TYPE "public"."workflow_trigger_type" AS ENUM('domain_event', 'schedule', 'manual', 'webhook', 'threshold', 'state_change');
--> statement-breakpoint
CREATE TYPE "public"."workflow_condition_operator" AS ENUM('equals', 'not_equals', 'in', 'not_in', 'greater_than', 'less_than', 'exists', 'not_exists', 'and', 'or');
--> statement-breakpoint
CREATE TYPE "public"."workflow_action_type" AS ENUM('create_task', 'create_notification', 'send_communication', 'request_approval', 'create_deadline', 'update_allowed_field', 'create_document_request', 'create_incident', 'create_payable', 'call_internal_service', 'enqueue_job', 'wait', 'webhook_external');
--> statement-breakpoint
CREATE TYPE "public"."workflow_failure_policy" AS ENUM('stop', 'continue', 'retry', 'escalate', 'wait_for_review');
--> statement-breakpoint
CREATE TYPE "public"."workflow_run_status" AS ENUM('queued', 'running', 'waiting', 'completed', 'failed', 'cancelled', 'timed_out', 'partially_completed');
--> statement-breakpoint
CREATE TYPE "public"."workflow_step_status" AS ENUM('pending', 'running', 'waiting', 'completed', 'failed', 'skipped', 'cancelled', 'timed_out');
--> statement-breakpoint
CREATE TABLE "control_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"owner_membership_id" uuid,
	"area" text,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"target_type" "control_goal_target_type" DEFAULT 'absolute' NOT NULL,
	"target_value" text,
	"current_value_source" text,
	"status" "control_goal_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "control_kpis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"unit" text,
	"direction" "control_kpi_direction" DEFAULT 'higher_is_better' NOT NULL,
	"source_type" "control_kpi_source_type" DEFAULT 'manual' NOT NULL,
	"source_config" jsonb,
	"target_value" text,
	"warning_threshold" text,
	"critical_threshold" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "control_kpi_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kpi_id" uuid NOT NULL,
	"period" text NOT NULL,
	"value" text NOT NULL,
	"source" text,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "control_approval_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"type" text NOT NULL,
	"reference_type" text NOT NULL,
	"reference_id" uuid NOT NULL,
	"requested_by_membership_id" uuid,
	"approver_policy" "control_approval_policy" DEFAULT 'single' NOT NULL,
	"status" "control_approval_status" DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "control_approval_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"approver_membership_id" uuid NOT NULL,
	"decision" "control_approval_decision" NOT NULL,
	"comment" text,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "control_departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "control_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"title" text NOT NULL,
	"level" text,
	"description" text,
	"responsibilities" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "control_employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"employee_code" text NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"status" "control_employee_status" DEFAULT 'preboarding' NOT NULL,
	"hired_at" timestamp with time zone,
	"terminated_at" timestamp with time zone,
	"manager_employee_id" uuid,
	"department_id" uuid,
	"position_id" uuid,
	"employment_type" "control_employment_type" DEFAULT 'employee' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_contract_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_onboarding_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"department_id" uuid,
	"position_id" uuid,
	"employment_type" "control_employment_type",
	"items_template" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_onboarding_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"template_id" uuid,
	"status" "employee_onboarding_plan_status" DEFAULT 'draft' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_onboarding_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"item_type" "employee_onboarding_item_type" DEFAULT 'other' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "employee_onboarding_item_status" DEFAULT 'pending' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"assignee_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_performance_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"reviewer_employee_id" uuid,
	"status" "employee_performance_review_status" DEFAULT 'draft' NOT NULL,
	"overall_score" integer,
	"review_scale_max" integer DEFAULT 5 NOT NULL,
	"strengths" text,
	"improvements" text,
	"goals" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_leave_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"leave_type" "employee_leave_type" DEFAULT 'vacation' NOT NULL,
	"status" "employee_leave_status" DEFAULT 'draft' NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"reason" text,
	"approved_by_membership_id" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_centers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"department_id" uuid,
	"manager_membership_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "internal_budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"fiscal_year" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "internal_budget_status" DEFAULT 'draft' NOT NULL,
	"approved_by_membership_id" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "internal_budget_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"budget_id" uuid NOT NULL,
	"cost_center_id" uuid,
	"category" text NOT NULL,
	"period" text NOT NULL,
	"planned_amount_cents" bigint NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"cost_center_id" uuid,
	"period" text NOT NULL,
	"total_cents" bigint DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"status" "expense_report_status" DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_report_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expense_report_id" uuid NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"incurred_at" timestamp with time zone NOT NULL,
	"document_id" uuid,
	"status" "expense_report_item_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intellectual_property_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"asset_type" "intellectual_property_type" DEFAULT 'other' NOT NULL,
	"status" "intellectual_property_status" DEFAULT 'draft' NOT NULL,
	"registration_number" text,
	"jurisdiction" text,
	"owner_membership_id" uuid,
	"filed_at" timestamp with time zone,
	"registered_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"document_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "internal_due_diligence_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid,
	"type" "due_diligence_case_type" DEFAULT 'other' NOT NULL,
	"status" "due_diligence_case_status" DEFAULT 'draft' NOT NULL,
	"title" text NOT NULL,
	"owner_membership_id" uuid,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "due_diligence_checklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "due_diligence_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"checklist_id" uuid NOT NULL,
	"area" "due_diligence_item_area" DEFAULT 'other' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "due_diligence_item_status" DEFAULT 'pending' NOT NULL,
	"document_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "internal_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "internal_policy_status" DEFAULT 'draft' NOT NULL,
	"effective_at" timestamp with time zone,
	"review_at" timestamp with time zone,
	"owner_membership_id" uuid,
	"document_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_acknowledgements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_id" uuid NOT NULL,
	"employee_id" uuid,
	"user_id" uuid,
	"acknowledged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"policy_version" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_risks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"category" "compliance_risk_category" DEFAULT 'other' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"owner_membership_id" uuid,
	"likelihood" integer DEFAULT 1 NOT NULL,
	"impact" integer DEFAULT 1 NOT NULL,
	"inherent_risk" integer,
	"residual_risk" integer,
	"status" "compliance_risk_status" DEFAULT 'open' NOT NULL,
	"review_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_controls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"risk_id" uuid,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"control_type" "compliance_control_type" DEFAULT 'preventive' NOT NULL,
	"owner_membership_id" uuid,
	"frequency" "compliance_control_frequency" DEFAULT 'ad_hoc' NOT NULL,
	"status" "compliance_control_status" DEFAULT 'draft' NOT NULL,
	"last_tested_at" timestamp with time zone,
	"next_test_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"type" "compliance_incident_type" DEFAULT 'other' NOT NULL,
	"severity" "compliance_incident_severity" DEFAULT 'medium' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "compliance_incident_status" DEFAULT 'open' NOT NULL,
	"owner_membership_id" uuid,
	"root_cause" text,
	"impact" text,
	"resolution" text,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"type" "compliance_audit_type" DEFAULT 'internal' NOT NULL,
	"title" text NOT NULL,
	"status" "compliance_audit_status" DEFAULT 'planned' NOT NULL,
	"owner_membership_id" uuid,
	"planned_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_audit_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"audit_id" uuid NOT NULL,
	"severity" "compliance_finding_severity" DEFAULT 'medium' NOT NULL,
	"description" text NOT NULL,
	"owner_membership_id" uuid,
	"remediation_due_at" timestamp with time zone,
	"status" "compliance_finding_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_obligations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"source" text,
	"authority" text,
	"frequency" text,
	"due_at" timestamp with time zone,
	"owner_membership_id" uuid,
	"status" "compliance_obligation_status" DEFAULT 'open' NOT NULL,
	"evidence_document_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "control_vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_name" text NOT NULL,
	"trade_name" text,
	"tax_id" text,
	"category" text,
	"status" "control_vendor_status" DEFAULT 'prospect' NOT NULL,
	"risk_level" "control_vendor_risk_level" DEFAULT 'medium' NOT NULL,
	"contact_email" text,
	"contact_phone" text,
	"contact_name" text,
	"onboarding_status" "vendor_onboarding_status" DEFAULT 'not_started' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_slas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"contract_id" uuid,
	"metric" text NOT NULL,
	"target" text NOT NULL,
	"measurement" text,
	"period" text,
	"status" "vendor_sla_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_sla_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sla_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"actual_value" text,
	"status" "vendor_sla_result_status" DEFAULT 'not_measured' NOT NULL,
	"notes" text,
	"measured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"quality_score" integer,
	"deadline_score" integer,
	"cost_score" integer,
	"security_score" integer,
	"compliance_score" integer,
	"support_score" integer,
	"overall_score" integer,
	"review_scale_max" integer DEFAULT 5 NOT NULL,
	"comments" text,
	"reviewer_membership_id" uuid,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "control_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"owner_membership_id" uuid,
	"sponsor_membership_id" uuid,
	"status" "control_project_status" DEFAULT 'proposed' NOT NULL,
	"start_at" timestamp with time zone,
	"target_end_at" timestamp with time zone,
	"budget_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_roadmaps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roadmap_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"roadmap_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" "roadmap_item_type" DEFAULT 'feature' NOT NULL,
	"priority" "roadmap_item_priority" DEFAULT 'medium' NOT NULL,
	"status" "roadmap_item_status" DEFAULT 'proposed' NOT NULL,
	"target_quarter" text,
	"owner_membership_id" uuid,
	"product_area" text,
	"linked_project_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" text NOT NULL,
	"name" text,
	"environment" text,
	"status" "product_release_status" DEFAULT 'planned' NOT NULL,
	"planned_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"notes" text,
	"commit_reference" text,
	"deployment_reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_bugs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"severity" "product_bug_severity" DEFAULT 'medium' NOT NULL,
	"priority" "roadmap_item_priority" DEFAULT 'medium' NOT NULL,
	"status" "product_bug_status" DEFAULT 'open' NOT NULL,
	"environment" text,
	"reporter_membership_id" uuid,
	"owner_membership_id" uuid,
	"reproduction_steps" text,
	"fixed_in_release_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "technology_incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"severity" "technology_incident_severity" DEFAULT 'sev3' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"started_at" timestamp with time zone,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"status" "technology_incident_status" DEFAULT 'open' NOT NULL,
	"impact" text,
	"root_cause" text,
	"postmortem_document_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_features" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"owner_membership_id" uuid,
	"status" "product_feature_status" DEFAULT 'discovery' NOT NULL,
	"release_id" uuid,
	"feature_flag_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_metric_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metric_key" text NOT NULL,
	"organization_id" uuid,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"dimensions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dimensions_key" text DEFAULT '' NOT NULL,
	"value" numeric NOT NULL,
	"formula_version" text NOT NULL,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_export_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"status" "analytics_export_status" DEFAULT 'pending' NOT NULL,
	"format" "analytics_export_format" DEFAULT 'csv' NOT NULL,
	"requested_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"error_code" text,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "workflow_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"domain" text,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "workflow_definition_status" DEFAULT 'draft' NOT NULL,
	"active_from" timestamp with time zone,
	"active_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"definition_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"body" jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"published_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_triggers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"definition_id" uuid NOT NULL,
	"version_id" uuid,
	"trigger_type" "workflow_trigger_type" NOT NULL,
	"event_key" text,
	"schedule_cron" text,
	"config" jsonb,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_conditions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"definition_id" uuid NOT NULL,
	"version_id" uuid,
	"parent_condition_id" uuid,
	"operator" "workflow_condition_operator" NOT NULL,
	"field_path" text,
	"value" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"definition_id" uuid NOT NULL,
	"version_id" uuid,
	"action_type" "workflow_action_type" NOT NULL,
	"name" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"timeout_ms" integer,
	"max_attempts" integer DEFAULT 1 NOT NULL,
	"failure_policy" "workflow_failure_policy" DEFAULT 'stop' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"definition_id" uuid NOT NULL,
	"version_id" uuid,
	"version" integer NOT NULL,
	"trigger_type" "workflow_trigger_type" NOT NULL,
	"trigger_reference" text,
	"status" "workflow_run_status" DEFAULT 'queued' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"idempotency_key" text NOT NULL,
	"dry_run" boolean DEFAULT false NOT NULL,
	"error_code" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_step_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_run_id" uuid NOT NULL,
	"action_id" uuid,
	"status" "workflow_step_status" DEFAULT 'pending' NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error_code" text,
	"output_metadata" jsonb,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"domain" text,
	"version" integer DEFAULT 1 NOT NULL,
	"body" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_run_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_run_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid
);
--> statement-breakpoint
CREATE UNIQUE INDEX "control_kpis_org_key_unique" ON "control_kpis" USING btree ("organization_id","key");
--> statement-breakpoint
CREATE INDEX "control_goals_org_idx" ON "control_goals" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "control_goals_org_status_idx" ON "control_goals" USING btree ("organization_id","status");
--> statement-breakpoint
CREATE INDEX "control_kpis_org_idx" ON "control_kpis" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "control_kpi_snapshots_kpi_idx" ON "control_kpi_snapshots" USING btree ("kpi_id");
--> statement-breakpoint
CREATE INDEX "control_kpi_snapshots_kpi_period_idx" ON "control_kpi_snapshots" USING btree ("kpi_id","period");
--> statement-breakpoint
CREATE INDEX "control_approval_requests_org_idx" ON "control_approval_requests" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "control_approval_requests_org_status_idx" ON "control_approval_requests" USING btree ("organization_id","status");
--> statement-breakpoint
CREATE INDEX "control_approval_requests_ref_idx" ON "control_approval_requests" USING btree ("reference_type","reference_id");
--> statement-breakpoint
CREATE INDEX "control_approval_decisions_request_idx" ON "control_approval_decisions" USING btree ("request_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "control_approval_decisions_request_approver_unique" ON "control_approval_decisions" USING btree ("request_id","approver_membership_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "control_departments_org_slug_unique" ON "control_departments" USING btree ("organization_id","slug");
--> statement-breakpoint
CREATE INDEX "control_departments_org_idx" ON "control_departments" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "control_positions_org_idx" ON "control_positions" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "control_positions_department_idx" ON "control_positions" USING btree ("department_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "control_employees_org_code_unique" ON "control_employees" USING btree ("organization_id","employee_code");
--> statement-breakpoint
CREATE INDEX "control_employees_org_idx" ON "control_employees" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "control_employees_org_status_idx" ON "control_employees" USING btree ("organization_id","status");
--> statement-breakpoint
CREATE INDEX "control_employees_department_idx" ON "control_employees" USING btree ("department_id");
--> statement-breakpoint
CREATE INDEX "control_employees_manager_idx" ON "control_employees" USING btree ("manager_employee_id");
--> statement-breakpoint
CREATE INDEX "control_employees_user_idx" ON "control_employees" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "employee_contract_links_unique" ON "employee_contract_links" USING btree ("employee_id","contract_id");
--> statement-breakpoint
CREATE INDEX "employee_contract_links_contract_idx" ON "employee_contract_links" USING btree ("contract_id");
--> statement-breakpoint
CREATE INDEX "employee_onboarding_templates_org_idx" ON "employee_onboarding_templates" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "employee_onboarding_plans_org_idx" ON "employee_onboarding_plans" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "employee_onboarding_plans_employee_idx" ON "employee_onboarding_plans" USING btree ("employee_id");
--> statement-breakpoint
CREATE INDEX "employee_onboarding_items_plan_idx" ON "employee_onboarding_items" USING btree ("plan_id");
--> statement-breakpoint
CREATE INDEX "employee_onboarding_items_status_idx" ON "employee_onboarding_items" USING btree ("plan_id","status");
--> statement-breakpoint
CREATE INDEX "employee_performance_reviews_org_idx" ON "employee_performance_reviews" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "employee_performance_reviews_employee_idx" ON "employee_performance_reviews" USING btree ("employee_id");
--> statement-breakpoint
CREATE INDEX "employee_leave_requests_org_idx" ON "employee_leave_requests" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "employee_leave_requests_employee_idx" ON "employee_leave_requests" USING btree ("employee_id");
--> statement-breakpoint
CREATE INDEX "employee_leave_requests_org_status_idx" ON "employee_leave_requests" USING btree ("organization_id","status");
--> statement-breakpoint
CREATE UNIQUE INDEX "cost_centers_org_code_unique" ON "cost_centers" USING btree ("organization_id","code");
--> statement-breakpoint
CREATE INDEX "cost_centers_org_idx" ON "cost_centers" USING btree ("organization_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "internal_budgets_org_year_version_unique" ON "internal_budgets" USING btree ("organization_id","fiscal_year","version");
--> statement-breakpoint
CREATE INDEX "internal_budgets_org_idx" ON "internal_budgets" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "internal_budget_lines_budget_idx" ON "internal_budget_lines" USING btree ("budget_id");
--> statement-breakpoint
CREATE INDEX "internal_budget_lines_cost_center_idx" ON "internal_budget_lines" USING btree ("cost_center_id");
--> statement-breakpoint
CREATE INDEX "expense_reports_org_idx" ON "expense_reports" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "expense_reports_employee_idx" ON "expense_reports" USING btree ("employee_id");
--> statement-breakpoint
CREATE INDEX "expense_reports_org_status_idx" ON "expense_reports" USING btree ("organization_id","status");
--> statement-breakpoint
CREATE INDEX "expense_report_items_report_idx" ON "expense_report_items" USING btree ("expense_report_id");
--> statement-breakpoint
CREATE INDEX "intellectual_property_assets_org_idx" ON "intellectual_property_assets" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "intellectual_property_assets_org_status_idx" ON "intellectual_property_assets" USING btree ("organization_id","status");
--> statement-breakpoint
CREATE INDEX "internal_due_diligence_cases_org_idx" ON "internal_due_diligence_cases" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "internal_due_diligence_cases_subject_idx" ON "internal_due_diligence_cases" USING btree ("subject_type","subject_id");
--> statement-breakpoint
CREATE INDEX "due_diligence_checklists_case_idx" ON "due_diligence_checklists" USING btree ("case_id");
--> statement-breakpoint
CREATE INDEX "due_diligence_items_checklist_idx" ON "due_diligence_items" USING btree ("checklist_id");
--> statement-breakpoint
CREATE INDEX "internal_policies_org_idx" ON "internal_policies" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "internal_policies_org_status_idx" ON "internal_policies" USING btree ("organization_id","status");
--> statement-breakpoint
CREATE INDEX "policy_acknowledgements_policy_idx" ON "policy_acknowledgements" USING btree ("policy_id");
--> statement-breakpoint
CREATE INDEX "policy_acknowledgements_employee_idx" ON "policy_acknowledgements" USING btree ("employee_id");
--> statement-breakpoint
CREATE INDEX "compliance_risks_org_idx" ON "compliance_risks" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "compliance_risks_org_status_idx" ON "compliance_risks" USING btree ("organization_id","status");
--> statement-breakpoint
CREATE UNIQUE INDEX "compliance_controls_org_code_unique" ON "compliance_controls" USING btree ("organization_id","code");
--> statement-breakpoint
CREATE INDEX "compliance_controls_org_idx" ON "compliance_controls" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "compliance_controls_risk_idx" ON "compliance_controls" USING btree ("risk_id");
--> statement-breakpoint
CREATE INDEX "compliance_incidents_org_idx" ON "compliance_incidents" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "compliance_incidents_org_status_idx" ON "compliance_incidents" USING btree ("organization_id","status");
--> statement-breakpoint
CREATE INDEX "compliance_audits_org_idx" ON "compliance_audits" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "compliance_audits_org_status_idx" ON "compliance_audits" USING btree ("organization_id","status");
--> statement-breakpoint
CREATE INDEX "compliance_audit_findings_audit_idx" ON "compliance_audit_findings" USING btree ("audit_id");
--> statement-breakpoint
CREATE INDEX "compliance_obligations_org_idx" ON "compliance_obligations" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "compliance_obligations_org_status_idx" ON "compliance_obligations" USING btree ("organization_id","status");
--> statement-breakpoint
CREATE INDEX "control_vendors_org_idx" ON "control_vendors" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "control_vendors_org_status_idx" ON "control_vendors" USING btree ("organization_id","status");
--> statement-breakpoint
CREATE INDEX "vendor_slas_vendor_idx" ON "vendor_slas" USING btree ("vendor_id");
--> statement-breakpoint
CREATE INDEX "vendor_slas_org_idx" ON "vendor_slas" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "vendor_sla_results_sla_idx" ON "vendor_sla_results" USING btree ("sla_id");
--> statement-breakpoint
CREATE INDEX "vendor_reviews_vendor_idx" ON "vendor_reviews" USING btree ("vendor_id");
--> statement-breakpoint
CREATE INDEX "vendor_reviews_org_idx" ON "vendor_reviews" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "control_projects_org_idx" ON "control_projects" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "control_projects_org_status_idx" ON "control_projects" USING btree ("organization_id","status");
--> statement-breakpoint
CREATE INDEX "product_roadmaps_org_idx" ON "product_roadmaps" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "roadmap_items_roadmap_idx" ON "roadmap_items" USING btree ("roadmap_id");
--> statement-breakpoint
CREATE INDEX "roadmap_items_status_idx" ON "roadmap_items" USING btree ("roadmap_id","status");
--> statement-breakpoint
CREATE UNIQUE INDEX "product_releases_org_version_unique" ON "product_releases" USING btree ("organization_id","version");
--> statement-breakpoint
CREATE INDEX "product_releases_org_idx" ON "product_releases" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "product_bugs_org_idx" ON "product_bugs" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "product_bugs_org_status_idx" ON "product_bugs" USING btree ("organization_id","status");
--> statement-breakpoint
CREATE INDEX "technology_incidents_org_idx" ON "technology_incidents" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "technology_incidents_org_status_idx" ON "technology_incidents" USING btree ("organization_id","status");
--> statement-breakpoint
CREATE UNIQUE INDEX "product_features_org_key_unique" ON "product_features" USING btree ("organization_id","key");
--> statement-breakpoint
CREATE INDEX "product_features_org_idx" ON "product_features" USING btree ("organization_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_metric_snapshots_unique" ON "analytics_metric_snapshots" USING btree ("metric_key","period_start","period_end","dimensions_key","organization_id");
--> statement-breakpoint
CREATE INDEX "analytics_metric_snapshots_metric_idx" ON "analytics_metric_snapshots" USING btree ("metric_key");
--> statement-breakpoint
CREATE INDEX "analytics_metric_snapshots_org_idx" ON "analytics_metric_snapshots" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "analytics_metric_snapshots_period_idx" ON "analytics_metric_snapshots" USING btree ("period_start","period_end");
--> statement-breakpoint
CREATE INDEX "analytics_export_jobs_org_idx" ON "analytics_export_jobs" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "analytics_export_jobs_status_idx" ON "analytics_export_jobs" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_definitions_org_key_version_unique" ON "workflow_definitions" USING btree ("organization_id","key","version");
--> statement-breakpoint
CREATE INDEX "workflow_definitions_org_idx" ON "workflow_definitions" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "workflow_definitions_key_idx" ON "workflow_definitions" USING btree ("key");
--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_versions_definition_version_unique" ON "workflow_versions" USING btree ("definition_id","version");
--> statement-breakpoint
CREATE INDEX "workflow_versions_definition_idx" ON "workflow_versions" USING btree ("definition_id");
--> statement-breakpoint
CREATE INDEX "workflow_triggers_definition_idx" ON "workflow_triggers" USING btree ("definition_id");
--> statement-breakpoint
CREATE INDEX "workflow_triggers_type_idx" ON "workflow_triggers" USING btree ("trigger_type");
--> statement-breakpoint
CREATE INDEX "workflow_conditions_definition_idx" ON "workflow_conditions" USING btree ("definition_id");
--> statement-breakpoint
CREATE INDEX "workflow_conditions_version_idx" ON "workflow_conditions" USING btree ("version_id");
--> statement-breakpoint
CREATE INDEX "workflow_actions_definition_idx" ON "workflow_actions" USING btree ("definition_id");
--> statement-breakpoint
CREATE INDEX "workflow_actions_version_idx" ON "workflow_actions" USING btree ("version_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_runs_org_idempotency_unique" ON "workflow_runs" USING btree ("organization_id","idempotency_key");
--> statement-breakpoint
CREATE INDEX "workflow_runs_definition_idx" ON "workflow_runs" USING btree ("definition_id");
--> statement-breakpoint
CREATE INDEX "workflow_runs_org_status_idx" ON "workflow_runs" USING btree ("organization_id","status");
--> statement-breakpoint
CREATE INDEX "workflow_step_runs_run_idx" ON "workflow_step_runs" USING btree ("workflow_run_id");
--> statement-breakpoint
CREATE INDEX "workflow_step_runs_action_idx" ON "workflow_step_runs" USING btree ("action_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_templates_key_version_unique" ON "workflow_templates" USING btree ("key","version");
--> statement-breakpoint
CREATE INDEX "workflow_run_history_run_idx" ON "workflow_run_history" USING btree ("workflow_run_id");
--> statement-breakpoint
CREATE INDEX "workflow_run_history_created_idx" ON "workflow_run_history" USING btree ("created_at");
--> statement-breakpoint
ALTER TABLE "control_goals" ADD CONSTRAINT "control_goals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "control_goals" ADD CONSTRAINT "control_goals_owner_membership_id_organization_members_id_fk" FOREIGN KEY ("owner_membership_id") REFERENCES "organization_members"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "control_kpis" ADD CONSTRAINT "control_kpis_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "control_kpi_snapshots" ADD CONSTRAINT "control_kpi_snapshots_kpi_id_control_kpis_id_fk" FOREIGN KEY ("kpi_id") REFERENCES "control_kpis"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "control_approval_requests" ADD CONSTRAINT "control_approval_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "control_approval_requests" ADD CONSTRAINT "control_approval_requests_requested_by_membership_id_organization_members_id_fk" FOREIGN KEY ("requested_by_membership_id") REFERENCES "organization_members"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "control_approval_decisions" ADD CONSTRAINT "control_approval_decisions_request_id_control_approval_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "control_approval_requests"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "control_approval_decisions" ADD CONSTRAINT "control_approval_decisions_approver_membership_id_organization_members_id_fk" FOREIGN KEY ("approver_membership_id") REFERENCES "organization_members"("id") ON DELETE RESTRICT ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "control_departments" ADD CONSTRAINT "control_departments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "control_positions" ADD CONSTRAINT "control_positions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "control_positions" ADD CONSTRAINT "control_positions_department_id_control_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "control_departments"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "control_employees" ADD CONSTRAINT "control_employees_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "control_employees" ADD CONSTRAINT "control_employees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "control_employees" ADD CONSTRAINT "control_employees_manager_employee_id_control_employees_id_fk" FOREIGN KEY ("manager_employee_id") REFERENCES "control_employees"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "control_employees" ADD CONSTRAINT "control_employees_department_id_control_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "control_departments"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "control_employees" ADD CONSTRAINT "control_employees_position_id_control_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "control_positions"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "employee_contract_links" ADD CONSTRAINT "employee_contract_links_employee_id_control_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "control_employees"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "employee_contract_links" ADD CONSTRAINT "employee_contract_links_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "employee_onboarding_templates" ADD CONSTRAINT "employee_onboarding_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "employee_onboarding_templates" ADD CONSTRAINT "employee_onboarding_templates_department_id_control_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "control_departments"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "employee_onboarding_templates" ADD CONSTRAINT "employee_onboarding_templates_position_id_control_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "control_positions"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "employee_onboarding_plans" ADD CONSTRAINT "employee_onboarding_plans_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "employee_onboarding_plans" ADD CONSTRAINT "employee_onboarding_plans_employee_id_control_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "control_employees"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "employee_onboarding_plans" ADD CONSTRAINT "employee_onboarding_plans_template_id_employee_onboarding_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "employee_onboarding_templates"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "employee_onboarding_items" ADD CONSTRAINT "employee_onboarding_items_plan_id_employee_onboarding_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "employee_onboarding_plans"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "employee_onboarding_items" ADD CONSTRAINT "employee_onboarding_items_assignee_membership_id_organization_members_id_fk" FOREIGN KEY ("assignee_membership_id") REFERENCES "organization_members"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "employee_performance_reviews" ADD CONSTRAINT "employee_performance_reviews_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "employee_performance_reviews" ADD CONSTRAINT "employee_performance_reviews_employee_id_control_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "control_employees"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "employee_performance_reviews" ADD CONSTRAINT "employee_performance_reviews_reviewer_employee_id_control_employees_id_fk" FOREIGN KEY ("reviewer_employee_id") REFERENCES "control_employees"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "employee_leave_requests" ADD CONSTRAINT "employee_leave_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "employee_leave_requests" ADD CONSTRAINT "employee_leave_requests_employee_id_control_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "control_employees"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "employee_leave_requests" ADD CONSTRAINT "employee_leave_requests_approved_by_membership_id_organization_members_id_fk" FOREIGN KEY ("approved_by_membership_id") REFERENCES "organization_members"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_department_id_control_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "control_departments"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_manager_membership_id_organization_members_id_fk" FOREIGN KEY ("manager_membership_id") REFERENCES "organization_members"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cost_records" ADD CONSTRAINT "cost_records_cost_center_id_cost_centers_id_fk" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "internal_budgets" ADD CONSTRAINT "internal_budgets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "internal_budgets" ADD CONSTRAINT "internal_budgets_approved_by_membership_id_organization_members_id_fk" FOREIGN KEY ("approved_by_membership_id") REFERENCES "organization_members"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "internal_budget_lines" ADD CONSTRAINT "internal_budget_lines_budget_id_internal_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "internal_budgets"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "internal_budget_lines" ADD CONSTRAINT "internal_budget_lines_cost_center_id_cost_centers_id_fk" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "expense_reports" ADD CONSTRAINT "expense_reports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "expense_reports" ADD CONSTRAINT "expense_reports_employee_id_control_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "control_employees"("id") ON DELETE RESTRICT ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "expense_reports" ADD CONSTRAINT "expense_reports_cost_center_id_cost_centers_id_fk" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "expense_report_items" ADD CONSTRAINT "expense_report_items_expense_report_id_expense_reports_id_fk" FOREIGN KEY ("expense_report_id") REFERENCES "expense_reports"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "expense_report_items" ADD CONSTRAINT "expense_report_items_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "intellectual_property_assets" ADD CONSTRAINT "intellectual_property_assets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "intellectual_property_assets" ADD CONSTRAINT "intellectual_property_assets_owner_membership_id_organization_members_id_fk" FOREIGN KEY ("owner_membership_id") REFERENCES "organization_members"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "intellectual_property_assets" ADD CONSTRAINT "intellectual_property_assets_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "internal_due_diligence_cases" ADD CONSTRAINT "internal_due_diligence_cases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "internal_due_diligence_cases" ADD CONSTRAINT "internal_due_diligence_cases_owner_membership_id_organization_members_id_fk" FOREIGN KEY ("owner_membership_id") REFERENCES "organization_members"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "due_diligence_checklists" ADD CONSTRAINT "due_diligence_checklists_case_id_internal_due_diligence_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "internal_due_diligence_cases"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "due_diligence_items" ADD CONSTRAINT "due_diligence_items_checklist_id_due_diligence_checklists_id_fk" FOREIGN KEY ("checklist_id") REFERENCES "due_diligence_checklists"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "due_diligence_items" ADD CONSTRAINT "due_diligence_items_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "internal_policies" ADD CONSTRAINT "internal_policies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "internal_policies" ADD CONSTRAINT "internal_policies_owner_membership_id_organization_members_id_fk" FOREIGN KEY ("owner_membership_id") REFERENCES "organization_members"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "internal_policies" ADD CONSTRAINT "internal_policies_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "policy_acknowledgements" ADD CONSTRAINT "policy_acknowledgements_policy_id_internal_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "internal_policies"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "policy_acknowledgements" ADD CONSTRAINT "policy_acknowledgements_employee_id_control_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "control_employees"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "policy_acknowledgements" ADD CONSTRAINT "policy_acknowledgements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "compliance_risks" ADD CONSTRAINT "compliance_risks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "compliance_risks" ADD CONSTRAINT "compliance_risks_owner_membership_id_organization_members_id_fk" FOREIGN KEY ("owner_membership_id") REFERENCES "organization_members"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "compliance_controls" ADD CONSTRAINT "compliance_controls_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "compliance_controls" ADD CONSTRAINT "compliance_controls_risk_id_compliance_risks_id_fk" FOREIGN KEY ("risk_id") REFERENCES "compliance_risks"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "compliance_controls" ADD CONSTRAINT "compliance_controls_owner_membership_id_organization_members_id_fk" FOREIGN KEY ("owner_membership_id") REFERENCES "organization_members"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "compliance_incidents" ADD CONSTRAINT "compliance_incidents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "compliance_incidents" ADD CONSTRAINT "compliance_incidents_owner_membership_id_organization_members_id_fk" FOREIGN KEY ("owner_membership_id") REFERENCES "organization_members"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "compliance_audits" ADD CONSTRAINT "compliance_audits_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "compliance_audits" ADD CONSTRAINT "compliance_audits_owner_membership_id_organization_members_id_fk" FOREIGN KEY ("owner_membership_id") REFERENCES "organization_members"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "compliance_audit_findings" ADD CONSTRAINT "compliance_audit_findings_audit_id_compliance_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "compliance_audits"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "compliance_audit_findings" ADD CONSTRAINT "compliance_audit_findings_owner_membership_id_organization_members_id_fk" FOREIGN KEY ("owner_membership_id") REFERENCES "organization_members"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "compliance_obligations" ADD CONSTRAINT "compliance_obligations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "compliance_obligations" ADD CONSTRAINT "compliance_obligations_owner_membership_id_organization_members_id_fk" FOREIGN KEY ("owner_membership_id") REFERENCES "organization_members"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "compliance_obligations" ADD CONSTRAINT "compliance_obligations_evidence_document_id_documents_id_fk" FOREIGN KEY ("evidence_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "control_vendors" ADD CONSTRAINT "control_vendors_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "vendor_slas" ADD CONSTRAINT "vendor_slas_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "vendor_slas" ADD CONSTRAINT "vendor_slas_vendor_id_control_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "control_vendors"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "vendor_slas" ADD CONSTRAINT "vendor_slas_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "vendor_sla_results" ADD CONSTRAINT "vendor_sla_results_sla_id_vendor_slas_id_fk" FOREIGN KEY ("sla_id") REFERENCES "vendor_slas"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "vendor_reviews" ADD CONSTRAINT "vendor_reviews_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "vendor_reviews" ADD CONSTRAINT "vendor_reviews_vendor_id_control_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "control_vendors"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "vendor_reviews" ADD CONSTRAINT "vendor_reviews_reviewer_membership_id_organization_members_id_fk" FOREIGN KEY ("reviewer_membership_id") REFERENCES "organization_members"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "control_projects" ADD CONSTRAINT "control_projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "control_projects" ADD CONSTRAINT "control_projects_owner_membership_id_organization_members_id_fk" FOREIGN KEY ("owner_membership_id") REFERENCES "organization_members"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "control_projects" ADD CONSTRAINT "control_projects_sponsor_membership_id_organization_members_id_fk" FOREIGN KEY ("sponsor_membership_id") REFERENCES "organization_members"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "control_projects" ADD CONSTRAINT "control_projects_budget_id_internal_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "internal_budgets"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_roadmaps" ADD CONSTRAINT "product_roadmaps_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "roadmap_items" ADD CONSTRAINT "roadmap_items_roadmap_id_product_roadmaps_id_fk" FOREIGN KEY ("roadmap_id") REFERENCES "product_roadmaps"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "roadmap_items" ADD CONSTRAINT "roadmap_items_owner_membership_id_organization_members_id_fk" FOREIGN KEY ("owner_membership_id") REFERENCES "organization_members"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "roadmap_items" ADD CONSTRAINT "roadmap_items_linked_project_id_control_projects_id_fk" FOREIGN KEY ("linked_project_id") REFERENCES "control_projects"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_releases" ADD CONSTRAINT "product_releases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_bugs" ADD CONSTRAINT "product_bugs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_bugs" ADD CONSTRAINT "product_bugs_reporter_membership_id_organization_members_id_fk" FOREIGN KEY ("reporter_membership_id") REFERENCES "organization_members"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_bugs" ADD CONSTRAINT "product_bugs_owner_membership_id_organization_members_id_fk" FOREIGN KEY ("owner_membership_id") REFERENCES "organization_members"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_bugs" ADD CONSTRAINT "product_bugs_fixed_in_release_id_product_releases_id_fk" FOREIGN KEY ("fixed_in_release_id") REFERENCES "product_releases"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "technology_incidents" ADD CONSTRAINT "technology_incidents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "technology_incidents" ADD CONSTRAINT "technology_incidents_postmortem_document_id_documents_id_fk" FOREIGN KEY ("postmortem_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_features" ADD CONSTRAINT "product_features_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_features" ADD CONSTRAINT "product_features_owner_membership_id_organization_members_id_fk" FOREIGN KEY ("owner_membership_id") REFERENCES "organization_members"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_features" ADD CONSTRAINT "product_features_release_id_product_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "product_releases"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "analytics_metric_snapshots" ADD CONSTRAINT "analytics_metric_snapshots_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "analytics_export_jobs" ADD CONSTRAINT "analytics_export_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "analytics_export_jobs" ADD CONSTRAINT "analytics_export_jobs_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workflow_definitions" ADD CONSTRAINT "workflow_definitions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_definition_id_workflow_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "workflow_definitions"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_published_by_membership_id_organization_members_id_fk" FOREIGN KEY ("published_by_membership_id") REFERENCES "organization_members"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workflow_triggers" ADD CONSTRAINT "workflow_triggers_definition_id_workflow_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "workflow_definitions"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workflow_triggers" ADD CONSTRAINT "workflow_triggers_version_id_workflow_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "workflow_versions"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workflow_conditions" ADD CONSTRAINT "workflow_conditions_definition_id_workflow_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "workflow_definitions"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workflow_conditions" ADD CONSTRAINT "workflow_conditions_version_id_workflow_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "workflow_versions"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workflow_actions" ADD CONSTRAINT "workflow_actions_definition_id_workflow_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "workflow_definitions"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workflow_actions" ADD CONSTRAINT "workflow_actions_version_id_workflow_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "workflow_versions"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_definition_id_workflow_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "workflow_definitions"("id") ON DELETE RESTRICT ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_version_id_workflow_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "workflow_versions"("id") ON DELETE RESTRICT ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workflow_step_runs" ADD CONSTRAINT "workflow_step_runs_workflow_run_id_workflow_runs_id_fk" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workflow_step_runs" ADD CONSTRAINT "workflow_step_runs_action_id_workflow_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "workflow_actions"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workflow_run_history" ADD CONSTRAINT "workflow_run_history_workflow_run_id_workflow_runs_id_fk" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workflow_run_history" ADD CONSTRAINT "workflow_run_history_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE no action;
