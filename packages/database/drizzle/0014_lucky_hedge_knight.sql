CREATE TYPE "public"."civil_claim_item_status" AS ENUM('draft', 'active', 'settled', 'withdrawn', 'rejected', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."legal_area_checklist_status" AS ENUM('draft', 'active', 'deprecated', 'archived');--> statement-breakpoint
CREATE TYPE "public"."legal_area_module_key" AS ENUM('TAX', 'CIVIL', 'CONSUMER', 'FAMILY', 'SUCCESSION', 'CORPORATE', 'CRIMINAL', 'ADMINISTRATIVE', 'MEDICAL', 'REAL_ESTATE', 'ENVIRONMENTAL', 'ELECTORAL', 'SPORTS', 'DIGITAL', 'INTERNATIONAL', 'ARBITRATION', 'MEDIATION');--> statement-breakpoint
CREATE TYPE "public"."matter_extension_confidentiality" AS ENUM('standard', 'confidential', 'highly_restricted');--> statement-breakpoint
CREATE TYPE "public"."versioned_rule_set_status" AS ENUM('draft', 'active', 'deprecated', 'archived');--> statement-breakpoint
CREATE TYPE "public"."tax_admin_case_phase" AS ENUM('impugnacao', 'defesa', 'diligencia', 'julgamento', 'recurso', 'decisao_final', 'other');--> statement-breakpoint
CREATE TYPE "public"."tax_assessment_status" AS ENUM('draft', 'issued', 'under_review', 'challenged', 'decided', 'appealed', 'final_admin', 'judicialized', 'cancelled', 'paid');--> statement-breakpoint
CREATE TYPE "public"."tax_calculation_status" AS ENUM('draft', 'calculated', 'review_required', 'reviewed', 'approved', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."tax_calculation_type" AS ENUM('debit', 'credit', 'refund', 'compensation', 'update', 'penalty', 'interest', 'installment', 'undue_repetition', 'comparative_scenario', 'other');--> statement-breakpoint
CREATE TYPE "public"."tax_case_status" AS ENUM('draft', 'active', 'suspended', 'closed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."tax_compensation_status" AS ENUM('draft', 'requested', 'under_analysis', 'accepted', 'partially_accepted', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."tax_credit_origin" AS ENUM('overpayment', 'undue_payment', 'judicial_recognition', 'administrative_recognition', 'withholding', 'incentive', 'other');--> statement-breakpoint
CREATE TYPE "public"."tax_credit_status" AS ENUM('draft', 'identified', 'under_review', 'confirmed', 'used', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."tax_enforcement_status" AS ENUM('draft', 'filed', 'active', 'suspended', 'settled', 'extinguished', 'archived');--> statement-breakpoint
CREATE TYPE "public"."tax_guarantee_status" AS ENUM('draft', 'proposed', 'accepted', 'rejected', 'released', 'executed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."tax_guarantee_type" AS ENUM('cash', 'bank_guarantee', 'insurance', 'property', 'vehicle', 'receivable', 'other');--> statement-breakpoint
CREATE TYPE "public"."tax_jurisdiction" AS ENUM('federal', 'state', 'municipal', 'other');--> statement-breakpoint
CREATE TYPE "public"."tax_jurisdiction_scope" AS ENUM('federal', 'state', 'municipal', 'mixed', 'other');--> statement-breakpoint
CREATE TYPE "public"."tax_nature" AS ENUM('tax', 'fee', 'contribution', 'improvement', 'other');--> statement-breakpoint
CREATE TYPE "public"."tax_obligation_status" AS ENUM('draft', 'open', 'pending', 'fulfilled', 'overdue', 'disputed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."tax_obligation_type" AS ENUM('principal', 'accessory', 'payment', 'declaration', 'filing', 'bookkeeping', 'withholding', 'other');--> statement-breakpoint
CREATE TYPE "public"."tax_refund_status" AS ENUM('draft', 'requested', 'under_analysis', 'partially_granted', 'granted', 'denied', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."tax_taxpayer_type" AS ENUM('individual', 'company', 'mei', 'public_body', 'other');--> statement-breakpoint
CREATE TYPE "public"."tax_thesis_applicability" AS ENUM('suggested', 'applicable', 'not_applicable', 'needs_review', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."tax_thesis_risk_level" AS ENUM('low', 'medium', 'high', 'critical', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."tax_thesis_status" AS ENUM('draft', 'under_research', 'supported', 'contested', 'outdated', 'superseded', 'archived');--> statement-breakpoint
CREATE TYPE "public"."tax_type_source" AS ENUM('system_seed', 'organization', 'import', 'provider', 'not_configured');--> statement-breakpoint
CREATE TYPE "public"."contract_amendment_status" AS ENUM('draft', 'pending_approval', 'approved', 'pending_signature', 'signed', 'effective', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."contract_approval_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."contract_approval_type" AS ENUM('single', 'sequential', 'parallel', 'dual');--> statement-breakpoint
CREATE TYPE "public"."contract_clause_source" AS ENUM('system', 'organization');--> statement-breakpoint
CREATE TYPE "public"."contract_obligation_status" AS ENUM('open', 'pending', 'fulfilled', 'overdue', 'waived', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."contract_party_role" AS ENUM('contractor', 'contractee', 'buyer', 'seller', 'lessor', 'lessee', 'provider', 'customer', 'partner', 'guarantor', 'witness', 'other');--> statement-breakpoint
CREATE TYPE "public"."contract_renewal_status" AS ENUM('draft', 'notice_pending', 'proposed', 'approved', 'completed', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."contract_renewal_type" AS ENUM('automatic', 'manual', 'none');--> statement-breakpoint
CREATE TYPE "public"."contract_status" AS ENUM('draft', 'internal_review', 'pending_approval', 'approved', 'pending_signature', 'partially_signed', 'signed', 'active', 'expiring', 'expired', 'terminated', 'cancelled', 'archived');--> statement-breakpoint
CREATE TYPE "public"."contract_termination_status" AS ENUM('draft', 'notice_pending', 'notice_sent', 'under_negotiation', 'approved', 'effective', 'cancelled', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."contract_termination_type" AS ENUM('mutual', 'unilateral', 'breach', 'expiration', 'other');--> statement-breakpoint
CREATE TYPE "public"."contract_version_status" AS ENUM('draft', 'in_review', 'approved', 'signed', 'superseded', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."signature_method" AS ENUM('provider', 'manual', 'wet_ink', 'other');--> statement-breakpoint
CREATE TYPE "public"."signature_request_status" AS ENUM('draft', 'ready', 'sent', 'viewed', 'partially_signed', 'signed', 'declined', 'expired', 'cancelled', 'failed', 'not_configured');--> statement-breakpoint
CREATE TYPE "public"."signature_signer_status" AS ENUM('pending', 'notified', 'viewed', 'signed', 'declined', 'expired', 'cancelled');--> statement-breakpoint
CREATE TABLE "administrative_law_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid NOT NULL,
	"administrative_process_id" uuid,
	"case_kind" text DEFAULT 'other' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "arbitration_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid NOT NULL,
	"institution" text,
	"rules" text,
	"seat" text,
	"language" text,
	"tribunal_composition" text,
	"claimant_label" text,
	"respondent_label" text,
	"arbitration_number" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"confidential" boolean DEFAULT true NOT NULL,
	"award_date" timestamp with time zone,
	"award_document_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "civil_claim_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid NOT NULL,
	"title" text NOT NULL,
	"claim_kind" text DEFAULT 'other' NOT NULL,
	"amount_cents" integer,
	"status" "civil_claim_item_status" DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "civil_damages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid NOT NULL,
	"damage_kind" text DEFAULT 'other' NOT NULL,
	"principal_cents" integer DEFAULT 0 NOT NULL,
	"moral_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "civil_obligations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid NOT NULL,
	"obligation_type" text DEFAULT 'other' NOT NULL,
	"description" text NOT NULL,
	"due_date" timestamp with time zone,
	"status" text DEFAULT 'open' NOT NULL,
	"amount_cents" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consumer_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"supplier_name" text,
	"product_or_service" text,
	"defect_kind" text,
	"complaint_channel" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "corporate_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"company_name" text,
	"operation_kind" text DEFAULT 'other' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "criminal_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"phase" text DEFAULT 'investigation' NOT NULL,
	"confidentiality" "matter_extension_confidentiality" DEFAULT 'highly_restricted' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "criminal_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"criminal_case_id" uuid NOT NULL,
	"charge_label" text NOT NULL,
	"legal_basis_text" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custodial_measures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"criminal_case_id" uuid NOT NULL,
	"measure_type" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custody_arrangements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid NOT NULL,
	"custody_type" text DEFAULT 'shared' NOT NULL,
	"visitation_notes" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "digital_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid NOT NULL,
	"case_kind" text DEFAULT 'lgpd' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "electoral_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid NOT NULL,
	"case_kind" text DEFAULT 'other' NOT NULL,
	"election_year" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "environmental_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid NOT NULL,
	"case_kind" text DEFAULT 'licensing' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "estate_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"estate_case_id" uuid NOT NULL,
	"description" text NOT NULL,
	"asset_kind" text DEFAULT 'other' NOT NULL,
	"estimated_value_cents" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "estate_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"deceased_name" text,
	"death_date" timestamp with time zone,
	"inventory_kind" text DEFAULT 'inventory' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "estate_heirs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"estate_case_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"heir_kind" text DEFAULT 'heir' NOT NULL,
	"share_basis_points" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "estate_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"estate_case_id" uuid NOT NULL,
	"heir_id" uuid,
	"asset_id" uuid,
	"share_basis_points" integer DEFAULT 0 NOT NULL,
	"amount_cents" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "family_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid NOT NULL,
	"relationship_type" text NOT NULL,
	"party_a_label" text NOT NULL,
	"party_b_label" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "international_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid NOT NULL,
	"country" text,
	"jurisdiction" text,
	"applicable_law" text,
	"language" text,
	"currency" text,
	"case_kind" text DEFAULT 'other' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_area_checklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"module_id" uuid NOT NULL,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"version" text DEFAULT '1' NOT NULL,
	"status" "legal_area_checklist_status" DEFAULT 'active' NOT NULL,
	"items" jsonb,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_area_feature_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" uuid NOT NULL,
	"feature_key" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"configuration" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_area_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" "legal_area_module_key" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"version" text DEFAULT '1' NOT NULL,
	"configuration" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_area_template_packs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"module_id" uuid NOT NULL,
	"legal_document_template_id" uuid,
	"pack_key" text NOT NULL,
	"title" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_area_workflow_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"module_id" uuid NOT NULL,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"stages" jsonb,
	"active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_matter_area_bindings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"confidentiality" "matter_extension_confidentiality" DEFAULT 'standard' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mediation_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid NOT NULL,
	"mediator_name" text,
	"institution" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"confidentiality" boolean DEFAULT true NOT NULL,
	"settlement_reached" boolean DEFAULT false NOT NULL,
	"settlement_document_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medical_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"case_kind" text DEFAULT 'health_plan_denial' NOT NULL,
	"confidentiality" "matter_extension_confidentiality" DEFAULT 'confidential' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_divisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid NOT NULL,
	"description" text NOT NULL,
	"share_basis_points" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "real_estate_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid,
	"registration_number" text,
	"address_summary" text,
	"asset_kind" text DEFAULT 'property' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "real_estate_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid NOT NULL,
	"real_estate_asset_id" uuid,
	"case_kind" text DEFAULT 'other' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sentencing_information" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"criminal_case_id" uuid NOT NULL,
	"sentence_summary" text,
	"sentence_date" timestamp with time zone,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sports_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid NOT NULL,
	"athlete_name" text,
	"club_name" text,
	"federation_name" text,
	"case_kind" text DEFAULT 'other' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_obligations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid NOT NULL,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"frequency" text DEFAULT 'monthly' NOT NULL,
	"beneficiary_label" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "versioned_rule_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"key" text NOT NULL,
	"domain" text NOT NULL,
	"version" text NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"source" text DEFAULT 'system' NOT NULL,
	"source_url" text,
	"status" "versioned_rule_set_status" DEFAULT 'active' NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_administrative_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"tax_case_id" uuid NOT NULL,
	"administrative_process_id" uuid NOT NULL,
	"tax_assessment_id" uuid,
	"phase" "tax_admin_case_phase" DEFAULT 'impugnacao' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"tax_case_id" uuid NOT NULL,
	"authority" text NOT NULL,
	"assessment_number" text NOT NULL,
	"assessment_date" timestamp with time zone NOT NULL,
	"tax_type_id" uuid NOT NULL,
	"principal_cents" bigint DEFAULT 0 NOT NULL,
	"penalty_cents" bigint DEFAULT 0 NOT NULL,
	"interest_cents" bigint DEFAULT 0 NOT NULL,
	"total_cents" bigint DEFAULT 0 NOT NULL,
	"legal_basis_text" text,
	"status" "tax_assessment_status" DEFAULT 'draft' NOT NULL,
	"administrative_process_id" uuid,
	"document_id" uuid,
	"source" text DEFAULT 'manual' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_calculations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"tax_case_id" uuid NOT NULL,
	"calculation_type" "tax_calculation_type" DEFAULT 'other' NOT NULL,
	"tax_type_id" uuid,
	"rule_set_id" uuid,
	"rule_set_version" text NOT NULL,
	"reference_date" timestamp with time zone NOT NULL,
	"input_snapshot" jsonb NOT NULL,
	"result_snapshot" jsonb,
	"status" "tax_calculation_status" DEFAULT 'draft' NOT NULL,
	"created_by_membership_id" uuid,
	"reviewed_by_membership_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_case_thesis_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"tax_case_id" uuid NOT NULL,
	"thesis_id" uuid NOT NULL,
	"applicability_status" "tax_thesis_applicability" DEFAULT 'suggested' NOT NULL,
	"assumptions" jsonb,
	"missing_data" jsonb,
	"reviewed_by_membership_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"responsible_membership_id" uuid,
	"taxpayer_type" "tax_taxpayer_type" DEFAULT 'company' NOT NULL,
	"jurisdiction_scope" "tax_jurisdiction_scope" DEFAULT 'federal' NOT NULL,
	"status" "tax_case_status" DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_compensations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"tax_case_id" uuid NOT NULL,
	"source_credit_id" uuid NOT NULL,
	"destination_tax_type_id" uuid NOT NULL,
	"destination_competence" text,
	"requested_amount_cents" bigint NOT NULL,
	"accepted_amount_cents" bigint,
	"status" "tax_compensation_status" DEFAULT 'draft' NOT NULL,
	"protocol" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"administrative_process_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"tax_case_id" uuid NOT NULL,
	"tax_type_id" uuid NOT NULL,
	"origin" "tax_credit_origin" DEFAULT 'other' NOT NULL,
	"competence_start" text,
	"competence_end" text,
	"principal_cents" bigint DEFAULT 0 NOT NULL,
	"correction_cents" bigint DEFAULT 0 NOT NULL,
	"interest_cents" bigint DEFAULT 0 NOT NULL,
	"penalty_cents" bigint DEFAULT 0 NOT NULL,
	"total_cents" bigint DEFAULT 0 NOT NULL,
	"status" "tax_credit_status" DEFAULT 'draft' NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"calculation_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_debt_certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"tax_case_id" uuid NOT NULL,
	"number" text NOT NULL,
	"issuer" text NOT NULL,
	"tax_type_id" uuid,
	"principal_cents" bigint DEFAULT 0 NOT NULL,
	"correction_cents" bigint DEFAULT 0 NOT NULL,
	"interest_cents" bigint DEFAULT 0 NOT NULL,
	"penalty_cents" bigint DEFAULT 0 NOT NULL,
	"total_cents" bigint DEFAULT 0 NOT NULL,
	"registration_date" timestamp with time zone,
	"source" text DEFAULT 'manual' NOT NULL,
	"document_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_enforcement_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"tax_case_id" uuid NOT NULL,
	"judicial_process_id" uuid NOT NULL,
	"debt_certificate_id" uuid,
	"cda_number" text,
	"cda_amount_cents" bigint,
	"filing_date" timestamp with time zone,
	"seizure_status" text,
	"guarantee_type" "tax_guarantee_type",
	"guarantee_amount_cents" bigint,
	"embargo_status" text,
	"exception_status" text,
	"installment_status" text,
	"status" "tax_enforcement_status" DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_guarantees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"tax_case_id" uuid NOT NULL,
	"enforcement_case_id" uuid,
	"guarantee_type" "tax_guarantee_type" DEFAULT 'other' NOT NULL,
	"amount_cents" bigint DEFAULT 0 NOT NULL,
	"status" "tax_guarantee_status" DEFAULT 'draft' NOT NULL,
	"description" text,
	"document_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_legal_theses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"title" text NOT NULL,
	"summary" text,
	"tax_type_id" uuid,
	"legal_basis" text,
	"status" "tax_thesis_status" DEFAULT 'draft' NOT NULL,
	"risk_level" "tax_thesis_risk_level" DEFAULT 'unknown' NOT NULL,
	"source_research_id" uuid,
	"verified_citation_count" integer DEFAULT 0 NOT NULL,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_obligations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"tax_case_id" uuid NOT NULL,
	"tax_type_id" uuid NOT NULL,
	"obligation_type" "tax_obligation_type" DEFAULT 'principal' NOT NULL,
	"competence" text,
	"due_date" timestamp with time zone,
	"amount_cents" bigint,
	"status" "tax_obligation_status" DEFAULT 'draft' NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"evidence_document_id" uuid,
	"deadline_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_refund_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"tax_case_id" uuid NOT NULL,
	"tax_credit_id" uuid NOT NULL,
	"administrative_process_id" uuid,
	"request_date" timestamp with time zone NOT NULL,
	"protocol_number" text,
	"amount_requested_cents" bigint NOT NULL,
	"amount_granted_cents" bigint,
	"status" "tax_refund_status" DEFAULT 'draft' NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"decision_document_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_rule_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"version" text NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"source" text DEFAULT 'system' NOT NULL,
	"source_url" text,
	"status" text DEFAULT 'active' NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"jurisdiction" "tax_jurisdiction" DEFAULT 'federal' NOT NULL,
	"tax_nature" "tax_nature" DEFAULT 'tax' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"source" "tax_type_source" DEFAULT 'system_seed' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_amendments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"parent_contract_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"amendment_type" text DEFAULT 'other' NOT NULL,
	"effective_date" timestamp with time zone,
	"changed_clauses" jsonb,
	"document_id" uuid,
	"approval_status" "contract_approval_status" DEFAULT 'pending' NOT NULL,
	"signature_status" "signature_request_status" DEFAULT 'draft' NOT NULL,
	"status" "contract_amendment_status" DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_approval_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"approval_type" "contract_approval_type" DEFAULT 'single' NOT NULL,
	"min_value_cents" bigint,
	"contract_type" text,
	"department" text,
	"risk_level" text,
	"require_second_approver" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"contract_version_id" uuid NOT NULL,
	"approver_membership_id" uuid NOT NULL,
	"approval_type" "contract_approval_type" DEFAULT 'single' NOT NULL,
	"status" "contract_approval_status" DEFAULT 'pending' NOT NULL,
	"comment" text,
	"sequence_order" integer DEFAULT 1 NOT NULL,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_clause_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"contract_version_id" uuid NOT NULL,
	"clause_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"content_snapshot" text NOT NULL,
	"variables_snapshot" jsonb,
	"negotiated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_clauses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"content" text NOT NULL,
	"version" text DEFAULT '1' NOT NULL,
	"source" "contract_clause_source" DEFAULT 'organization' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"risk_level" text,
	"locked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_obligations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"contract_party_id" uuid,
	"source_clause_instance_id" uuid,
	"description" text NOT NULL,
	"due_date" timestamp with time zone,
	"recurrence" text,
	"amount_cents" bigint,
	"status" "contract_obligation_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_parties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"party_role" "contract_party_role" DEFAULT 'other' NOT NULL,
	"display_name" text NOT NULL,
	"document_reference" text,
	"representative" text,
	"client_id" uuid,
	"signing_order" integer DEFAULT 1 NOT NULL,
	"signer_required" boolean DEFAULT true NOT NULL,
	"email" text,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_renewals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"renewal_type" "contract_renewal_type" DEFAULT 'manual' NOT NULL,
	"notice_date" timestamp with time zone,
	"proposed_new_expiration" timestamp with time zone,
	"status" "contract_renewal_status" DEFAULT 'draft' NOT NULL,
	"document_id" uuid,
	"approval_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"legal_document_template_id" uuid,
	"title" text NOT NULL,
	"contract_type" text DEFAULT 'other' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_terminations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"termination_type" "contract_termination_type" DEFAULT 'other' NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"effective_at" timestamp with time zone,
	"reason" text,
	"notice_period_days" integer,
	"penalty_cents" bigint,
	"status" "contract_termination_status" DEFAULT 'draft' NOT NULL,
	"source_document_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_timeline_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"summary" text NOT NULL,
	"actor_membership_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"source_draft_id" uuid,
	"document_id" uuid,
	"document_version_id" uuid,
	"content_snapshot" text,
	"clause_snapshot" jsonb,
	"status" "contract_version_status" DEFAULT 'draft' NOT NULL,
	"immutable" boolean DEFAULT false NOT NULL,
	"created_by_membership_id" uuid,
	"approved_by_membership_id" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid,
	"client_id" uuid,
	"contract_template_id" uuid,
	"current_version_id" uuid,
	"title" text NOT NULL,
	"contract_type" text DEFAULT 'other' NOT NULL,
	"status" "contract_status" DEFAULT 'draft' NOT NULL,
	"effective_date" timestamp with time zone,
	"expiration_date" timestamp with time zone,
	"indefinite_term" boolean DEFAULT false NOT NULL,
	"renewal_type" "contract_renewal_type" DEFAULT 'none' NOT NULL,
	"renewal_notice_days" integer,
	"termination_date" timestamp with time zone,
	"governing_law" text,
	"jurisdiction" text,
	"currency" text DEFAULT 'BRL',
	"total_value_cents" bigint,
	"source_draft_id" uuid,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manual_signature_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"contract_version_id" uuid NOT NULL,
	"contract_party_id" uuid,
	"signed_at" timestamp with time zone NOT NULL,
	"evidence_document_id" uuid NOT NULL,
	"method" "signature_method" DEFAULT 'manual' NOT NULL,
	"recorded_by_membership_id" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signature_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"contract_version_id" uuid NOT NULL,
	"provider_key" text DEFAULT 'not_configured' NOT NULL,
	"external_envelope_id" text,
	"status" "signature_request_status" DEFAULT 'draft' NOT NULL,
	"sent_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"evidence_document_id" uuid,
	"certificate_metadata" jsonb,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signature_signers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"signature_request_id" uuid NOT NULL,
	"contract_party_id" uuid,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"signing_order" integer DEFAULT 1 NOT NULL,
	"status" "signature_signer_status" DEFAULT 'pending' NOT NULL,
	"signed_at" timestamp with time zone,
	"external_signer_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "administrative_law_cases" ADD CONSTRAINT "administrative_law_cases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "administrative_law_cases" ADD CONSTRAINT "administrative_law_cases_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "administrative_law_cases" ADD CONSTRAINT "administrative_law_cases_administrative_process_id_administrative_processes_id_fk" FOREIGN KEY ("administrative_process_id") REFERENCES "public"."administrative_processes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arbitration_cases" ADD CONSTRAINT "arbitration_cases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arbitration_cases" ADD CONSTRAINT "arbitration_cases_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arbitration_cases" ADD CONSTRAINT "arbitration_cases_award_document_id_documents_id_fk" FOREIGN KEY ("award_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "civil_claim_items" ADD CONSTRAINT "civil_claim_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "civil_claim_items" ADD CONSTRAINT "civil_claim_items_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "civil_damages" ADD CONSTRAINT "civil_damages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "civil_damages" ADD CONSTRAINT "civil_damages_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "civil_obligations" ADD CONSTRAINT "civil_obligations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "civil_obligations" ADD CONSTRAINT "civil_obligations_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumer_cases" ADD CONSTRAINT "consumer_cases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumer_cases" ADD CONSTRAINT "consumer_cases_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumer_cases" ADD CONSTRAINT "consumer_cases_client_id_crm_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."crm_clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_cases" ADD CONSTRAINT "corporate_cases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_cases" ADD CONSTRAINT "corporate_cases_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_cases" ADD CONSTRAINT "corporate_cases_client_id_crm_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."crm_clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criminal_cases" ADD CONSTRAINT "criminal_cases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criminal_cases" ADD CONSTRAINT "criminal_cases_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criminal_cases" ADD CONSTRAINT "criminal_cases_client_id_crm_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."crm_clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criminal_charges" ADD CONSTRAINT "criminal_charges_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criminal_charges" ADD CONSTRAINT "criminal_charges_criminal_case_id_criminal_cases_id_fk" FOREIGN KEY ("criminal_case_id") REFERENCES "public"."criminal_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custodial_measures" ADD CONSTRAINT "custodial_measures_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custodial_measures" ADD CONSTRAINT "custodial_measures_criminal_case_id_criminal_cases_id_fk" FOREIGN KEY ("criminal_case_id") REFERENCES "public"."criminal_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custody_arrangements" ADD CONSTRAINT "custody_arrangements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custody_arrangements" ADD CONSTRAINT "custody_arrangements_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_cases" ADD CONSTRAINT "digital_cases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_cases" ADD CONSTRAINT "digital_cases_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral_cases" ADD CONSTRAINT "electoral_cases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral_cases" ADD CONSTRAINT "electoral_cases_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environmental_cases" ADD CONSTRAINT "environmental_cases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environmental_cases" ADD CONSTRAINT "environmental_cases_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_assets" ADD CONSTRAINT "estate_assets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_assets" ADD CONSTRAINT "estate_assets_estate_case_id_estate_cases_id_fk" FOREIGN KEY ("estate_case_id") REFERENCES "public"."estate_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_cases" ADD CONSTRAINT "estate_cases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_cases" ADD CONSTRAINT "estate_cases_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_cases" ADD CONSTRAINT "estate_cases_client_id_crm_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."crm_clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_heirs" ADD CONSTRAINT "estate_heirs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_heirs" ADD CONSTRAINT "estate_heirs_estate_case_id_estate_cases_id_fk" FOREIGN KEY ("estate_case_id") REFERENCES "public"."estate_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_shares" ADD CONSTRAINT "estate_shares_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_shares" ADD CONSTRAINT "estate_shares_estate_case_id_estate_cases_id_fk" FOREIGN KEY ("estate_case_id") REFERENCES "public"."estate_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_shares" ADD CONSTRAINT "estate_shares_heir_id_estate_heirs_id_fk" FOREIGN KEY ("heir_id") REFERENCES "public"."estate_heirs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_shares" ADD CONSTRAINT "estate_shares_asset_id_estate_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."estate_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_relationships" ADD CONSTRAINT "family_relationships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_relationships" ADD CONSTRAINT "family_relationships_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "international_cases" ADD CONSTRAINT "international_cases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "international_cases" ADD CONSTRAINT "international_cases_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_area_checklists" ADD CONSTRAINT "legal_area_checklists_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_area_checklists" ADD CONSTRAINT "legal_area_checklists_module_id_legal_area_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."legal_area_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_area_feature_config" ADD CONSTRAINT "legal_area_feature_config_module_id_legal_area_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."legal_area_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_area_template_packs" ADD CONSTRAINT "legal_area_template_packs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_area_template_packs" ADD CONSTRAINT "legal_area_template_packs_module_id_legal_area_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."legal_area_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_area_template_packs" ADD CONSTRAINT "legal_area_template_packs_legal_document_template_id_legal_document_templates_id_fk" FOREIGN KEY ("legal_document_template_id") REFERENCES "public"."legal_document_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_area_workflow_configs" ADD CONSTRAINT "legal_area_workflow_configs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_area_workflow_configs" ADD CONSTRAINT "legal_area_workflow_configs_module_id_legal_area_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."legal_area_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_matter_area_bindings" ADD CONSTRAINT "legal_matter_area_bindings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_matter_area_bindings" ADD CONSTRAINT "legal_matter_area_bindings_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_matter_area_bindings" ADD CONSTRAINT "legal_matter_area_bindings_module_id_legal_area_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."legal_area_modules"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mediation_cases" ADD CONSTRAINT "mediation_cases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mediation_cases" ADD CONSTRAINT "mediation_cases_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mediation_cases" ADD CONSTRAINT "mediation_cases_settlement_document_id_documents_id_fk" FOREIGN KEY ("settlement_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_cases" ADD CONSTRAINT "medical_cases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_cases" ADD CONSTRAINT "medical_cases_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_cases" ADD CONSTRAINT "medical_cases_client_id_crm_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."crm_clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_divisions" ADD CONSTRAINT "property_divisions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_divisions" ADD CONSTRAINT "property_divisions_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "real_estate_assets" ADD CONSTRAINT "real_estate_assets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "real_estate_assets" ADD CONSTRAINT "real_estate_assets_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "real_estate_cases" ADD CONSTRAINT "real_estate_cases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "real_estate_cases" ADD CONSTRAINT "real_estate_cases_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "real_estate_cases" ADD CONSTRAINT "real_estate_cases_real_estate_asset_id_real_estate_assets_id_fk" FOREIGN KEY ("real_estate_asset_id") REFERENCES "public"."real_estate_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sentencing_information" ADD CONSTRAINT "sentencing_information_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sentencing_information" ADD CONSTRAINT "sentencing_information_criminal_case_id_criminal_cases_id_fk" FOREIGN KEY ("criminal_case_id") REFERENCES "public"."criminal_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sports_cases" ADD CONSTRAINT "sports_cases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sports_cases" ADD CONSTRAINT "sports_cases_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_obligations" ADD CONSTRAINT "support_obligations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_obligations" ADD CONSTRAINT "support_obligations_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "versioned_rule_sets" ADD CONSTRAINT "versioned_rule_sets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_administrative_cases" ADD CONSTRAINT "tax_administrative_cases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_administrative_cases" ADD CONSTRAINT "tax_administrative_cases_tax_case_id_tax_cases_id_fk" FOREIGN KEY ("tax_case_id") REFERENCES "public"."tax_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_administrative_cases" ADD CONSTRAINT "tax_administrative_cases_administrative_process_id_administrative_processes_id_fk" FOREIGN KEY ("administrative_process_id") REFERENCES "public"."administrative_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_administrative_cases" ADD CONSTRAINT "tax_administrative_cases_tax_assessment_id_tax_assessments_id_fk" FOREIGN KEY ("tax_assessment_id") REFERENCES "public"."tax_assessments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_assessments" ADD CONSTRAINT "tax_assessments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_assessments" ADD CONSTRAINT "tax_assessments_tax_case_id_tax_cases_id_fk" FOREIGN KEY ("tax_case_id") REFERENCES "public"."tax_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_assessments" ADD CONSTRAINT "tax_assessments_tax_type_id_tax_types_id_fk" FOREIGN KEY ("tax_type_id") REFERENCES "public"."tax_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_assessments" ADD CONSTRAINT "tax_assessments_administrative_process_id_administrative_processes_id_fk" FOREIGN KEY ("administrative_process_id") REFERENCES "public"."administrative_processes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_assessments" ADD CONSTRAINT "tax_assessments_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_calculations" ADD CONSTRAINT "tax_calculations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_calculations" ADD CONSTRAINT "tax_calculations_tax_case_id_tax_cases_id_fk" FOREIGN KEY ("tax_case_id") REFERENCES "public"."tax_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_calculations" ADD CONSTRAINT "tax_calculations_tax_type_id_tax_types_id_fk" FOREIGN KEY ("tax_type_id") REFERENCES "public"."tax_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_calculations" ADD CONSTRAINT "tax_calculations_rule_set_id_tax_rule_sets_id_fk" FOREIGN KEY ("rule_set_id") REFERENCES "public"."tax_rule_sets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_calculations" ADD CONSTRAINT "tax_calculations_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_calculations" ADD CONSTRAINT "tax_calculations_reviewed_by_membership_id_organization_members_id_fk" FOREIGN KEY ("reviewed_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_case_thesis_links" ADD CONSTRAINT "tax_case_thesis_links_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_case_thesis_links" ADD CONSTRAINT "tax_case_thesis_links_tax_case_id_tax_cases_id_fk" FOREIGN KEY ("tax_case_id") REFERENCES "public"."tax_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_case_thesis_links" ADD CONSTRAINT "tax_case_thesis_links_thesis_id_tax_legal_theses_id_fk" FOREIGN KEY ("thesis_id") REFERENCES "public"."tax_legal_theses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_case_thesis_links" ADD CONSTRAINT "tax_case_thesis_links_reviewed_by_membership_id_organization_members_id_fk" FOREIGN KEY ("reviewed_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_cases" ADD CONSTRAINT "tax_cases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_cases" ADD CONSTRAINT "tax_cases_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_cases" ADD CONSTRAINT "tax_cases_client_id_crm_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."crm_clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_cases" ADD CONSTRAINT "tax_cases_responsible_membership_id_organization_members_id_fk" FOREIGN KEY ("responsible_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_cases" ADD CONSTRAINT "tax_cases_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_compensations" ADD CONSTRAINT "tax_compensations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_compensations" ADD CONSTRAINT "tax_compensations_tax_case_id_tax_cases_id_fk" FOREIGN KEY ("tax_case_id") REFERENCES "public"."tax_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_compensations" ADD CONSTRAINT "tax_compensations_source_credit_id_tax_credits_id_fk" FOREIGN KEY ("source_credit_id") REFERENCES "public"."tax_credits"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_compensations" ADD CONSTRAINT "tax_compensations_destination_tax_type_id_tax_types_id_fk" FOREIGN KEY ("destination_tax_type_id") REFERENCES "public"."tax_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_compensations" ADD CONSTRAINT "tax_compensations_administrative_process_id_administrative_processes_id_fk" FOREIGN KEY ("administrative_process_id") REFERENCES "public"."administrative_processes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_credits" ADD CONSTRAINT "tax_credits_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_credits" ADD CONSTRAINT "tax_credits_tax_case_id_tax_cases_id_fk" FOREIGN KEY ("tax_case_id") REFERENCES "public"."tax_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_credits" ADD CONSTRAINT "tax_credits_tax_type_id_tax_types_id_fk" FOREIGN KEY ("tax_type_id") REFERENCES "public"."tax_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_debt_certificates" ADD CONSTRAINT "tax_debt_certificates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_debt_certificates" ADD CONSTRAINT "tax_debt_certificates_tax_case_id_tax_cases_id_fk" FOREIGN KEY ("tax_case_id") REFERENCES "public"."tax_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_debt_certificates" ADD CONSTRAINT "tax_debt_certificates_tax_type_id_tax_types_id_fk" FOREIGN KEY ("tax_type_id") REFERENCES "public"."tax_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_debt_certificates" ADD CONSTRAINT "tax_debt_certificates_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_enforcement_cases" ADD CONSTRAINT "tax_enforcement_cases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_enforcement_cases" ADD CONSTRAINT "tax_enforcement_cases_tax_case_id_tax_cases_id_fk" FOREIGN KEY ("tax_case_id") REFERENCES "public"."tax_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_enforcement_cases" ADD CONSTRAINT "tax_enforcement_cases_judicial_process_id_judicial_processes_id_fk" FOREIGN KEY ("judicial_process_id") REFERENCES "public"."judicial_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_enforcement_cases" ADD CONSTRAINT "tax_enforcement_cases_debt_certificate_id_tax_debt_certificates_id_fk" FOREIGN KEY ("debt_certificate_id") REFERENCES "public"."tax_debt_certificates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_guarantees" ADD CONSTRAINT "tax_guarantees_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_guarantees" ADD CONSTRAINT "tax_guarantees_tax_case_id_tax_cases_id_fk" FOREIGN KEY ("tax_case_id") REFERENCES "public"."tax_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_guarantees" ADD CONSTRAINT "tax_guarantees_enforcement_case_id_tax_enforcement_cases_id_fk" FOREIGN KEY ("enforcement_case_id") REFERENCES "public"."tax_enforcement_cases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_guarantees" ADD CONSTRAINT "tax_guarantees_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_legal_theses" ADD CONSTRAINT "tax_legal_theses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_legal_theses" ADD CONSTRAINT "tax_legal_theses_tax_type_id_tax_types_id_fk" FOREIGN KEY ("tax_type_id") REFERENCES "public"."tax_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_legal_theses" ADD CONSTRAINT "tax_legal_theses_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_obligations" ADD CONSTRAINT "tax_obligations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_obligations" ADD CONSTRAINT "tax_obligations_tax_case_id_tax_cases_id_fk" FOREIGN KEY ("tax_case_id") REFERENCES "public"."tax_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_obligations" ADD CONSTRAINT "tax_obligations_tax_type_id_tax_types_id_fk" FOREIGN KEY ("tax_type_id") REFERENCES "public"."tax_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_obligations" ADD CONSTRAINT "tax_obligations_evidence_document_id_documents_id_fk" FOREIGN KEY ("evidence_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_obligations" ADD CONSTRAINT "tax_obligations_deadline_id_deadlines_id_fk" FOREIGN KEY ("deadline_id") REFERENCES "public"."deadlines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_refund_requests" ADD CONSTRAINT "tax_refund_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_refund_requests" ADD CONSTRAINT "tax_refund_requests_tax_case_id_tax_cases_id_fk" FOREIGN KEY ("tax_case_id") REFERENCES "public"."tax_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_refund_requests" ADD CONSTRAINT "tax_refund_requests_tax_credit_id_tax_credits_id_fk" FOREIGN KEY ("tax_credit_id") REFERENCES "public"."tax_credits"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_refund_requests" ADD CONSTRAINT "tax_refund_requests_administrative_process_id_administrative_processes_id_fk" FOREIGN KEY ("administrative_process_id") REFERENCES "public"."administrative_processes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_refund_requests" ADD CONSTRAINT "tax_refund_requests_decision_document_id_documents_id_fk" FOREIGN KEY ("decision_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_amendments" ADD CONSTRAINT "contract_amendments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_amendments" ADD CONSTRAINT "contract_amendments_parent_contract_id_contracts_id_fk" FOREIGN KEY ("parent_contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_amendments" ADD CONSTRAINT "contract_amendments_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_approval_policies" ADD CONSTRAINT "contract_approval_policies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_approvals" ADD CONSTRAINT "contract_approvals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_approvals" ADD CONSTRAINT "contract_approvals_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_approvals" ADD CONSTRAINT "contract_approvals_contract_version_id_contract_versions_id_fk" FOREIGN KEY ("contract_version_id") REFERENCES "public"."contract_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_approvals" ADD CONSTRAINT "contract_approvals_approver_membership_id_organization_members_id_fk" FOREIGN KEY ("approver_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_clause_instances" ADD CONSTRAINT "contract_clause_instances_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_clause_instances" ADD CONSTRAINT "contract_clause_instances_contract_version_id_contract_versions_id_fk" FOREIGN KEY ("contract_version_id") REFERENCES "public"."contract_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_clause_instances" ADD CONSTRAINT "contract_clause_instances_clause_id_contract_clauses_id_fk" FOREIGN KEY ("clause_id") REFERENCES "public"."contract_clauses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_clauses" ADD CONSTRAINT "contract_clauses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_obligations" ADD CONSTRAINT "contract_obligations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_obligations" ADD CONSTRAINT "contract_obligations_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_obligations" ADD CONSTRAINT "contract_obligations_contract_party_id_contract_parties_id_fk" FOREIGN KEY ("contract_party_id") REFERENCES "public"."contract_parties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_obligations" ADD CONSTRAINT "contract_obligations_source_clause_instance_id_contract_clause_instances_id_fk" FOREIGN KEY ("source_clause_instance_id") REFERENCES "public"."contract_clause_instances"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_parties" ADD CONSTRAINT "contract_parties_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_parties" ADD CONSTRAINT "contract_parties_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_parties" ADD CONSTRAINT "contract_parties_client_id_crm_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."crm_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_renewals" ADD CONSTRAINT "contract_renewals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_renewals" ADD CONSTRAINT "contract_renewals_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_renewals" ADD CONSTRAINT "contract_renewals_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_renewals" ADD CONSTRAINT "contract_renewals_approval_id_contract_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."contract_approvals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_templates" ADD CONSTRAINT "contract_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_templates" ADD CONSTRAINT "contract_templates_legal_document_template_id_legal_document_templates_id_fk" FOREIGN KEY ("legal_document_template_id") REFERENCES "public"."legal_document_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_terminations" ADD CONSTRAINT "contract_terminations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_terminations" ADD CONSTRAINT "contract_terminations_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_terminations" ADD CONSTRAINT "contract_terminations_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_timeline_events" ADD CONSTRAINT "contract_timeline_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_timeline_events" ADD CONSTRAINT "contract_timeline_events_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_timeline_events" ADD CONSTRAINT "contract_timeline_events_actor_membership_id_organization_members_id_fk" FOREIGN KEY ("actor_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_versions" ADD CONSTRAINT "contract_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_versions" ADD CONSTRAINT "contract_versions_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_versions" ADD CONSTRAINT "contract_versions_source_draft_id_legal_document_drafts_id_fk" FOREIGN KEY ("source_draft_id") REFERENCES "public"."legal_document_drafts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_versions" ADD CONSTRAINT "contract_versions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_versions" ADD CONSTRAINT "contract_versions_document_version_id_document_versions_id_fk" FOREIGN KEY ("document_version_id") REFERENCES "public"."document_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_versions" ADD CONSTRAINT "contract_versions_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_versions" ADD CONSTRAINT "contract_versions_approved_by_membership_id_organization_members_id_fk" FOREIGN KEY ("approved_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_client_id_crm_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."crm_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_contract_template_id_contract_templates_id_fk" FOREIGN KEY ("contract_template_id") REFERENCES "public"."contract_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_source_draft_id_legal_document_drafts_id_fk" FOREIGN KEY ("source_draft_id") REFERENCES "public"."legal_document_drafts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_signature_records" ADD CONSTRAINT "manual_signature_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_signature_records" ADD CONSTRAINT "manual_signature_records_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_signature_records" ADD CONSTRAINT "manual_signature_records_contract_version_id_contract_versions_id_fk" FOREIGN KEY ("contract_version_id") REFERENCES "public"."contract_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_signature_records" ADD CONSTRAINT "manual_signature_records_contract_party_id_contract_parties_id_fk" FOREIGN KEY ("contract_party_id") REFERENCES "public"."contract_parties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_signature_records" ADD CONSTRAINT "manual_signature_records_evidence_document_id_documents_id_fk" FOREIGN KEY ("evidence_document_id") REFERENCES "public"."documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_signature_records" ADD CONSTRAINT "manual_signature_records_recorded_by_membership_id_organization_members_id_fk" FOREIGN KEY ("recorded_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_contract_version_id_contract_versions_id_fk" FOREIGN KEY ("contract_version_id") REFERENCES "public"."contract_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_evidence_document_id_documents_id_fk" FOREIGN KEY ("evidence_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_signers" ADD CONSTRAINT "signature_signers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_signers" ADD CONSTRAINT "signature_signers_signature_request_id_signature_requests_id_fk" FOREIGN KEY ("signature_request_id") REFERENCES "public"."signature_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_signers" ADD CONSTRAINT "signature_signers_contract_party_id_contract_parties_id_fk" FOREIGN KEY ("contract_party_id") REFERENCES "public"."contract_parties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "administrative_law_cases_org_idx" ON "administrative_law_cases" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "administrative_law_cases_matter_idx" ON "administrative_law_cases" USING btree ("legal_matter_id");--> statement-breakpoint
CREATE INDEX "arbitration_cases_org_idx" ON "arbitration_cases" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "arbitration_cases_matter_idx" ON "arbitration_cases" USING btree ("legal_matter_id");--> statement-breakpoint
CREATE INDEX "civil_claim_items_org_matter_idx" ON "civil_claim_items" USING btree ("organization_id","legal_matter_id");--> statement-breakpoint
CREATE INDEX "civil_claim_items_status_idx" ON "civil_claim_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "civil_damages_org_matter_idx" ON "civil_damages" USING btree ("organization_id","legal_matter_id");--> statement-breakpoint
CREATE INDEX "civil_obligations_org_matter_idx" ON "civil_obligations" USING btree ("organization_id","legal_matter_id");--> statement-breakpoint
CREATE INDEX "consumer_cases_org_idx" ON "consumer_cases" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "consumer_cases_matter_idx" ON "consumer_cases" USING btree ("legal_matter_id");--> statement-breakpoint
CREATE INDEX "corporate_cases_org_idx" ON "corporate_cases" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "corporate_cases_matter_idx" ON "corporate_cases" USING btree ("legal_matter_id");--> statement-breakpoint
CREATE INDEX "criminal_cases_org_idx" ON "criminal_cases" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "criminal_cases_matter_idx" ON "criminal_cases" USING btree ("legal_matter_id");--> statement-breakpoint
CREATE INDEX "criminal_charges_case_idx" ON "criminal_charges" USING btree ("criminal_case_id");--> statement-breakpoint
CREATE INDEX "custodial_measures_case_idx" ON "custodial_measures" USING btree ("criminal_case_id");--> statement-breakpoint
CREATE INDEX "custody_arrangements_org_matter_idx" ON "custody_arrangements" USING btree ("organization_id","legal_matter_id");--> statement-breakpoint
CREATE INDEX "digital_cases_org_idx" ON "digital_cases" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "digital_cases_matter_idx" ON "digital_cases" USING btree ("legal_matter_id");--> statement-breakpoint
CREATE INDEX "electoral_cases_org_idx" ON "electoral_cases" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "electoral_cases_matter_idx" ON "electoral_cases" USING btree ("legal_matter_id");--> statement-breakpoint
CREATE INDEX "environmental_cases_org_idx" ON "environmental_cases" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "environmental_cases_matter_idx" ON "environmental_cases" USING btree ("legal_matter_id");--> statement-breakpoint
CREATE INDEX "estate_assets_case_idx" ON "estate_assets" USING btree ("estate_case_id");--> statement-breakpoint
CREATE INDEX "estate_cases_org_idx" ON "estate_cases" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "estate_cases_matter_idx" ON "estate_cases" USING btree ("legal_matter_id");--> statement-breakpoint
CREATE INDEX "estate_heirs_case_idx" ON "estate_heirs" USING btree ("estate_case_id");--> statement-breakpoint
CREATE INDEX "estate_shares_case_idx" ON "estate_shares" USING btree ("estate_case_id");--> statement-breakpoint
CREATE INDEX "family_relationships_org_matter_idx" ON "family_relationships" USING btree ("organization_id","legal_matter_id");--> statement-breakpoint
CREATE INDEX "international_cases_org_idx" ON "international_cases" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "international_cases_matter_idx" ON "international_cases" USING btree ("legal_matter_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_area_checklists_module_key_version_unique" ON "legal_area_checklists" USING btree ("module_id","key","version");--> statement-breakpoint
CREATE INDEX "legal_area_checklists_org_idx" ON "legal_area_checklists" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "legal_area_checklists_status_idx" ON "legal_area_checklists" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_area_feature_config_module_feature_unique" ON "legal_area_feature_config" USING btree ("module_id","feature_key");--> statement-breakpoint
CREATE INDEX "legal_area_feature_config_feature_idx" ON "legal_area_feature_config" USING btree ("feature_key");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_area_modules_key_unique" ON "legal_area_modules" USING btree ("key");--> statement-breakpoint
CREATE INDEX "legal_area_modules_active_idx" ON "legal_area_modules" USING btree ("active");--> statement-breakpoint
CREATE INDEX "legal_area_template_packs_module_idx" ON "legal_area_template_packs" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "legal_area_template_packs_org_idx" ON "legal_area_template_packs" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_area_template_packs_org_module_key_unique" ON "legal_area_template_packs" USING btree ("organization_id","module_id","pack_key");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_area_workflow_configs_module_key_unique" ON "legal_area_workflow_configs" USING btree ("module_id","key");--> statement-breakpoint
CREATE INDEX "legal_area_workflow_configs_org_idx" ON "legal_area_workflow_configs" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_matter_area_bindings_matter_module_unique" ON "legal_matter_area_bindings" USING btree ("legal_matter_id","module_id");--> statement-breakpoint
CREATE INDEX "legal_matter_area_bindings_org_idx" ON "legal_matter_area_bindings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "legal_matter_area_bindings_module_idx" ON "legal_matter_area_bindings" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "mediation_cases_org_idx" ON "mediation_cases" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "mediation_cases_matter_idx" ON "mediation_cases" USING btree ("legal_matter_id");--> statement-breakpoint
CREATE INDEX "medical_cases_org_idx" ON "medical_cases" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "medical_cases_matter_idx" ON "medical_cases" USING btree ("legal_matter_id");--> statement-breakpoint
CREATE INDEX "property_divisions_org_matter_idx" ON "property_divisions" USING btree ("organization_id","legal_matter_id");--> statement-breakpoint
CREATE INDEX "real_estate_assets_org_idx" ON "real_estate_assets" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "real_estate_assets_matter_idx" ON "real_estate_assets" USING btree ("legal_matter_id");--> statement-breakpoint
CREATE INDEX "real_estate_cases_org_idx" ON "real_estate_cases" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "real_estate_cases_matter_idx" ON "real_estate_cases" USING btree ("legal_matter_id");--> statement-breakpoint
CREATE INDEX "sentencing_information_case_idx" ON "sentencing_information" USING btree ("criminal_case_id");--> statement-breakpoint
CREATE INDEX "sports_cases_org_idx" ON "sports_cases" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "sports_cases_matter_idx" ON "sports_cases" USING btree ("legal_matter_id");--> statement-breakpoint
CREATE INDEX "support_obligations_org_matter_idx" ON "support_obligations" USING btree ("organization_id","legal_matter_id");--> statement-breakpoint
CREATE UNIQUE INDEX "versioned_rule_sets_domain_key_version_unique" ON "versioned_rule_sets" USING btree ("domain","key","version");--> statement-breakpoint
CREATE INDEX "versioned_rule_sets_domain_idx" ON "versioned_rule_sets" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "versioned_rule_sets_status_idx" ON "versioned_rule_sets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "versioned_rule_sets_effective_idx" ON "versioned_rule_sets" USING btree ("effective_from","effective_to");--> statement-breakpoint
CREATE INDEX "tax_administrative_cases_org_case_idx" ON "tax_administrative_cases" USING btree ("organization_id","tax_case_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_administrative_cases_admin_unique" ON "tax_administrative_cases" USING btree ("administrative_process_id");--> statement-breakpoint
CREATE INDEX "tax_assessments_org_case_idx" ON "tax_assessments" USING btree ("organization_id","tax_case_id");--> statement-breakpoint
CREATE INDEX "tax_assessments_status_idx" ON "tax_assessments" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_assessments_org_number_unique" ON "tax_assessments" USING btree ("organization_id","assessment_number");--> statement-breakpoint
CREATE INDEX "tax_calculations_org_case_idx" ON "tax_calculations" USING btree ("organization_id","tax_case_id");--> statement-breakpoint
CREATE INDEX "tax_calculations_status_idx" ON "tax_calculations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tax_calculations_type_idx" ON "tax_calculations" USING btree ("calculation_type");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_case_thesis_links_case_thesis_unique" ON "tax_case_thesis_links" USING btree ("tax_case_id","thesis_id");--> statement-breakpoint
CREATE INDEX "tax_case_thesis_links_org_idx" ON "tax_case_thesis_links" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "tax_cases_org_idx" ON "tax_cases" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "tax_cases_org_client_idx" ON "tax_cases" USING btree ("organization_id","client_id");--> statement-breakpoint
CREATE INDEX "tax_cases_matter_idx" ON "tax_cases" USING btree ("legal_matter_id");--> statement-breakpoint
CREATE INDEX "tax_cases_org_status_idx" ON "tax_cases" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "tax_compensations_org_case_idx" ON "tax_compensations" USING btree ("organization_id","tax_case_id");--> statement-breakpoint
CREATE INDEX "tax_compensations_status_idx" ON "tax_compensations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tax_credits_org_case_idx" ON "tax_credits" USING btree ("organization_id","tax_case_id");--> statement-breakpoint
CREATE INDEX "tax_credits_status_idx" ON "tax_credits" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tax_debt_certificates_org_case_idx" ON "tax_debt_certificates" USING btree ("organization_id","tax_case_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_debt_certificates_org_number_unique" ON "tax_debt_certificates" USING btree ("organization_id","number");--> statement-breakpoint
CREATE INDEX "tax_enforcement_cases_org_case_idx" ON "tax_enforcement_cases" USING btree ("organization_id","tax_case_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_enforcement_cases_judicial_unique" ON "tax_enforcement_cases" USING btree ("judicial_process_id");--> statement-breakpoint
CREATE INDEX "tax_enforcement_cases_status_idx" ON "tax_enforcement_cases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tax_guarantees_org_case_idx" ON "tax_guarantees" USING btree ("organization_id","tax_case_id");--> statement-breakpoint
CREATE INDEX "tax_guarantees_status_idx" ON "tax_guarantees" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tax_legal_theses_org_idx" ON "tax_legal_theses" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "tax_legal_theses_status_idx" ON "tax_legal_theses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tax_obligations_org_case_idx" ON "tax_obligations" USING btree ("organization_id","tax_case_id");--> statement-breakpoint
CREATE INDEX "tax_obligations_status_idx" ON "tax_obligations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tax_obligations_due_date_idx" ON "tax_obligations" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "tax_refund_requests_org_case_idx" ON "tax_refund_requests" USING btree ("organization_id","tax_case_id");--> statement-breakpoint
CREATE INDEX "tax_refund_requests_status_idx" ON "tax_refund_requests" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_rule_sets_key_version_unique" ON "tax_rule_sets" USING btree ("key","version");--> statement-breakpoint
CREATE INDEX "tax_rule_sets_status_idx" ON "tax_rule_sets" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_types_code_unique" ON "tax_types" USING btree ("code");--> statement-breakpoint
CREATE INDEX "tax_types_jurisdiction_idx" ON "tax_types" USING btree ("jurisdiction");--> statement-breakpoint
CREATE INDEX "tax_types_active_idx" ON "tax_types" USING btree ("active");--> statement-breakpoint
CREATE UNIQUE INDEX "contract_amendments_parent_version_unique" ON "contract_amendments" USING btree ("parent_contract_id","version");--> statement-breakpoint
CREATE INDEX "contract_amendments_org_idx" ON "contract_amendments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "contract_approval_policies_org_idx" ON "contract_approval_policies" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "contract_approval_policies_active_idx" ON "contract_approval_policies" USING btree ("active");--> statement-breakpoint
CREATE INDEX "contract_approvals_org_contract_idx" ON "contract_approvals" USING btree ("organization_id","contract_id");--> statement-breakpoint
CREATE INDEX "contract_approvals_version_idx" ON "contract_approvals" USING btree ("contract_version_id");--> statement-breakpoint
CREATE INDEX "contract_approvals_status_idx" ON "contract_approvals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contract_clause_instances_version_idx" ON "contract_clause_instances" USING btree ("contract_version_id");--> statement-breakpoint
CREATE INDEX "contract_clause_instances_org_idx" ON "contract_clause_instances" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contract_clauses_org_key_version_unique" ON "contract_clauses" USING btree ("organization_id","key","version");--> statement-breakpoint
CREATE INDEX "contract_clauses_org_idx" ON "contract_clauses" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "contract_clauses_active_idx" ON "contract_clauses" USING btree ("active");--> statement-breakpoint
CREATE INDEX "contract_obligations_org_contract_idx" ON "contract_obligations" USING btree ("organization_id","contract_id");--> statement-breakpoint
CREATE INDEX "contract_obligations_due_date_idx" ON "contract_obligations" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "contract_obligations_status_idx" ON "contract_obligations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contract_parties_contract_idx" ON "contract_parties" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "contract_parties_org_idx" ON "contract_parties" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "contract_renewals_org_contract_idx" ON "contract_renewals" USING btree ("organization_id","contract_id");--> statement-breakpoint
CREATE INDEX "contract_renewals_status_idx" ON "contract_renewals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contract_templates_org_idx" ON "contract_templates" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "contract_templates_active_idx" ON "contract_templates" USING btree ("active");--> statement-breakpoint
CREATE INDEX "contract_terminations_org_contract_idx" ON "contract_terminations" USING btree ("organization_id","contract_id");--> statement-breakpoint
CREATE INDEX "contract_terminations_status_idx" ON "contract_terminations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contract_timeline_events_contract_idx" ON "contract_timeline_events" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "contract_timeline_events_org_idx" ON "contract_timeline_events" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contract_versions_contract_version_unique" ON "contract_versions" USING btree ("contract_id","version");--> statement-breakpoint
CREATE INDEX "contract_versions_org_idx" ON "contract_versions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "contract_versions_status_idx" ON "contract_versions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contracts_org_idx" ON "contracts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "contracts_org_status_idx" ON "contracts" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "contracts_matter_idx" ON "contracts" USING btree ("legal_matter_id");--> statement-breakpoint
CREATE INDEX "contracts_client_idx" ON "contracts" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "contracts_expiration_idx" ON "contracts" USING btree ("expiration_date");--> statement-breakpoint
CREATE INDEX "manual_signature_records_org_contract_idx" ON "manual_signature_records" USING btree ("organization_id","contract_id");--> statement-breakpoint
CREATE INDEX "signature_requests_org_contract_idx" ON "signature_requests" USING btree ("organization_id","contract_id");--> statement-breakpoint
CREATE INDEX "signature_requests_status_idx" ON "signature_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "signature_signers_request_idx" ON "signature_signers" USING btree ("signature_request_id");--> statement-breakpoint
CREATE INDEX "signature_signers_org_idx" ON "signature_signers" USING btree ("organization_id");