-- Etapa 21.3+21.4+21.5+22 — Split/Repasses, Disputas, Conciliação/Tesouraria, Monetização
-- Hand-written: drizzle-kit regenerated all existing enums when entitlement_limit_type / payout_status expanded.

ALTER TYPE "public"."entitlement_limit_type" ADD VALUE IF NOT EXISTS 'storage';--> statement-breakpoint
ALTER TYPE "public"."entitlement_limit_type" ADD VALUE IF NOT EXISTS 'rate';--> statement-breakpoint
ALTER TYPE "public"."entitlement_limit_type" ADD VALUE IF NOT EXISTS 'credit';--> statement-breakpoint
ALTER TYPE "public"."entitlement_limit_type" ADD VALUE IF NOT EXISTS 'currency';--> statement-breakpoint
ALTER TYPE "public"."payout_status" ADD VALUE IF NOT EXISTS 'scheduled';--> statement-breakpoint
ALTER TYPE "public"."payout_status" ADD VALUE IF NOT EXISTS 'held';--> statement-breakpoint
CREATE TYPE "public"."treasury_accounts_payable_status" AS ENUM('draft', 'approved', 'scheduled', 'paid', 'overdue', 'cancelled', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."ai_credit_tx_type" AS ENUM('grant', 'purchase', 'consumption', 'refund', 'expiration', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."api_client_status" AS ENUM('active', 'suspended', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."delinquency_stage" AS ENUM('reminder', 'notice', 'negotiation', 'collection', 'legal', 'written_off');--> statement-breakpoint
CREATE TYPE "public"."delinquency_status" AS ENUM('open', 'in_progress', 'resolved', 'written_off', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."external_financial_source" AS ENUM('payment_provider', 'ledger', 'bank', 'manual_import', 'erp');--> statement-breakpoint
CREATE TYPE "public"."external_import_source" AS ENUM('api', 'webhook', 'csv', 'ofx', 'cnab', 'manual');--> statement-breakpoint
CREATE TYPE "public"."external_tx_direction" AS ENUM('inflow', 'outflow');--> statement-breakpoint
CREATE TYPE "public"."financial_discrepancy_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."financial_discrepancy_status" AS ENUM('open', 'investigating', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."financial_discrepancy_type" AS ENUM('missing_payment', 'missing_ledger_entry', 'missing_bank_entry', 'amount_mismatch', 'duplicate', 'unexpected_fee', 'unexpected_refund', 'payout_mismatch', 'other');--> statement-breakpoint
CREATE TYPE "public"."financial_dispute_status" AS ENUM('open', 'under_review', 'waiting_customer', 'waiting_provider', 'evidence_required', 'submitted', 'won', 'lost', 'partially_won', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."financial_dispute_type" AS ENUM('service', 'payment', 'chargeback', 'fraud', 'refund', 'delivery', 'other');--> statement-breakpoint
CREATE TYPE "public"."financial_retention_source" AS ENUM('manual', 'estimated', 'provider_confirmed');--> statement-breakpoint
CREATE TYPE "public"."financial_retention_status" AS ENUM('pending', 'applied', 'released', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."financial_retention_type" AS ENUM('tax_withholding', 'platform_reserve', 'chargeback_reserve', 'compliance_hold', 'dispute_hold', 'other');--> statement-breakpoint
CREATE TYPE "public"."treasury_forecast_scenario" AS ENUM('pessimistic', 'base', 'favorable', 'custom');--> statement-breakpoint
CREATE TYPE "public"."monetization_product_type" AS ENUM('subscription', 'one_time_service', 'ai_credit_pack', 'api_package', 'license', 'white_label_setup', 'technology_fee', 'other');--> statement-breakpoint
CREATE TYPE "public"."finance_payable_status" AS ENUM('pending', 'held', 'available', 'scheduled', 'paid', 'cancelled', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."payout_frequency" AS ENUM('daily', 'weekly', 'biweekly', 'monthly', 'manual');--> statement-breakpoint
CREATE TYPE "public"."plan_target" AS ENUM('user', 'professional', 'organization', 'enterprise', 'partner');--> statement-breakpoint
CREATE TYPE "public"."plan_tier" AS ENUM('individual', 'professional', 'office', 'business', 'enterprise', 'white_label');--> statement-breakpoint
CREATE TYPE "public"."treasury_receivable_status" AS ENUM('open', 'partial', 'paid', 'overdue', 'disputed', 'written_off', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."reconciliation_item_status" AS ENUM('matched', 'partial', 'missing_left', 'missing_right', 'amount_mismatch', 'date_mismatch', 'duplicate', 'review_required', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."reconciliation_run_status" AS ENUM('pending', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."refund_type" AS ENUM('full', 'partial', 'credit');--> statement-breakpoint
CREATE TYPE "public"."software_license_status" AS ENUM('draft', 'active', 'expired', 'suspended', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."software_license_type" AS ENUM('subscription', 'term', 'perpetual', 'enterprise', 'white_label', 'custom');--> statement-breakpoint
CREATE TYPE "public"."split_allocation_type" AS ENUM('platform_fee', 'professional_fee', 'partner_share', 'service_fee', 'technology_fee', 'commission', 'withholding', 'tax_estimate', 'other');--> statement-breakpoint
CREATE TYPE "public"."split_beneficiary_type" AS ENUM('platform', 'professional', 'partner', 'organization', 'instructor', 'correspondent', 'service_provider', 'other');--> statement-breakpoint
CREATE TYPE "public"."split_calculation_type" AS ENUM('percentage', 'fixed', 'percentage_plus_fixed', 'remainder', 'custom_rule');--> statement-breakpoint
CREATE TYPE "public"."split_rule_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."usage_aggregation_type" AS ENUM('sum', 'max', 'count', 'last', 'unique_count');--> statement-breakpoint
CREATE TYPE "public"."usage_reset_period" AS ENUM('none', 'daily', 'monthly', 'yearly', 'billing_period');--> statement-breakpoint
CREATE TYPE "public"."white_label_status" AS ENUM('draft', 'pending_domain', 'active', 'suspended', 'disabled');--> statement-breakpoint
CREATE TABLE "accounts_payable" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vendor_name" text,
	"beneficiary_type" text,
	"beneficiary_id" uuid,
	"category" text DEFAULT 'other' NOT NULL,
	"description" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"due_at" timestamp with time zone,
	"status" "treasury_accounts_payable_status" DEFAULT 'draft' NOT NULL,
	"document_id" uuid,
	"source_type" text,
	"source_id" uuid,
	"approved_by_membership_id" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_credit_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid NOT NULL,
	"type" "ai_credit_tx_type" NOT NULL,
	"amount_credits" bigint NOT NULL,
	"balance_after_credits" bigint NOT NULL,
	"reason" text,
	"source_type" text,
	"source_id" uuid,
	"provider_tokens" bigint,
	"provider_cost_micros" bigint,
	"feature_key" text,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_credit_wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"user_id" uuid,
	"balance_credits" bigint DEFAULT 0 NOT NULL,
	"currency_label" text DEFAULT 'credit' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_client_scopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_client_id" uuid NOT NULL,
	"scope_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" "api_client_status" DEFAULT 'active' NOT NULL,
	"plan_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_client_id" uuid NOT NULL,
	"credential_id" text NOT NULL,
	"secret_hash" text NOT NULL,
	"prefix" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_scopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_usage_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_client_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"endpoint_key" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"units" bigint,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'ok' NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delinquency_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"receivable_id" uuid NOT NULL,
	"days_overdue" integer DEFAULT 0 NOT NULL,
	"stage" "delinquency_stage" DEFAULT 'reminder' NOT NULL,
	"status" "delinquency_status" DEFAULT 'open' NOT NULL,
	"last_contact_at" timestamp with time zone,
	"next_action_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_financial_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"source_type" "external_financial_source" NOT NULL,
	"import_source" "external_import_source" DEFAULT 'manual' NOT NULL,
	"provider_key" text DEFAULT 'not_configured' NOT NULL,
	"external_id" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"direction" "external_tx_direction" NOT NULL,
	"description" text,
	"raw_reference" text,
	"status" text DEFAULT 'imported' NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "financial_discrepancies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"run_id" uuid,
	"source" text NOT NULL,
	"type" "financial_discrepancy_type" NOT NULL,
	"amount_cents" bigint,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"status" "financial_discrepancy_status" DEFAULT 'open' NOT NULL,
	"severity" "financial_discrepancy_severity" DEFAULT 'medium' NOT NULL,
	"owner_membership_id" uuid,
	"description" text,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_dispute_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispute_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"evidence_type" text DEFAULT 'other' NOT NULL,
	"submitted_by_user_id" uuid,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_dispute_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispute_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"note" text,
	"actor_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"payment_id" uuid,
	"invoice_id" uuid,
	"source_type" text NOT NULL,
	"source_id" uuid,
	"dispute_type" "financial_dispute_type" DEFAULT 'payment' NOT NULL,
	"opened_by_user_id" uuid,
	"amount_cents" bigint NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"reason_code" text,
	"description" text,
	"status" "financial_dispute_status" DEFAULT 'open' NOT NULL,
	"provider_key" text DEFAULT 'not_configured' NOT NULL,
	"external_dispute_id" text,
	"hold_applied" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolution_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_retentions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"allocation_id" uuid NOT NULL,
	"type" "financial_retention_type" NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"source" "financial_retention_source" DEFAULT 'manual' NOT NULL,
	"rule_set_id" text,
	"status" "financial_retention_status" DEFAULT 'pending' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monetization_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"product_type" "monetization_product_type" NOT NULL,
	"plan_tier" "plan_tier",
	"plan_target" "plan_target",
	"billing_plan_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"beneficiary_type" text NOT NULL,
	"beneficiary_id" uuid NOT NULL,
	"source_allocation_id" uuid,
	"amount_cents" bigint NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"due_at" timestamp with time zone,
	"status" "finance_payable_status" DEFAULT 'pending' NOT NULL,
	"hold_reason" text,
	"held_by_dispute_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payout_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"beneficiary_type" text NOT NULL,
	"beneficiary_id" uuid NOT NULL,
	"frequency" "payout_frequency" DEFAULT 'manual' NOT NULL,
	"day_of_week" integer,
	"day_of_month" integer,
	"minimum_amount_cents" bigint,
	"delay_days" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"interval" text,
	"usage_based" boolean DEFAULT false NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receivables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid NOT NULL,
	"debtor_type" text,
	"debtor_id" uuid,
	"amount_cents" bigint NOT NULL,
	"amount_paid_cents" bigint DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"due_at" timestamp with time zone,
	"expected_at" timestamp with time zone,
	"status" "treasury_receivable_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reconciliation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"source_a_type" text NOT NULL,
	"source_a_id" uuid,
	"source_b_type" text,
	"source_b_id" uuid,
	"amount_difference_cents" bigint DEFAULT 0 NOT NULL,
	"date_difference_hours" integer,
	"status" "reconciliation_item_status" DEFAULT 'review_required' NOT NULL,
	"confidence" integer,
	"resolution" text,
	"resolved_by_membership_id" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reconciliation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"source_a" "external_financial_source" NOT NULL,
	"source_b" "external_financial_source" NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"status" "reconciliation_run_status" DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"summary" jsonb,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refund_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"refund_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"note" text,
	"actor_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "software_licenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"product" text NOT NULL,
	"license_type" "software_license_type" DEFAULT 'subscription' NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	"seats" integer,
	"status" "software_license_status" DEFAULT 'draft' NOT NULL,
	"contract_id" uuid,
	"subscription_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "split_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"key" text NOT NULL,
	"product_type" text NOT NULL,
	"service_type" text,
	"beneficiary_type" "split_beneficiary_type" NOT NULL,
	"calculation_type" "split_calculation_type" DEFAULT 'percentage' NOT NULL,
	"percentage_bps" integer,
	"fixed_amount_cents" bigint,
	"priority" integer DEFAULT 100 NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	"status" "split_rule_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"snapshot_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "technology_fee_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"applies_to" text NOT NULL,
	"percentage_bps" integer,
	"fixed_amount_cents" bigint,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treasury_cash_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"source_account_key" text DEFAULT 'ledger_derived' NOT NULL,
	"as_of_date" timestamp with time zone NOT NULL,
	"balance_cents" bigint NOT NULL,
	"derived_from" text DEFAULT 'ledger' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treasury_forecast_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"forecast_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"opening_balance_cents" bigint DEFAULT 0 NOT NULL,
	"projected_inflows_cents" bigint DEFAULT 0 NOT NULL,
	"projected_outflows_cents" bigint DEFAULT 0 NOT NULL,
	"closing_balance_cents" bigint DEFAULT 0 NOT NULL,
	"actual_opening_cents" bigint,
	"actual_inflows_cents" bigint,
	"actual_outflows_cents" bigint,
	"snapshot_json" jsonb,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treasury_forecasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"scenario" "treasury_forecast_scenario" DEFAULT 'base' NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"current_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_meters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"aggregation_type" "usage_aggregation_type" DEFAULT 'sum' NOT NULL,
	"reset_period" "usage_reset_period" DEFAULT 'monthly' NOT NULL,
	"billable" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"user_id" uuid,
	"meter_id" uuid NOT NULL,
	"quantity" bigint NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid,
	"idempotency_key" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "white_label_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"brand_name" text,
	"logo_document_id" uuid,
	"primary_color" text,
	"secondary_color" text,
	"custom_domain" text,
	"custom_domain_verified" boolean DEFAULT false NOT NULL,
	"support_branding" boolean DEFAULT true NOT NULL,
	"status" "white_label_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_allocations" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "invoice_id" uuid;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "refund_type" text DEFAULT 'partial' NOT NULL;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "reason_code" text;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "requested_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "requested_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "failed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "credit_id" uuid;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD COLUMN "allocation_type" text DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD COLUMN "gross_amount_cents" bigint;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD COLUMN "fee_amount_cents" bigint;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD COLUMN "retention_amount_cents" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD COLUMN "net_amount_cents" bigint;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD COLUMN "currency" text DEFAULT 'BRL' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD COLUMN "rule_version_id" uuid;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD COLUMN "rule_snapshot_json" jsonb;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "payable_id" uuid;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "scheduled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "initiated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "failed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "failure_code" text;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "hold_reason" text;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_approved_by_membership_id_organization_members_id_fk" FOREIGN KEY ("approved_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_credit_transactions" ADD CONSTRAINT "ai_credit_transactions_wallet_id_ai_credit_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."ai_credit_wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_credit_wallets" ADD CONSTRAINT "ai_credit_wallets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_credit_wallets" ADD CONSTRAINT "ai_credit_wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_client_scopes" ADD CONSTRAINT "api_client_scopes_api_client_id_api_clients_id_fk" FOREIGN KEY ("api_client_id") REFERENCES "public"."api_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_client_scopes" ADD CONSTRAINT "api_client_scopes_scope_id_api_scopes_id_fk" FOREIGN KEY ("scope_id") REFERENCES "public"."api_scopes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_clients" ADD CONSTRAINT "api_clients_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_clients" ADD CONSTRAINT "api_clients_plan_id_billing_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."billing_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_credentials" ADD CONSTRAINT "api_credentials_api_client_id_api_clients_id_fk" FOREIGN KEY ("api_client_id") REFERENCES "public"."api_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_usage_records" ADD CONSTRAINT "api_usage_records_api_client_id_api_clients_id_fk" FOREIGN KEY ("api_client_id") REFERENCES "public"."api_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_usage_records" ADD CONSTRAINT "api_usage_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delinquency_cases" ADD CONSTRAINT "delinquency_cases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delinquency_cases" ADD CONSTRAINT "delinquency_cases_receivable_id_receivables_id_fk" FOREIGN KEY ("receivable_id") REFERENCES "public"."receivables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_financial_transactions" ADD CONSTRAINT "external_financial_transactions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_discrepancies" ADD CONSTRAINT "financial_discrepancies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_discrepancies" ADD CONSTRAINT "financial_discrepancies_run_id_reconciliation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."reconciliation_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_discrepancies" ADD CONSTRAINT "financial_discrepancies_owner_membership_id_organization_members_id_fk" FOREIGN KEY ("owner_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_dispute_evidence" ADD CONSTRAINT "financial_dispute_evidence_dispute_id_financial_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."financial_disputes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_dispute_evidence" ADD CONSTRAINT "financial_dispute_evidence_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_dispute_evidence" ADD CONSTRAINT "financial_dispute_evidence_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_dispute_history" ADD CONSTRAINT "financial_dispute_history_dispute_id_financial_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."financial_disputes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_dispute_history" ADD CONSTRAINT "financial_dispute_history_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_disputes" ADD CONSTRAINT "financial_disputes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_disputes" ADD CONSTRAINT "financial_disputes_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_disputes" ADD CONSTRAINT "financial_disputes_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_disputes" ADD CONSTRAINT "financial_disputes_opened_by_user_id_users_id_fk" FOREIGN KEY ("opened_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_retentions" ADD CONSTRAINT "financial_retentions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_retentions" ADD CONSTRAINT "financial_retentions_allocation_id_payment_allocations_id_fk" FOREIGN KEY ("allocation_id") REFERENCES "public"."payment_allocations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monetization_products" ADD CONSTRAINT "monetization_products_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monetization_products" ADD CONSTRAINT "monetization_products_billing_plan_id_billing_plans_id_fk" FOREIGN KEY ("billing_plan_id") REFERENCES "public"."billing_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payables" ADD CONSTRAINT "payables_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payables" ADD CONSTRAINT "payables_source_allocation_id_payment_allocations_id_fk" FOREIGN KEY ("source_allocation_id") REFERENCES "public"."payment_allocations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_schedules" ADD CONSTRAINT "payout_schedules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_product_id_monetization_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."monetization_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_items" ADD CONSTRAINT "reconciliation_items_run_id_reconciliation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."reconciliation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_items" ADD CONSTRAINT "reconciliation_items_resolved_by_membership_id_organization_members_id_fk" FOREIGN KEY ("resolved_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_runs" ADD CONSTRAINT "reconciliation_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_runs" ADD CONSTRAINT "reconciliation_runs_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_history" ADD CONSTRAINT "refund_history_refund_id_refunds_id_fk" FOREIGN KEY ("refund_id") REFERENCES "public"."refunds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_history" ADD CONSTRAINT "refund_history_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "software_licenses" ADD CONSTRAINT "software_licenses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "software_licenses" ADD CONSTRAINT "software_licenses_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "software_licenses" ADD CONSTRAINT "software_licenses_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "split_rules" ADD CONSTRAINT "split_rules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_cash_positions" ADD CONSTRAINT "treasury_cash_positions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_forecast_versions" ADD CONSTRAINT "treasury_forecast_versions_forecast_id_treasury_forecasts_id_fk" FOREIGN KEY ("forecast_id") REFERENCES "public"."treasury_forecasts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_forecast_versions" ADD CONSTRAINT "treasury_forecast_versions_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_forecasts" ADD CONSTRAINT "treasury_forecasts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_meter_id_usage_meters_id_fk" FOREIGN KEY ("meter_id") REFERENCES "public"."usage_meters"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "white_label_configs" ADD CONSTRAINT "white_label_configs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "white_label_configs" ADD CONSTRAINT "white_label_configs_logo_document_id_documents_id_fk" FOREIGN KEY ("logo_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_payable_org_idx" ON "accounts_payable" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "accounts_payable_status_idx" ON "accounts_payable" USING btree ("status");--> statement-breakpoint
CREATE INDEX "accounts_payable_due_idx" ON "accounts_payable" USING btree ("due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_credit_transactions_idempotency_unique" ON "ai_credit_transactions" USING btree ("wallet_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "ai_credit_transactions_wallet_idx" ON "ai_credit_transactions" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "ai_credit_transactions_type_idx" ON "ai_credit_transactions" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_credit_wallets_org_unique" ON "ai_credit_wallets" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_credit_wallets_user_unique" ON "ai_credit_wallets" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "api_client_scopes_unique" ON "api_client_scopes" USING btree ("api_client_id","scope_id");--> statement-breakpoint
CREATE INDEX "api_clients_org_idx" ON "api_clients" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "api_clients_status_idx" ON "api_clients" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "api_credentials_credential_id_unique" ON "api_credentials" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "api_credentials_client_idx" ON "api_credentials" USING btree ("api_client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "api_scopes_key_unique" ON "api_scopes" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "api_usage_records_idempotency_unique" ON "api_usage_records" USING btree ("api_client_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "api_usage_records_client_idx" ON "api_usage_records" USING btree ("api_client_id");--> statement-breakpoint
CREATE INDEX "api_usage_records_occurred_idx" ON "api_usage_records" USING btree ("occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "delinquency_cases_receivable_unique" ON "delinquency_cases" USING btree ("receivable_id");--> statement-breakpoint
CREATE INDEX "delinquency_cases_org_idx" ON "delinquency_cases" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "delinquency_cases_stage_idx" ON "delinquency_cases" USING btree ("stage");--> statement-breakpoint
CREATE UNIQUE INDEX "external_financial_tx_provider_ext_unique" ON "external_financial_transactions" USING btree ("organization_id","provider_key","external_id");--> statement-breakpoint
CREATE INDEX "external_financial_tx_org_idx" ON "external_financial_transactions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "external_financial_tx_occurred_idx" ON "external_financial_transactions" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "financial_discrepancies_org_idx" ON "financial_discrepancies" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "financial_discrepancies_status_idx" ON "financial_discrepancies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "financial_dispute_evidence_dispute_idx" ON "financial_dispute_evidence" USING btree ("dispute_id");--> statement-breakpoint
CREATE INDEX "financial_dispute_history_dispute_idx" ON "financial_dispute_history" USING btree ("dispute_id");--> statement-breakpoint
CREATE INDEX "financial_disputes_org_idx" ON "financial_disputes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "financial_disputes_payment_idx" ON "financial_disputes" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "financial_disputes_status_idx" ON "financial_disputes" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "financial_disputes_external_unique" ON "financial_disputes" USING btree ("provider_key","external_dispute_id");--> statement-breakpoint
CREATE INDEX "financial_retentions_allocation_idx" ON "financial_retentions" USING btree ("allocation_id");--> statement-breakpoint
CREATE INDEX "financial_retentions_org_idx" ON "financial_retentions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "financial_retentions_status_idx" ON "financial_retentions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "monetization_products_key_unique" ON "monetization_products" USING btree ("key");--> statement-breakpoint
CREATE INDEX "monetization_products_type_idx" ON "monetization_products" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX "payables_org_idx" ON "payables" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "payables_beneficiary_idx" ON "payables" USING btree ("beneficiary_type","beneficiary_id");--> statement-breakpoint
CREATE INDEX "payables_status_idx" ON "payables" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payables_available_idx" ON "payables" USING btree ("available_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payout_schedules_beneficiary_unique" ON "payout_schedules" USING btree ("organization_id","beneficiary_type","beneficiary_id");--> statement-breakpoint
CREATE INDEX "payout_schedules_active_idx" ON "payout_schedules" USING btree ("active");--> statement-breakpoint
CREATE UNIQUE INDEX "product_prices_product_version_unique" ON "product_prices" USING btree ("product_id","version");--> statement-breakpoint
CREATE INDEX "product_prices_product_idx" ON "product_prices" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "receivables_source_unique" ON "receivables" USING btree ("organization_id","source_type","source_id");--> statement-breakpoint
CREATE INDEX "receivables_org_status_idx" ON "receivables" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "receivables_due_idx" ON "receivables" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "reconciliation_items_run_idx" ON "reconciliation_items" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "reconciliation_items_status_idx" ON "reconciliation_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reconciliation_runs_org_idx" ON "reconciliation_runs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "reconciliation_runs_status_idx" ON "reconciliation_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "refund_history_refund_idx" ON "refund_history" USING btree ("refund_id");--> statement-breakpoint
CREATE INDEX "software_licenses_org_idx" ON "software_licenses" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "software_licenses_status_idx" ON "software_licenses" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "split_rules_org_key_version_unique" ON "split_rules" USING btree ("organization_id","key","version");--> statement-breakpoint
CREATE INDEX "split_rules_product_idx" ON "split_rules" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX "split_rules_status_idx" ON "split_rules" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "technology_fee_rules_key_version_unique" ON "technology_fee_rules" USING btree ("key","version");--> statement-breakpoint
CREATE INDEX "technology_fee_rules_applies_idx" ON "technology_fee_rules" USING btree ("applies_to");--> statement-breakpoint
CREATE UNIQUE INDEX "treasury_cash_positions_unique" ON "treasury_cash_positions" USING btree ("organization_id","currency","source_account_key","as_of_date");--> statement-breakpoint
CREATE INDEX "treasury_cash_positions_org_idx" ON "treasury_cash_positions" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "treasury_forecast_versions_unique" ON "treasury_forecast_versions" USING btree ("forecast_id","version");--> statement-breakpoint
CREATE INDEX "treasury_forecast_versions_forecast_idx" ON "treasury_forecast_versions" USING btree ("forecast_id");--> statement-breakpoint
CREATE INDEX "treasury_forecasts_org_idx" ON "treasury_forecasts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "treasury_forecasts_scenario_idx" ON "treasury_forecasts" USING btree ("scenario");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_meters_key_unique" ON "usage_meters" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_records_idempotency_unique" ON "usage_records" USING btree ("organization_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "usage_records_meter_idx" ON "usage_records" USING btree ("meter_id");--> statement-breakpoint
CREATE INDEX "usage_records_org_idx" ON "usage_records" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "usage_records_occurred_idx" ON "usage_records" USING btree ("occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "white_label_configs_org_unique" ON "white_label_configs" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "white_label_configs_domain_unique" ON "white_label_configs" USING btree ("custom_domain");--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_credit_id_billing_credits_id_fk" FOREIGN KEY ("credit_id") REFERENCES "public"."billing_credits"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "refunds_idempotency_unique" ON "refunds" USING btree ("organization_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "payment_allocations_org_idx" ON "payment_allocations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_status_idx" ON "payment_allocations" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "payouts_idempotency_unique" ON "payouts" USING btree ("organization_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "payouts_external_unique" ON "payouts" USING btree ("provider_key","external_payout_id");