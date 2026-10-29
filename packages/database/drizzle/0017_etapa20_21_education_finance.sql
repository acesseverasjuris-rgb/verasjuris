CREATE TYPE "public"."education_attempt_status" AS ENUM('in_progress', 'submitted', 'graded', 'abandoned');
--> statement-breakpoint
CREATE TYPE "public"."education_certificate_status" AS ENUM('issued', 'revoked', 'expired');
--> statement-breakpoint
CREATE TYPE "public"."education_content_block_type" AS ENUM('text', 'video_reference', 'audio_reference', 'document_reference', 'embed', 'quiz_reference', 'exercise', 'code', 'external_link');
--> statement-breakpoint
CREATE TYPE "public"."education_course_level" AS ENUM('beginner', 'intermediate', 'advanced', 'expert', 'other');
--> statement-breakpoint
CREATE TYPE "public"."education_course_status" AS ENUM('draft', 'under_review', 'published', 'unpublished', 'archived');
--> statement-breakpoint
CREATE TYPE "public"."education_educator_verification" AS ENUM('not_submitted', 'pending', 'approved', 'rejected', 'not_required');
--> statement-breakpoint
CREATE TYPE "public"."education_enrollment_source" AS ENUM('free', 'purchase', 'subscription', 'organization', 'admin', 'promotion', 'other');
--> statement-breakpoint
CREATE TYPE "public"."education_enrollment_status" AS ENUM('active', 'completed', 'expired', 'cancelled', 'pending_payment', 'suspended');
--> statement-breakpoint
CREATE TYPE "public"."education_lesson_status" AS ENUM('draft', 'published', 'archived');
--> statement-breakpoint
CREATE TYPE "public"."education_lesson_type" AS ENUM('video', 'text', 'document', 'audio', 'quiz', 'live', 'assignment', 'case_study', 'other');
--> statement-breakpoint
CREATE TYPE "public"."education_library_item_type" AS ENUM('book', 'article', 'guide', 'case', 'legislation_collection', 'jurisprudence_collection', 'video', 'audio', 'document', 'other');
--> statement-breakpoint
CREATE TYPE "public"."education_library_source" AS ENUM('authored_internally', 'licensed', 'public_source', 'external_link');
--> statement-breakpoint
CREATE TYPE "public"."education_progress_status" AS ENUM('not_started', 'in_progress', 'completed');
--> statement-breakpoint
CREATE TYPE "public"."education_release_rule" AS ENUM('immediate', 'sequential', 'date_gated', 'manual');
--> statement-breakpoint
CREATE TYPE "public"."education_visibility" AS ENUM('public', 'authenticated', 'organization_only', 'private', 'paid');
--> statement-breakpoint
CREATE TYPE "public"."billable_item_type" AS ENUM('subscription', 'service', 'legal_fee', 'platform_fee', 'registry_fee', 'diligence', 'consultation', 'course', 'credit', 'adjustment', 'other');
--> statement-breakpoint
CREATE TYPE "public"."billing_charge_status" AS ENUM('pending', 'processing', 'succeeded', 'failed', 'cancelled', 'not_configured');
--> statement-breakpoint
CREATE TYPE "public"."billing_credit_status" AS ENUM('available', 'applied', 'expired', 'void');
--> statement-breakpoint
CREATE TYPE "public"."billing_interval" AS ENUM('monthly', 'quarterly', 'yearly', 'one_time', 'custom');
--> statement-breakpoint
CREATE TYPE "public"."cost_category" AS ENUM('infrastructure', 'ai', 'provider', 'registry', 'court', 'travel', 'marketing', 'personnel', 'refund', 'processing_fee', 'other');
--> statement-breakpoint
CREATE TYPE "public"."entitlement_limit_type" AS ENUM('boolean', 'count', 'amount_cents', 'unlimited');
--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'open', 'partially_paid', 'paid', 'past_due', 'void', 'uncollectible', 'refunded');
--> statement-breakpoint
CREATE TYPE "public"."ledger_account_type" AS ENUM('asset', 'liability', 'equity', 'revenue', 'expense', 'clearing');
--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_direction" AS ENUM('debit', 'credit');
--> statement-breakpoint
CREATE TYPE "public"."ledger_transaction_status" AS ENUM('draft', 'posted', 'reversed');
--> statement-breakpoint
CREATE TYPE "public"."ledger_transaction_type" AS ENUM('payment_received', 'payment_failed', 'refund', 'invoice_recognition', 'credit_applied', 'fee_accrual', 'platform_fee', 'payout', 'chargeback', 'manual_journal', 'reversal', 'cost', 'other');
--> statement-breakpoint
CREATE TYPE "public"."legal_fee_accrual_status" AS ENUM('accrued', 'invoiced', 'waived', 'cancelled');
--> statement-breakpoint
CREATE TYPE "public"."legal_fee_agreement_status" AS ENUM('draft', 'active', 'completed', 'cancelled', 'suspended');
--> statement-breakpoint
CREATE TYPE "public"."legal_fee_type" AS ENUM('fixed', 'hourly', 'percentage', 'success', 'mixed', 'installment', 'other');
--> statement-breakpoint
CREATE TYPE "public"."payment_allocation_status" AS ENUM('pending', 'reserved', 'released', 'paid_out', 'cancelled', 'not_configured');
--> statement-breakpoint
CREATE TYPE "public"."payment_dispute_status" AS ENUM('open', 'under_review', 'won', 'lost', 'cancelled', 'not_configured');
--> statement-breakpoint
CREATE TYPE "public"."payment_dispute_type" AS ENUM('chargeback', 'payment_dispute', 'fraud_review');
--> statement-breakpoint
CREATE TYPE "public"."payment_intent_status" AS ENUM('created', 'requires_action', 'processing', 'authorized', 'confirmed', 'failed', 'cancelled', 'expired', 'not_configured');
--> statement-breakpoint
CREATE TYPE "public"."platform_payment_method" AS ENUM('pix', 'credit_card', 'debit_card', 'boleto', 'bank_transfer', 'wallet', 'manual', 'other');
--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('pending', 'processing', 'paid', 'failed', 'cancelled', 'not_configured');
--> statement-breakpoint
CREATE TYPE "public"."platform_fee_base" AS ENUM('marketplace', 'online_consultation', 'diligence', 'extrajudicial', 'education', 'subscription', 'other');
--> statement-breakpoint
CREATE TYPE "public"."platform_payment_status" AS ENUM('pending', 'authorized', 'confirmed', 'failed', 'cancelled', 'refunded', 'partially_refunded', 'chargeback', 'disputed');
--> statement-breakpoint
CREATE TYPE "public"."financial_reconciliation_status" AS ENUM('unmatched', 'matched', 'partial', 'review_required', 'resolved', 'not_configured');
--> statement-breakpoint
CREATE TYPE "public"."platform_refund_status" AS ENUM('requested', 'processing', 'confirmed', 'failed', 'cancelled', 'not_configured');
--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('incomplete', 'trialing', 'active', 'past_due', 'suspended', 'cancelled', 'expired', 'not_configured');
--> statement-breakpoint
CREATE TYPE "public"."payment_webhook_event_status" AS ENUM('received', 'processing', 'processed', 'ignored', 'failed');
--> statement-breakpoint
CREATE TABLE "education_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"legal_area_module_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "education_instructors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"bio" text,
	"qualifications" text,
	"active" boolean DEFAULT true NOT NULL,
	"public_profile" boolean DEFAULT false NOT NULL,
	"verified_educator_status" "education_educator_verification" DEFAULT 'not_required' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "education_courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"instructor_id" uuid,
	"category_id" uuid,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"short_description" text,
	"level" "education_course_level" DEFAULT 'beginner' NOT NULL,
	"language" text DEFAULT 'pt-BR' NOT NULL,
	"estimated_duration_minutes" integer,
	"status" "education_course_status" DEFAULT 'draft' NOT NULL,
	"visibility" "education_visibility" DEFAULT 'private' NOT NULL,
	"cover_document_id" uuid,
	"price_cents" bigint,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"certificate_enabled" boolean DEFAULT true NOT NULL,
	"completion_rule_json" jsonb,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"release_rule" "education_release_rule" DEFAULT 'immediate' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"lesson_type" "education_lesson_type" DEFAULT 'text' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"estimated_duration_minutes" integer,
	"required" boolean DEFAULT true NOT NULL,
	"preview_allowed" boolean DEFAULT false NOT NULL,
	"status" "education_lesson_status" DEFAULT 'draft' NOT NULL,
	"quiz_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_contents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"block_type" "education_content_block_type" NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"current_version_id" uuid,
	"document_id" uuid,
	"media_provider_key" text DEFAULT 'not_configured' NOT NULL,
	"external_media_ref" text,
	"license_note" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_content_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"body_text" text,
	"payload_json" jsonb,
	"published_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"legal_area_id" uuid,
	"status" "education_course_status" DEFAULT 'draft' NOT NULL,
	"visibility" "education_visibility" DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_track_courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"prerequisite_course_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid,
	"source" "education_enrollment_source" DEFAULT 'free' NOT NULL,
	"status" "education_enrollment_status" DEFAULT 'active' NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"invoice_id" uuid,
	"payment_intent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"status" "education_progress_status" DEFAULT 'not_started' NOT NULL,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"last_position_metadata" jsonb,
	"content_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "education_quizzes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid,
	"lesson_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"passing_score_percent" integer DEFAULT 70 NOT NULL,
	"max_attempts" integer,
	"shuffle_questions" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "education_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"prompt" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"points" integer DEFAULT 1 NOT NULL,
	"explanation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "education_question_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"label" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_correct" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "education_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "education_attempt_status" DEFAULT 'in_progress' NOT NULL,
	"score_percent" integer,
	"passed" boolean,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "education_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"option_id" uuid,
	"free_text" text,
	"is_correct" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "education_certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"certificate_number" text NOT NULL,
	"verification_code" text NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"status" "education_certificate_status" DEFAULT 'issued' NOT NULL,
	"document_id" uuid,
	"pdf_generation_status" text DEFAULT 'PDF_GENERATION_NOT_CONFIGURED' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "education_library_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"item_type" "education_library_item_type" DEFAULT 'document' NOT NULL,
	"source" "education_library_source" DEFAULT 'authored_internally' NOT NULL,
	"license_note" text,
	"external_url" text,
	"document_id" uuid,
	"visibility" "education_visibility" DEFAULT 'authenticated' NOT NULL,
	"category_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"billing_interval" "billing_interval" DEFAULT 'monthly' NOT NULL,
	"price_cents" bigint DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"public" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"current_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_plan_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"billing_interval" "billing_interval" NOT NULL,
	"price_cents" bigint NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	"snapshot_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_plan_features" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"plan_version_id" uuid,
	"feature_key" text NOT NULL,
	"limit_type" "entitlement_limit_type" DEFAULT 'boolean' NOT NULL,
	"limit_value" bigint,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"user_id" uuid,
	"plan_id" uuid NOT NULL,
	"plan_version_id" uuid NOT NULL,
	"status" "subscription_status" DEFAULT 'incomplete' NOT NULL,
	"billing_cycle_anchor" timestamp with time zone,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"cancelled_at" timestamp with time zone,
	"trial_ends_at" timestamp with time zone,
	"provider_key" text DEFAULT 'not_configured' NOT NULL,
	"external_subscription_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"user_id" uuid,
	"client_id" uuid,
	"subscription_id" uuid,
	"invoice_number" text NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"subtotal_cents" bigint DEFAULT 0 NOT NULL,
	"discount_cents" bigint DEFAULT 0 NOT NULL,
	"tax_cents" bigint DEFAULT 0 NOT NULL,
	"estimated_tax_cents" bigint,
	"tax_source" text,
	"total_cents" bigint DEFAULT 0 NOT NULL,
	"amount_paid_cents" bigint DEFAULT 0 NOT NULL,
	"amount_due_cents" bigint DEFAULT 0 NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"issued_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"external_reference" text,
	"period_key" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"type" "billable_item_type" DEFAULT 'other' NOT NULL,
	"description" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_amount_cents" bigint NOT NULL,
	"total_amount_cents" bigint NOT NULL,
	"reference_type" text,
	"reference_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"invoice_id" uuid,
	"amount_cents" bigint NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"status" "billing_charge_status" DEFAULT 'pending' NOT NULL,
	"description" text,
	"payment_intent_id" uuid,
	"attempted_at" timestamp with time zone,
	"succeeded_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"failure_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"user_id" uuid,
	"amount_cents" bigint NOT NULL,
	"remaining_cents" bigint NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"reason" text NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"status" "billing_credit_status" DEFAULT 'available' NOT NULL,
	"expires_at" timestamp with time zone,
	"applied_invoice_id" uuid,
	"ledger_transaction_id" uuid,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_fee_agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid,
	"legal_matter_id" uuid,
	"contract_id" uuid,
	"fee_type" "legal_fee_type" DEFAULT 'fixed' NOT NULL,
	"fixed_amount_cents" bigint,
	"hourly_rate_cents" bigint,
	"percentage_bps" integer,
	"success_fee_bps" integer,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"installment_config" jsonb,
	"status" "legal_fee_agreement_status" DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_fee_accruals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agreement_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"description" text,
	"status" "legal_fee_accrual_status" DEFAULT 'accrued' NOT NULL,
	"accrued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"invoice_id" uuid,
	"ledger_transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_fee_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"fee_base" "platform_fee_base" NOT NULL,
	"percentage_bps" integer,
	"fixed_amount_cents" bigint,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"category" "cost_category" DEFAULT 'other' NOT NULL,
	"description" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"incurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"legal_matter_id" uuid,
	"service_reference_type" text,
	"service_reference_id" uuid,
	"document_id" uuid,
	"source" text DEFAULT 'manual' NOT NULL,
	"ledger_transaction_id" uuid,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" "ledger_account_type" NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"parent_account_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"system_account" boolean DEFAULT false NOT NULL,
	"system_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"transaction_type" "ledger_transaction_type" NOT NULL,
	"reference_type" text,
	"reference_id" uuid,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "ledger_transaction_status" DEFAULT 'draft' NOT NULL,
	"idempotency_key" text NOT NULL,
	"description" text,
	"reversal_of_transaction_id" uuid,
	"reason" text,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"posted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"direction" "ledger_entry_direction" NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_reconciliations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider_key" text DEFAULT 'not_configured' NOT NULL,
	"external_reference" text,
	"ledger_transaction_id" uuid,
	"amount_cents" bigint,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"status" "financial_reconciliation_status" DEFAULT 'not_configured' NOT NULL,
	"notes" text,
	"matched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"payer_type" text NOT NULL,
	"payer_id" uuid NOT NULL,
	"invoice_id" uuid,
	"reference_type" text NOT NULL,
	"reference_id" uuid NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"payment_method" "platform_payment_method" DEFAULT 'other' NOT NULL,
	"status" "payment_intent_status" DEFAULT 'created' NOT NULL,
	"provider_key" text DEFAULT 'not_configured' NOT NULL,
	"external_intent_id" text,
	"idempotency_key" text NOT NULL,
	"expires_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_intent_id" uuid NOT NULL,
	"organization_id" uuid,
	"amount_cents" bigint NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"status" "platform_payment_status" DEFAULT 'pending' NOT NULL,
	"provider_key" text DEFAULT 'not_configured' NOT NULL,
	"external_payment_id" text,
	"confirmed_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"failure_code" text,
	"evidence_document_id" uuid,
	"recorded_by_membership_id" uuid,
	"ledger_transaction_id" uuid,
	"is_manual" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_key" text NOT NULL,
	"external_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload_hash" text NOT NULL,
	"signature_valid" boolean,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"status" "payment_webhook_event_status" DEFAULT 'received' NOT NULL,
	"error_code" text,
	"payment_intent_id" uuid,
	"raw_payload_ref" text
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"organization_id" uuid,
	"amount_cents" bigint NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"status" "platform_refund_status" DEFAULT 'requested' NOT NULL,
	"provider_key" text DEFAULT 'not_configured' NOT NULL,
	"external_refund_id" text,
	"reason" text,
	"confirmed_at" timestamp with time zone,
	"ledger_transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"organization_id" uuid,
	"dispute_type" "payment_dispute_type" DEFAULT 'chargeback' NOT NULL,
	"status" "payment_dispute_status" DEFAULT 'not_configured' NOT NULL,
	"provider_key" text DEFAULT 'not_configured' NOT NULL,
	"external_dispute_id" text,
	"amount_cents" bigint,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"reason" text,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"beneficiary_type" text NOT NULL,
	"beneficiary_id" uuid NOT NULL,
	"gross_cents" bigint NOT NULL,
	"fee_cents" bigint DEFAULT 0 NOT NULL,
	"net_cents" bigint NOT NULL,
	"status" "payment_allocation_status" DEFAULT 'not_configured' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"beneficiary_type" text NOT NULL,
	"beneficiary_id" uuid NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"status" "payout_status" DEFAULT 'not_configured' NOT NULL,
	"provider_key" text DEFAULT 'not_configured' NOT NULL,
	"external_payout_id" text,
	"allocation_id" uuid,
	"paid_at" timestamp with time zone,
	"ledger_transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "education_categories" ADD CONSTRAINT "education_categories_legal_area_module_id_legal_area_modules_id_fk" FOREIGN KEY ("legal_area_module_id") REFERENCES "public"."legal_area_modules"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "education_instructors" ADD CONSTRAINT "education_instructors_profile_id_profiles_user_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "education_courses" ADD CONSTRAINT "education_courses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "education_courses" ADD CONSTRAINT "education_courses_instructor_id_education_instructors_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."education_instructors"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "education_courses" ADD CONSTRAINT "education_courses_category_id_education_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."education_categories"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "education_courses" ADD CONSTRAINT "education_courses_cover_document_id_documents_id_fk" FOREIGN KEY ("cover_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_course_id_education_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."education_courses"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "course_lessons" ADD CONSTRAINT "course_lessons_module_id_course_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."course_modules"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lesson_contents" ADD CONSTRAINT "lesson_contents_lesson_id_course_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."course_lessons"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lesson_contents" ADD CONSTRAINT "lesson_contents_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lesson_content_versions" ADD CONSTRAINT "lesson_content_versions_content_id_lesson_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."lesson_contents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lesson_content_versions" ADD CONSTRAINT "lesson_content_versions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "learning_tracks" ADD CONSTRAINT "learning_tracks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "learning_tracks" ADD CONSTRAINT "learning_tracks_legal_area_id_legal_areas_id_fk" FOREIGN KEY ("legal_area_id") REFERENCES "public"."legal_areas"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "learning_track_courses" ADD CONSTRAINT "learning_track_courses_track_id_learning_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."learning_tracks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "learning_track_courses" ADD CONSTRAINT "learning_track_courses_course_id_education_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."education_courses"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "learning_track_courses" ADD CONSTRAINT "learning_track_courses_prerequisite_course_id_education_courses_id_fk" FOREIGN KEY ("prerequisite_course_id") REFERENCES "public"."education_courses"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_course_id_education_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."education_courses"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_enrollment_id_course_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."course_enrollments"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_course_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."course_lessons"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "education_quizzes" ADD CONSTRAINT "education_quizzes_course_id_education_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."education_courses"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "education_quizzes" ADD CONSTRAINT "education_quizzes_lesson_id_course_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."course_lessons"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "education_questions" ADD CONSTRAINT "education_questions_quiz_id_education_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."education_quizzes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "education_question_options" ADD CONSTRAINT "education_question_options_question_id_education_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."education_questions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "education_attempts" ADD CONSTRAINT "education_attempts_quiz_id_education_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."education_quizzes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "education_attempts" ADD CONSTRAINT "education_attempts_enrollment_id_course_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."course_enrollments"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "education_attempts" ADD CONSTRAINT "education_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "education_answers" ADD CONSTRAINT "education_answers_attempt_id_education_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."education_attempts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "education_answers" ADD CONSTRAINT "education_answers_question_id_education_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."education_questions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "education_answers" ADD CONSTRAINT "education_answers_option_id_education_question_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."education_question_options"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "education_certificates" ADD CONSTRAINT "education_certificates_enrollment_id_course_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."course_enrollments"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "education_certificates" ADD CONSTRAINT "education_certificates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "education_certificates" ADD CONSTRAINT "education_certificates_course_id_education_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."education_courses"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "education_certificates" ADD CONSTRAINT "education_certificates_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "education_library_items" ADD CONSTRAINT "education_library_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "education_library_items" ADD CONSTRAINT "education_library_items_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "education_library_items" ADD CONSTRAINT "education_library_items_category_id_education_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."education_categories"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billing_plan_versions" ADD CONSTRAINT "billing_plan_versions_plan_id_billing_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."billing_plans"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billing_plan_features" ADD CONSTRAINT "billing_plan_features_plan_id_billing_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."billing_plans"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billing_plan_features" ADD CONSTRAINT "billing_plan_features_plan_version_id_billing_plan_versions_id_fk" FOREIGN KEY ("plan_version_id") REFERENCES "public"."billing_plan_versions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_billing_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."billing_plans"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_version_id_billing_plan_versions_id_fk" FOREIGN KEY ("plan_version_id") REFERENCES "public"."billing_plan_versions"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billing_charges" ADD CONSTRAINT "billing_charges_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billing_charges" ADD CONSTRAINT "billing_charges_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billing_credits" ADD CONSTRAINT "billing_credits_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billing_credits" ADD CONSTRAINT "billing_credits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billing_credits" ADD CONSTRAINT "billing_credits_applied_invoice_id_invoices_id_fk" FOREIGN KEY ("applied_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billing_credits" ADD CONSTRAINT "billing_credits_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "legal_fee_agreements" ADD CONSTRAINT "legal_fee_agreements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "legal_fee_agreements" ADD CONSTRAINT "legal_fee_agreements_client_id_crm_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."crm_clients"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "legal_fee_agreements" ADD CONSTRAINT "legal_fee_agreements_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "legal_fee_agreements" ADD CONSTRAINT "legal_fee_agreements_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "legal_fee_accruals" ADD CONSTRAINT "legal_fee_accruals_agreement_id_legal_fee_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."legal_fee_agreements"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "legal_fee_accruals" ADD CONSTRAINT "legal_fee_accruals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "legal_fee_accruals" ADD CONSTRAINT "legal_fee_accruals_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cost_records" ADD CONSTRAINT "cost_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cost_records" ADD CONSTRAINT "cost_records_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cost_records" ADD CONSTRAINT "cost_records_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cost_records" ADD CONSTRAINT "cost_records_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transaction_id_ledger_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."ledger_transactions"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_ledger_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "financial_reconciliations" ADD CONSTRAINT "financial_reconciliations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "financial_reconciliations" ADD CONSTRAINT "financial_reconciliations_ledger_transaction_id_ledger_transactions_id_fk" FOREIGN KEY ("ledger_transaction_id") REFERENCES "public"."ledger_transactions"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payment_intent_id_payment_intents_id_fk" FOREIGN KEY ("payment_intent_id") REFERENCES "public"."payment_intents"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_payment_intent_id_payment_intents_id_fk" FOREIGN KEY ("payment_intent_id") REFERENCES "public"."payment_intents"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payment_disputes" ADD CONSTRAINT "payment_disputes_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payment_disputes" ADD CONSTRAINT "payment_disputes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_allocation_id_payment_allocations_id_fk" FOREIGN KEY ("allocation_id") REFERENCES "public"."payment_allocations"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "education_categories_key_unique" ON "education_categories" USING btree ("key");
--> statement-breakpoint
CREATE INDEX "education_categories_parent_idx" ON "education_categories" USING btree ("parent_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "education_instructors_profile_unique" ON "education_instructors" USING btree ("profile_id");
--> statement-breakpoint
CREATE INDEX "education_instructors_active_idx" ON "education_instructors" USING btree ("active");
--> statement-breakpoint
CREATE UNIQUE INDEX "education_courses_slug_unique" ON "education_courses" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX "education_courses_org_idx" ON "education_courses" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "education_courses_status_idx" ON "education_courses" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "education_courses_visibility_idx" ON "education_courses" USING btree ("visibility");
--> statement-breakpoint
CREATE INDEX "education_courses_instructor_idx" ON "education_courses" USING btree ("instructor_id");
--> statement-breakpoint
CREATE INDEX "course_modules_course_idx" ON "course_modules" USING btree ("course_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "course_modules_course_position_unique" ON "course_modules" USING btree ("course_id","position");
--> statement-breakpoint
CREATE INDEX "course_lessons_module_idx" ON "course_lessons" USING btree ("module_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "course_lessons_module_position_unique" ON "course_lessons" USING btree ("module_id","position");
--> statement-breakpoint
CREATE INDEX "lesson_contents_lesson_idx" ON "lesson_contents" USING btree ("lesson_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_contents_lesson_position_unique" ON "lesson_contents" USING btree ("lesson_id","position");
--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_content_versions_content_version_unique" ON "lesson_content_versions" USING btree ("content_id","version");
--> statement-breakpoint
CREATE INDEX "lesson_content_versions_content_idx" ON "lesson_content_versions" USING btree ("content_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "learning_tracks_slug_unique" ON "learning_tracks" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX "learning_tracks_org_idx" ON "learning_tracks" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "learning_tracks_status_idx" ON "learning_tracks" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX "learning_track_courses_track_course_unique" ON "learning_track_courses" USING btree ("track_id","course_id");
--> statement-breakpoint
CREATE INDEX "learning_track_courses_track_idx" ON "learning_track_courses" USING btree ("track_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "course_enrollments_course_user_unique" ON "course_enrollments" USING btree ("course_id","user_id");
--> statement-breakpoint
CREATE INDEX "course_enrollments_user_idx" ON "course_enrollments" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "course_enrollments_org_idx" ON "course_enrollments" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "course_enrollments_status_idx" ON "course_enrollments" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_progress_enrollment_lesson_unique" ON "lesson_progress" USING btree ("enrollment_id","lesson_id");
--> statement-breakpoint
CREATE INDEX "lesson_progress_enrollment_idx" ON "lesson_progress" USING btree ("enrollment_id");
--> statement-breakpoint
CREATE INDEX "lesson_progress_status_idx" ON "lesson_progress" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "education_quizzes_course_idx" ON "education_quizzes" USING btree ("course_id");
--> statement-breakpoint
CREATE INDEX "education_quizzes_lesson_idx" ON "education_quizzes" USING btree ("lesson_id");
--> statement-breakpoint
CREATE INDEX "education_questions_quiz_idx" ON "education_questions" USING btree ("quiz_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "education_questions_quiz_position_unique" ON "education_questions" USING btree ("quiz_id","position");
--> statement-breakpoint
CREATE INDEX "education_question_options_question_idx" ON "education_question_options" USING btree ("question_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "education_question_options_question_position_unique" ON "education_question_options" USING btree ("question_id","position");
--> statement-breakpoint
CREATE INDEX "education_attempts_quiz_idx" ON "education_attempts" USING btree ("quiz_id");
--> statement-breakpoint
CREATE INDEX "education_attempts_enrollment_idx" ON "education_attempts" USING btree ("enrollment_id");
--> statement-breakpoint
CREATE INDEX "education_attempts_user_idx" ON "education_attempts" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "education_answers_attempt_question_unique" ON "education_answers" USING btree ("attempt_id","question_id");
--> statement-breakpoint
CREATE INDEX "education_answers_attempt_idx" ON "education_answers" USING btree ("attempt_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "education_certificates_number_unique" ON "education_certificates" USING btree ("certificate_number");
--> statement-breakpoint
CREATE UNIQUE INDEX "education_certificates_verification_unique" ON "education_certificates" USING btree ("verification_code");
--> statement-breakpoint
CREATE UNIQUE INDEX "education_certificates_enrollment_unique" ON "education_certificates" USING btree ("enrollment_id");
--> statement-breakpoint
CREATE INDEX "education_certificates_user_idx" ON "education_certificates" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "education_certificates_course_idx" ON "education_certificates" USING btree ("course_id");
--> statement-breakpoint
CREATE INDEX "education_certificates_status_idx" ON "education_certificates" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX "education_library_items_slug_unique" ON "education_library_items" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX "education_library_items_org_idx" ON "education_library_items" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "education_library_items_type_idx" ON "education_library_items" USING btree ("item_type");
--> statement-breakpoint
CREATE INDEX "education_library_items_visibility_idx" ON "education_library_items" USING btree ("visibility");
--> statement-breakpoint
CREATE UNIQUE INDEX "billing_plans_key_unique" ON "billing_plans" USING btree ("key");
--> statement-breakpoint
CREATE INDEX "billing_plans_active_idx" ON "billing_plans" USING btree ("active");
--> statement-breakpoint
CREATE UNIQUE INDEX "billing_plan_versions_plan_version_unique" ON "billing_plan_versions" USING btree ("plan_id","version");
--> statement-breakpoint
CREATE INDEX "billing_plan_versions_plan_idx" ON "billing_plan_versions" USING btree ("plan_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "billing_plan_features_plan_feature_unique" ON "billing_plan_features" USING btree ("plan_id","feature_key");
--> statement-breakpoint
CREATE INDEX "billing_plan_features_plan_idx" ON "billing_plan_features" USING btree ("plan_id");
--> statement-breakpoint
CREATE INDEX "billing_plan_features_key_idx" ON "billing_plan_features" USING btree ("feature_key");
--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_external_unique" ON "subscriptions" USING btree ("provider_key","external_subscription_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_unique" ON "invoices" USING btree ("invoice_number");
--> statement-breakpoint
CREATE INDEX "invoices_subscription_idx" ON "invoices" USING btree ("subscription_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_subscription_period_unique" ON "invoices" USING btree ("subscription_id","period_key");
--> statement-breakpoint
CREATE INDEX "invoice_lines_invoice_idx" ON "invoice_lines" USING btree ("invoice_id");
--> statement-breakpoint
CREATE INDEX "billing_charges_org_idx" ON "billing_charges" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "billing_charges_invoice_idx" ON "billing_charges" USING btree ("invoice_id");
--> statement-breakpoint
CREATE INDEX "billing_charges_status_idx" ON "billing_charges" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "billing_credits_org_idx" ON "billing_credits" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "billing_credits_user_idx" ON "billing_credits" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "billing_credits_status_idx" ON "billing_credits" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "legal_fee_agreements_org_idx" ON "legal_fee_agreements" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "legal_fee_agreements_client_idx" ON "legal_fee_agreements" USING btree ("client_id");
--> statement-breakpoint
CREATE INDEX "legal_fee_agreements_matter_idx" ON "legal_fee_agreements" USING btree ("legal_matter_id");
--> statement-breakpoint
CREATE INDEX "legal_fee_agreements_status_idx" ON "legal_fee_agreements" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "legal_fee_accruals_agreement_idx" ON "legal_fee_accruals" USING btree ("agreement_id");
--> statement-breakpoint
CREATE INDEX "legal_fee_accruals_org_idx" ON "legal_fee_accruals" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "legal_fee_accruals_status_idx" ON "legal_fee_accruals" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX "platform_fee_rules_key_version_unique" ON "platform_fee_rules" USING btree ("key","version");
--> statement-breakpoint
CREATE INDEX "platform_fee_rules_base_idx" ON "platform_fee_rules" USING btree ("fee_base");
--> statement-breakpoint
CREATE INDEX "platform_fee_rules_active_idx" ON "platform_fee_rules" USING btree ("active");
--> statement-breakpoint
CREATE INDEX "cost_records_org_idx" ON "cost_records" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "cost_records_category_idx" ON "cost_records" USING btree ("category");
--> statement-breakpoint
CREATE INDEX "cost_records_incurred_idx" ON "cost_records" USING btree ("incurred_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_accounts_org_code_unique" ON "ledger_accounts" USING btree ("organization_id","code");
--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_accounts_org_system_key_unique" ON "ledger_accounts" USING btree ("organization_id","system_key");
--> statement-breakpoint
CREATE INDEX "ledger_accounts_org_idx" ON "ledger_accounts" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "ledger_accounts_type_idx" ON "ledger_accounts" USING btree ("type");
--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_transactions_idempotency_unique" ON "ledger_transactions" USING btree ("organization_id","idempotency_key");
--> statement-breakpoint
CREATE INDEX "ledger_transactions_org_idx" ON "ledger_transactions" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "ledger_transactions_status_idx" ON "ledger_transactions" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "ledger_transactions_ref_idx" ON "ledger_transactions" USING btree ("reference_type","reference_id");
--> statement-breakpoint
CREATE INDEX "ledger_transactions_occurred_idx" ON "ledger_transactions" USING btree ("occurred_at");
--> statement-breakpoint
CREATE INDEX "ledger_entries_transaction_idx" ON "ledger_entries" USING btree ("transaction_id");
--> statement-breakpoint
CREATE INDEX "ledger_entries_account_idx" ON "ledger_entries" USING btree ("account_id");
--> statement-breakpoint
CREATE INDEX "financial_reconciliations_org_idx" ON "financial_reconciliations" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "financial_reconciliations_status_idx" ON "financial_reconciliations" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX "payment_intents_idempotency_unique" ON "payment_intents" USING btree ("organization_id","idempotency_key");
--> statement-breakpoint
CREATE INDEX "payment_intents_org_idx" ON "payment_intents" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "payment_intents_status_idx" ON "payment_intents" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "payment_intents_invoice_idx" ON "payment_intents" USING btree ("invoice_id");
--> statement-breakpoint
CREATE INDEX "payment_intents_ref_idx" ON "payment_intents" USING btree ("reference_type","reference_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "payment_intents_external_unique" ON "payment_intents" USING btree ("provider_key","external_intent_id");
--> statement-breakpoint
CREATE INDEX "payments_intent_idx" ON "payments" USING btree ("payment_intent_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "payments_external_unique" ON "payments" USING btree ("provider_key","external_payment_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "payments_ledger_tx_unique" ON "payments" USING btree ("ledger_transaction_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "payment_webhook_events_provider_event_unique" ON "payment_webhook_events" USING btree ("provider_key","external_event_id");
--> statement-breakpoint
CREATE INDEX "payment_webhook_events_status_idx" ON "payment_webhook_events" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "payment_webhook_events_received_idx" ON "payment_webhook_events" USING btree ("received_at");
--> statement-breakpoint
CREATE INDEX "refunds_payment_idx" ON "refunds" USING btree ("payment_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "refunds_external_unique" ON "refunds" USING btree ("provider_key","external_refund_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "refunds_ledger_tx_unique" ON "refunds" USING btree ("ledger_transaction_id");
--> statement-breakpoint
CREATE INDEX "payment_disputes_payment_idx" ON "payment_disputes" USING btree ("payment_id");
--> statement-breakpoint
CREATE INDEX "payment_disputes_status_idx" ON "payment_disputes" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "payment_allocations_payment_idx" ON "payment_allocations" USING btree ("payment_id");
--> statement-breakpoint
CREATE INDEX "payment_allocations_beneficiary_idx" ON "payment_allocations" USING btree ("beneficiary_type","beneficiary_id");
