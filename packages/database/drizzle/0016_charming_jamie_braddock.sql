CREATE TYPE "public"."marketplace_delivery_mode" AS ENUM('remote', 'in_person', 'hybrid', 'other');--> statement-breakpoint
CREATE TYPE "public"."marketplace_delivery_status" AS ENUM('submitted', 'under_review', 'accepted', 'revision_requested', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."marketplace_dispute_status" AS ENUM('open', 'under_review', 'waiting_client', 'waiting_provider', 'mediation', 'resolved', 'closed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."marketplace_engagement_status" AS ENUM('pending_contract', 'pending_payment', 'active', 'waiting_client', 'waiting_provider', 'delivered', 'completed', 'cancelled', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."marketplace_pricing_model" AS ENUM('fixed', 'starting_at', 'hourly', 'quote_required', 'custom');--> statement-breakpoint
CREATE TYPE "public"."marketplace_proposal_status" AS ENUM('draft', 'submitted', 'viewed', 'accepted', 'declined', 'withdrawn', 'expired');--> statement-breakpoint
CREATE TYPE "public"."marketplace_request_status" AS ENUM('draft', 'open', 'receiving_proposals', 'proposal_selected', 'contracting', 'in_progress', 'delivered', 'completed', 'cancelled', 'disputed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."marketplace_review_origin" AS ENUM('marketplace', 'diligence', 'extrajudicial', 'online_lawyer');--> statement-breakpoint
CREATE TYPE "public"."biometric_session_status" AS ENUM('pending', 'passed', 'failed', 'review_required', 'expired', 'not_configured');--> statement-breakpoint
CREATE TYPE "public"."professional_identity_doc_status" AS ENUM('uploaded', 'pending_validation', 'validated', 'rejected', 'expired', 'not_configured');--> statement-breakpoint
CREATE TYPE "public"."professional_suspension_scope" AS ENUM('marketplace', 'proposals', 'acceptance', 'engagement', 'receiving', 'all');--> statement-breakpoint
CREATE TYPE "public"."professional_suspension_status" AS ENUM('active', 'lifted', 'expired');--> statement-breakpoint
CREATE TYPE "public"."professional_verification_risk" AS ENUM('low', 'medium', 'high', 'critical', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."professional_verification_type" AS ENUM('oab', 'cpf', 'identity', 'document', 'biometric', 'address', 'other');--> statement-breakpoint
CREATE TYPE "public"."professional_verification_case_status" AS ENUM('not_started', 'pending', 'in_review', 'verified', 'rejected', 'expired', 'suspended', 'revalidation_required', 'not_configured');
--> statement-breakpoint
CREATE TYPE "public"."diligence_assignment_status" AS ENUM('accepted', 'in_progress', 'evidence_pending', 'under_review', 'completed', 'cancelled', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."diligence_evidence_status" AS ENUM('submitted', 'under_review', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."diligence_evidence_type" AS ENUM('document', 'receipt', 'protocol', 'certificate', 'photo', 'location_proof', 'signed_acknowledgement', 'other');--> statement-breakpoint
CREATE TYPE "public"."diligence_execution_event_type" AS ENUM('started', 'arrived', 'protocolled', 'hearing_attended', 'document_collected', 'evidence_submitted', 'completed', 'issue_reported');--> statement-breakpoint
CREATE TYPE "public"."diligence_proposal_status" AS ENUM('draft', 'submitted', 'accepted', 'declined', 'withdrawn', 'expired');--> statement-breakpoint
CREATE TYPE "public"."diligence_request_status" AS ENUM('draft', 'open', 'receiving_proposals', 'assigned', 'in_progress', 'evidence_pending', 'under_review', 'completed', 'cancelled', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."extrajudicial_delivery_status" AS ENUM('pending', 'delivered', 'confirmed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."extrajudicial_delivery_type" AS ENUM('digital_document', 'physical_pickup', 'courier', 'registry_portal', 'other');--> statement-breakpoint
CREATE TYPE "public"."extrajudicial_order_status" AS ENUM('pending_documents', 'ready_to_submit', 'submitted', 'protocolled', 'under_processing', 'pending_requirement', 'ready_for_delivery', 'delivered', 'completed', 'cancelled', 'disputed', 'not_configured_external');--> statement-breakpoint
CREATE TYPE "public"."extrajudicial_quote_source" AS ENUM('manual_estimate', 'provider', 'fee_table', 'other');--> statement-breakpoint
CREATE TYPE "public"."extrajudicial_quote_status" AS ENUM('draft', 'submitted', 'accepted', 'declined', 'expired', 'revised');--> statement-breakpoint
CREATE TYPE "public"."extrajudicial_request_status" AS ENUM('draft', 'quoting', 'quote_received', 'accepted', 'ordered', 'in_progress', 'completed', 'cancelled', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."extrajudicial_requirement_status" AS ENUM('open', 'fulfilled', 'waived', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."registry_office_source" AS ENUM('manual', 'provider', 'official_import', 'other');--> statement-breakpoint
CREATE TYPE "public"."registry_office_verification_status" AS ENUM('unverified', 'verified', 'outdated', 'not_configured');--> statement-breakpoint
CREATE TABLE "marketplace_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid NOT NULL,
	"delivered_by_user_id" uuid NOT NULL,
	"description" text NOT NULL,
	"document_id" uuid,
	"status" "marketplace_delivery_status" DEFAULT 'submitted' NOT NULL,
	"delivered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"revision_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketplace_disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid,
	"source_entity_type" text,
	"source_entity_id" uuid,
	"source_type" text DEFAULT 'marketplace' NOT NULL,
	"opened_by_user_id" uuid NOT NULL,
	"reason_code" text NOT NULL,
	"description" text NOT NULL,
	"status" "marketplace_dispute_status" DEFAULT 'open' NOT NULL,
	"resolution" text,
	"resolved_by_membership_id" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketplace_engagements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"request_id" uuid NOT NULL,
	"proposal_id" uuid NOT NULL,
	"client_id" uuid,
	"professional_profile_id" uuid NOT NULL,
	"contract_id" uuid,
	"payment_record_id" uuid,
	"conversation_thread_id" uuid,
	"legal_matter_id" uuid,
	"status" "marketplace_engagement_status" DEFAULT 'pending_contract' NOT NULL,
	"revision_limit" integer DEFAULT 2 NOT NULL,
	"revision_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketplace_proposal_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"amount_cents" bigint NOT NULL,
	"message" text,
	"terms" text,
	"snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketplace_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"professional_profile_id" uuid NOT NULL,
	"amount_cents" bigint NOT NULL,
	"fee_breakdown" jsonb,
	"estimated_delivery_at" timestamp with time zone,
	"message" text,
	"terms" text,
	"status" "marketplace_proposal_status" DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketplace_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"requester_user_id" uuid NOT NULL,
	"client_id" uuid,
	"category_id" uuid NOT NULL,
	"legal_area_id" uuid,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"urgency" text DEFAULT 'normal' NOT NULL,
	"location_state" text,
	"location_city" text,
	"remote_allowed" boolean DEFAULT true NOT NULL,
	"budget_min_cents" bigint,
	"budget_max_cents" bigint,
	"deadline_at" timestamp with time zone,
	"status" "marketplace_request_status" DEFAULT 'draft' NOT NULL,
	"accepted_proposal_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketplace_service_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"legal_area_id" uuid,
	"legal_subarea_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professional_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"professional_profile_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"delivery_mode" "marketplace_delivery_mode" DEFAULT 'remote' NOT NULL,
	"pricing_model" "marketplace_pricing_model" DEFAULT 'quote_required' NOT NULL,
	"base_price_cents" bigint,
	"min_price_cents" bigint,
	"max_price_cents" bigint,
	"estimated_duration" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"origin" "marketplace_review_origin" DEFAULT 'marketplace' NOT NULL,
	"engagement_id" uuid,
	"source_entity_type" text,
	"source_entity_id" uuid,
	"reviewer_user_id" uuid NOT NULL,
	"professional_profile_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"moderated_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "biometric_verification_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"verification_case_id" uuid NOT NULL,
	"provider_key" text,
	"external_session_ref" text,
	"status" "biometric_session_status" DEFAULT 'not_configured' NOT NULL,
	"result_metadata" jsonb,
	"consent_recorded_at" timestamp with time zone,
	"consent_term_version" text,
	"retention_expires_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professional_identity_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"verification_case_id" uuid NOT NULL,
	"document_type" text NOT NULL,
	"issuing_country" text DEFAULT 'BR' NOT NULL,
	"issuing_authority" text,
	"number_masked" text,
	"number_encrypted" text,
	"issue_date" timestamp with time zone,
	"expiration_date" timestamp with time zone,
	"document_id" uuid,
	"status" "professional_identity_doc_status" DEFAULT 'uploaded' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professional_revalidation_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"professional_profile_id" uuid NOT NULL,
	"case_id" uuid,
	"trigger" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professional_suspensions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"professional_profile_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"scope" "professional_suspension_scope" DEFAULT 'all' NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	"status" "professional_suspension_status" DEFAULT 'active' NOT NULL,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professional_verification_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"professional_profile_id" uuid NOT NULL,
	"verification_type" "professional_verification_type" NOT NULL,
	"status" "professional_verification_case_status" DEFAULT 'not_started' NOT NULL,
	"risk_level" "professional_verification_risk" DEFAULT 'unknown' NOT NULL,
	"provider_key" text,
	"provider_status" text DEFAULT 'not_configured' NOT NULL,
	"external_reference" text,
	"subject_metadata" jsonb,
	"requested_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"suspended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professional_verification_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"reviewer_membership_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"reason_code" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_key" text NOT NULL,
	"provider_type" text NOT NULL,
	"external_event_id" text,
	"idempotency_key" text NOT NULL,
	"signature_valid" boolean,
	"payload_hash" text,
	"raw_payload_ref" text,
	"processed_at" timestamp with time zone,
	"status" text DEFAULT 'received' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diligence_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"proposal_id" uuid NOT NULL,
	"correspondent_profile_id" uuid NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "diligence_assignment_status" DEFAULT 'accepted' NOT NULL,
	"payment_record_id" uuid,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diligence_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"evidence_type" "diligence_evidence_type" NOT NULL,
	"document_id" uuid,
	"description" text,
	"occurred_at" timestamp with time zone,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "diligence_evidence_status" DEFAULT 'submitted' NOT NULL,
	"authenticity_claim" text DEFAULT 'unverified' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diligence_execution_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"event_type" "diligence_execution_event_type" NOT NULL,
	"notes" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diligence_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"professional_profile_id" uuid NOT NULL,
	"amount_cents" bigint NOT NULL,
	"estimated_completion_at" timestamp with time zone,
	"notes" text,
	"status" "diligence_proposal_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diligence_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"requester_membership_id" uuid NOT NULL,
	"client_id" uuid,
	"legal_matter_id" uuid,
	"type_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"country" text DEFAULT 'BR' NOT NULL,
	"state" text,
	"city" text,
	"address_text" text,
	"court_or_agency" text,
	"forum" text,
	"registry_office_name" text,
	"due_at" timestamp with time zone,
	"urgency" text DEFAULT 'normal' NOT NULL,
	"budget_cents" bigint,
	"status" "diligence_request_status" DEFAULT 'draft' NOT NULL,
	"accepted_proposal_id" uuid,
	"calendar_event_id" uuid,
	"deadline_id" uuid,
	"task_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diligence_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"requires_exclusivity" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extrajudicial_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"delivery_type" "extrajudicial_delivery_type" DEFAULT 'other' NOT NULL,
	"document_id" uuid,
	"external_reference" text,
	"delivered_at" timestamp with time zone,
	"evidence_notes" text,
	"status" "extrajudicial_delivery_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extrajudicial_document_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"version" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extrajudicial_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"contract_id" uuid,
	"payment_record_id" uuid,
	"status" "extrajudicial_order_status" DEFAULT 'pending_documents' NOT NULL,
	"external_protocol" text,
	"protocol_source" text,
	"protocol_evidence_document_id" uuid,
	"submitted_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extrajudicial_quote_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_request_id" uuid NOT NULL,
	"target_registry_office_id" uuid,
	"target_provider_profile_id" uuid,
	"notes" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extrajudicial_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_request_id" uuid NOT NULL,
	"quote_request_id" uuid,
	"provider_profile_id" uuid,
	"registry_office_id" uuid,
	"service_fee_cents" bigint DEFAULT 0 NOT NULL,
	"estimated_official_fees_cents" bigint,
	"estimated_third_party_fees_cents" bigint,
	"total_estimate_cents" bigint NOT NULL,
	"estimated_delivery_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"notes" text,
	"source" "extrajudicial_quote_source" DEFAULT 'manual_estimate' NOT NULL,
	"status" "extrajudicial_quote_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extrajudicial_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"description" text NOT NULL,
	"due_at" timestamp with time zone,
	"status" "extrajudicial_requirement_status" DEFAULT 'open' NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"evidence_document_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extrajudicial_service_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"requester_user_id" uuid NOT NULL,
	"client_id" uuid,
	"legal_matter_id" uuid,
	"service_type_id" uuid NOT NULL,
	"document_type_id" uuid,
	"registry_office_id" uuid,
	"provider_profile_id" uuid,
	"jurisdiction_state" text,
	"jurisdiction_city" text,
	"description" text NOT NULL,
	"status" "extrajudicial_request_status" DEFAULT 'draft' NOT NULL,
	"accepted_quote_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extrajudicial_service_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"official_support_claim" text DEFAULT 'not_configured' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registry_offices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"office_type" text DEFAULT 'other' NOT NULL,
	"country" text DEFAULT 'BR' NOT NULL,
	"state" text,
	"city" text,
	"address" text,
	"external_identifier" text,
	"source" "registry_office_source" DEFAULT 'manual' NOT NULL,
	"verification_status" "registry_office_verification_status" DEFAULT 'unverified' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lawyer_profiles" ADD COLUMN "marketplace_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "lawyer_profiles" ADD COLUMN "marketplace_headline" text;--> statement-breakpoint
ALTER TABLE "lawyer_profiles" ADD COLUMN "marketplace_description" text;--> statement-breakpoint
ALTER TABLE "lawyer_profiles" ADD COLUMN "service_cities" text;--> statement-breakpoint
ALTER TABLE "lawyer_profiles" ADD COLUMN "marketplace_categories" text;--> statement-breakpoint
ALTER TABLE "lawyer_profiles" ADD COLUMN "specialties" text;--> statement-breakpoint
ALTER TABLE "lawyer_profiles" ADD COLUMN "response_time_estimate" text;--> statement-breakpoint
ALTER TABLE "lawyer_profiles" ADD COLUMN "base_price_min_cents" integer;--> statement-breakpoint
ALTER TABLE "lawyer_profiles" ADD COLUMN "base_price_max_cents" integer;--> statement-breakpoint
ALTER TABLE "lawyer_profiles" ADD COLUMN "marketplace_status" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "marketplace_deliveries" ADD CONSTRAINT "marketplace_deliveries_engagement_id_marketplace_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."marketplace_engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_deliveries" ADD CONSTRAINT "marketplace_deliveries_delivered_by_user_id_users_id_fk" FOREIGN KEY ("delivered_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_deliveries" ADD CONSTRAINT "marketplace_deliveries_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_disputes" ADD CONSTRAINT "marketplace_disputes_engagement_id_marketplace_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."marketplace_engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_disputes" ADD CONSTRAINT "marketplace_disputes_opened_by_user_id_users_id_fk" FOREIGN KEY ("opened_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_disputes" ADD CONSTRAINT "marketplace_disputes_resolved_by_membership_id_organization_members_id_fk" FOREIGN KEY ("resolved_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_engagements" ADD CONSTRAINT "marketplace_engagements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_engagements" ADD CONSTRAINT "marketplace_engagements_request_id_marketplace_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."marketplace_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_engagements" ADD CONSTRAINT "marketplace_engagements_proposal_id_marketplace_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."marketplace_proposals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_engagements" ADD CONSTRAINT "marketplace_engagements_client_id_crm_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."crm_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_engagements" ADD CONSTRAINT "marketplace_engagements_professional_profile_id_lawyer_profiles_user_id_fk" FOREIGN KEY ("professional_profile_id") REFERENCES "public"."lawyer_profiles"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_engagements" ADD CONSTRAINT "marketplace_engagements_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_engagements" ADD CONSTRAINT "marketplace_engagements_conversation_thread_id_conversation_threads_id_fk" FOREIGN KEY ("conversation_thread_id") REFERENCES "public"."conversation_threads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_engagements" ADD CONSTRAINT "marketplace_engagements_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_proposal_history" ADD CONSTRAINT "marketplace_proposal_history_proposal_id_marketplace_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."marketplace_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_proposals" ADD CONSTRAINT "marketplace_proposals_request_id_marketplace_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."marketplace_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_proposals" ADD CONSTRAINT "marketplace_proposals_professional_profile_id_lawyer_profiles_user_id_fk" FOREIGN KEY ("professional_profile_id") REFERENCES "public"."lawyer_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_requests" ADD CONSTRAINT "marketplace_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_requests" ADD CONSTRAINT "marketplace_requests_requester_user_id_users_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_requests" ADD CONSTRAINT "marketplace_requests_client_id_crm_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."crm_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_requests" ADD CONSTRAINT "marketplace_requests_category_id_marketplace_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."marketplace_service_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_requests" ADD CONSTRAINT "marketplace_requests_legal_area_id_legal_areas_id_fk" FOREIGN KEY ("legal_area_id") REFERENCES "public"."legal_areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_service_categories" ADD CONSTRAINT "marketplace_service_categories_legal_area_id_legal_areas_id_fk" FOREIGN KEY ("legal_area_id") REFERENCES "public"."legal_areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_service_categories" ADD CONSTRAINT "marketplace_service_categories_legal_subarea_id_legal_subareas_id_fk" FOREIGN KEY ("legal_subarea_id") REFERENCES "public"."legal_subareas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_services" ADD CONSTRAINT "professional_services_professional_profile_id_lawyer_profiles_user_id_fk" FOREIGN KEY ("professional_profile_id") REFERENCES "public"."lawyer_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_services" ADD CONSTRAINT "professional_services_category_id_marketplace_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."marketplace_service_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_reviews" ADD CONSTRAINT "service_reviews_engagement_id_marketplace_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."marketplace_engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_reviews" ADD CONSTRAINT "service_reviews_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_reviews" ADD CONSTRAINT "service_reviews_professional_profile_id_lawyer_profiles_user_id_fk" FOREIGN KEY ("professional_profile_id") REFERENCES "public"."lawyer_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_reviews" ADD CONSTRAINT "service_reviews_moderated_by_membership_id_organization_members_id_fk" FOREIGN KEY ("moderated_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "biometric_verification_sessions" ADD CONSTRAINT "biometric_verification_sessions_verification_case_id_professional_verification_cases_id_fk" FOREIGN KEY ("verification_case_id") REFERENCES "public"."professional_verification_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_identity_documents" ADD CONSTRAINT "professional_identity_documents_verification_case_id_professional_verification_cases_id_fk" FOREIGN KEY ("verification_case_id") REFERENCES "public"."professional_verification_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_identity_documents" ADD CONSTRAINT "professional_identity_documents_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_revalidation_requests" ADD CONSTRAINT "professional_revalidation_requests_professional_profile_id_lawyer_profiles_user_id_fk" FOREIGN KEY ("professional_profile_id") REFERENCES "public"."lawyer_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_revalidation_requests" ADD CONSTRAINT "professional_revalidation_requests_case_id_professional_verification_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."professional_verification_cases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_suspensions" ADD CONSTRAINT "professional_suspensions_professional_profile_id_lawyer_profiles_user_id_fk" FOREIGN KEY ("professional_profile_id") REFERENCES "public"."lawyer_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_suspensions" ADD CONSTRAINT "professional_suspensions_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_verification_cases" ADD CONSTRAINT "professional_verification_cases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_verification_cases" ADD CONSTRAINT "professional_verification_cases_professional_profile_id_lawyer_profiles_user_id_fk" FOREIGN KEY ("professional_profile_id") REFERENCES "public"."lawyer_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_verification_reviews" ADD CONSTRAINT "professional_verification_reviews_case_id_professional_verification_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."professional_verification_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_verification_reviews" ADD CONSTRAINT "professional_verification_reviews_reviewer_membership_id_organization_members_id_fk" FOREIGN KEY ("reviewer_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diligence_assignments" ADD CONSTRAINT "diligence_assignments_request_id_diligence_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."diligence_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diligence_assignments" ADD CONSTRAINT "diligence_assignments_proposal_id_diligence_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."diligence_proposals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diligence_assignments" ADD CONSTRAINT "diligence_assignments_correspondent_profile_id_lawyer_profiles_user_id_fk" FOREIGN KEY ("correspondent_profile_id") REFERENCES "public"."lawyer_profiles"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diligence_evidence" ADD CONSTRAINT "diligence_evidence_assignment_id_diligence_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."diligence_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diligence_evidence" ADD CONSTRAINT "diligence_evidence_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diligence_execution_events" ADD CONSTRAINT "diligence_execution_events_assignment_id_diligence_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."diligence_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diligence_proposals" ADD CONSTRAINT "diligence_proposals_request_id_diligence_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."diligence_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diligence_proposals" ADD CONSTRAINT "diligence_proposals_professional_profile_id_lawyer_profiles_user_id_fk" FOREIGN KEY ("professional_profile_id") REFERENCES "public"."lawyer_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diligence_requests" ADD CONSTRAINT "diligence_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diligence_requests" ADD CONSTRAINT "diligence_requests_requester_membership_id_organization_members_id_fk" FOREIGN KEY ("requester_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diligence_requests" ADD CONSTRAINT "diligence_requests_client_id_crm_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."crm_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diligence_requests" ADD CONSTRAINT "diligence_requests_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diligence_requests" ADD CONSTRAINT "diligence_requests_type_id_diligence_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."diligence_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extrajudicial_deliveries" ADD CONSTRAINT "extrajudicial_deliveries_order_id_extrajudicial_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."extrajudicial_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extrajudicial_deliveries" ADD CONSTRAINT "extrajudicial_deliveries_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extrajudicial_orders" ADD CONSTRAINT "extrajudicial_orders_request_id_extrajudicial_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."extrajudicial_service_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extrajudicial_orders" ADD CONSTRAINT "extrajudicial_orders_quote_id_extrajudicial_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."extrajudicial_quotes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extrajudicial_orders" ADD CONSTRAINT "extrajudicial_orders_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extrajudicial_orders" ADD CONSTRAINT "extrajudicial_orders_protocol_evidence_document_id_documents_id_fk" FOREIGN KEY ("protocol_evidence_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extrajudicial_quote_requests" ADD CONSTRAINT "extrajudicial_quote_requests_service_request_id_extrajudicial_service_requests_id_fk" FOREIGN KEY ("service_request_id") REFERENCES "public"."extrajudicial_service_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extrajudicial_quote_requests" ADD CONSTRAINT "extrajudicial_quote_requests_target_registry_office_id_registry_offices_id_fk" FOREIGN KEY ("target_registry_office_id") REFERENCES "public"."registry_offices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extrajudicial_quote_requests" ADD CONSTRAINT "extrajudicial_quote_requests_target_provider_profile_id_lawyer_profiles_user_id_fk" FOREIGN KEY ("target_provider_profile_id") REFERENCES "public"."lawyer_profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extrajudicial_quotes" ADD CONSTRAINT "extrajudicial_quotes_service_request_id_extrajudicial_service_requests_id_fk" FOREIGN KEY ("service_request_id") REFERENCES "public"."extrajudicial_service_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extrajudicial_quotes" ADD CONSTRAINT "extrajudicial_quotes_quote_request_id_extrajudicial_quote_requests_id_fk" FOREIGN KEY ("quote_request_id") REFERENCES "public"."extrajudicial_quote_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extrajudicial_quotes" ADD CONSTRAINT "extrajudicial_quotes_provider_profile_id_lawyer_profiles_user_id_fk" FOREIGN KEY ("provider_profile_id") REFERENCES "public"."lawyer_profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extrajudicial_quotes" ADD CONSTRAINT "extrajudicial_quotes_registry_office_id_registry_offices_id_fk" FOREIGN KEY ("registry_office_id") REFERENCES "public"."registry_offices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extrajudicial_requirements" ADD CONSTRAINT "extrajudicial_requirements_order_id_extrajudicial_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."extrajudicial_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extrajudicial_requirements" ADD CONSTRAINT "extrajudicial_requirements_evidence_document_id_documents_id_fk" FOREIGN KEY ("evidence_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extrajudicial_service_requests" ADD CONSTRAINT "extrajudicial_service_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extrajudicial_service_requests" ADD CONSTRAINT "extrajudicial_service_requests_requester_user_id_users_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extrajudicial_service_requests" ADD CONSTRAINT "extrajudicial_service_requests_client_id_crm_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."crm_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extrajudicial_service_requests" ADD CONSTRAINT "extrajudicial_service_requests_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extrajudicial_service_requests" ADD CONSTRAINT "extrajudicial_service_requests_service_type_id_extrajudicial_service_types_id_fk" FOREIGN KEY ("service_type_id") REFERENCES "public"."extrajudicial_service_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extrajudicial_service_requests" ADD CONSTRAINT "extrajudicial_service_requests_document_type_id_extrajudicial_document_types_id_fk" FOREIGN KEY ("document_type_id") REFERENCES "public"."extrajudicial_document_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extrajudicial_service_requests" ADD CONSTRAINT "extrajudicial_service_requests_registry_office_id_registry_offices_id_fk" FOREIGN KEY ("registry_office_id") REFERENCES "public"."registry_offices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extrajudicial_service_requests" ADD CONSTRAINT "extrajudicial_service_requests_provider_profile_id_lawyer_profiles_user_id_fk" FOREIGN KEY ("provider_profile_id") REFERENCES "public"."lawyer_profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "marketplace_deliveries_engagement_idx" ON "marketplace_deliveries" USING btree ("engagement_id");--> statement-breakpoint
CREATE INDEX "marketplace_deliveries_status_idx" ON "marketplace_deliveries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "marketplace_disputes_engagement_idx" ON "marketplace_disputes" USING btree ("engagement_id");--> statement-breakpoint
CREATE INDEX "marketplace_disputes_status_idx" ON "marketplace_disputes" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "marketplace_engagements_request_unique" ON "marketplace_engagements" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "marketplace_engagements_proposal_unique" ON "marketplace_engagements" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "marketplace_engagements_professional_idx" ON "marketplace_engagements" USING btree ("professional_profile_id");--> statement-breakpoint
CREATE INDEX "marketplace_engagements_status_idx" ON "marketplace_engagements" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "marketplace_proposal_history_proposal_version_unique" ON "marketplace_proposal_history" USING btree ("proposal_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "marketplace_proposals_request_professional_active_unique" ON "marketplace_proposals" USING btree ("request_id","professional_profile_id");--> statement-breakpoint
CREATE INDEX "marketplace_proposals_status_idx" ON "marketplace_proposals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "marketplace_proposals_professional_idx" ON "marketplace_proposals" USING btree ("professional_profile_id");--> statement-breakpoint
CREATE INDEX "marketplace_requests_requester_idx" ON "marketplace_requests" USING btree ("requester_user_id");--> statement-breakpoint
CREATE INDEX "marketplace_requests_org_idx" ON "marketplace_requests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "marketplace_requests_status_idx" ON "marketplace_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "marketplace_requests_category_idx" ON "marketplace_requests" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "marketplace_service_categories_key_unique" ON "marketplace_service_categories" USING btree ("key");--> statement-breakpoint
CREATE INDEX "marketplace_service_categories_parent_idx" ON "marketplace_service_categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "marketplace_service_categories_active_idx" ON "marketplace_service_categories" USING btree ("active");--> statement-breakpoint
CREATE INDEX "professional_services_profile_idx" ON "professional_services" USING btree ("professional_profile_id");--> statement-breakpoint
CREATE INDEX "professional_services_category_idx" ON "professional_services" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "professional_services_active_idx" ON "professional_services" USING btree ("active");--> statement-breakpoint
CREATE UNIQUE INDEX "service_reviews_engagement_unique" ON "service_reviews" USING btree ("engagement_id");--> statement-breakpoint
CREATE INDEX "service_reviews_professional_idx" ON "service_reviews" USING btree ("professional_profile_id");--> statement-breakpoint
CREATE INDEX "service_reviews_origin_idx" ON "service_reviews" USING btree ("origin");--> statement-breakpoint
CREATE INDEX "biometric_verification_sessions_case_idx" ON "biometric_verification_sessions" USING btree ("verification_case_id");--> statement-breakpoint
CREATE INDEX "biometric_verification_sessions_external_idx" ON "biometric_verification_sessions" USING btree ("external_session_ref");--> statement-breakpoint
CREATE INDEX "professional_identity_documents_case_idx" ON "professional_identity_documents" USING btree ("verification_case_id");--> statement-breakpoint
CREATE INDEX "professional_revalidation_requests_profile_idx" ON "professional_revalidation_requests" USING btree ("professional_profile_id");--> statement-breakpoint
CREATE INDEX "professional_revalidation_requests_status_idx" ON "professional_revalidation_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "professional_suspensions_profile_idx" ON "professional_suspensions" USING btree ("professional_profile_id");--> statement-breakpoint
CREATE INDEX "professional_suspensions_status_idx" ON "professional_suspensions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "professional_verification_cases_user_idx" ON "professional_verification_cases" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "professional_verification_cases_profile_idx" ON "professional_verification_cases" USING btree ("professional_profile_id");--> statement-breakpoint
CREATE INDEX "professional_verification_cases_type_status_idx" ON "professional_verification_cases" USING btree ("verification_type","status");--> statement-breakpoint
CREATE INDEX "professional_verification_reviews_case_idx" ON "professional_verification_reviews" USING btree ("case_id");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_webhook_events_idempotency_unique" ON "provider_webhook_events" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "provider_webhook_events_provider_idx" ON "provider_webhook_events" USING btree ("provider_key");--> statement-breakpoint
CREATE UNIQUE INDEX "diligence_assignments_request_unique" ON "diligence_assignments" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "diligence_assignments_proposal_unique" ON "diligence_assignments" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "diligence_assignments_correspondent_idx" ON "diligence_assignments" USING btree ("correspondent_profile_id");--> statement-breakpoint
CREATE INDEX "diligence_assignments_status_idx" ON "diligence_assignments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "diligence_evidence_assignment_idx" ON "diligence_evidence" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "diligence_evidence_status_idx" ON "diligence_evidence" USING btree ("status");--> statement-breakpoint
CREATE INDEX "diligence_execution_events_assignment_idx" ON "diligence_execution_events" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "diligence_execution_events_type_idx" ON "diligence_execution_events" USING btree ("event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "diligence_proposals_request_professional_unique" ON "diligence_proposals" USING btree ("request_id","professional_profile_id");--> statement-breakpoint
CREATE INDEX "diligence_proposals_status_idx" ON "diligence_proposals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "diligence_requests_org_idx" ON "diligence_requests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "diligence_requests_status_idx" ON "diligence_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "diligence_requests_due_idx" ON "diligence_requests" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "diligence_requests_type_idx" ON "diligence_requests" USING btree ("type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "diligence_types_key_unique" ON "diligence_types" USING btree ("key");--> statement-breakpoint
CREATE INDEX "extrajudicial_deliveries_order_idx" ON "extrajudicial_deliveries" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "extrajudicial_deliveries_status_idx" ON "extrajudicial_deliveries" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "extrajudicial_document_types_key_version_unique" ON "extrajudicial_document_types" USING btree ("key","version");--> statement-breakpoint
CREATE UNIQUE INDEX "extrajudicial_orders_request_unique" ON "extrajudicial_orders" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "extrajudicial_orders_quote_unique" ON "extrajudicial_orders" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "extrajudicial_orders_status_idx" ON "extrajudicial_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "extrajudicial_quote_requests_service_idx" ON "extrajudicial_quote_requests" USING btree ("service_request_id");--> statement-breakpoint
CREATE INDEX "extrajudicial_quotes_service_idx" ON "extrajudicial_quotes" USING btree ("service_request_id");--> statement-breakpoint
CREATE INDEX "extrajudicial_quotes_status_idx" ON "extrajudicial_quotes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "extrajudicial_requirements_order_idx" ON "extrajudicial_requirements" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "extrajudicial_requirements_status_idx" ON "extrajudicial_requirements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "extrajudicial_service_requests_org_idx" ON "extrajudicial_service_requests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "extrajudicial_service_requests_status_idx" ON "extrajudicial_service_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "extrajudicial_service_requests_type_idx" ON "extrajudicial_service_requests" USING btree ("service_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "extrajudicial_service_types_key_unique" ON "extrajudicial_service_types" USING btree ("key");--> statement-breakpoint
CREATE INDEX "registry_offices_state_city_idx" ON "registry_offices" USING btree ("state","city");--> statement-breakpoint
CREATE INDEX "registry_offices_verification_idx" ON "registry_offices" USING btree ("verification_status");--> statement-breakpoint
CREATE INDEX "registry_offices_external_idx" ON "registry_offices" USING btree ("external_identifier");