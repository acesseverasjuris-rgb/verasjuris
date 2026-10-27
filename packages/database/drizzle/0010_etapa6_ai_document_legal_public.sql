CREATE TYPE "public"."ai_budget_period" AS ENUM('daily', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."ai_job_status" AS ENUM('pending', 'queued', 'running', 'succeeded', 'failed', 'cancelled', 'not_configured');--> statement-breakpoint
CREATE TYPE "public"."ai_output_disposition" AS ENUM('draft', 'assistive', 'requires_review');--> statement-breakpoint
CREATE TYPE "public"."ai_prompt_version_status" AS ENUM('draft', 'review', 'approved', 'active', 'deprecated');--> statement-breakpoint
CREATE TYPE "public"."ai_request_status" AS ENUM('pending', 'running', 'succeeded', 'failed', 'cancelled', 'not_configured');--> statement-breakpoint
CREATE TYPE "public"."document_extraction_method" AS ENUM('native_text', 'plain_text', 'ocr', 'manual', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."document_processing_status" AS ENUM('pending', 'queued', 'running', 'succeeded', 'failed', 'cancelled', 'not_configured');--> statement-breakpoint
CREATE TYPE "public"."document_intel_review_status" AS ENUM('unreviewed', 'reviewed', 'corrected', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."document_segment_status" AS ENUM('detected', 'confirmed', 'rejected', 'not_configured');--> statement-breakpoint
CREATE TYPE "public"."legal_analysis_item_review_status" AS ENUM('unreviewed', 'accepted', 'corrected', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."legal_ai_analysis_status" AS ENUM('pending', 'running', 'succeeded', 'failed', 'cancelled', 'not_configured', 'requires_review', 'reviewed');--> statement-breakpoint
CREATE TYPE "public"."public_opportunity_interest_status" AS ENUM('saved', 'reviewing', 'interested', 'preparing', 'submitted', 'not_interested', 'won', 'lost', 'archived');--> statement-breakpoint
CREATE TYPE "public"."public_opportunity_requirement_status" AS ENUM('pending', 'met', 'not_met', 'waived', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."public_opportunity_source" AS ENUM('manual', 'public_provider', 'import');--> statement-breakpoint
CREATE TYPE "public"."public_opportunity_status" AS ENUM('draft', 'published', 'open', 'closed', 'cancelled', 'archived');--> statement-breakpoint
CREATE TYPE "public"."public_opportunity_type" AS ENUM('tender', 'public_call', 'accreditation', 'partnership', 'concession', 'grant', 'program', 'notice', 'other');--> statement-breakpoint
CREATE TABLE "ai_budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"period" "ai_budget_period" DEFAULT 'monthly' NOT NULL,
	"soft_limit_micros" bigint,
	"hard_limit_micros" bigint,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"job_type" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" uuid NOT NULL,
	"status" "ai_job_status" DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"idempotency_key" text,
	"runtime" text DEFAULT 'local_in_process' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"last_error_code" text,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_key" text NOT NULL,
	"external_model_id" text NOT NULL,
	"display_name" text NOT NULL,
	"model_family" text,
	"capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"context_window" integer,
	"input_cost_per_million_micros" bigint DEFAULT 0 NOT NULL,
	"output_cost_per_million_micros" bigint DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"pricing_unit" text DEFAULT 'million_tokens' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"configured" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_prompt_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prompt_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"system_template" text NOT NULL,
	"user_template" text NOT NULL,
	"output_schema" jsonb,
	"safety_instructions" text,
	"changelog" text,
	"status" "ai_prompt_version_status" DEFAULT 'draft' NOT NULL,
	"created_by_user_id" uuid,
	"approved_by_user_id" uuid,
	"activated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_prompts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"feature" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"membership_id" uuid,
	"feature" text NOT NULL,
	"provider" text NOT NULL,
	"model_id" uuid,
	"prompt_version_id" uuid,
	"status" "ai_request_status" DEFAULT 'pending' NOT NULL,
	"output_disposition" "ai_output_disposition" DEFAULT 'requires_review' NOT NULL,
	"input_reference" text,
	"correlation_id" text,
	"idempotency_key" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"duration_ms" integer,
	"error_code" text,
	"error_safe_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ai_request_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"output_type" text DEFAULT 'structured' NOT NULL,
	"structured_result" jsonb,
	"raw_provider_reference" text,
	"finish_reason" text,
	"model_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_result_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"ai_request_id" uuid NOT NULL,
	"resource_type" text,
	"resource_id" uuid,
	"document_id" uuid,
	"document_version_id" uuid,
	"page_number" integer,
	"text_start" integer,
	"text_end" integer,
	"source_label" text NOT NULL,
	"source_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_safety_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"rule_type" text NOT NULL,
	"description" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ai_request_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"model_external_id" text,
	"feature" text NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"cached_input_tokens" integer,
	"total_tokens" integer,
	"tokens_are_estimate" boolean DEFAULT false NOT NULL,
	"estimated_cost_micros" bigint DEFAULT 0 NOT NULL,
	"provider_reported_cost_micros" bigint,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"duration_ms" integer,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_classifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"document_version_id" uuid NOT NULL,
	"processing_run_id" uuid,
	"suggested_kind" text,
	"applied_kind" text,
	"confidence" integer,
	"method" text DEFAULT 'manual' NOT NULL,
	"status" text DEFAULT 'manual' NOT NULL,
	"review_status" "document_intel_review_status" DEFAULT 'unreviewed' NOT NULL,
	"reviewed_by_membership_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_extracted_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"document_version_id" uuid NOT NULL,
	"processing_run_id" uuid,
	"field_key" text NOT NULL,
	"original_value" text,
	"corrected_value" text,
	"confidence" integer,
	"source_page" integer,
	"extraction_method" text DEFAULT 'ai' NOT NULL,
	"review_status" "document_intel_review_status" DEFAULT 'unreviewed' NOT NULL,
	"reviewed_by_membership_id" uuid,
	"reviewed_at" timestamp with time zone,
	"review_comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"document_version_id" uuid NOT NULL,
	"processing_run_id" uuid,
	"page_number" integer NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"extraction_method" "document_extraction_method" NOT NULL,
	"confidence" integer,
	"char_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_processing_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"document_version_id" uuid NOT NULL,
	"status" "document_processing_status" DEFAULT 'pending' NOT NULL,
	"processing_strategy" text DEFAULT 'auto' NOT NULL,
	"ocr_required" boolean DEFAULT false NOT NULL,
	"ocr_provider" text,
	"extraction_method" "document_extraction_method",
	"text_hash" text,
	"page_count" integer,
	"char_count" integer,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error_code" text,
	"error_safe_message" text,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"document_version_id" uuid NOT NULL,
	"processing_run_id" uuid,
	"start_page" integer NOT NULL,
	"end_page" integer NOT NULL,
	"detected_type" text,
	"confidence" integer,
	"status" "document_segment_status" DEFAULT 'not_configured' NOT NULL,
	"review_status" "document_intel_review_status" DEFAULT 'unreviewed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_ai_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid,
	"judicial_process_id" uuid,
	"administrative_process_id" uuid,
	"document_id" uuid,
	"ai_request_id" uuid,
	"analysis_type" text NOT NULL,
	"status" "legal_ai_analysis_status" DEFAULT 'pending' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"disposition" text DEFAULT 'requires_review' NOT NULL,
	"summary" text,
	"structured_result" jsonb,
	"created_by_membership_id" uuid,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_membership_id" uuid,
	"review_comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_analysis_amounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"analysis_id" uuid NOT NULL,
	"original_text" text NOT NULL,
	"amount_cents" bigint,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"context" text,
	"source_label" text,
	"page_number" integer,
	"confidence" integer,
	"review_status" "legal_analysis_item_review_status" DEFAULT 'unreviewed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_analysis_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"analysis_id" uuid NOT NULL,
	"text" text NOT NULL,
	"claim_type" text,
	"related_party" text,
	"source_label" text,
	"document_id" uuid,
	"page_number" integer,
	"observation" text,
	"review_status" "legal_analysis_item_review_status" DEFAULT 'unreviewed' NOT NULL,
	"corrected_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_analysis_contradictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"analysis_id" uuid NOT NULL,
	"statement_a" text NOT NULL,
	"source_a" text,
	"statement_b" text NOT NULL,
	"source_b" text,
	"explanation" text,
	"severity" text DEFAULT 'medium' NOT NULL,
	"confidence" integer,
	"review_status" "legal_analysis_item_review_status" DEFAULT 'unreviewed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_analysis_dates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"analysis_id" uuid NOT NULL,
	"date_value" text NOT NULL,
	"date_type" text,
	"description" text,
	"source_page" integer,
	"confidence" integer,
	"review_status" "legal_analysis_item_review_status" DEFAULT 'unreviewed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_analysis_evidence_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"analysis_id" uuid NOT NULL,
	"fact_id" uuid,
	"claim_id" uuid,
	"proposition" text NOT NULL,
	"evidence_document_id" uuid,
	"page_number" integer,
	"excerpt_reference" text,
	"relevance" text,
	"review_status" "legal_analysis_item_review_status" DEFAULT 'unreviewed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_analysis_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"analysis_id" uuid NOT NULL,
	"text" text NOT NULL,
	"category" text,
	"dispute_status" text DEFAULT 'unknown' NOT NULL,
	"source_label" text,
	"document_id" uuid,
	"page_number" integer,
	"confidence" integer,
	"review_status" "legal_analysis_item_review_status" DEFAULT 'unreviewed' NOT NULL,
	"corrected_text" text,
	"review_comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_analysis_grounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"analysis_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"text" text NOT NULL,
	"source_label" text,
	"document_id" uuid,
	"page_number" integer,
	"confidence" integer,
	"review_status" "legal_analysis_item_review_status" DEFAULT 'unreviewed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_analysis_missing_info" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"analysis_id" uuid NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"review_status" "legal_analysis_item_review_status" DEFAULT 'unreviewed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_analysis_obligations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"analysis_id" uuid NOT NULL,
	"obligor" text,
	"beneficiary" text,
	"action" text NOT NULL,
	"condition" text,
	"deadline_text" text,
	"amount_cents" bigint,
	"source_label" text,
	"confidence" integer,
	"review_status" "legal_analysis_item_review_status" DEFAULT 'unreviewed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_analysis_parties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"analysis_id" uuid NOT NULL,
	"name" text NOT NULL,
	"inferred_role" text,
	"source_label" text,
	"page_number" integer,
	"confidence" integer,
	"review_status" "legal_analysis_item_review_status" DEFAULT 'unreviewed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"source_provider" "public_opportunity_source" DEFAULT 'manual' NOT NULL,
	"source_reference" text,
	"source_url" text,
	"opportunity_type" "public_opportunity_type" DEFAULT 'tender' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"public_body_id" uuid,
	"process_number" text,
	"procurement_number" text,
	"modality" text,
	"object" text NOT NULL,
	"estimated_value_cents" bigint,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"publication_date" timestamp with time zone,
	"proposal_deadline" timestamp with time zone,
	"timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"status" "public_opportunity_status" DEFAULT 'draft' NOT NULL,
	"region" text,
	"state_code" text,
	"municipality" text,
	"metadata" jsonb,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_opportunity_interests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"status" "public_opportunity_interest_status" DEFAULT 'saved' NOT NULL,
	"notes" text,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_opportunity_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"description" text NOT NULL,
	"category" text,
	"mandatory" boolean DEFAULT true NOT NULL,
	"status" "public_opportunity_requirement_status" DEFAULT 'pending' NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"reviewed_by_membership_id" uuid,
	"reviewed_at" timestamp with time zone,
	"review_comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_budgets" ADD CONSTRAINT "ai_budgets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_prompt_versions" ADD CONSTRAINT "ai_prompt_versions_prompt_id_ai_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."ai_prompts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_prompt_versions" ADD CONSTRAINT "ai_prompt_versions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_prompt_versions" ADD CONSTRAINT "ai_prompt_versions_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_membership_id_organization_members_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_model_id_ai_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."ai_models"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_prompt_version_id_ai_prompt_versions_id_fk" FOREIGN KEY ("prompt_version_id") REFERENCES "public"."ai_prompt_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_responses" ADD CONSTRAINT "ai_responses_ai_request_id_ai_requests_id_fk" FOREIGN KEY ("ai_request_id") REFERENCES "public"."ai_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_responses" ADD CONSTRAINT "ai_responses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_result_sources" ADD CONSTRAINT "ai_result_sources_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_result_sources" ADD CONSTRAINT "ai_result_sources_ai_request_id_ai_requests_id_fk" FOREIGN KEY ("ai_request_id") REFERENCES "public"."ai_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_ai_request_id_ai_requests_id_fk" FOREIGN KEY ("ai_request_id") REFERENCES "public"."ai_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_classifications" ADD CONSTRAINT "document_classifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_classifications" ADD CONSTRAINT "document_classifications_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_classifications" ADD CONSTRAINT "document_classifications_document_version_id_document_versions_id_fk" FOREIGN KEY ("document_version_id") REFERENCES "public"."document_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_classifications" ADD CONSTRAINT "document_classifications_processing_run_id_document_processing_runs_id_fk" FOREIGN KEY ("processing_run_id") REFERENCES "public"."document_processing_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_classifications" ADD CONSTRAINT "document_classifications_reviewed_by_membership_id_organization_members_id_fk" FOREIGN KEY ("reviewed_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_extracted_metadata" ADD CONSTRAINT "document_extracted_metadata_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_extracted_metadata" ADD CONSTRAINT "document_extracted_metadata_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_extracted_metadata" ADD CONSTRAINT "document_extracted_metadata_document_version_id_document_versions_id_fk" FOREIGN KEY ("document_version_id") REFERENCES "public"."document_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_extracted_metadata" ADD CONSTRAINT "document_extracted_metadata_processing_run_id_document_processing_runs_id_fk" FOREIGN KEY ("processing_run_id") REFERENCES "public"."document_processing_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_extracted_metadata" ADD CONSTRAINT "document_extracted_metadata_reviewed_by_membership_id_organization_members_id_fk" FOREIGN KEY ("reviewed_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_pages" ADD CONSTRAINT "document_pages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_pages" ADD CONSTRAINT "document_pages_document_version_id_document_versions_id_fk" FOREIGN KEY ("document_version_id") REFERENCES "public"."document_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_pages" ADD CONSTRAINT "document_pages_processing_run_id_document_processing_runs_id_fk" FOREIGN KEY ("processing_run_id") REFERENCES "public"."document_processing_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_processing_runs" ADD CONSTRAINT "document_processing_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_processing_runs" ADD CONSTRAINT "document_processing_runs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_processing_runs" ADD CONSTRAINT "document_processing_runs_document_version_id_document_versions_id_fk" FOREIGN KEY ("document_version_id") REFERENCES "public"."document_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_processing_runs" ADD CONSTRAINT "document_processing_runs_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_segments" ADD CONSTRAINT "document_segments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_segments" ADD CONSTRAINT "document_segments_document_version_id_document_versions_id_fk" FOREIGN KEY ("document_version_id") REFERENCES "public"."document_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_segments" ADD CONSTRAINT "document_segments_processing_run_id_document_processing_runs_id_fk" FOREIGN KEY ("processing_run_id") REFERENCES "public"."document_processing_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_ai_analyses" ADD CONSTRAINT "legal_ai_analyses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_ai_analyses" ADD CONSTRAINT "legal_ai_analyses_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_ai_analyses" ADD CONSTRAINT "legal_ai_analyses_judicial_process_id_judicial_processes_id_fk" FOREIGN KEY ("judicial_process_id") REFERENCES "public"."judicial_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_ai_analyses" ADD CONSTRAINT "legal_ai_analyses_administrative_process_id_administrative_processes_id_fk" FOREIGN KEY ("administrative_process_id") REFERENCES "public"."administrative_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_ai_analyses" ADD CONSTRAINT "legal_ai_analyses_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_ai_analyses" ADD CONSTRAINT "legal_ai_analyses_ai_request_id_ai_requests_id_fk" FOREIGN KEY ("ai_request_id") REFERENCES "public"."ai_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_ai_analyses" ADD CONSTRAINT "legal_ai_analyses_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_ai_analyses" ADD CONSTRAINT "legal_ai_analyses_reviewed_by_membership_id_organization_members_id_fk" FOREIGN KEY ("reviewed_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_analysis_amounts" ADD CONSTRAINT "legal_analysis_amounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_analysis_amounts" ADD CONSTRAINT "legal_analysis_amounts_analysis_id_legal_ai_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."legal_ai_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_analysis_claims" ADD CONSTRAINT "legal_analysis_claims_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_analysis_claims" ADD CONSTRAINT "legal_analysis_claims_analysis_id_legal_ai_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."legal_ai_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_analysis_contradictions" ADD CONSTRAINT "legal_analysis_contradictions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_analysis_contradictions" ADD CONSTRAINT "legal_analysis_contradictions_analysis_id_legal_ai_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."legal_ai_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_analysis_dates" ADD CONSTRAINT "legal_analysis_dates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_analysis_dates" ADD CONSTRAINT "legal_analysis_dates_analysis_id_legal_ai_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."legal_ai_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_analysis_evidence_links" ADD CONSTRAINT "legal_analysis_evidence_links_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_analysis_evidence_links" ADD CONSTRAINT "legal_analysis_evidence_links_analysis_id_legal_ai_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."legal_ai_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_analysis_evidence_links" ADD CONSTRAINT "legal_analysis_evidence_links_fact_id_legal_analysis_facts_id_fk" FOREIGN KEY ("fact_id") REFERENCES "public"."legal_analysis_facts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_analysis_evidence_links" ADD CONSTRAINT "legal_analysis_evidence_links_claim_id_legal_analysis_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."legal_analysis_claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_analysis_evidence_links" ADD CONSTRAINT "legal_analysis_evidence_links_evidence_document_id_documents_id_fk" FOREIGN KEY ("evidence_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_analysis_facts" ADD CONSTRAINT "legal_analysis_facts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_analysis_facts" ADD CONSTRAINT "legal_analysis_facts_analysis_id_legal_ai_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."legal_ai_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_analysis_grounds" ADD CONSTRAINT "legal_analysis_grounds_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_analysis_grounds" ADD CONSTRAINT "legal_analysis_grounds_analysis_id_legal_ai_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."legal_ai_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_analysis_missing_info" ADD CONSTRAINT "legal_analysis_missing_info_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_analysis_missing_info" ADD CONSTRAINT "legal_analysis_missing_info_analysis_id_legal_ai_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."legal_ai_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_analysis_obligations" ADD CONSTRAINT "legal_analysis_obligations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_analysis_obligations" ADD CONSTRAINT "legal_analysis_obligations_analysis_id_legal_ai_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."legal_ai_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_analysis_parties" ADD CONSTRAINT "legal_analysis_parties_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_analysis_parties" ADD CONSTRAINT "legal_analysis_parties_analysis_id_legal_ai_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."legal_ai_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_opportunities" ADD CONSTRAINT "public_opportunities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_opportunities" ADD CONSTRAINT "public_opportunities_public_body_id_administrative_bodies_id_fk" FOREIGN KEY ("public_body_id") REFERENCES "public"."administrative_bodies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_opportunities" ADD CONSTRAINT "public_opportunities_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_opportunity_interests" ADD CONSTRAINT "public_opportunity_interests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_opportunity_interests" ADD CONSTRAINT "public_opportunity_interests_opportunity_id_public_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."public_opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_opportunity_interests" ADD CONSTRAINT "public_opportunity_interests_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_opportunity_requirements" ADD CONSTRAINT "public_opportunity_requirements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_opportunity_requirements" ADD CONSTRAINT "public_opportunity_requirements_opportunity_id_public_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."public_opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_opportunity_requirements" ADD CONSTRAINT "public_opportunity_requirements_reviewed_by_membership_id_organization_members_id_fk" FOREIGN KEY ("reviewed_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_budgets_org_period_unique" ON "ai_budgets" USING btree ("organization_id","period");--> statement-breakpoint
CREATE INDEX "ai_jobs_org_status_idx" ON "ai_jobs" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_jobs_idempotency_unique" ON "ai_jobs" USING btree ("organization_id","job_type","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_models_provider_external_unique" ON "ai_models" USING btree ("provider_key","external_model_id");--> statement-breakpoint
CREATE INDEX "ai_models_active_idx" ON "ai_models" USING btree ("active");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_prompt_versions_prompt_version_unique" ON "ai_prompt_versions" USING btree ("prompt_id","version");--> statement-breakpoint
CREATE INDEX "ai_prompt_versions_status_idx" ON "ai_prompt_versions" USING btree ("prompt_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_prompts_key_unique" ON "ai_prompts" USING btree ("key");--> statement-breakpoint
CREATE INDEX "ai_requests_org_idx" ON "ai_requests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "ai_requests_org_feature_idx" ON "ai_requests" USING btree ("organization_id","feature");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_requests_idempotency_unique" ON "ai_requests" USING btree ("organization_id","feature","idempotency_key");--> statement-breakpoint
CREATE INDEX "ai_responses_request_idx" ON "ai_responses" USING btree ("ai_request_id");--> statement-breakpoint
CREATE INDEX "ai_responses_org_idx" ON "ai_responses" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "ai_result_sources_request_idx" ON "ai_result_sources" USING btree ("ai_request_id");--> statement-breakpoint
CREATE INDEX "ai_result_sources_org_idx" ON "ai_result_sources" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_safety_rules_key_unique" ON "ai_safety_rules" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_usage_request_unique" ON "ai_usage" USING btree ("ai_request_id");--> statement-breakpoint
CREATE INDEX "ai_usage_org_recorded_idx" ON "ai_usage" USING btree ("organization_id","recorded_at");--> statement-breakpoint
CREATE INDEX "document_classifications_org_idx" ON "document_classifications" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "document_classifications_doc_idx" ON "document_classifications" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_extracted_metadata_org_idx" ON "document_extracted_metadata" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "document_extracted_metadata_doc_idx" ON "document_extracted_metadata" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_extracted_metadata_version_idx" ON "document_extracted_metadata" USING btree ("document_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_pages_version_page_unique" ON "document_pages" USING btree ("document_version_id","page_number");--> statement-breakpoint
CREATE INDEX "document_pages_org_idx" ON "document_pages" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "document_pages_version_idx" ON "document_pages" USING btree ("document_version_id");--> statement-breakpoint
CREATE INDEX "document_processing_runs_org_idx" ON "document_processing_runs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "document_processing_runs_version_idx" ON "document_processing_runs" USING btree ("document_version_id");--> statement-breakpoint
CREATE INDEX "document_processing_runs_doc_idx" ON "document_processing_runs" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_segments_version_idx" ON "document_segments" USING btree ("document_version_id");--> statement-breakpoint
CREATE INDEX "document_segments_org_idx" ON "document_segments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "legal_ai_analyses_org_idx" ON "legal_ai_analyses" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "legal_ai_analyses_matter_idx" ON "legal_ai_analyses" USING btree ("legal_matter_id");--> statement-breakpoint
CREATE INDEX "legal_ai_analyses_document_idx" ON "legal_ai_analyses" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_ai_analyses_matter_type_version_unique" ON "legal_ai_analyses" USING btree ("organization_id","legal_matter_id","analysis_type","version");--> statement-breakpoint
CREATE INDEX "legal_analysis_amounts_analysis_idx" ON "legal_analysis_amounts" USING btree ("analysis_id");--> statement-breakpoint
CREATE INDEX "legal_analysis_claims_analysis_idx" ON "legal_analysis_claims" USING btree ("analysis_id");--> statement-breakpoint
CREATE INDEX "legal_analysis_contradictions_analysis_idx" ON "legal_analysis_contradictions" USING btree ("analysis_id");--> statement-breakpoint
CREATE INDEX "legal_analysis_dates_analysis_idx" ON "legal_analysis_dates" USING btree ("analysis_id");--> statement-breakpoint
CREATE INDEX "legal_analysis_evidence_analysis_idx" ON "legal_analysis_evidence_links" USING btree ("analysis_id");--> statement-breakpoint
CREATE INDEX "legal_analysis_facts_analysis_idx" ON "legal_analysis_facts" USING btree ("analysis_id");--> statement-breakpoint
CREATE INDEX "legal_analysis_facts_org_idx" ON "legal_analysis_facts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "legal_analysis_grounds_analysis_idx" ON "legal_analysis_grounds" USING btree ("analysis_id");--> statement-breakpoint
CREATE INDEX "legal_analysis_missing_analysis_idx" ON "legal_analysis_missing_info" USING btree ("analysis_id");--> statement-breakpoint
CREATE INDEX "legal_analysis_obligations_analysis_idx" ON "legal_analysis_obligations" USING btree ("analysis_id");--> statement-breakpoint
CREATE INDEX "legal_analysis_parties_analysis_idx" ON "legal_analysis_parties" USING btree ("analysis_id");--> statement-breakpoint
CREATE INDEX "public_opportunities_org_idx" ON "public_opportunities" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "public_opportunities_type_idx" ON "public_opportunities" USING btree ("opportunity_type");--> statement-breakpoint
CREATE INDEX "public_opportunities_status_idx" ON "public_opportunities" USING btree ("status");--> statement-breakpoint
CREATE INDEX "public_opportunities_deadline_idx" ON "public_opportunities" USING btree ("proposal_deadline");--> statement-breakpoint
CREATE INDEX "public_opportunities_state_idx" ON "public_opportunities" USING btree ("state_code");--> statement-breakpoint
CREATE INDEX "public_opportunities_body_idx" ON "public_opportunities" USING btree ("public_body_id");--> statement-breakpoint
CREATE UNIQUE INDEX "public_opportunity_interests_org_opp_unique" ON "public_opportunity_interests" USING btree ("organization_id","opportunity_id");--> statement-breakpoint
CREATE INDEX "public_opportunity_interests_org_idx" ON "public_opportunity_interests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "public_opportunity_interests_status_idx" ON "public_opportunity_interests" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "public_opportunity_requirements_org_idx" ON "public_opportunity_requirements" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "public_opportunity_requirements_opp_idx" ON "public_opportunity_requirements" USING btree ("opportunity_id");