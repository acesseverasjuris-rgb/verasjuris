-- Etapa 26–33 — Platform hardening foundation
-- Integrações, segurança avançada, LGPD, observabilidade, enterprise, a11y, i18n, assistente, políticas.
-- Hand-written: do not regenerate via drizzle-kit generate (enum regeneration).
-- Reuses communication_consents / white_label_configs — no duplicate consent/branding stores.

CREATE TYPE "public"."user_mfa_status" AS ENUM('disabled', 'enabled', 'required', 'locked');
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "mfa_status" "user_mfa_status" DEFAULT 'disabled' NOT NULL;
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "device_id" text;
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "ip_masked" text;
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "revoke_reason" text;
--> statement-breakpoint
CREATE INDEX "sessions_device_id_idx" ON "sessions" USING btree ("device_id");
--> statement-breakpoint
CREATE TYPE "public"."white_label_domain_verification_status" AS ENUM('requested', 'verification_pending', 'verified', 'tls_pending', 'active', 'failed');
--> statement-breakpoint
ALTER TABLE "white_label_configs" ADD COLUMN "domain_verification_status" "white_label_domain_verification_status";
--> statement-breakpoint
ALTER TABLE "white_label_configs" ADD COLUMN "domain_verification_token_ref" text;
--> statement-breakpoint
CREATE INDEX "white_label_configs_domain_verification_idx" ON "white_label_configs" USING btree ("domain_verification_status");
--> statement-breakpoint
CREATE TYPE "public"."integration_credential_status" AS ENUM('configured', 'not_configured', 'degraded', 'failed', 'disabled', 'expired', 'rotated');
--> statement-breakpoint
CREATE TYPE "public"."integration_environment" AS ENUM('production', 'sandbox', 'staging', 'development');
--> statement-breakpoint
CREATE TYPE "public"."integration_health_status" AS ENUM('healthy', 'degraded', 'failed', 'not_configured', 'unknown');
--> statement-breakpoint
CREATE TYPE "public"."court_data_sync_status" AS ENUM('pending', 'syncing', 'synced', 'stale', 'failed', 'not_configured');
--> statement-breakpoint
CREATE TYPE "public"."mfa_method_type" AS ENUM('totp');
--> statement-breakpoint
CREATE TYPE "public"."mfa_method_status" AS ENUM('pending', 'active', 'disabled', 'locked');
--> statement-breakpoint
CREATE TYPE "public"."security_event_type" AS ENUM('login_failure', 'mfa_failure', 'session_anomaly', 'privilege_change', 'secret_failure', 'rate_limit', 'suspicious_upload', 'webhook_invalid', 'payment_anomaly', 'api_abuse', 'other');
--> statement-breakpoint
CREATE TYPE "public"."security_severity" AS ENUM('info', 'low', 'medium', 'high', 'critical');
--> statement-breakpoint
CREATE TYPE "public"."security_alert_status" AS ENUM('open', 'acknowledged', 'investigating', 'resolved', 'dismissed');
--> statement-breakpoint
CREATE TYPE "public"."security_vulnerability_status" AS ENUM('open', 'triaged', 'in_remediation', 'fixed', 'accepted', 'false_positive');
--> statement-breakpoint
CREATE TYPE "public"."security_pentest_status" AS ENUM('planned', 'in_progress', 'completed', 'report_pending', 'approved', 'rejected', 'cancelled');
--> statement-breakpoint
CREATE TYPE "public"."legal_basis_type" AS ENUM('consent', 'contract', 'legal_obligation', 'regulatory', 'legitimate_interest', 'legal_process', 'credit_protection', 'health', 'other');
--> statement-breakpoint
CREATE TYPE "public"."data_subject_category" AS ENUM('client', 'user', 'employee', 'professional', 'partner', 'vendor', 'visitor', 'other');
--> statement-breakpoint
CREATE TYPE "public"."data_asset_status" AS ENUM('draft', 'active', 'under_review', 'retired');
--> statement-breakpoint
CREATE TYPE "public"."data_retention_trigger" AS ENUM('created_at', 'last_activity', 'contract_end', 'relationship_end', 'legal_event', 'manual');
--> statement-breakpoint
CREATE TYPE "public"."data_disposal_method" AS ENUM('delete', 'anonymize', 'archive', 'legal_hold', 'manual_review');
--> statement-breakpoint
CREATE TYPE "public"."data_subject_request_type" AS ENUM('access', 'portability', 'correction', 'deletion', 'anonymization', 'restriction', 'objection', 'consent_withdrawal');
--> statement-breakpoint
CREATE TYPE "public"."data_subject_request_status" AS ENUM('received', 'identity_pending', 'under_review', 'in_progress', 'completed', 'partially_completed', 'rejected', 'cancelled');
--> statement-breakpoint
CREATE TYPE "public"."privacy_officer_role" AS ENUM('dpo', 'deputy_dpo', 'privacy_contact', 'other');
--> statement-breakpoint
CREATE TYPE "public"."privacy_incident_assessment_status" AS ENUM('draft', 'in_progress', 'completed', 'reported', 'closed');
--> statement-breakpoint
CREATE TYPE "public"."service_slo_status" AS ENUM('meeting', 'at_risk', 'breached', 'unknown', 'not_configured');
--> statement-breakpoint
CREATE TYPE "public"."disaster_recovery_exercise_status" AS ENUM('planned', 'in_progress', 'completed', 'failed', 'cancelled');
--> statement-breakpoint
CREATE TYPE "public"."enterprise_sso_protocol" AS ENUM('saml', 'oidc');
--> statement-breakpoint
CREATE TYPE "public"."enterprise_sso_status" AS ENUM('not_configured', 'draft', 'configured', 'active', 'disabled', 'failed');
--> statement-breakpoint
CREATE TYPE "public"."enterprise_sla_status" AS ENUM('draft', 'active', 'paused', 'expired', 'breached');
--> statement-breakpoint
CREATE TYPE "public"."accessibility_contrast_mode" AS ENUM('default', 'high', 'inverted', 'custom');
--> statement-breakpoint
CREATE TYPE "public"."accessibility_color_vision_mode" AS ENUM('none', 'protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia');
--> statement-breakpoint
CREATE TYPE "public"."accessibility_interface_density" AS ENUM('comfortable', 'compact', 'spacious');
--> statement-breakpoint
CREATE TYPE "public"."content_translation_status" AS ENUM('pending', 'machine_translated', 'reviewed', 'failed', 'not_configured');
--> statement-breakpoint
CREATE TYPE "public"."assistant_conversation_status" AS ENUM('active', 'archived', 'deleted');
--> statement-breakpoint
CREATE TYPE "public"."assistant_message_role" AS ENUM('user', 'assistant', 'system', 'tool');
--> statement-breakpoint
CREATE TYPE "public"."assistant_feedback_rating" AS ENUM('positive', 'negative', 'neutral');
--> statement-breakpoint
CREATE TYPE "public"."institutional_policy_status" AS ENUM('draft', 'reviewed', 'approved', 'published', 'superseded');
--> statement-breakpoint
CREATE TABLE "integration_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"provider_key" text NOT NULL,
	"credential_reference" text NOT NULL,
	"environment" "integration_environment" DEFAULT 'production' NOT NULL,
	"status" "integration_credential_status" DEFAULT 'not_configured' NOT NULL,
	"rotated_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_health_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"provider_key" text NOT NULL,
	"status" "integration_health_status" DEFAULT 'unknown' NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"detail" jsonb,
	"latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_api_webhook_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"api_client_id" uuid,
	"url" text NOT NULL,
	"secret_reference" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"retry_policy" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "court_data_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"tribunal" text NOT NULL,
	"provider_key" text NOT NULL,
	"external_reference" text NOT NULL,
	"fetched_at" timestamp with time zone,
	"source" text,
	"confidence" text,
	"sync_status" "court_data_sync_status" DEFAULT 'pending' NOT NULL,
	"legal_matter_id" uuid,
	"judicial_process_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mfa_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "mfa_method_type" DEFAULT 'totp' NOT NULL,
	"secret_reference" text,
	"status" "mfa_method_status" DEFAULT 'pending' NOT NULL,
	"verified_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mfa_recovery_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passkey_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"credential_id" text NOT NULL,
	"public_key" text NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"transports" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" text NOT NULL,
	"device_name" text,
	"browser" text,
	"os" text,
	"trusted" boolean DEFAULT false NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "security_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "security_event_type" NOT NULL,
	"severity" "security_severity" DEFAULT 'info' NOT NULL,
	"user_id" uuid,
	"organization_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "security_alert_status" DEFAULT 'open' NOT NULL,
	"event_id" uuid,
	"title" text NOT NULL,
	"severity" "security_severity" DEFAULT 'medium' NOT NULL,
	"organization_id" uuid,
	"acknowledged_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_vulnerabilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"identifier" text NOT NULL,
	"package_name" text,
	"severity" "security_severity" DEFAULT 'medium' NOT NULL,
	"status" "security_vulnerability_status" DEFAULT 'open' NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fixed_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_pentests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"status" "security_pentest_status" DEFAULT 'planned' NOT NULL,
	"report_document_id" uuid,
	"conducted_at" timestamp with time zone,
	"organization_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_bases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"key" text NOT NULL,
	"type" "legal_basis_type" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_retention_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"data_type" text NOT NULL,
	"duration_days" text,
	"trigger" "data_retention_trigger" DEFAULT 'created_at' NOT NULL,
	"legal_hold_override" boolean DEFAULT true NOT NULL,
	"disposal_method" "data_disposal_method" DEFAULT 'manual_review' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"system_domain" text NOT NULL,
	"data_category" text NOT NULL,
	"purpose" text NOT NULL,
	"owner_label" text,
	"owner_user_id" uuid,
	"processor_label" text,
	"storage_location" text,
	"retention_policy_id" uuid,
	"legal_basis_id" uuid,
	"sensitive" boolean DEFAULT false NOT NULL,
	"international_transfer" boolean DEFAULT false NOT NULL,
	"status" "data_asset_status" DEFAULT 'draft' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processing_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"purpose" text NOT NULL,
	"data_subjects" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"data_categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"legal_basis_id" uuid,
	"retention_policy_id" uuid,
	"security_measures" text,
	"transfers" text,
	"related_consent_channel" text,
	"active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_subject_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"type" "data_subject_request_type" NOT NULL,
	"status" "data_subject_request_status" DEFAULT 'received' NOT NULL,
	"subject_category" "data_subject_category" DEFAULT 'other' NOT NULL,
	"subject_user_id" uuid,
	"subject_external_ref" text,
	"requested_by_user_id" uuid,
	"communication_consent_id" uuid,
	"identity_verified_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "privacy_officers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"role" "privacy_officer_role" DEFAULT 'dpo' NOT NULL,
	"display_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_processors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vendor_name" text NOT NULL,
	"purpose" text NOT NULL,
	"location" text,
	"contract_id" uuid,
	"dpa_document_ref" text,
	"subprocessor_support" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "privacy_incident_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"compliance_incident_id" uuid,
	"title" text NOT NULL,
	"status" "privacy_incident_assessment_status" DEFAULT 'draft' NOT NULL,
	"risk_level" text,
	"affected_subjects_estimate" text,
	"authority_notification_required" boolean DEFAULT false NOT NULL,
	"authority_notified_at" timestamp with time zone,
	"assessment" jsonb,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_slos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"service" text NOT NULL,
	"metric" text NOT NULL,
	"target" text NOT NULL,
	"window" text NOT NULL,
	"status" "service_slo_status" DEFAULT 'unknown' NOT NULL,
	"last_evaluated_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disaster_recovery_exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"title" text NOT NULL,
	"status" "disaster_recovery_exercise_status" DEFAULT 'planned' NOT NULL,
	"conducted_at" timestamp with time zone,
	"conducted_by_user_id" uuid,
	"rto_result" text,
	"rpo_result" text,
	"restore_verified" text,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enterprise_sso_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"protocol" "enterprise_sso_protocol" DEFAULT 'oidc' NOT NULL,
	"status" "enterprise_sso_status" DEFAULT 'not_configured' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"secret_reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_security_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"mfa_required" boolean DEFAULT false NOT NULL,
	"mfa_policy" text DEFAULT 'optional' NOT NULL,
	"session_timeout_minutes" integer DEFAULT 480 NOT NULL,
	"ip_restrictions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sso_required" boolean DEFAULT false NOT NULL,
	"allowed_auth_methods" jsonb DEFAULT '["password"]'::jsonb NOT NULL,
	"document_retention_days" integer,
	"api_policy" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enterprise_slas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" "enterprise_sla_status" DEFAULT 'draft' NOT NULL,
	"availability_target" text,
	"support_tier" text,
	"response_time_minutes" integer,
	"resolution_time_hours" integer,
	"white_label_config_id" uuid,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accessibility_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"font_scale" text DEFAULT '100' NOT NULL,
	"line_spacing" text DEFAULT 'normal' NOT NULL,
	"contrast_mode" "accessibility_contrast_mode" DEFAULT 'default' NOT NULL,
	"color_vision_mode" "accessibility_color_vision_mode" DEFAULT 'none' NOT NULL,
	"reduced_motion" boolean DEFAULT false NOT NULL,
	"reduced_transparency" boolean DEFAULT false NOT NULL,
	"focus_enhancement" boolean DEFAULT false NOT NULL,
	"screen_reader_optimized" boolean DEFAULT false NOT NULL,
	"simplified_language" boolean DEFAULT false NOT NULL,
	"dyslexia_friendly_mode" boolean DEFAULT false NOT NULL,
	"cognitive_support_mode" boolean DEFAULT false NOT NULL,
	"captions_preferred" boolean DEFAULT false NOT NULL,
	"sign_language_preferred" boolean DEFAULT false NOT NULL,
	"keyboard_only" boolean DEFAULT false NOT NULL,
	"high_visibility_cursor" boolean DEFAULT false NOT NULL,
	"reading_guide" boolean DEFAULT false NOT NULL,
	"interface_density" "accessibility_interface_density" DEFAULT 'comfortable' NOT NULL,
	"active_profile" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"source_language" text NOT NULL,
	"target_language" text NOT NULL,
	"translated_text" text NOT NULL,
	"provider" text DEFAULT 'not_configured' NOT NULL,
	"status" "content_translation_status" DEFAULT 'pending' NOT NULL,
	"reviewed" boolean DEFAULT false NOT NULL,
	"reviewed_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"user_id" uuid NOT NULL,
	"title" text,
	"locale" text DEFAULT 'pt-BR' NOT NULL,
	"status" "assistant_conversation_status" DEFAULT 'active' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" "assistant_message_role" NOT NULL,
	"content" text NOT NULL,
	"provider_key" text DEFAULT 'not_configured' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid,
	"message_id" uuid,
	"user_id" uuid NOT NULL,
	"rating" "assistant_feedback_rating" DEFAULT 'neutral' NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "institutional_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"category" text DEFAULT 'legal' NOT NULL,
	"locale" text DEFAULT 'pt-BR' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "institutional_policy_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" "institutional_policy_status" DEFAULT 'draft' NOT NULL,
	"content" text NOT NULL,
	"locale" text DEFAULT 'pt-BR' NOT NULL,
	"published_at" timestamp with time zone,
	"reviewed_by_user_id" uuid,
	"approved_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE INDEX "integration_credentials_provider_idx" ON "integration_credentials" USING btree ("provider_key");
--> statement-breakpoint
CREATE INDEX "integration_credentials_org_idx" ON "integration_credentials" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "integration_credentials_status_idx" ON "integration_credentials" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "integration_health_checks_provider_idx" ON "integration_health_checks" USING btree ("provider_key");
--> statement-breakpoint
CREATE INDEX "integration_health_checks_checked_idx" ON "integration_health_checks" USING btree ("checked_at");
--> statement-breakpoint
CREATE INDEX "integration_health_checks_org_idx" ON "integration_health_checks" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "public_api_webhook_endpoints_org_idx" ON "public_api_webhook_endpoints" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "public_api_webhook_endpoints_client_idx" ON "public_api_webhook_endpoints" USING btree ("api_client_id");
--> statement-breakpoint
CREATE INDEX "public_api_webhook_endpoints_active_idx" ON "public_api_webhook_endpoints" USING btree ("active");
--> statement-breakpoint
CREATE INDEX "court_data_sources_org_idx" ON "court_data_sources" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "court_data_sources_provider_idx" ON "court_data_sources" USING btree ("provider_key");
--> statement-breakpoint
CREATE INDEX "court_data_sources_external_idx" ON "court_data_sources" USING btree ("external_reference");
--> statement-breakpoint
CREATE INDEX "court_data_sources_sync_idx" ON "court_data_sources" USING btree ("sync_status");
--> statement-breakpoint
CREATE INDEX "court_data_sources_matter_idx" ON "court_data_sources" USING btree ("legal_matter_id");
--> statement-breakpoint
CREATE INDEX "court_data_sources_process_idx" ON "court_data_sources" USING btree ("judicial_process_id");
--> statement-breakpoint
CREATE INDEX "mfa_methods_user_idx" ON "mfa_methods" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "mfa_methods_status_idx" ON "mfa_methods" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX "mfa_recovery_codes_hash_unique" ON "mfa_recovery_codes" USING btree ("code_hash");
--> statement-breakpoint
CREATE INDEX "mfa_recovery_codes_user_idx" ON "mfa_recovery_codes" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "passkey_credentials_credential_id_unique" ON "passkey_credentials" USING btree ("credential_id");
--> statement-breakpoint
CREATE INDEX "passkey_credentials_user_idx" ON "passkey_credentials" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "user_devices_user_device_unique" ON "user_devices" USING btree ("user_id","device_id");
--> statement-breakpoint
CREATE INDEX "user_devices_user_idx" ON "user_devices" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "security_events_type_idx" ON "security_events" USING btree ("type");
--> statement-breakpoint
CREATE INDEX "security_events_severity_idx" ON "security_events" USING btree ("severity");
--> statement-breakpoint
CREATE INDEX "security_events_user_idx" ON "security_events" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "security_events_org_idx" ON "security_events" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "security_events_created_idx" ON "security_events" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "security_alerts_status_idx" ON "security_alerts" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "security_alerts_severity_idx" ON "security_alerts" USING btree ("severity");
--> statement-breakpoint
CREATE INDEX "security_alerts_org_idx" ON "security_alerts" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "security_vulnerabilities_status_idx" ON "security_vulnerabilities" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "security_vulnerabilities_severity_idx" ON "security_vulnerabilities" USING btree ("severity");
--> statement-breakpoint
CREATE INDEX "security_vulnerabilities_identifier_idx" ON "security_vulnerabilities" USING btree ("identifier");
--> statement-breakpoint
CREATE UNIQUE INDEX "security_vulnerabilities_source_identifier_unique" ON "security_vulnerabilities" USING btree ("source","identifier");
--> statement-breakpoint
CREATE INDEX "security_pentests_status_idx" ON "security_pentests" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "security_pentests_org_idx" ON "security_pentests" USING btree ("organization_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "legal_bases_org_key_unique" ON "legal_bases" USING btree ("organization_id","key");
--> statement-breakpoint
CREATE INDEX "legal_bases_type_idx" ON "legal_bases" USING btree ("type");
--> statement-breakpoint
CREATE UNIQUE INDEX "data_retention_policies_org_key_unique" ON "data_retention_policies" USING btree ("organization_id","key");
--> statement-breakpoint
CREATE INDEX "data_retention_policies_data_type_idx" ON "data_retention_policies" USING btree ("data_type");
--> statement-breakpoint
CREATE INDEX "data_assets_org_idx" ON "data_assets" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "data_assets_status_idx" ON "data_assets" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "data_assets_domain_idx" ON "data_assets" USING btree ("system_domain");
--> statement-breakpoint
CREATE UNIQUE INDEX "processing_activities_org_key_unique" ON "processing_activities" USING btree ("organization_id","key");
--> statement-breakpoint
CREATE INDEX "processing_activities_org_idx" ON "processing_activities" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "data_subject_requests_org_idx" ON "data_subject_requests" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "data_subject_requests_status_idx" ON "data_subject_requests" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "data_subject_requests_type_idx" ON "data_subject_requests" USING btree ("type");
--> statement-breakpoint
CREATE INDEX "privacy_officers_org_idx" ON "privacy_officers" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "privacy_officers_role_idx" ON "privacy_officers" USING btree ("role");
--> statement-breakpoint
CREATE INDEX "data_processors_org_idx" ON "data_processors" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "data_processors_vendor_idx" ON "data_processors" USING btree ("vendor_name");
--> statement-breakpoint
CREATE INDEX "privacy_incident_assessments_org_idx" ON "privacy_incident_assessments" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "privacy_incident_assessments_status_idx" ON "privacy_incident_assessments" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX "service_slos_org_service_metric_window_unique" ON "service_slos" USING btree ("organization_id","service","metric","window");
--> statement-breakpoint
CREATE INDEX "service_slos_status_idx" ON "service_slos" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "service_slos_service_idx" ON "service_slos" USING btree ("service");
--> statement-breakpoint
CREATE INDEX "disaster_recovery_exercises_status_idx" ON "disaster_recovery_exercises" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "disaster_recovery_exercises_org_idx" ON "disaster_recovery_exercises" USING btree ("organization_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "enterprise_sso_configs_org_protocol_unique" ON "enterprise_sso_configs" USING btree ("organization_id","protocol");
--> statement-breakpoint
CREATE INDEX "enterprise_sso_configs_status_idx" ON "enterprise_sso_configs" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX "organization_security_policies_org_unique" ON "organization_security_policies" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "enterprise_slas_org_idx" ON "enterprise_slas" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "enterprise_slas_status_idx" ON "enterprise_slas" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX "accessibility_preferences_user_unique" ON "accessibility_preferences" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "content_translations_source_lang_unique" ON "content_translations" USING btree ("source_type","source_id","source_language","target_language");
--> statement-breakpoint
CREATE INDEX "content_translations_org_idx" ON "content_translations" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "content_translations_status_idx" ON "content_translations" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "assistant_conversations_user_idx" ON "assistant_conversations" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "assistant_conversations_org_idx" ON "assistant_conversations" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "assistant_conversations_status_idx" ON "assistant_conversations" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "assistant_messages_conversation_idx" ON "assistant_messages" USING btree ("conversation_id");
--> statement-breakpoint
CREATE INDEX "assistant_messages_created_idx" ON "assistant_messages" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "assistant_feedback_user_idx" ON "assistant_feedback" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "assistant_feedback_message_idx" ON "assistant_feedback" USING btree ("message_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "institutional_policies_org_key_locale_unique" ON "institutional_policies" USING btree ("organization_id","key","locale");
--> statement-breakpoint
CREATE INDEX "institutional_policies_key_idx" ON "institutional_policies" USING btree ("key");
--> statement-breakpoint
CREATE UNIQUE INDEX "institutional_policy_versions_policy_version_unique" ON "institutional_policy_versions" USING btree ("policy_id","version");
--> statement-breakpoint
CREATE INDEX "institutional_policy_versions_status_idx" ON "institutional_policy_versions" USING btree ("status");
--> statement-breakpoint
ALTER TABLE "integration_credentials" ADD CONSTRAINT "integration_credentials_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "integration_health_checks" ADD CONSTRAINT "integration_health_checks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "public_api_webhook_endpoints" ADD CONSTRAINT "public_api_webhook_endpoints_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "public_api_webhook_endpoints" ADD CONSTRAINT "public_api_webhook_endpoints_api_client_id_api_clients_id_fk" FOREIGN KEY ("api_client_id") REFERENCES "api_clients"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "court_data_sources" ADD CONSTRAINT "court_data_sources_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "court_data_sources" ADD CONSTRAINT "court_data_sources_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "legal_matters"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "court_data_sources" ADD CONSTRAINT "court_data_sources_judicial_process_id_judicial_processes_id_fk" FOREIGN KEY ("judicial_process_id") REFERENCES "judicial_processes"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mfa_methods" ADD CONSTRAINT "mfa_methods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mfa_recovery_codes" ADD CONSTRAINT "mfa_recovery_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "passkey_credentials" ADD CONSTRAINT "passkey_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "security_alerts" ADD CONSTRAINT "security_alerts_event_id_security_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "security_events"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "security_alerts" ADD CONSTRAINT "security_alerts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "security_pentests" ADD CONSTRAINT "security_pentests_report_document_id_documents_id_fk" FOREIGN KEY ("report_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "security_pentests" ADD CONSTRAINT "security_pentests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "legal_bases" ADD CONSTRAINT "legal_bases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "data_retention_policies" ADD CONSTRAINT "data_retention_policies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "data_assets" ADD CONSTRAINT "data_assets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "data_assets" ADD CONSTRAINT "data_assets_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "data_assets" ADD CONSTRAINT "data_assets_retention_policy_id_data_retention_policies_id_fk" FOREIGN KEY ("retention_policy_id") REFERENCES "data_retention_policies"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "data_assets" ADD CONSTRAINT "data_assets_legal_basis_id_legal_bases_id_fk" FOREIGN KEY ("legal_basis_id") REFERENCES "legal_bases"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "processing_activities" ADD CONSTRAINT "processing_activities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "processing_activities" ADD CONSTRAINT "processing_activities_legal_basis_id_legal_bases_id_fk" FOREIGN KEY ("legal_basis_id") REFERENCES "legal_bases"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "processing_activities" ADD CONSTRAINT "processing_activities_retention_policy_id_data_retention_policies_id_fk" FOREIGN KEY ("retention_policy_id") REFERENCES "data_retention_policies"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "data_subject_requests" ADD CONSTRAINT "data_subject_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "data_subject_requests" ADD CONSTRAINT "data_subject_requests_subject_user_id_users_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "data_subject_requests" ADD CONSTRAINT "data_subject_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "data_subject_requests" ADD CONSTRAINT "data_subject_requests_communication_consent_id_communication_consents_id_fk" FOREIGN KEY ("communication_consent_id") REFERENCES "communication_consents"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "privacy_officers" ADD CONSTRAINT "privacy_officers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "privacy_officers" ADD CONSTRAINT "privacy_officers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "data_processors" ADD CONSTRAINT "data_processors_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "data_processors" ADD CONSTRAINT "data_processors_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "privacy_incident_assessments" ADD CONSTRAINT "privacy_incident_assessments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "privacy_incident_assessments" ADD CONSTRAINT "privacy_incident_assessments_compliance_incident_id_compliance_incidents_id_fk" FOREIGN KEY ("compliance_incident_id") REFERENCES "compliance_incidents"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "service_slos" ADD CONSTRAINT "service_slos_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "disaster_recovery_exercises" ADD CONSTRAINT "disaster_recovery_exercises_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "disaster_recovery_exercises" ADD CONSTRAINT "disaster_recovery_exercises_conducted_by_user_id_users_id_fk" FOREIGN KEY ("conducted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "enterprise_sso_configs" ADD CONSTRAINT "enterprise_sso_configs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "organization_security_policies" ADD CONSTRAINT "organization_security_policies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "enterprise_slas" ADD CONSTRAINT "enterprise_slas_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "enterprise_slas" ADD CONSTRAINT "enterprise_slas_white_label_config_id_white_label_configs_id_fk" FOREIGN KEY ("white_label_config_id") REFERENCES "white_label_configs"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "accessibility_preferences" ADD CONSTRAINT "accessibility_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "content_translations" ADD CONSTRAINT "content_translations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "content_translations" ADD CONSTRAINT "content_translations_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_conversation_id_assistant_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "assistant_conversations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assistant_feedback" ADD CONSTRAINT "assistant_feedback_conversation_id_assistant_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "assistant_conversations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assistant_feedback" ADD CONSTRAINT "assistant_feedback_message_id_assistant_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "assistant_messages"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assistant_feedback" ADD CONSTRAINT "assistant_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "institutional_policies" ADD CONSTRAINT "institutional_policies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "institutional_policy_versions" ADD CONSTRAINT "institutional_policy_versions_policy_id_institutional_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "institutional_policies"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "institutional_policy_versions" ADD CONSTRAINT "institutional_policy_versions_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "institutional_policy_versions" ADD CONSTRAINT "institutional_policy_versions_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE no action;
