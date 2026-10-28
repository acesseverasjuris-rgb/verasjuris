CREATE TYPE "public"."lawyer_availability_status" AS ENUM('available', 'busy', 'away', 'offline');--> statement-breakpoint
CREATE TYPE "public"."oab_verification_status" AS ENUM('informed', 'pending_verification', 'verified', 'rejected', 'expired', 'not_configured');--> statement-breakpoint
CREATE TYPE "public"."client_appointment_request_status" AS ENUM('open', 'in_review', 'scheduled', 'declined', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."client_document_request_status" AS ENUM('open', 'viewed', 'uploaded', 'under_review', 'accepted', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."client_payment_status" AS ENUM('pending', 'paid', 'partial', 'overdue', 'cancelled', 'refunded', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."client_request_status" AS ENUM('open', 'in_review', 'assigned', 'waiting_client', 'resolved', 'closed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."client_request_type" AS ENUM('document_request', 'status_request', 'appointment_request', 'call_request', 'contract_request', 'payment_question', 'general', 'other');--> statement-breakpoint
CREATE TYPE "public"."conversation_thread_status" AS ENUM('open', 'waiting_client', 'waiting_staff', 'closed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."message_sender_type" AS ENUM('client', 'staff', 'system');--> statement-breakpoint
CREATE TYPE "public"."communication_category" AS ENUM('transactional', 'case_update', 'appointment', 'document', 'payment', 'contract', 'marketing', 'security', 'system');--> statement-breakpoint
CREATE TYPE "public"."communication_channel" AS ENUM('in_app', 'email', 'sms', 'whatsapp', 'push');--> statement-breakpoint
CREATE TYPE "public"."communication_consent_status" AS ENUM('unknown', 'opted_in', 'opted_out', 'required', 'not_applicable');--> statement-breakpoint
CREATE TYPE "public"."communication_message_status" AS ENUM('draft', 'queued', 'sending', 'sent', 'delivered', 'failed', 'cancelled', 'not_configured');--> statement-breakpoint
CREATE TYPE "public"."communication_outbox_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'cancelled', 'not_configured');--> statement-breakpoint
CREATE TYPE "public"."online_consultation_mode" AS ENUM('text', 'audio', 'video', 'in_person', 'other');--> statement-breakpoint
CREATE TYPE "public"."online_consultation_payment_status" AS ENUM('pending', 'paid_manual', 'paid_provider', 'failed', 'cancelled', 'refunded', 'not_configured');--> statement-breakpoint
CREATE TYPE "public"."online_consultation_status" AS ENUM('matched', 'awaiting_payment', 'scheduled', 'ready', 'in_progress', 'completed', 'cancelled', 'no_show', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."online_legal_request_status" AS ENUM('draft', 'submitted', 'matching', 'matched', 'cancelled', 'expired', 'converted');--> statement-breakpoint
CREATE TYPE "public"."online_legal_urgency" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."online_match_candidate_status" AS ENUM('pending', 'offered', 'accepted', 'declined', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."online_review_status" AS ENUM('pending', 'published', 'hidden', 'reported', 'removed');--> statement-breakpoint
CREATE TABLE "client_appointment_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"legal_matter_id" uuid,
	"created_by_user_id" uuid,
	"preferred_date_ranges" jsonb,
	"appointment_type" text DEFAULT 'general' NOT NULL,
	"notes" text,
	"status" "client_appointment_request_status" DEFAULT 'open' NOT NULL,
	"resulting_calendar_event_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_document_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"legal_matter_id" uuid,
	"requested_by_membership_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"document_kind" text,
	"due_at" timestamp with time zone,
	"status" "client_document_request_status" DEFAULT 'open' NOT NULL,
	"fulfilled_document_id" uuid,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_payment_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"legal_matter_id" uuid,
	"contract_id" uuid,
	"description" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"due_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"status" "client_payment_status" DEFAULT 'pending' NOT NULL,
	"payment_method" text,
	"external_reference" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"evidence_document_id" uuid,
	"recorded_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"legal_matter_id" uuid,
	"created_by_user_id" uuid,
	"request_type" "client_request_type" DEFAULT 'general' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "client_request_status" DEFAULT 'open' NOT NULL,
	"assigned_membership_id" uuid,
	"resulting_task_id" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"participant_role" text DEFAULT 'member' NOT NULL,
	"last_read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid,
	"legal_matter_id" uuid,
	"subject" text NOT NULL,
	"status" "conversation_thread_status" DEFAULT 'open' NOT NULL,
	"created_by_user_id" uuid,
	"context_type" text,
	"context_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"sender_user_id" uuid,
	"sender_type" "message_sender_type" DEFAULT 'staff' NOT NULL,
	"body" text NOT NULL,
	"client_visible" boolean DEFAULT true NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communication_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"channel" "communication_channel" NOT NULL,
	"category" "communication_category" NOT NULL,
	"status" "communication_consent_status" DEFAULT 'unknown' NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"granted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"evidence" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communication_message_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communication_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"recipient_type" text NOT NULL,
	"recipient_id" uuid NOT NULL,
	"channel" "communication_channel" NOT NULL,
	"category" "communication_category" DEFAULT 'system' NOT NULL,
	"template_version_id" uuid,
	"subject" text,
	"body_snapshot" text NOT NULL,
	"status" "communication_message_status" DEFAULT 'draft' NOT NULL,
	"provider_key" text DEFAULT 'not_configured' NOT NULL,
	"external_message_id" text,
	"idempotency_key" text,
	"scheduled_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"error_code" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communication_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"communication_message_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" "communication_outbox_status" DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"last_error_code" text,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communication_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"channel" "communication_channel" NOT NULL,
	"category" "communication_category" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"quiet_hours_start" text,
	"quiet_hours_end" text,
	"language" text DEFAULT 'pt-BR' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communication_template_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"subject_template" text,
	"body_template" text NOT NULL,
	"variable_schema" jsonb,
	"locked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communication_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"scope" text DEFAULT 'organization' NOT NULL,
	"channel" "communication_channel" NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"subject_template" text,
	"body_template" text NOT NULL,
	"variable_schema" jsonb,
	"category" "communication_category" DEFAULT 'system' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"current_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultation_closures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"closed_by_user_id" uuid NOT NULL,
	"outcome" text DEFAULT 'completed' NOT NULL,
	"summary" text,
	"follow_up_recommended" boolean DEFAULT false NOT NULL,
	"legal_matter_created_id" uuid,
	"closed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultation_terms_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"terms_version" text NOT NULL,
	"accepted_at" timestamp with time zone NOT NULL,
	"source" text DEFAULT 'portal' NOT NULL,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lawyer_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lawyer_profile_id" uuid NOT NULL,
	"day_of_week" integer,
	"specific_date" timestamp with time zone,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"mode" "online_consultation_mode" DEFAULT 'text' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lawyer_availability_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lawyer_profile_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"override_type" text DEFAULT 'unavailable' NOT NULL,
	"reason" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "online_consultation_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"amount_cents" bigint NOT NULL,
	"platform_fee_cents" bigint DEFAULT 0 NOT NULL,
	"lawyer_amount_cents" bigint DEFAULT 0 NOT NULL,
	"status" "online_consultation_payment_status" DEFAULT 'pending' NOT NULL,
	"provider_key" text DEFAULT 'not_configured' NOT NULL,
	"external_reference" text,
	"evidence_document_id" uuid,
	"recorded_by_membership_id" uuid,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "online_consultation_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"client_id" uuid,
	"reviewer_user_id" uuid NOT NULL,
	"lawyer_profile_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"status" "online_review_status" DEFAULT 'pending' NOT NULL,
	"moderated_by_membership_id" uuid,
	"moderated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "online_consultations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"request_id" uuid NOT NULL,
	"client_id" uuid,
	"lawyer_profile_id" uuid NOT NULL,
	"match_candidate_id" uuid,
	"status" "online_consultation_status" DEFAULT 'matched' NOT NULL,
	"mode" "online_consultation_mode" DEFAULT 'text' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"calendar_event_id" uuid,
	"contract_id" uuid,
	"conversation_thread_id" uuid,
	"price_cents" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "online_legal_match_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"lawyer_profile_id" uuid NOT NULL,
	"score_breakdown" jsonb NOT NULL,
	"total_score" integer DEFAULT 0 NOT NULL,
	"status" "online_match_candidate_status" DEFAULT 'pending' NOT NULL,
	"offered_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "online_legal_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"requester_user_id" uuid NOT NULL,
	"client_id" uuid,
	"legal_area_id" uuid,
	"subarea_id" uuid,
	"urgency" "online_legal_urgency" DEFAULT 'normal' NOT NULL,
	"state_code" text NOT NULL,
	"summary" text NOT NULL,
	"preferred_mode" "online_consultation_mode" DEFAULT 'text' NOT NULL,
	"status" "online_legal_request_status" DEFAULT 'draft' NOT NULL,
	"accepted_match_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "legal_matter_timeline_events" ADD COLUMN "client_visible" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "client_visible" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "lawyer_profiles" ADD COLUMN "oab_verification_status" "oab_verification_status" DEFAULT 'not_configured' NOT NULL;--> statement-breakpoint
ALTER TABLE "lawyer_profiles" ADD COLUMN "online_service_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "lawyer_profiles" ADD COLUMN "service_states" text;--> statement-breakpoint
ALTER TABLE "lawyer_profiles" ADD COLUMN "consultation_modes" text;--> statement-breakpoint
ALTER TABLE "lawyer_profiles" ADD COLUMN "availability_status" "lawyer_availability_status" DEFAULT 'offline' NOT NULL;--> statement-breakpoint
ALTER TABLE "lawyer_profiles" ADD COLUMN "accepts_urgent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "lawyer_profiles" ADD COLUMN "consultation_price_cents" integer;--> statement-breakpoint
ALTER TABLE "client_appointment_requests" ADD CONSTRAINT "client_appointment_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_appointment_requests" ADD CONSTRAINT "client_appointment_requests_client_id_crm_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."crm_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_appointment_requests" ADD CONSTRAINT "client_appointment_requests_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_appointment_requests" ADD CONSTRAINT "client_appointment_requests_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_appointment_requests" ADD CONSTRAINT "client_appointment_requests_resulting_calendar_event_id_calendar_events_id_fk" FOREIGN KEY ("resulting_calendar_event_id") REFERENCES "public"."calendar_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_document_requests" ADD CONSTRAINT "client_document_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_document_requests" ADD CONSTRAINT "client_document_requests_client_id_crm_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."crm_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_document_requests" ADD CONSTRAINT "client_document_requests_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_document_requests" ADD CONSTRAINT "client_document_requests_requested_by_membership_id_organization_members_id_fk" FOREIGN KEY ("requested_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_document_requests" ADD CONSTRAINT "client_document_requests_fulfilled_document_id_documents_id_fk" FOREIGN KEY ("fulfilled_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_payment_records" ADD CONSTRAINT "client_payment_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_payment_records" ADD CONSTRAINT "client_payment_records_client_id_crm_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."crm_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_payment_records" ADD CONSTRAINT "client_payment_records_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_payment_records" ADD CONSTRAINT "client_payment_records_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_payment_records" ADD CONSTRAINT "client_payment_records_evidence_document_id_documents_id_fk" FOREIGN KEY ("evidence_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_payment_records" ADD CONSTRAINT "client_payment_records_recorded_by_membership_id_organization_members_id_fk" FOREIGN KEY ("recorded_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_requests" ADD CONSTRAINT "client_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_requests" ADD CONSTRAINT "client_requests_client_id_crm_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."crm_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_requests" ADD CONSTRAINT "client_requests_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_requests" ADD CONSTRAINT "client_requests_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_requests" ADD CONSTRAINT "client_requests_assigned_membership_id_organization_members_id_fk" FOREIGN KEY ("assigned_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_thread_id_conversation_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."conversation_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_threads" ADD CONSTRAINT "conversation_threads_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_threads" ADD CONSTRAINT "conversation_threads_client_id_crm_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."crm_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_threads" ADD CONSTRAINT "conversation_threads_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_threads" ADD CONSTRAINT "conversation_threads_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_id_conversation_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."conversation_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_consents" ADD CONSTRAINT "communication_consents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_message_history" ADD CONSTRAINT "communication_message_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_message_history" ADD CONSTRAINT "communication_message_history_message_id_communication_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."communication_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_messages" ADD CONSTRAINT "communication_messages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_messages" ADD CONSTRAINT "communication_messages_template_version_id_communication_template_versions_id_fk" FOREIGN KEY ("template_version_id") REFERENCES "public"."communication_template_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_outbox" ADD CONSTRAINT "communication_outbox_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_outbox" ADD CONSTRAINT "communication_outbox_communication_message_id_communication_messages_id_fk" FOREIGN KEY ("communication_message_id") REFERENCES "public"."communication_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_preferences" ADD CONSTRAINT "communication_preferences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_preferences" ADD CONSTRAINT "communication_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_template_versions" ADD CONSTRAINT "communication_template_versions_template_id_communication_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."communication_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_templates" ADD CONSTRAINT "communication_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_closures" ADD CONSTRAINT "consultation_closures_consultation_id_online_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."online_consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_closures" ADD CONSTRAINT "consultation_closures_closed_by_user_id_users_id_fk" FOREIGN KEY ("closed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_closures" ADD CONSTRAINT "consultation_closures_legal_matter_created_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_created_id") REFERENCES "public"."legal_matters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_terms_acceptances" ADD CONSTRAINT "consultation_terms_acceptances_consultation_id_online_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."online_consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_terms_acceptances" ADD CONSTRAINT "consultation_terms_acceptances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lawyer_availability" ADD CONSTRAINT "lawyer_availability_lawyer_profile_id_lawyer_profiles_user_id_fk" FOREIGN KEY ("lawyer_profile_id") REFERENCES "public"."lawyer_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lawyer_availability_overrides" ADD CONSTRAINT "lawyer_availability_overrides_lawyer_profile_id_lawyer_profiles_user_id_fk" FOREIGN KEY ("lawyer_profile_id") REFERENCES "public"."lawyer_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_consultation_payments" ADD CONSTRAINT "online_consultation_payments_consultation_id_online_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."online_consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_consultation_payments" ADD CONSTRAINT "online_consultation_payments_evidence_document_id_documents_id_fk" FOREIGN KEY ("evidence_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_consultation_payments" ADD CONSTRAINT "online_consultation_payments_recorded_by_membership_id_organization_members_id_fk" FOREIGN KEY ("recorded_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_consultation_reviews" ADD CONSTRAINT "online_consultation_reviews_consultation_id_online_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."online_consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_consultation_reviews" ADD CONSTRAINT "online_consultation_reviews_client_id_crm_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."crm_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_consultation_reviews" ADD CONSTRAINT "online_consultation_reviews_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_consultation_reviews" ADD CONSTRAINT "online_consultation_reviews_lawyer_profile_id_lawyer_profiles_user_id_fk" FOREIGN KEY ("lawyer_profile_id") REFERENCES "public"."lawyer_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_consultation_reviews" ADD CONSTRAINT "online_consultation_reviews_moderated_by_membership_id_organization_members_id_fk" FOREIGN KEY ("moderated_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_consultations" ADD CONSTRAINT "online_consultations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_consultations" ADD CONSTRAINT "online_consultations_request_id_online_legal_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."online_legal_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_consultations" ADD CONSTRAINT "online_consultations_client_id_crm_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."crm_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_consultations" ADD CONSTRAINT "online_consultations_lawyer_profile_id_lawyer_profiles_user_id_fk" FOREIGN KEY ("lawyer_profile_id") REFERENCES "public"."lawyer_profiles"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_consultations" ADD CONSTRAINT "online_consultations_match_candidate_id_online_legal_match_candidates_id_fk" FOREIGN KEY ("match_candidate_id") REFERENCES "public"."online_legal_match_candidates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_consultations" ADD CONSTRAINT "online_consultations_calendar_event_id_calendar_events_id_fk" FOREIGN KEY ("calendar_event_id") REFERENCES "public"."calendar_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_consultations" ADD CONSTRAINT "online_consultations_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_consultations" ADD CONSTRAINT "online_consultations_conversation_thread_id_conversation_threads_id_fk" FOREIGN KEY ("conversation_thread_id") REFERENCES "public"."conversation_threads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_legal_match_candidates" ADD CONSTRAINT "online_legal_match_candidates_request_id_online_legal_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."online_legal_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_legal_match_candidates" ADD CONSTRAINT "online_legal_match_candidates_lawyer_profile_id_lawyer_profiles_user_id_fk" FOREIGN KEY ("lawyer_profile_id") REFERENCES "public"."lawyer_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_legal_requests" ADD CONSTRAINT "online_legal_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_legal_requests" ADD CONSTRAINT "online_legal_requests_requester_user_id_users_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_legal_requests" ADD CONSTRAINT "online_legal_requests_client_id_crm_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."crm_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_legal_requests" ADD CONSTRAINT "online_legal_requests_legal_area_id_legal_areas_id_fk" FOREIGN KEY ("legal_area_id") REFERENCES "public"."legal_areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_legal_requests" ADD CONSTRAINT "online_legal_requests_subarea_id_legal_subareas_id_fk" FOREIGN KEY ("subarea_id") REFERENCES "public"."legal_subareas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_appointment_requests_org_client_idx" ON "client_appointment_requests" USING btree ("organization_id","client_id");--> statement-breakpoint
CREATE INDEX "client_appointment_requests_status_idx" ON "client_appointment_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "client_document_requests_org_client_idx" ON "client_document_requests" USING btree ("organization_id","client_id");--> statement-breakpoint
CREATE INDEX "client_document_requests_status_idx" ON "client_document_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "client_document_requests_matter_idx" ON "client_document_requests" USING btree ("legal_matter_id");--> statement-breakpoint
CREATE INDEX "client_payment_records_org_client_idx" ON "client_payment_records" USING btree ("organization_id","client_id");--> statement-breakpoint
CREATE INDEX "client_payment_records_status_idx" ON "client_payment_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "client_payment_records_due_idx" ON "client_payment_records" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "client_requests_org_client_idx" ON "client_requests" USING btree ("organization_id","client_id");--> statement-breakpoint
CREATE INDEX "client_requests_status_idx" ON "client_requests" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_participants_thread_user_unique" ON "conversation_participants" USING btree ("thread_id","user_id");--> statement-breakpoint
CREATE INDEX "conversation_participants_org_idx" ON "conversation_participants" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "conversation_threads_org_idx" ON "conversation_threads" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "conversation_threads_org_client_idx" ON "conversation_threads" USING btree ("organization_id","client_id");--> statement-breakpoint
CREATE INDEX "conversation_threads_matter_idx" ON "conversation_threads" USING btree ("legal_matter_id");--> statement-breakpoint
CREATE INDEX "conversation_threads_status_idx" ON "conversation_threads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "messages_thread_idx" ON "messages" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_org_idx" ON "messages" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "communication_consents_subject_idx" ON "communication_consents" USING btree ("organization_id","subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "communication_consents_channel_category_idx" ON "communication_consents" USING btree ("channel","category");--> statement-breakpoint
CREATE INDEX "communication_message_history_message_idx" ON "communication_message_history" USING btree ("message_id","created_at");--> statement-breakpoint
CREATE INDEX "communication_messages_org_idx" ON "communication_messages" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "communication_messages_status_idx" ON "communication_messages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "communication_messages_recipient_idx" ON "communication_messages" USING btree ("recipient_type","recipient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "communication_messages_org_idempotency_unique" ON "communication_messages" USING btree ("organization_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "communication_outbox_idempotency_unique" ON "communication_outbox" USING btree ("organization_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "communication_outbox_status_next_idx" ON "communication_outbox" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE UNIQUE INDEX "communication_preferences_user_channel_category_unique" ON "communication_preferences" USING btree ("user_id","organization_id","channel","category");--> statement-breakpoint
CREATE INDEX "communication_preferences_org_idx" ON "communication_preferences" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "communication_template_versions_template_version_unique" ON "communication_template_versions" USING btree ("template_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "communication_templates_org_channel_key_unique" ON "communication_templates" USING btree ("organization_id","channel","key");--> statement-breakpoint
CREATE INDEX "communication_templates_channel_idx" ON "communication_templates" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "communication_templates_active_idx" ON "communication_templates" USING btree ("active");--> statement-breakpoint
CREATE UNIQUE INDEX "consultation_closures_consultation_unique" ON "consultation_closures" USING btree ("consultation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "consultation_terms_acceptances_consultation_user_version_unique" ON "consultation_terms_acceptances" USING btree ("consultation_id","user_id","terms_version");--> statement-breakpoint
CREATE INDEX "lawyer_availability_profile_idx" ON "lawyer_availability" USING btree ("lawyer_profile_id");--> statement-breakpoint
CREATE INDEX "lawyer_availability_active_idx" ON "lawyer_availability" USING btree ("active");--> statement-breakpoint
CREATE INDEX "lawyer_availability_overrides_profile_idx" ON "lawyer_availability_overrides" USING btree ("lawyer_profile_id");--> statement-breakpoint
CREATE INDEX "lawyer_availability_overrides_range_idx" ON "lawyer_availability_overrides" USING btree ("starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "online_consultation_payments_consultation_idx" ON "online_consultation_payments" USING btree ("consultation_id");--> statement-breakpoint
CREATE INDEX "online_consultation_payments_status_idx" ON "online_consultation_payments" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "online_consultation_reviews_consultation_unique" ON "online_consultation_reviews" USING btree ("consultation_id");--> statement-breakpoint
CREATE INDEX "online_consultation_reviews_lawyer_idx" ON "online_consultation_reviews" USING btree ("lawyer_profile_id");--> statement-breakpoint
CREATE INDEX "online_consultation_reviews_status_idx" ON "online_consultation_reviews" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "online_consultations_request_unique" ON "online_consultations" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "online_consultations_lawyer_idx" ON "online_consultations" USING btree ("lawyer_profile_id");--> statement-breakpoint
CREATE INDEX "online_consultations_status_idx" ON "online_consultations" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "online_legal_match_candidates_request_lawyer_unique" ON "online_legal_match_candidates" USING btree ("request_id","lawyer_profile_id");--> statement-breakpoint
CREATE INDEX "online_legal_match_candidates_status_idx" ON "online_legal_match_candidates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "online_legal_match_candidates_lawyer_idx" ON "online_legal_match_candidates" USING btree ("lawyer_profile_id");--> statement-breakpoint
CREATE INDEX "online_legal_requests_requester_idx" ON "online_legal_requests" USING btree ("requester_user_id");--> statement-breakpoint
CREATE INDEX "online_legal_requests_org_idx" ON "online_legal_requests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "online_legal_requests_status_idx" ON "online_legal_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "online_legal_requests_state_idx" ON "online_legal_requests" USING btree ("state_code");--> statement-breakpoint
CREATE INDEX "legal_matter_timeline_client_visible_idx" ON "legal_matter_timeline_events" USING btree ("legal_matter_id","client_visible","occurred_at");