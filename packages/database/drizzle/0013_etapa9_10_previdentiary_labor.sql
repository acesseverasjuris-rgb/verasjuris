CREATE TYPE "public"."benefit_scenario_review_status" AS ENUM('draft', 'estimated', 'review_required', 'reviewed', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."benefit_type_category" AS ENUM('retirement', 'disability', 'accident_aid', 'maternity', 'survivor_pension', 'imprisonment_aid', 'bpc_loas', 'accident_benefit', 'assistential', 'other');--> statement-breakpoint
CREATE TYPE "public"."benefit_type_source" AS ENUM('system_seed', 'organization', 'import', 'provider', 'not_configured');--> statement-breakpoint
CREATE TYPE "public"."cnis_entry_review_status" AS ENUM('unreviewed', 'accepted', 'rejected', 'corrected', 'needs_review');--> statement-breakpoint
CREATE TYPE "public"."cnis_import_status" AS ENUM('draft', 'pending_review', 'reviewed', 'rejected', 'failed', 'not_configured');--> statement-breakpoint
CREATE TYPE "public"."contribution_validation_status" AS ENUM('unreviewed', 'valid', 'invalid', 'needs_review', 'not_applicable');--> statement-breakpoint
CREATE TYPE "public"."period_review_status" AS ENUM('unreviewed', 'accepted', 'rejected', 'needs_review');--> statement-breakpoint
CREATE TYPE "public"."previdentiary_calculation_status" AS ENUM('draft', 'calculated', 'review_required', 'reviewed', 'approved', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."previdentiary_exam_modality" AS ENUM('in_person', 'remote', 'documental', 'other', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."previdentiary_exam_status" AS ENUM('scheduled', 'completed', 'missed', 'cancelled', 'rescheduled', 'result_available', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."previdentiary_regime" AS ENUM('rgps', 'rpps', 'military', 'other');--> statement-breakpoint
CREATE TYPE "public"."previdentiary_request_status" AS ENUM('draft', 'ready', 'submitted', 'under_analysis', 'requirement_open', 'decided', 'appeal', 'closed', 'cancelled', 'archived');--> statement-breakpoint
CREATE TYPE "public"."previdentiary_request_type" AS ENUM('initial_request', 'extension', 'reconsideration', 'revision', 'restoration', 'appeal', 'compliance', 'other');--> statement-breakpoint
CREATE TYPE "public"."protocol_verification_status" AS ENUM('unverified', 'manual', 'verified', 'source_unavailable', 'not_configured');--> statement-breakpoint
CREATE TYPE "public"."previdentiary_rule_set_status" AS ENUM('draft', 'active', 'deprecated', 'archived');--> statement-breakpoint
CREATE TYPE "public"."social_security_benefit_source" AS ENUM('manual', 'document', 'import', 'provider', 'not_configured');--> statement-breakpoint
CREATE TYPE "public"."social_security_benefit_status" AS ENUM('draft', 'requested', 'under_analysis', 'granted', 'active', 'suspended', 'ceased', 'denied', 'cancelled', 'under_appeal', 'judicialized', 'archived');--> statement-breakpoint
CREATE TYPE "public"."social_security_period_category" AS ENUM('employment', 'individual_contributor', 'optional', 'domestic', 'rural', 'public_service', 'special', 'interleaved_benefit', 'military', 'other');--> statement-breakpoint
CREATE TYPE "public"."social_security_period_status" AS ENUM('draft', 'active', 'reviewed', 'rejected', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."employment_contract_history_kind" AS ENUM('job_title', 'salary', 'schedule', 'workplace', 'suspension', 'leave', 'contract_change', 'other');--> statement-breakpoint
CREATE TYPE "public"."employment_contract_source" AS ENUM('manual', 'document', 'import', 'provider', 'not_configured');--> statement-breakpoint
CREATE TYPE "public"."employment_contract_status" AS ENUM('draft', 'active', 'suspended', 'terminated', 'cancelled', 'archived');--> statement-breakpoint
CREATE TYPE "public"."employment_termination_status" AS ENUM('draft', 'calculated', 'review_required', 'reviewed', 'finalized', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."fgts_review_status" AS ENUM('unreviewed', 'accepted', 'rejected', 'needs_review');--> statement-breakpoint
CREATE TYPE "public"."labor_calculation_status" AS ENUM('draft', 'calculated', 'review_required', 'reviewed', 'approved', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."labor_case_status" AS ENUM('draft', 'active', 'suspended', 'closed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."labor_claim_item_status" AS ENUM('draft', 'active', 'withdrawn', 'settled', 'rejected', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."labor_client_role" AS ENUM('employee', 'employer', 'other');--> statement-breakpoint
CREATE TYPE "public"."labor_liquidation_status" AS ENUM('draft', 'calculated', 'review_required', 'reviewed', 'approved', 'superseded', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."labor_remuneration_item_type" AS ENUM('salary', 'commission', 'gratification', 'additional', 'bonus', 'tip', 'variable', 'benefit', 'deduction', 'other');--> statement-breakpoint
CREATE TYPE "public"."labor_rule_set_status" AS ENUM('draft', 'active', 'deprecated', 'archived');--> statement-breakpoint
CREATE TYPE "public"."vacation_period_status" AS ENUM('accruing', 'available', 'scheduled', 'enjoyed', 'sold', 'paid', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."work_time_record_source" AS ENUM('manual', 'import', 'provider', 'not_configured');--> statement-breakpoint
CREATE TABLE "benefit_arrears_calculations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"previdentiary_case_id" uuid NOT NULL,
	"calculation_id" uuid,
	"benefit_id" uuid,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"monthly_values" jsonb,
	"correction_index" text,
	"interest_rule" text,
	"deductions" jsonb,
	"total_principal_cents" bigint DEFAULT 0 NOT NULL,
	"total_correction_cents" bigint DEFAULT 0 NOT NULL,
	"total_interest_cents" bigint DEFAULT 0 NOT NULL,
	"total_cents" bigint DEFAULT 0 NOT NULL,
	"rule_set_version" text,
	"status" "previdentiary_calculation_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "benefit_scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"previdentiary_case_id" uuid NOT NULL,
	"calculation_id" uuid,
	"benefit_type_id" uuid,
	"der" timestamp with time zone,
	"rule_set_version" text,
	"eligibility_status" text,
	"estimated_rmi_cents" bigint,
	"estimated_start" timestamp with time zone,
	"assumptions" jsonb,
	"missing_data" jsonb,
	"review_status" "benefit_scenario_review_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "benefit_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category" "benefit_type_category" DEFAULT 'other' NOT NULL,
	"regime" "previdentiary_regime" DEFAULT 'rgps' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"source" "benefit_type_source" DEFAULT 'system_seed' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cnis_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"import_id" uuid NOT NULL,
	"competence" text NOT NULL,
	"relationship_type" text,
	"employer" text,
	"employer_document" text,
	"remuneration_cents" bigint,
	"contribution_cents" bigint,
	"indicators" jsonb,
	"source" "social_security_benefit_source" DEFAULT 'import' NOT NULL,
	"review_status" "cnis_entry_review_status" DEFAULT 'unreviewed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cnis_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"previdentiary_case_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"source_document_id" uuid,
	"import_format" text DEFAULT 'manual' NOT NULL,
	"status" "cnis_import_status" DEFAULT 'draft' NOT NULL,
	"source" "social_security_benefit_source" DEFAULT 'manual' NOT NULL,
	"notes" text,
	"created_by_membership_id" uuid,
	"reviewed_by_membership_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cnis_warnings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"import_id" uuid NOT NULL,
	"entry_id" uuid,
	"code" text NOT NULL,
	"severity" text DEFAULT 'warning' NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "previdentiary_calculations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"previdentiary_case_id" uuid NOT NULL,
	"calculation_type" text NOT NULL,
	"rule_set_id" uuid,
	"rule_set_version" text NOT NULL,
	"reference_date" timestamp with time zone NOT NULL,
	"input_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result_snapshot" jsonb,
	"status" "previdentiary_calculation_status" DEFAULT 'draft' NOT NULL,
	"created_by_membership_id" uuid,
	"reviewed_by_membership_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "previdentiary_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"legal_matter_id" uuid NOT NULL,
	"responsible_membership_id" uuid,
	"regime" "previdentiary_regime" DEFAULT 'rgps' NOT NULL,
	"insured_category" text,
	"current_situation" text,
	"notes" text,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "previdentiary_client_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"nit_masked" text,
	"pis_masked" text,
	"category" text,
	"occupation" text,
	"rural_worker" boolean DEFAULT false NOT NULL,
	"special_exposure" boolean DEFAULT false NOT NULL,
	"disability" boolean DEFAULT false NOT NULL,
	"public_service_history" boolean DEFAULT false NOT NULL,
	"benefit_history_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "previdentiary_medical_exams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"calendar_event_id" uuid,
	"exam_type" text NOT NULL,
	"scheduled_at" timestamp with time zone,
	"timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"location" text,
	"modality" "previdentiary_exam_modality" DEFAULT 'unknown' NOT NULL,
	"examiner_info" text,
	"status" "previdentiary_exam_status" DEFAULT 'scheduled' NOT NULL,
	"result_summary" text,
	"source" "social_security_benefit_source" DEFAULT 'manual' NOT NULL,
	"document_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "previdentiary_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"previdentiary_case_id" uuid NOT NULL,
	"administrative_process_id" uuid NOT NULL,
	"benefit_type_id" uuid,
	"request_type" "previdentiary_request_type" DEFAULT 'initial_request' NOT NULL,
	"der" timestamp with time zone,
	"protocol_number" text,
	"protocol_date" timestamp with time zone,
	"protocol_source" text DEFAULT 'manual' NOT NULL,
	"protocol_verification_status" "protocol_verification_status" DEFAULT 'manual' NOT NULL,
	"status" "previdentiary_request_status" DEFAULT 'draft' NOT NULL,
	"source" "social_security_benefit_source" DEFAULT 'manual' NOT NULL,
	"justification_summary" text,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "previdentiary_rule_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"version" text NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"source" text DEFAULT 'system_seed' NOT NULL,
	"source_url" text,
	"status" "previdentiary_rule_set_status" DEFAULT 'draft' NOT NULL,
	"metadata" jsonb,
	"locked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "previdentiary_social_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"calendar_event_id" uuid,
	"scheduled_at" timestamp with time zone,
	"timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"location" text,
	"modality" "previdentiary_exam_modality" DEFAULT 'unknown' NOT NULL,
	"status" "previdentiary_exam_status" DEFAULT 'scheduled' NOT NULL,
	"result_summary" text,
	"source" "social_security_benefit_source" DEFAULT 'manual' NOT NULL,
	"document_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rural_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"previdentiary_case_id" uuid NOT NULL,
	"period_id" uuid,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"regime" text,
	"evidence_notes" text,
	"review_status" "period_review_status" DEFAULT 'unreviewed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_security_benefit_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"benefit_id" uuid NOT NULL,
	"previous_status" "social_security_benefit_status",
	"new_status" "social_security_benefit_status",
	"event" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" "social_security_benefit_source" DEFAULT 'manual' NOT NULL,
	"actor_membership_id" uuid,
	"document_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_security_benefits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"previdentiary_case_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"benefit_type_id" uuid NOT NULL,
	"nb" text,
	"normalized_nb" text,
	"der" timestamp with time zone,
	"dib" timestamp with time zone,
	"dcb" timestamp with time zone,
	"dip" timestamp with time zone,
	"cessacao_at" timestamp with time zone,
	"status" "social_security_benefit_status" DEFAULT 'draft' NOT NULL,
	"administrative_process_id" uuid,
	"judicial_process_id" uuid,
	"source" "social_security_benefit_source" DEFAULT 'manual' NOT NULL,
	"source_reference" text,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_security_contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"previdentiary_case_id" uuid NOT NULL,
	"period_id" uuid,
	"competence" text NOT NULL,
	"remuneration_cents" bigint DEFAULT 0 NOT NULL,
	"contribution_cents" bigint,
	"contribution_type" text,
	"source" "social_security_benefit_source" DEFAULT 'manual' NOT NULL,
	"source_document_id" uuid,
	"validation_status" "contribution_validation_status" DEFAULT 'unreviewed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_security_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"previdentiary_case_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"category" "social_security_period_category" DEFAULT 'other' NOT NULL,
	"employer_name" text,
	"employer_document" text,
	"source" "social_security_benefit_source" DEFAULT 'manual' NOT NULL,
	"source_document_id" uuid,
	"status" "social_security_period_status" DEFAULT 'draft' NOT NULL,
	"reviewed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "special_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"previdentiary_case_id" uuid NOT NULL,
	"period_id" uuid,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"agent" text,
	"intensity" text,
	"concentration" text,
	"ppp_document_id" uuid,
	"ltcat_document_id" uuid,
	"evidence_notes" text,
	"review_status" "period_review_status" DEFAULT 'unreviewed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employment_contract_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"kind" "employment_contract_history_kind" DEFAULT 'other' NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"previous_value" jsonb,
	"new_value" jsonb,
	"notes" text,
	"source" "employment_contract_source" DEFAULT 'manual' NOT NULL,
	"actor_membership_id" uuid,
	"document_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employment_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"labor_case_id" uuid NOT NULL,
	"employee_client_id" uuid,
	"employer_name" text NOT NULL,
	"employer_document" text,
	"admission_date" timestamp with time zone NOT NULL,
	"termination_date" timestamp with time zone,
	"contract_type" text,
	"job_title" text,
	"workplace" text,
	"salary_cents" bigint DEFAULT 0 NOT NULL,
	"remuneration_structure" jsonb,
	"weekly_hours" integer,
	"status" "employment_contract_status" DEFAULT 'draft' NOT NULL,
	"source" "employment_contract_source" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employment_terminations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"labor_case_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"termination_type" text NOT NULL,
	"notice_type" text,
	"notice_start" timestamp with time zone,
	"notice_end" timestamp with time zone,
	"termination_date" timestamp with time zone NOT NULL,
	"reason" text,
	"last_salary_cents" bigint,
	"status" "employment_termination_status" DEFAULT 'draft' NOT NULL,
	"source" "employment_contract_source" DEFAULT 'manual' NOT NULL,
	"document_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fgts_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"labor_case_id" uuid NOT NULL,
	"contract_id" uuid,
	"competence" text NOT NULL,
	"base_amount_cents" bigint DEFAULT 0 NOT NULL,
	"due_amount_cents" bigint DEFAULT 0 NOT NULL,
	"paid_amount_cents" bigint,
	"payment_date" timestamp with time zone,
	"source" "employment_contract_source" DEFAULT 'manual' NOT NULL,
	"review_status" "fgts_review_status" DEFAULT 'unreviewed' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "labor_calculations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"labor_case_id" uuid NOT NULL,
	"calculation_type" text NOT NULL,
	"reference_date" timestamp with time zone NOT NULL,
	"rule_set_id" uuid,
	"rule_set_version" text NOT NULL,
	"input_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result_snapshot" jsonb,
	"status" "labor_calculation_status" DEFAULT 'draft' NOT NULL,
	"created_by_membership_id" uuid,
	"reviewed_by_membership_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "labor_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"legal_matter_id" uuid NOT NULL,
	"judicial_process_id" uuid,
	"responsible_membership_id" uuid,
	"client_role" "labor_client_role" DEFAULT 'employee' NOT NULL,
	"status" "labor_case_status" DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "labor_claim_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"labor_case_id" uuid NOT NULL,
	"claim_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"amount_cents" bigint,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"status" "labor_claim_item_status" DEFAULT 'draft' NOT NULL,
	"facts" text,
	"evidence_notes" text,
	"calculation_id" uuid,
	"document_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "labor_liquidations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"labor_case_id" uuid NOT NULL,
	"calculation_id" uuid,
	"reference_date" timestamp with time zone NOT NULL,
	"rule_set_version" text,
	"items_snapshot" jsonb,
	"periods_snapshot" jsonb,
	"correction_index" text,
	"interest_rule" text,
	"contributions_cents" bigint DEFAULT 0 NOT NULL,
	"deductions_cents" bigint DEFAULT 0 NOT NULL,
	"total_principal_cents" bigint DEFAULT 0 NOT NULL,
	"total_correction_cents" bigint DEFAULT 0 NOT NULL,
	"total_interest_cents" bigint DEFAULT 0 NOT NULL,
	"total_cents" bigint DEFAULT 0 NOT NULL,
	"status" "labor_liquidation_status" DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_by_membership_id" uuid,
	"reviewed_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "labor_remuneration_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"labor_case_id" uuid NOT NULL,
	"contract_id" uuid,
	"item_type" "labor_remuneration_item_type" DEFAULT 'other' NOT NULL,
	"description" text NOT NULL,
	"competence" text,
	"amount_cents" bigint DEFAULT 0 NOT NULL,
	"is_credit" boolean DEFAULT true NOT NULL,
	"source" "employment_contract_source" DEFAULT 'manual' NOT NULL,
	"document_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "labor_rule_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"version" text NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"source" text DEFAULT 'system_seed' NOT NULL,
	"source_url" text,
	"status" "labor_rule_set_status" DEFAULT 'draft' NOT NULL,
	"metadata" jsonb,
	"locked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vacation_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"labor_case_id" uuid NOT NULL,
	"contract_id" uuid,
	"accrual_start" timestamp with time zone NOT NULL,
	"accrual_end" timestamp with time zone NOT NULL,
	"concession_start" timestamp with time zone,
	"concession_end" timestamp with time zone,
	"enjoyed_days" integer DEFAULT 0 NOT NULL,
	"sold_days" integer DEFAULT 0 NOT NULL,
	"payment_date" timestamp with time zone,
	"amount_cents" bigint,
	"status" "vacation_period_status" DEFAULT 'accruing' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"labor_case_id" uuid NOT NULL,
	"contract_id" uuid,
	"name" text NOT NULL,
	"weekly_hours" integer,
	"schedule_pattern" jsonb,
	"includes_night_shift" boolean DEFAULT false NOT NULL,
	"includes_overtime_bank" boolean DEFAULT false NOT NULL,
	"effective_from" timestamp with time zone,
	"effective_to" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_time_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"labor_case_id" uuid NOT NULL,
	"contract_id" uuid,
	"schedule_id" uuid,
	"work_date" timestamp with time zone NOT NULL,
	"clock_in_at" timestamp with time zone,
	"clock_out_at" timestamp with time zone,
	"break_minutes" integer,
	"overtime_minutes" integer,
	"night_minutes" integer,
	"notes" text,
	"source" "work_time_record_source" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "benefit_arrears_calculations" ADD CONSTRAINT "benefit_arrears_calculations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benefit_arrears_calculations" ADD CONSTRAINT "benefit_arrears_calculations_previdentiary_case_id_previdentiary_cases_id_fk" FOREIGN KEY ("previdentiary_case_id") REFERENCES "public"."previdentiary_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benefit_arrears_calculations" ADD CONSTRAINT "benefit_arrears_calculations_calculation_id_previdentiary_calculations_id_fk" FOREIGN KEY ("calculation_id") REFERENCES "public"."previdentiary_calculations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benefit_arrears_calculations" ADD CONSTRAINT "benefit_arrears_calculations_benefit_id_social_security_benefits_id_fk" FOREIGN KEY ("benefit_id") REFERENCES "public"."social_security_benefits"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benefit_scenarios" ADD CONSTRAINT "benefit_scenarios_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benefit_scenarios" ADD CONSTRAINT "benefit_scenarios_previdentiary_case_id_previdentiary_cases_id_fk" FOREIGN KEY ("previdentiary_case_id") REFERENCES "public"."previdentiary_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benefit_scenarios" ADD CONSTRAINT "benefit_scenarios_calculation_id_previdentiary_calculations_id_fk" FOREIGN KEY ("calculation_id") REFERENCES "public"."previdentiary_calculations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benefit_scenarios" ADD CONSTRAINT "benefit_scenarios_benefit_type_id_benefit_types_id_fk" FOREIGN KEY ("benefit_type_id") REFERENCES "public"."benefit_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cnis_entries" ADD CONSTRAINT "cnis_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cnis_entries" ADD CONSTRAINT "cnis_entries_import_id_cnis_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."cnis_imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cnis_imports" ADD CONSTRAINT "cnis_imports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cnis_imports" ADD CONSTRAINT "cnis_imports_previdentiary_case_id_previdentiary_cases_id_fk" FOREIGN KEY ("previdentiary_case_id") REFERENCES "public"."previdentiary_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cnis_imports" ADD CONSTRAINT "cnis_imports_client_id_crm_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."crm_clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cnis_imports" ADD CONSTRAINT "cnis_imports_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cnis_imports" ADD CONSTRAINT "cnis_imports_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cnis_imports" ADD CONSTRAINT "cnis_imports_reviewed_by_membership_id_organization_members_id_fk" FOREIGN KEY ("reviewed_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cnis_warnings" ADD CONSTRAINT "cnis_warnings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cnis_warnings" ADD CONSTRAINT "cnis_warnings_import_id_cnis_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."cnis_imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cnis_warnings" ADD CONSTRAINT "cnis_warnings_entry_id_cnis_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."cnis_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "previdentiary_calculations" ADD CONSTRAINT "previdentiary_calculations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "previdentiary_calculations" ADD CONSTRAINT "previdentiary_calculations_previdentiary_case_id_previdentiary_cases_id_fk" FOREIGN KEY ("previdentiary_case_id") REFERENCES "public"."previdentiary_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "previdentiary_calculations" ADD CONSTRAINT "previdentiary_calculations_rule_set_id_previdentiary_rule_sets_id_fk" FOREIGN KEY ("rule_set_id") REFERENCES "public"."previdentiary_rule_sets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "previdentiary_calculations" ADD CONSTRAINT "previdentiary_calculations_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "previdentiary_calculations" ADD CONSTRAINT "previdentiary_calculations_reviewed_by_membership_id_organization_members_id_fk" FOREIGN KEY ("reviewed_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "previdentiary_cases" ADD CONSTRAINT "previdentiary_cases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "previdentiary_cases" ADD CONSTRAINT "previdentiary_cases_client_id_crm_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."crm_clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "previdentiary_cases" ADD CONSTRAINT "previdentiary_cases_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "previdentiary_cases" ADD CONSTRAINT "previdentiary_cases_responsible_membership_id_organization_members_id_fk" FOREIGN KEY ("responsible_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "previdentiary_cases" ADD CONSTRAINT "previdentiary_cases_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "previdentiary_client_profiles" ADD CONSTRAINT "previdentiary_client_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "previdentiary_client_profiles" ADD CONSTRAINT "previdentiary_client_profiles_client_id_crm_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."crm_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "previdentiary_medical_exams" ADD CONSTRAINT "previdentiary_medical_exams_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "previdentiary_medical_exams" ADD CONSTRAINT "previdentiary_medical_exams_request_id_previdentiary_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."previdentiary_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "previdentiary_medical_exams" ADD CONSTRAINT "previdentiary_medical_exams_calendar_event_id_calendar_events_id_fk" FOREIGN KEY ("calendar_event_id") REFERENCES "public"."calendar_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "previdentiary_medical_exams" ADD CONSTRAINT "previdentiary_medical_exams_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "previdentiary_requests" ADD CONSTRAINT "previdentiary_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "previdentiary_requests" ADD CONSTRAINT "previdentiary_requests_previdentiary_case_id_previdentiary_cases_id_fk" FOREIGN KEY ("previdentiary_case_id") REFERENCES "public"."previdentiary_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "previdentiary_requests" ADD CONSTRAINT "previdentiary_requests_administrative_process_id_administrative_processes_id_fk" FOREIGN KEY ("administrative_process_id") REFERENCES "public"."administrative_processes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "previdentiary_requests" ADD CONSTRAINT "previdentiary_requests_benefit_type_id_benefit_types_id_fk" FOREIGN KEY ("benefit_type_id") REFERENCES "public"."benefit_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "previdentiary_requests" ADD CONSTRAINT "previdentiary_requests_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "previdentiary_social_assessments" ADD CONSTRAINT "previdentiary_social_assessments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "previdentiary_social_assessments" ADD CONSTRAINT "previdentiary_social_assessments_request_id_previdentiary_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."previdentiary_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "previdentiary_social_assessments" ADD CONSTRAINT "previdentiary_social_assessments_calendar_event_id_calendar_events_id_fk" FOREIGN KEY ("calendar_event_id") REFERENCES "public"."calendar_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "previdentiary_social_assessments" ADD CONSTRAINT "previdentiary_social_assessments_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rural_periods" ADD CONSTRAINT "rural_periods_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rural_periods" ADD CONSTRAINT "rural_periods_previdentiary_case_id_previdentiary_cases_id_fk" FOREIGN KEY ("previdentiary_case_id") REFERENCES "public"."previdentiary_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rural_periods" ADD CONSTRAINT "rural_periods_period_id_social_security_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."social_security_periods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_security_benefit_history" ADD CONSTRAINT "social_security_benefit_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_security_benefit_history" ADD CONSTRAINT "social_security_benefit_history_benefit_id_social_security_benefits_id_fk" FOREIGN KEY ("benefit_id") REFERENCES "public"."social_security_benefits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_security_benefit_history" ADD CONSTRAINT "social_security_benefit_history_actor_membership_id_organization_members_id_fk" FOREIGN KEY ("actor_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_security_benefit_history" ADD CONSTRAINT "social_security_benefit_history_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_security_benefits" ADD CONSTRAINT "social_security_benefits_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_security_benefits" ADD CONSTRAINT "social_security_benefits_previdentiary_case_id_previdentiary_cases_id_fk" FOREIGN KEY ("previdentiary_case_id") REFERENCES "public"."previdentiary_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_security_benefits" ADD CONSTRAINT "social_security_benefits_client_id_crm_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."crm_clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_security_benefits" ADD CONSTRAINT "social_security_benefits_benefit_type_id_benefit_types_id_fk" FOREIGN KEY ("benefit_type_id") REFERENCES "public"."benefit_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_security_benefits" ADD CONSTRAINT "social_security_benefits_administrative_process_id_administrative_processes_id_fk" FOREIGN KEY ("administrative_process_id") REFERENCES "public"."administrative_processes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_security_benefits" ADD CONSTRAINT "social_security_benefits_judicial_process_id_judicial_processes_id_fk" FOREIGN KEY ("judicial_process_id") REFERENCES "public"."judicial_processes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_security_benefits" ADD CONSTRAINT "social_security_benefits_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_security_contributions" ADD CONSTRAINT "social_security_contributions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_security_contributions" ADD CONSTRAINT "social_security_contributions_previdentiary_case_id_previdentiary_cases_id_fk" FOREIGN KEY ("previdentiary_case_id") REFERENCES "public"."previdentiary_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_security_contributions" ADD CONSTRAINT "social_security_contributions_period_id_social_security_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."social_security_periods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_security_contributions" ADD CONSTRAINT "social_security_contributions_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_security_periods" ADD CONSTRAINT "social_security_periods_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_security_periods" ADD CONSTRAINT "social_security_periods_previdentiary_case_id_previdentiary_cases_id_fk" FOREIGN KEY ("previdentiary_case_id") REFERENCES "public"."previdentiary_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_security_periods" ADD CONSTRAINT "social_security_periods_client_id_crm_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."crm_clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_security_periods" ADD CONSTRAINT "social_security_periods_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "special_periods" ADD CONSTRAINT "special_periods_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "special_periods" ADD CONSTRAINT "special_periods_previdentiary_case_id_previdentiary_cases_id_fk" FOREIGN KEY ("previdentiary_case_id") REFERENCES "public"."previdentiary_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "special_periods" ADD CONSTRAINT "special_periods_period_id_social_security_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."social_security_periods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "special_periods" ADD CONSTRAINT "special_periods_ppp_document_id_documents_id_fk" FOREIGN KEY ("ppp_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "special_periods" ADD CONSTRAINT "special_periods_ltcat_document_id_documents_id_fk" FOREIGN KEY ("ltcat_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_contract_history" ADD CONSTRAINT "employment_contract_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_contract_history" ADD CONSTRAINT "employment_contract_history_contract_id_employment_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."employment_contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_contract_history" ADD CONSTRAINT "employment_contract_history_actor_membership_id_organization_members_id_fk" FOREIGN KEY ("actor_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_contract_history" ADD CONSTRAINT "employment_contract_history_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_contracts" ADD CONSTRAINT "employment_contracts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_contracts" ADD CONSTRAINT "employment_contracts_labor_case_id_labor_cases_id_fk" FOREIGN KEY ("labor_case_id") REFERENCES "public"."labor_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_contracts" ADD CONSTRAINT "employment_contracts_employee_client_id_crm_clients_id_fk" FOREIGN KEY ("employee_client_id") REFERENCES "public"."crm_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_terminations" ADD CONSTRAINT "employment_terminations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_terminations" ADD CONSTRAINT "employment_terminations_labor_case_id_labor_cases_id_fk" FOREIGN KEY ("labor_case_id") REFERENCES "public"."labor_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_terminations" ADD CONSTRAINT "employment_terminations_contract_id_employment_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."employment_contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_terminations" ADD CONSTRAINT "employment_terminations_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fgts_records" ADD CONSTRAINT "fgts_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fgts_records" ADD CONSTRAINT "fgts_records_labor_case_id_labor_cases_id_fk" FOREIGN KEY ("labor_case_id") REFERENCES "public"."labor_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fgts_records" ADD CONSTRAINT "fgts_records_contract_id_employment_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."employment_contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labor_calculations" ADD CONSTRAINT "labor_calculations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labor_calculations" ADD CONSTRAINT "labor_calculations_labor_case_id_labor_cases_id_fk" FOREIGN KEY ("labor_case_id") REFERENCES "public"."labor_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labor_calculations" ADD CONSTRAINT "labor_calculations_rule_set_id_labor_rule_sets_id_fk" FOREIGN KEY ("rule_set_id") REFERENCES "public"."labor_rule_sets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labor_calculations" ADD CONSTRAINT "labor_calculations_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labor_calculations" ADD CONSTRAINT "labor_calculations_reviewed_by_membership_id_organization_members_id_fk" FOREIGN KEY ("reviewed_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labor_cases" ADD CONSTRAINT "labor_cases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labor_cases" ADD CONSTRAINT "labor_cases_client_id_crm_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."crm_clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labor_cases" ADD CONSTRAINT "labor_cases_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labor_cases" ADD CONSTRAINT "labor_cases_judicial_process_id_judicial_processes_id_fk" FOREIGN KEY ("judicial_process_id") REFERENCES "public"."judicial_processes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labor_cases" ADD CONSTRAINT "labor_cases_responsible_membership_id_organization_members_id_fk" FOREIGN KEY ("responsible_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labor_cases" ADD CONSTRAINT "labor_cases_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labor_claim_items" ADD CONSTRAINT "labor_claim_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labor_claim_items" ADD CONSTRAINT "labor_claim_items_labor_case_id_labor_cases_id_fk" FOREIGN KEY ("labor_case_id") REFERENCES "public"."labor_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labor_claim_items" ADD CONSTRAINT "labor_claim_items_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labor_liquidations" ADD CONSTRAINT "labor_liquidations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labor_liquidations" ADD CONSTRAINT "labor_liquidations_labor_case_id_labor_cases_id_fk" FOREIGN KEY ("labor_case_id") REFERENCES "public"."labor_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labor_liquidations" ADD CONSTRAINT "labor_liquidations_calculation_id_labor_calculations_id_fk" FOREIGN KEY ("calculation_id") REFERENCES "public"."labor_calculations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labor_liquidations" ADD CONSTRAINT "labor_liquidations_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labor_liquidations" ADD CONSTRAINT "labor_liquidations_reviewed_by_membership_id_organization_members_id_fk" FOREIGN KEY ("reviewed_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labor_remuneration_items" ADD CONSTRAINT "labor_remuneration_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labor_remuneration_items" ADD CONSTRAINT "labor_remuneration_items_labor_case_id_labor_cases_id_fk" FOREIGN KEY ("labor_case_id") REFERENCES "public"."labor_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labor_remuneration_items" ADD CONSTRAINT "labor_remuneration_items_contract_id_employment_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."employment_contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labor_remuneration_items" ADD CONSTRAINT "labor_remuneration_items_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacation_periods" ADD CONSTRAINT "vacation_periods_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacation_periods" ADD CONSTRAINT "vacation_periods_labor_case_id_labor_cases_id_fk" FOREIGN KEY ("labor_case_id") REFERENCES "public"."labor_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacation_periods" ADD CONSTRAINT "vacation_periods_contract_id_employment_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."employment_contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_schedules" ADD CONSTRAINT "work_schedules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_schedules" ADD CONSTRAINT "work_schedules_labor_case_id_labor_cases_id_fk" FOREIGN KEY ("labor_case_id") REFERENCES "public"."labor_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_schedules" ADD CONSTRAINT "work_schedules_contract_id_employment_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."employment_contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_time_records" ADD CONSTRAINT "work_time_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_time_records" ADD CONSTRAINT "work_time_records_labor_case_id_labor_cases_id_fk" FOREIGN KEY ("labor_case_id") REFERENCES "public"."labor_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_time_records" ADD CONSTRAINT "work_time_records_contract_id_employment_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."employment_contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_time_records" ADD CONSTRAINT "work_time_records_schedule_id_work_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."work_schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "benefit_arrears_calculations_org_idx" ON "benefit_arrears_calculations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "benefit_arrears_calculations_case_idx" ON "benefit_arrears_calculations" USING btree ("previdentiary_case_id");--> statement-breakpoint
CREATE INDEX "benefit_arrears_calculations_dates_idx" ON "benefit_arrears_calculations" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "benefit_arrears_calculations_status_idx" ON "benefit_arrears_calculations" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "benefit_scenarios_org_idx" ON "benefit_scenarios" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "benefit_scenarios_case_idx" ON "benefit_scenarios" USING btree ("previdentiary_case_id");--> statement-breakpoint
CREATE INDEX "benefit_scenarios_review_idx" ON "benefit_scenarios" USING btree ("organization_id","review_status");--> statement-breakpoint
CREATE UNIQUE INDEX "benefit_types_code_unique" ON "benefit_types" USING btree ("code");--> statement-breakpoint
CREATE INDEX "benefit_types_category_idx" ON "benefit_types" USING btree ("category");--> statement-breakpoint
CREATE INDEX "benefit_types_regime_idx" ON "benefit_types" USING btree ("regime");--> statement-breakpoint
CREATE INDEX "benefit_types_active_idx" ON "benefit_types" USING btree ("active");--> statement-breakpoint
CREATE INDEX "cnis_entries_org_idx" ON "cnis_entries" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "cnis_entries_import_idx" ON "cnis_entries" USING btree ("import_id");--> statement-breakpoint
CREATE INDEX "cnis_entries_competence_idx" ON "cnis_entries" USING btree ("organization_id","competence");--> statement-breakpoint
CREATE INDEX "cnis_entries_review_idx" ON "cnis_entries" USING btree ("organization_id","review_status");--> statement-breakpoint
CREATE INDEX "cnis_imports_org_idx" ON "cnis_imports" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "cnis_imports_case_idx" ON "cnis_imports" USING btree ("previdentiary_case_id");--> statement-breakpoint
CREATE INDEX "cnis_imports_org_status_idx" ON "cnis_imports" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "cnis_imports_org_client_idx" ON "cnis_imports" USING btree ("organization_id","client_id");--> statement-breakpoint
CREATE INDEX "cnis_warnings_org_idx" ON "cnis_warnings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "cnis_warnings_import_idx" ON "cnis_warnings" USING btree ("import_id");--> statement-breakpoint
CREATE INDEX "cnis_warnings_entry_idx" ON "cnis_warnings" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "previdentiary_calculations_org_idx" ON "previdentiary_calculations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "previdentiary_calculations_case_idx" ON "previdentiary_calculations" USING btree ("previdentiary_case_id");--> statement-breakpoint
CREATE INDEX "previdentiary_calculations_org_status_idx" ON "previdentiary_calculations" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "previdentiary_calculations_reference_idx" ON "previdentiary_calculations" USING btree ("reference_date");--> statement-breakpoint
CREATE INDEX "previdentiary_calculations_rule_set_idx" ON "previdentiary_calculations" USING btree ("rule_set_id");--> statement-breakpoint
CREATE INDEX "previdentiary_cases_org_idx" ON "previdentiary_cases" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "previdentiary_cases_org_client_idx" ON "previdentiary_cases" USING btree ("organization_id","client_id");--> statement-breakpoint
CREATE INDEX "previdentiary_cases_matter_idx" ON "previdentiary_cases" USING btree ("legal_matter_id");--> statement-breakpoint
CREATE INDEX "previdentiary_cases_org_regime_idx" ON "previdentiary_cases" USING btree ("organization_id","regime");--> statement-breakpoint
CREATE INDEX "previdentiary_cases_responsible_idx" ON "previdentiary_cases" USING btree ("responsible_membership_id");--> statement-breakpoint
CREATE UNIQUE INDEX "previdentiary_client_profiles_org_client_unique" ON "previdentiary_client_profiles" USING btree ("organization_id","client_id");--> statement-breakpoint
CREATE INDEX "previdentiary_client_profiles_org_idx" ON "previdentiary_client_profiles" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "previdentiary_client_profiles_client_idx" ON "previdentiary_client_profiles" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "previdentiary_medical_exams_org_idx" ON "previdentiary_medical_exams" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "previdentiary_medical_exams_request_idx" ON "previdentiary_medical_exams" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "previdentiary_medical_exams_calendar_idx" ON "previdentiary_medical_exams" USING btree ("calendar_event_id");--> statement-breakpoint
CREATE INDEX "previdentiary_medical_exams_status_idx" ON "previdentiary_medical_exams" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "previdentiary_medical_exams_scheduled_idx" ON "previdentiary_medical_exams" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "previdentiary_requests_org_idx" ON "previdentiary_requests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "previdentiary_requests_case_idx" ON "previdentiary_requests" USING btree ("previdentiary_case_id");--> statement-breakpoint
CREATE INDEX "previdentiary_requests_admin_process_idx" ON "previdentiary_requests" USING btree ("administrative_process_id");--> statement-breakpoint
CREATE INDEX "previdentiary_requests_org_status_idx" ON "previdentiary_requests" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "previdentiary_requests_der_idx" ON "previdentiary_requests" USING btree ("der");--> statement-breakpoint
CREATE UNIQUE INDEX "previdentiary_rule_sets_key_version_unique" ON "previdentiary_rule_sets" USING btree ("key","version");--> statement-breakpoint
CREATE INDEX "previdentiary_rule_sets_status_idx" ON "previdentiary_rule_sets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "previdentiary_rule_sets_effective_idx" ON "previdentiary_rule_sets" USING btree ("effective_from","effective_to");--> statement-breakpoint
CREATE INDEX "previdentiary_social_assessments_org_idx" ON "previdentiary_social_assessments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "previdentiary_social_assessments_request_idx" ON "previdentiary_social_assessments" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "previdentiary_social_assessments_calendar_idx" ON "previdentiary_social_assessments" USING btree ("calendar_event_id");--> statement-breakpoint
CREATE INDEX "previdentiary_social_assessments_status_idx" ON "previdentiary_social_assessments" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "previdentiary_social_assessments_scheduled_idx" ON "previdentiary_social_assessments" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "rural_periods_org_idx" ON "rural_periods" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "rural_periods_case_idx" ON "rural_periods" USING btree ("previdentiary_case_id");--> statement-breakpoint
CREATE INDEX "rural_periods_dates_idx" ON "rural_periods" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "rural_periods_review_idx" ON "rural_periods" USING btree ("organization_id","review_status");--> statement-breakpoint
CREATE INDEX "social_security_benefit_history_org_idx" ON "social_security_benefit_history" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "social_security_benefit_history_benefit_idx" ON "social_security_benefit_history" USING btree ("benefit_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "social_security_benefits_org_nb_unique" ON "social_security_benefits" USING btree ("organization_id","normalized_nb") WHERE "social_security_benefits"."normalized_nb" is not null;--> statement-breakpoint
CREATE INDEX "social_security_benefits_org_idx" ON "social_security_benefits" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "social_security_benefits_org_status_idx" ON "social_security_benefits" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "social_security_benefits_org_client_idx" ON "social_security_benefits" USING btree ("organization_id","client_id");--> statement-breakpoint
CREATE INDEX "social_security_benefits_case_idx" ON "social_security_benefits" USING btree ("previdentiary_case_id");--> statement-breakpoint
CREATE INDEX "social_security_benefits_der_idx" ON "social_security_benefits" USING btree ("der");--> statement-breakpoint
CREATE INDEX "social_security_benefits_dib_idx" ON "social_security_benefits" USING btree ("dib");--> statement-breakpoint
CREATE INDEX "social_security_benefits_type_idx" ON "social_security_benefits" USING btree ("benefit_type_id");--> statement-breakpoint
CREATE INDEX "social_security_contributions_org_idx" ON "social_security_contributions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "social_security_contributions_case_idx" ON "social_security_contributions" USING btree ("previdentiary_case_id");--> statement-breakpoint
CREATE INDEX "social_security_contributions_period_idx" ON "social_security_contributions" USING btree ("period_id");--> statement-breakpoint
CREATE INDEX "social_security_contributions_competence_idx" ON "social_security_contributions" USING btree ("organization_id","competence");--> statement-breakpoint
CREATE INDEX "social_security_periods_org_idx" ON "social_security_periods" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "social_security_periods_case_idx" ON "social_security_periods" USING btree ("previdentiary_case_id");--> statement-breakpoint
CREATE INDEX "social_security_periods_org_client_idx" ON "social_security_periods" USING btree ("organization_id","client_id");--> statement-breakpoint
CREATE INDEX "social_security_periods_dates_idx" ON "social_security_periods" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "social_security_periods_status_idx" ON "social_security_periods" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "special_periods_org_idx" ON "special_periods" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "special_periods_case_idx" ON "special_periods" USING btree ("previdentiary_case_id");--> statement-breakpoint
CREATE INDEX "special_periods_dates_idx" ON "special_periods" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "special_periods_review_idx" ON "special_periods" USING btree ("organization_id","review_status");--> statement-breakpoint
CREATE INDEX "employment_contract_history_org_idx" ON "employment_contract_history" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "employment_contract_history_contract_idx" ON "employment_contract_history" USING btree ("contract_id","effective_from");--> statement-breakpoint
CREATE INDEX "employment_contracts_org_idx" ON "employment_contracts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "employment_contracts_case_idx" ON "employment_contracts" USING btree ("labor_case_id");--> statement-breakpoint
CREATE INDEX "employment_contracts_org_status_idx" ON "employment_contracts" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "employment_contracts_admission_idx" ON "employment_contracts" USING btree ("admission_date");--> statement-breakpoint
CREATE INDEX "employment_contracts_employee_idx" ON "employment_contracts" USING btree ("employee_client_id");--> statement-breakpoint
CREATE INDEX "employment_terminations_org_idx" ON "employment_terminations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "employment_terminations_case_idx" ON "employment_terminations" USING btree ("labor_case_id");--> statement-breakpoint
CREATE INDEX "employment_terminations_contract_idx" ON "employment_terminations" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "employment_terminations_org_status_idx" ON "employment_terminations" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "employment_terminations_date_idx" ON "employment_terminations" USING btree ("termination_date");--> statement-breakpoint
CREATE INDEX "fgts_records_org_idx" ON "fgts_records" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "fgts_records_case_idx" ON "fgts_records" USING btree ("labor_case_id");--> statement-breakpoint
CREATE INDEX "fgts_records_competence_idx" ON "fgts_records" USING btree ("organization_id","competence");--> statement-breakpoint
CREATE INDEX "fgts_records_review_idx" ON "fgts_records" USING btree ("organization_id","review_status");--> statement-breakpoint
CREATE INDEX "labor_calculations_org_idx" ON "labor_calculations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "labor_calculations_case_idx" ON "labor_calculations" USING btree ("labor_case_id");--> statement-breakpoint
CREATE INDEX "labor_calculations_org_status_idx" ON "labor_calculations" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "labor_calculations_reference_idx" ON "labor_calculations" USING btree ("reference_date");--> statement-breakpoint
CREATE INDEX "labor_calculations_rule_set_idx" ON "labor_calculations" USING btree ("rule_set_id");--> statement-breakpoint
CREATE INDEX "labor_cases_org_idx" ON "labor_cases" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "labor_cases_org_client_idx" ON "labor_cases" USING btree ("organization_id","client_id");--> statement-breakpoint
CREATE INDEX "labor_cases_org_status_idx" ON "labor_cases" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "labor_cases_matter_idx" ON "labor_cases" USING btree ("legal_matter_id");--> statement-breakpoint
CREATE INDEX "labor_cases_judicial_idx" ON "labor_cases" USING btree ("judicial_process_id");--> statement-breakpoint
CREATE INDEX "labor_cases_responsible_idx" ON "labor_cases" USING btree ("responsible_membership_id");--> statement-breakpoint
CREATE INDEX "labor_claim_items_org_idx" ON "labor_claim_items" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "labor_claim_items_case_idx" ON "labor_claim_items" USING btree ("labor_case_id");--> statement-breakpoint
CREATE INDEX "labor_claim_items_org_status_idx" ON "labor_claim_items" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "labor_claim_items_type_idx" ON "labor_claim_items" USING btree ("organization_id","claim_type");--> statement-breakpoint
CREATE INDEX "labor_liquidations_org_idx" ON "labor_liquidations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "labor_liquidations_case_idx" ON "labor_liquidations" USING btree ("labor_case_id");--> statement-breakpoint
CREATE INDEX "labor_liquidations_org_status_idx" ON "labor_liquidations" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "labor_liquidations_reference_idx" ON "labor_liquidations" USING btree ("reference_date");--> statement-breakpoint
CREATE INDEX "labor_remuneration_items_org_idx" ON "labor_remuneration_items" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "labor_remuneration_items_case_idx" ON "labor_remuneration_items" USING btree ("labor_case_id");--> statement-breakpoint
CREATE INDEX "labor_remuneration_items_competence_idx" ON "labor_remuneration_items" USING btree ("organization_id","competence");--> statement-breakpoint
CREATE INDEX "labor_remuneration_items_type_idx" ON "labor_remuneration_items" USING btree ("organization_id","item_type");--> statement-breakpoint
CREATE UNIQUE INDEX "labor_rule_sets_key_version_unique" ON "labor_rule_sets" USING btree ("key","version");--> statement-breakpoint
CREATE INDEX "labor_rule_sets_status_idx" ON "labor_rule_sets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "labor_rule_sets_effective_idx" ON "labor_rule_sets" USING btree ("effective_from","effective_to");--> statement-breakpoint
CREATE INDEX "vacation_periods_org_idx" ON "vacation_periods" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "vacation_periods_case_idx" ON "vacation_periods" USING btree ("labor_case_id");--> statement-breakpoint
CREATE INDEX "vacation_periods_org_status_idx" ON "vacation_periods" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "vacation_periods_accrual_idx" ON "vacation_periods" USING btree ("accrual_start","accrual_end");--> statement-breakpoint
CREATE INDEX "work_schedules_org_idx" ON "work_schedules" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "work_schedules_case_idx" ON "work_schedules" USING btree ("labor_case_id");--> statement-breakpoint
CREATE INDEX "work_schedules_contract_idx" ON "work_schedules" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "work_time_records_org_idx" ON "work_time_records" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "work_time_records_case_idx" ON "work_time_records" USING btree ("labor_case_id");--> statement-breakpoint
CREATE INDEX "work_time_records_date_idx" ON "work_time_records" USING btree ("organization_id","work_date");--> statement-breakpoint
CREATE INDEX "work_time_records_contract_idx" ON "work_time_records" USING btree ("contract_id");--> statement-breakpoint
-- Placeholder benefit types — NOT official INSS catalog (source=system_seed).
INSERT INTO "benefit_types" ("id", "code", "name", "category", "regime", "active", "source", "metadata")
VALUES
  ('a1000000-0000-4000-8000-000000000001', 'SEED-APOS-IDADE', '[SEED] Aposentadoria por idade (placeholder)', 'retirement', 'rgps', true, 'system_seed', '{"official":false,"note":"system_seed placeholder — not INSS catalog"}'::jsonb),
  ('a1000000-0000-4000-8000-000000000002', 'SEED-APOS-TEMPO', '[SEED] Aposentadoria por tempo de contribuição (placeholder)', 'retirement', 'rgps', true, 'system_seed', '{"official":false,"note":"system_seed placeholder — not INSS catalog"}'::jsonb),
  ('a1000000-0000-4000-8000-000000000003', 'SEED-AUX-DOENCA', '[SEED] Auxílio por incapacidade temporária (placeholder)', 'disability', 'rgps', true, 'system_seed', '{"official":false,"note":"system_seed placeholder — not INSS catalog"}'::jsonb),
  ('a1000000-0000-4000-8000-000000000004', 'SEED-BPC-LOAS', '[SEED] BPC/LOAS (placeholder assistencial)', 'bpc_loas', 'rgps', true, 'system_seed', '{"official":false,"note":"system_seed placeholder — not INSS catalog"}'::jsonb),
  ('a1000000-0000-4000-8000-000000000005', 'SEED-PENSAO-MORTE', '[SEED] Pensão por morte (placeholder)', 'survivor_pension', 'rgps', true, 'system_seed', '{"official":false,"note":"system_seed placeholder — not INSS catalog"}'::jsonb)
ON CONFLICT ("code") DO NOTHING;
