CREATE TYPE "public"."auction_award_event_type" AS ENUM('cancelled', 'reversed', 'annulled', 'disputed', 'suspended', 'reinstated', 'adjudication');--> statement-breakpoint
CREATE TYPE "public"."auction_award_status" AS ENUM('pending_confirmation', 'confirmed', 'payment_pending', 'paid', 'documentation_pending', 'delivery_pending', 'registration_pending', 'completed', 'cancelled', 'reversed', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."auction_bid_record_source" AS ENUM('manual', 'external', 'provider', 'import');--> statement-breakpoint
CREATE TYPE "public"."auction_bid_record_status" AS ENUM('recorded', 'cancelled', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."auction_delivery_status" AS ENUM('pending', 'scheduled', 'in_progress', 'completed', 'cancelled', 'failed', 'not_required');--> statement-breakpoint
CREATE TYPE "public"."auction_delivery_type" AS ENUM('possession', 'physical_delivery', 'pickup', 'key_handover', 'other');--> statement-breakpoint
CREATE TYPE "public"."auction_participation_qualification_status" AS ENUM('not_started', 'pending', 'qualified_manually', 'disqualified', 'not_required');--> statement-breakpoint
CREATE TYPE "public"."auction_participation_registration_status" AS ENUM('not_started', 'pending', 'submitted_manually', 'confirmed_manually', 'rejected', 'not_required');--> statement-breakpoint
CREATE TYPE "public"."auction_participation_status" AS ENUM('interested', 'preparing', 'registered_manually', 'qualified_manually', 'participated', 'no_bid', 'bid_placed_manually', 'result_pending', 'won', 'lost', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."auction_payment_status" AS ENUM('pending', 'partially_paid', 'paid', 'overdue', 'cancelled', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."auction_payment_type" AS ENUM('bid_price', 'auctioneer_commission', 'court_fee', 'tax', 'transfer_fee', 'other');--> statement-breakpoint
CREATE TYPE "public"."auction_possession_status" AS ENUM('not_required', 'pending', 'requested', 'ordered', 'scheduled', 'completed', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."auction_regularization_item_status" AS ENUM('pending', 'in_progress', 'done', 'not_applicable', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."auction_result_source" AS ENUM('manual', 'external', 'provider', 'import', 'not_configured');--> statement-breakpoint
CREATE TYPE "public"."auction_result_status" AS ENUM('pending', 'sold', 'unsold', 'cancelled', 'suspended', 'withdrawn', 'failed', 'other');--> statement-breakpoint
CREATE TYPE "public"."auction_transfer_status" AS ENUM('pending', 'in_progress', 'submitted', 'completed', 'blocked', 'cancelled', 'not_required');--> statement-breakpoint
CREATE TYPE "public"."auction_transfer_type" AS ENUM('real_estate_registration', 'vehicle_transfer', 'asset_transfer', 'corporate_right_transfer', 'other');--> statement-breakpoint
CREATE TYPE "public"."auction_post_verification_status" AS ENUM('unverified', 'source_available', 'verified', 'source_unavailable', 'not_configured');--> statement-breakpoint
CREATE TYPE "public"."legal_comparison_item_review_status" AS ENUM('unreviewed', 'confirmed', 'rejected', 'corrected');--> statement-breakpoint
CREATE TYPE "public"."legal_comparison_item_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."legal_comparison_source_role" AS ENUM('side_a', 'side_b', 'petition', 'defense', 'evidence', 'allegation', 'claim', 'decision', 'judgment', 'appeal', 'administrative_request', 'administrative_decision', 'other');--> statement-breakpoint
CREATE TYPE "public"."legal_comparison_status" AS ENUM('draft', 'processing', 'generated', 'human_review', 'reviewed', 'closed', 'failed', 'not_configured');--> statement-breakpoint
CREATE TYPE "public"."legal_comparison_type" AS ENUM('petition_vs_defense', 'evidence_vs_allegations', 'claim_vs_decision', 'judgment_vs_appeal', 'admin_process_vs_judicial_action');--> statement-breakpoint
CREATE TYPE "public"."legal_document_draft_status" AS ENUM('draft', 'ai_assisted', 'human_review', 'approved', 'ready_to_file', 'filed', 'confirmed', 'rejected', 'cancelled', 'archived', 'failed');--> statement-breakpoint
CREATE TYPE "public"."legal_draft_checklist_item_status" AS ENUM('pending', 'done', 'not_applicable', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."legal_draft_confirmation_method" AS ENUM('manual', 'provider');--> statement-breakpoint
CREATE TYPE "public"."legal_draft_filing_method" AS ENUM('manual', 'electronic', 'provider', 'not_configured');--> statement-breakpoint
CREATE TYPE "public"."legal_draft_source_item_type" AS ENUM('document', 'analysis', 'research', 'citation', 'fact', 'evidence', 'instruction');--> statement-breakpoint
CREATE TYPE "public"."legal_document_template_content_format" AS ENUM('html', 'markdown', 'plain_text', 'structured');--> statement-breakpoint
CREATE TYPE "public"."legal_document_template_scope" AS ENUM('system', 'organization');--> statement-breakpoint
CREATE TYPE "public"."legal_document_template_type" AS ENUM('initial_petition', 'defense', 'reply', 'motion', 'appeal', 'counter_arguments', 'legal_opinion', 'administrative_request', 'contract', 'notice', 'power_of_attorney', 'declaration', 'settlement', 'other');--> statement-breakpoint
CREATE TYPE "public"."legal_document_template_version_status" AS ENUM('draft', 'review', 'approved', 'active', 'deprecated', 'archived');--> statement-breakpoint
CREATE TABLE "auction_award_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"award_id" uuid NOT NULL,
	"event_type" "auction_award_event_type" NOT NULL,
	"reason" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"actor_membership_id" uuid,
	"related_document_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auction_awards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"auction_id" uuid NOT NULL,
	"lot_id" uuid NOT NULL,
	"participation_id" uuid,
	"result_id" uuid,
	"award_status" "auction_award_status" DEFAULT 'pending_confirmation' NOT NULL,
	"winning_bid_cents" bigint DEFAULT 0 NOT NULL,
	"commission_basis_points" integer,
	"commission_base_amount_cents" bigint,
	"calculated_commission_cents" bigint,
	"actual_commission_cents" bigint,
	"commission_cents" bigint,
	"fees_cents" bigint,
	"total_known_cost_cents" bigint DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"awarded_at" timestamp with time zone,
	"verification_status" "auction_post_verification_status" DEFAULT 'unverified' NOT NULL,
	"source" "auction_result_source" DEFAULT 'manual' NOT NULL,
	"commission_source" text,
	"notes" text,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auction_bid_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"participation_id" uuid NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" "auction_bid_record_source" DEFAULT 'manual' NOT NULL,
	"provider_reference" text,
	"status" "auction_bid_record_status" DEFAULT 'recorded' NOT NULL,
	"notes" text,
	"recorded_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auction_delivery_processes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"award_id" uuid NOT NULL,
	"delivery_type" "auction_delivery_type" DEFAULT 'other' NOT NULL,
	"status" "auction_delivery_status" DEFAULT 'pending' NOT NULL,
	"possession_status" "auction_possession_status" DEFAULT 'not_required' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"location" text,
	"responsible_membership_id" uuid,
	"evidence_document_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auction_participations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"auction_id" uuid NOT NULL,
	"lot_id" uuid,
	"participant_membership_id" uuid,
	"status" "auction_participation_status" DEFAULT 'interested' NOT NULL,
	"registration_status" "auction_participation_registration_status" DEFAULT 'not_started' NOT NULL,
	"qualification_status" "auction_participation_qualification_status" DEFAULT 'not_started' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auction_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"award_id" uuid NOT NULL,
	"payment_type" "auction_payment_type" DEFAULT 'bid_price' NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"due_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"status" "auction_payment_status" DEFAULT 'pending' NOT NULL,
	"payment_reference" text,
	"evidence_document_id" uuid,
	"notes" text,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auction_regularization_checklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"award_id" uuid NOT NULL,
	"item_key" text NOT NULL,
	"label" text NOT NULL,
	"category" text,
	"status" "auction_regularization_item_status" DEFAULT 'pending' NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"completed_by_membership_id" uuid,
	"completed_at" timestamp with time zone,
	"evidence_document_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auction_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"auction_id" uuid NOT NULL,
	"lot_id" uuid NOT NULL,
	"status" "auction_result_status" DEFAULT 'pending' NOT NULL,
	"winning_bid_cents" bigint,
	"winner_reference" text,
	"result_date" timestamp with time zone,
	"source" "auction_result_source" DEFAULT 'manual' NOT NULL,
	"source_reference" text,
	"verification_status" "auction_post_verification_status" DEFAULT 'unverified' NOT NULL,
	"notes" text,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auction_transfer_processes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"award_id" uuid NOT NULL,
	"transfer_type" "auction_transfer_type" DEFAULT 'other' NOT NULL,
	"status" "auction_transfer_status" DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"authority" text,
	"protocol" text,
	"evidence_document_id" uuid,
	"notes" text,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_comparison_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"comparison_id" uuid NOT NULL,
	"category" text NOT NULL,
	"source_a" text,
	"source_b" text,
	"finding" text NOT NULL,
	"severity" "legal_comparison_item_severity" DEFAULT 'medium' NOT NULL,
	"confidence" integer,
	"provenance" jsonb,
	"review_status" "legal_comparison_item_review_status" DEFAULT 'unreviewed' NOT NULL,
	"reviewer_comment" text,
	"reviewed_by_membership_id" uuid,
	"reviewed_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_comparison_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"comparison_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"document_version_id" uuid,
	"role_in_comparison" "legal_comparison_source_role" DEFAULT 'other' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_comparisons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid,
	"comparison_type" "legal_comparison_type" NOT NULL,
	"status" "legal_comparison_status" DEFAULT 'draft' NOT NULL,
	"title" text,
	"summary" text,
	"structured_result" jsonb,
	"ai_request_id" uuid,
	"created_by_membership_id" uuid,
	"reviewed_by_membership_id" uuid,
	"review_comment" text,
	"completed_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_document_draft_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"draft_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"content" text,
	"structured_data" jsonb,
	"status" "legal_document_draft_status" DEFAULT 'draft' NOT NULL,
	"change_summary" text,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_document_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid,
	"judicial_process_id" uuid,
	"administrative_process_id" uuid,
	"client_id" uuid,
	"template_id" uuid,
	"template_version_id" uuid,
	"document_type" "legal_document_template_type" DEFAULT 'other' NOT NULL,
	"title" text NOT NULL,
	"status" "legal_document_draft_status" DEFAULT 'draft' NOT NULL,
	"content" text,
	"structured_data" jsonb,
	"ai_request_id" uuid,
	"source_set_id" uuid,
	"current_document_id" uuid,
	"reviewed_by_membership_id" uuid,
	"reviewed_at" timestamp with time zone,
	"review_comment" text,
	"approved_by_membership_id" uuid,
	"approved_at" timestamp with time zone,
	"filed_at" timestamp with time zone,
	"filed_by_membership_id" uuid,
	"filing_method" "legal_draft_filing_method",
	"protocol_number" text,
	"evidence_document_id" uuid,
	"filing_notes" text,
	"confirmation_evidence_document_id" uuid,
	"confirmed_at" timestamp with time zone,
	"confirmed_by_membership_id" uuid,
	"confirmation_method" "legal_draft_confirmation_method",
	"created_by_membership_id" uuid,
	"updated_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_document_workflow_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"draft_id" uuid NOT NULL,
	"from_status" "legal_document_draft_status",
	"to_status" "legal_document_draft_status" NOT NULL,
	"actor_membership_id" uuid,
	"reason" text,
	"evidence_document_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_draft_checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"checklist_id" uuid NOT NULL,
	"item_key" text NOT NULL,
	"label" text NOT NULL,
	"category" text,
	"required" boolean DEFAULT true NOT NULL,
	"status" "legal_draft_checklist_item_status" DEFAULT 'pending' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"completed_by_membership_id" uuid,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_draft_checklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"draft_id" uuid,
	"name" text NOT NULL,
	"is_template" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_draft_source_set_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"source_set_id" uuid NOT NULL,
	"item_type" "legal_draft_source_item_type" NOT NULL,
	"reference_id" uuid,
	"document_id" uuid,
	"document_version_id" uuid,
	"instruction_text" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_draft_source_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"draft_id" uuid,
	"name" text,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_document_template_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"content" text NOT NULL,
	"content_format" "legal_document_template_content_format" DEFAULT 'html' NOT NULL,
	"variable_schema" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"section_schema" jsonb,
	"status" "legal_document_template_version_status" DEFAULT 'draft' NOT NULL,
	"changelog" text,
	"created_by_membership_id" uuid,
	"approved_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"activated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "legal_document_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"scope" "legal_document_template_scope" DEFAULT 'organization' NOT NULL,
	"template_type" "legal_document_template_type" DEFAULT 'other' NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"legal_area_id" uuid,
	"jurisdiction" text,
	"document_kind" "document_kind" DEFAULT 'other' NOT NULL,
	"current_version_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auction_award_events" ADD CONSTRAINT "auction_award_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_award_events" ADD CONSTRAINT "auction_award_events_award_id_auction_awards_id_fk" FOREIGN KEY ("award_id") REFERENCES "public"."auction_awards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_award_events" ADD CONSTRAINT "auction_award_events_actor_membership_id_organization_members_id_fk" FOREIGN KEY ("actor_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_award_events" ADD CONSTRAINT "auction_award_events_related_document_id_documents_id_fk" FOREIGN KEY ("related_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_awards" ADD CONSTRAINT "auction_awards_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_awards" ADD CONSTRAINT "auction_awards_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_awards" ADD CONSTRAINT "auction_awards_lot_id_auction_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."auction_lots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_awards" ADD CONSTRAINT "auction_awards_participation_id_auction_participations_id_fk" FOREIGN KEY ("participation_id") REFERENCES "public"."auction_participations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_awards" ADD CONSTRAINT "auction_awards_result_id_auction_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."auction_results"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_awards" ADD CONSTRAINT "auction_awards_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_bid_records" ADD CONSTRAINT "auction_bid_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_bid_records" ADD CONSTRAINT "auction_bid_records_participation_id_auction_participations_id_fk" FOREIGN KEY ("participation_id") REFERENCES "public"."auction_participations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_bid_records" ADD CONSTRAINT "auction_bid_records_recorded_by_membership_id_organization_members_id_fk" FOREIGN KEY ("recorded_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_delivery_processes" ADD CONSTRAINT "auction_delivery_processes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_delivery_processes" ADD CONSTRAINT "auction_delivery_processes_award_id_auction_awards_id_fk" FOREIGN KEY ("award_id") REFERENCES "public"."auction_awards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_delivery_processes" ADD CONSTRAINT "auction_delivery_processes_responsible_membership_id_organization_members_id_fk" FOREIGN KEY ("responsible_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_delivery_processes" ADD CONSTRAINT "auction_delivery_processes_evidence_document_id_documents_id_fk" FOREIGN KEY ("evidence_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_participations" ADD CONSTRAINT "auction_participations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_participations" ADD CONSTRAINT "auction_participations_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_participations" ADD CONSTRAINT "auction_participations_lot_id_auction_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."auction_lots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_participations" ADD CONSTRAINT "auction_participations_participant_membership_id_organization_members_id_fk" FOREIGN KEY ("participant_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_payments" ADD CONSTRAINT "auction_payments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_payments" ADD CONSTRAINT "auction_payments_award_id_auction_awards_id_fk" FOREIGN KEY ("award_id") REFERENCES "public"."auction_awards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_payments" ADD CONSTRAINT "auction_payments_evidence_document_id_documents_id_fk" FOREIGN KEY ("evidence_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_payments" ADD CONSTRAINT "auction_payments_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_regularization_checklists" ADD CONSTRAINT "auction_regularization_checklists_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_regularization_checklists" ADD CONSTRAINT "auction_regularization_checklists_award_id_auction_awards_id_fk" FOREIGN KEY ("award_id") REFERENCES "public"."auction_awards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_regularization_checklists" ADD CONSTRAINT "auction_regularization_checklists_completed_by_membership_id_organization_members_id_fk" FOREIGN KEY ("completed_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_regularization_checklists" ADD CONSTRAINT "auction_regularization_checklists_evidence_document_id_documents_id_fk" FOREIGN KEY ("evidence_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_results" ADD CONSTRAINT "auction_results_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_results" ADD CONSTRAINT "auction_results_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_results" ADD CONSTRAINT "auction_results_lot_id_auction_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."auction_lots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_results" ADD CONSTRAINT "auction_results_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_transfer_processes" ADD CONSTRAINT "auction_transfer_processes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_transfer_processes" ADD CONSTRAINT "auction_transfer_processes_award_id_auction_awards_id_fk" FOREIGN KEY ("award_id") REFERENCES "public"."auction_awards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_transfer_processes" ADD CONSTRAINT "auction_transfer_processes_evidence_document_id_documents_id_fk" FOREIGN KEY ("evidence_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_transfer_processes" ADD CONSTRAINT "auction_transfer_processes_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_comparison_items" ADD CONSTRAINT "legal_comparison_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_comparison_items" ADD CONSTRAINT "legal_comparison_items_comparison_id_legal_comparisons_id_fk" FOREIGN KEY ("comparison_id") REFERENCES "public"."legal_comparisons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_comparison_items" ADD CONSTRAINT "legal_comparison_items_reviewed_by_membership_id_organization_members_id_fk" FOREIGN KEY ("reviewed_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_comparison_sources" ADD CONSTRAINT "legal_comparison_sources_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_comparison_sources" ADD CONSTRAINT "legal_comparison_sources_comparison_id_legal_comparisons_id_fk" FOREIGN KEY ("comparison_id") REFERENCES "public"."legal_comparisons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_comparison_sources" ADD CONSTRAINT "legal_comparison_sources_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_comparison_sources" ADD CONSTRAINT "legal_comparison_sources_document_version_id_document_versions_id_fk" FOREIGN KEY ("document_version_id") REFERENCES "public"."document_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_comparisons" ADD CONSTRAINT "legal_comparisons_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_comparisons" ADD CONSTRAINT "legal_comparisons_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_comparisons" ADD CONSTRAINT "legal_comparisons_ai_request_id_ai_requests_id_fk" FOREIGN KEY ("ai_request_id") REFERENCES "public"."ai_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_comparisons" ADD CONSTRAINT "legal_comparisons_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_comparisons" ADD CONSTRAINT "legal_comparisons_reviewed_by_membership_id_organization_members_id_fk" FOREIGN KEY ("reviewed_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_document_draft_versions" ADD CONSTRAINT "legal_document_draft_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_document_draft_versions" ADD CONSTRAINT "legal_document_draft_versions_draft_id_legal_document_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."legal_document_drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_document_draft_versions" ADD CONSTRAINT "legal_document_draft_versions_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_document_drafts" ADD CONSTRAINT "legal_document_drafts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_document_drafts" ADD CONSTRAINT "legal_document_drafts_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_document_drafts" ADD CONSTRAINT "legal_document_drafts_judicial_process_id_judicial_processes_id_fk" FOREIGN KEY ("judicial_process_id") REFERENCES "public"."judicial_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_document_drafts" ADD CONSTRAINT "legal_document_drafts_administrative_process_id_administrative_processes_id_fk" FOREIGN KEY ("administrative_process_id") REFERENCES "public"."administrative_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_document_drafts" ADD CONSTRAINT "legal_document_drafts_client_id_crm_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."crm_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_document_drafts" ADD CONSTRAINT "legal_document_drafts_template_id_legal_document_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."legal_document_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_document_drafts" ADD CONSTRAINT "legal_document_drafts_template_version_id_legal_document_template_versions_id_fk" FOREIGN KEY ("template_version_id") REFERENCES "public"."legal_document_template_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_document_drafts" ADD CONSTRAINT "legal_document_drafts_ai_request_id_ai_requests_id_fk" FOREIGN KEY ("ai_request_id") REFERENCES "public"."ai_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_document_drafts" ADD CONSTRAINT "legal_document_drafts_current_document_id_documents_id_fk" FOREIGN KEY ("current_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_document_drafts" ADD CONSTRAINT "legal_document_drafts_reviewed_by_membership_id_organization_members_id_fk" FOREIGN KEY ("reviewed_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_document_drafts" ADD CONSTRAINT "legal_document_drafts_approved_by_membership_id_organization_members_id_fk" FOREIGN KEY ("approved_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_document_drafts" ADD CONSTRAINT "legal_document_drafts_filed_by_membership_id_organization_members_id_fk" FOREIGN KEY ("filed_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_document_drafts" ADD CONSTRAINT "legal_document_drafts_evidence_document_id_documents_id_fk" FOREIGN KEY ("evidence_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_document_drafts" ADD CONSTRAINT "legal_document_drafts_confirmation_evidence_document_id_documents_id_fk" FOREIGN KEY ("confirmation_evidence_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_document_drafts" ADD CONSTRAINT "legal_document_drafts_confirmed_by_membership_id_organization_members_id_fk" FOREIGN KEY ("confirmed_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_document_drafts" ADD CONSTRAINT "legal_document_drafts_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_document_drafts" ADD CONSTRAINT "legal_document_drafts_updated_by_membership_id_organization_members_id_fk" FOREIGN KEY ("updated_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_document_workflow_history" ADD CONSTRAINT "legal_document_workflow_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_document_workflow_history" ADD CONSTRAINT "legal_document_workflow_history_draft_id_legal_document_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."legal_document_drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_document_workflow_history" ADD CONSTRAINT "legal_document_workflow_history_actor_membership_id_organization_members_id_fk" FOREIGN KEY ("actor_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_document_workflow_history" ADD CONSTRAINT "legal_document_workflow_history_evidence_document_id_documents_id_fk" FOREIGN KEY ("evidence_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_draft_checklist_items" ADD CONSTRAINT "legal_draft_checklist_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_draft_checklist_items" ADD CONSTRAINT "legal_draft_checklist_items_checklist_id_legal_draft_checklists_id_fk" FOREIGN KEY ("checklist_id") REFERENCES "public"."legal_draft_checklists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_draft_checklist_items" ADD CONSTRAINT "legal_draft_checklist_items_completed_by_membership_id_organization_members_id_fk" FOREIGN KEY ("completed_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_draft_checklists" ADD CONSTRAINT "legal_draft_checklists_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_draft_checklists" ADD CONSTRAINT "legal_draft_checklists_draft_id_legal_document_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."legal_document_drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_draft_checklists" ADD CONSTRAINT "legal_draft_checklists_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_draft_source_set_items" ADD CONSTRAINT "legal_draft_source_set_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_draft_source_set_items" ADD CONSTRAINT "legal_draft_source_set_items_source_set_id_legal_draft_source_sets_id_fk" FOREIGN KEY ("source_set_id") REFERENCES "public"."legal_draft_source_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_draft_source_set_items" ADD CONSTRAINT "legal_draft_source_set_items_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_draft_source_set_items" ADD CONSTRAINT "legal_draft_source_set_items_document_version_id_document_versions_id_fk" FOREIGN KEY ("document_version_id") REFERENCES "public"."document_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_draft_source_sets" ADD CONSTRAINT "legal_draft_source_sets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_draft_source_sets" ADD CONSTRAINT "legal_draft_source_sets_draft_id_legal_document_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."legal_document_drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_draft_source_sets" ADD CONSTRAINT "legal_draft_source_sets_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_document_template_versions" ADD CONSTRAINT "legal_document_template_versions_template_id_legal_document_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."legal_document_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_document_template_versions" ADD CONSTRAINT "legal_document_template_versions_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_document_template_versions" ADD CONSTRAINT "legal_document_template_versions_approved_by_membership_id_organization_members_id_fk" FOREIGN KEY ("approved_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_document_templates" ADD CONSTRAINT "legal_document_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_document_templates" ADD CONSTRAINT "legal_document_templates_legal_area_id_legal_areas_id_fk" FOREIGN KEY ("legal_area_id") REFERENCES "public"."legal_areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_document_templates" ADD CONSTRAINT "legal_document_templates_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auction_award_events_award_idx" ON "auction_award_events" USING btree ("award_id");--> statement-breakpoint
CREATE INDEX "auction_award_events_org_idx" ON "auction_award_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "auction_award_events_type_idx" ON "auction_award_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "auction_awards_org_idx" ON "auction_awards" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "auction_awards_auction_idx" ON "auction_awards" USING btree ("auction_id");--> statement-breakpoint
CREATE INDEX "auction_awards_lot_idx" ON "auction_awards" USING btree ("lot_id");--> statement-breakpoint
CREATE INDEX "auction_awards_status_idx" ON "auction_awards" USING btree ("organization_id","award_status");--> statement-breakpoint
CREATE INDEX "auction_awards_participation_idx" ON "auction_awards" USING btree ("participation_id");--> statement-breakpoint
CREATE INDEX "auction_bid_records_participation_idx" ON "auction_bid_records" USING btree ("participation_id");--> statement-breakpoint
CREATE INDEX "auction_bid_records_org_idx" ON "auction_bid_records" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "auction_delivery_processes_award_idx" ON "auction_delivery_processes" USING btree ("award_id");--> statement-breakpoint
CREATE INDEX "auction_delivery_processes_org_idx" ON "auction_delivery_processes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "auction_delivery_processes_status_idx" ON "auction_delivery_processes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "auction_participations_org_idx" ON "auction_participations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "auction_participations_auction_idx" ON "auction_participations" USING btree ("auction_id");--> statement-breakpoint
CREATE INDEX "auction_participations_lot_idx" ON "auction_participations" USING btree ("lot_id");--> statement-breakpoint
CREATE INDEX "auction_participations_status_idx" ON "auction_participations" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "auction_payments_award_idx" ON "auction_payments" USING btree ("award_id");--> statement-breakpoint
CREATE INDEX "auction_payments_org_idx" ON "auction_payments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "auction_payments_status_idx" ON "auction_payments" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "auction_regularization_checklists_award_key_unique" ON "auction_regularization_checklists" USING btree ("award_id","item_key");--> statement-breakpoint
CREATE INDEX "auction_regularization_checklists_award_idx" ON "auction_regularization_checklists" USING btree ("award_id");--> statement-breakpoint
CREATE INDEX "auction_regularization_checklists_org_idx" ON "auction_regularization_checklists" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auction_results_lot_unique" ON "auction_results" USING btree ("lot_id");--> statement-breakpoint
CREATE INDEX "auction_results_auction_idx" ON "auction_results" USING btree ("auction_id");--> statement-breakpoint
CREATE INDEX "auction_results_org_idx" ON "auction_results" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "auction_results_status_idx" ON "auction_results" USING btree ("status");--> statement-breakpoint
CREATE INDEX "auction_transfer_processes_award_idx" ON "auction_transfer_processes" USING btree ("award_id");--> statement-breakpoint
CREATE INDEX "auction_transfer_processes_org_idx" ON "auction_transfer_processes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "auction_transfer_processes_status_idx" ON "auction_transfer_processes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "legal_comparison_items_comparison_idx" ON "legal_comparison_items" USING btree ("comparison_id");--> statement-breakpoint
CREATE INDEX "legal_comparison_items_org_idx" ON "legal_comparison_items" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "legal_comparison_items_review_idx" ON "legal_comparison_items" USING btree ("review_status");--> statement-breakpoint
CREATE INDEX "legal_comparison_sources_comparison_idx" ON "legal_comparison_sources" USING btree ("comparison_id");--> statement-breakpoint
CREATE INDEX "legal_comparison_sources_org_idx" ON "legal_comparison_sources" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "legal_comparison_sources_document_idx" ON "legal_comparison_sources" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "legal_comparisons_org_idx" ON "legal_comparisons" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "legal_comparisons_matter_idx" ON "legal_comparisons" USING btree ("legal_matter_id");--> statement-breakpoint
CREATE INDEX "legal_comparisons_type_idx" ON "legal_comparisons" USING btree ("comparison_type");--> statement-breakpoint
CREATE INDEX "legal_comparisons_status_idx" ON "legal_comparisons" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_document_draft_versions_draft_version_unique" ON "legal_document_draft_versions" USING btree ("draft_id","version");--> statement-breakpoint
CREATE INDEX "legal_document_draft_versions_draft_idx" ON "legal_document_draft_versions" USING btree ("draft_id");--> statement-breakpoint
CREATE INDEX "legal_document_draft_versions_org_idx" ON "legal_document_draft_versions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "legal_document_drafts_org_idx" ON "legal_document_drafts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "legal_document_drafts_matter_idx" ON "legal_document_drafts" USING btree ("legal_matter_id");--> statement-breakpoint
CREATE INDEX "legal_document_drafts_status_idx" ON "legal_document_drafts" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "legal_document_drafts_template_idx" ON "legal_document_drafts" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "legal_document_drafts_judicial_idx" ON "legal_document_drafts" USING btree ("judicial_process_id");--> statement-breakpoint
CREATE INDEX "legal_document_drafts_admin_idx" ON "legal_document_drafts" USING btree ("administrative_process_id");--> statement-breakpoint
CREATE INDEX "legal_document_workflow_history_draft_idx" ON "legal_document_workflow_history" USING btree ("draft_id");--> statement-breakpoint
CREATE INDEX "legal_document_workflow_history_org_idx" ON "legal_document_workflow_history" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "legal_document_workflow_history_created_idx" ON "legal_document_workflow_history" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_draft_checklist_items_checklist_key_unique" ON "legal_draft_checklist_items" USING btree ("checklist_id","item_key");--> statement-breakpoint
CREATE INDEX "legal_draft_checklist_items_checklist_idx" ON "legal_draft_checklist_items" USING btree ("checklist_id");--> statement-breakpoint
CREATE INDEX "legal_draft_checklist_items_org_idx" ON "legal_draft_checklist_items" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "legal_draft_checklists_org_idx" ON "legal_draft_checklists" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "legal_draft_checklists_draft_idx" ON "legal_draft_checklists" USING btree ("draft_id");--> statement-breakpoint
CREATE INDEX "legal_draft_checklists_template_idx" ON "legal_draft_checklists" USING btree ("organization_id","is_template");--> statement-breakpoint
CREATE INDEX "legal_draft_source_set_items_set_idx" ON "legal_draft_source_set_items" USING btree ("source_set_id");--> statement-breakpoint
CREATE INDEX "legal_draft_source_set_items_org_idx" ON "legal_draft_source_set_items" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "legal_draft_source_set_items_type_idx" ON "legal_draft_source_set_items" USING btree ("item_type");--> statement-breakpoint
CREATE INDEX "legal_draft_source_sets_org_idx" ON "legal_draft_source_sets" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "legal_draft_source_sets_draft_idx" ON "legal_draft_source_sets" USING btree ("draft_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_document_template_versions_template_version_unique" ON "legal_document_template_versions" USING btree ("template_id","version");--> statement-breakpoint
CREATE INDEX "legal_document_template_versions_template_idx" ON "legal_document_template_versions" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "legal_document_template_versions_status_idx" ON "legal_document_template_versions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "legal_document_templates_org_idx" ON "legal_document_templates" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "legal_document_templates_scope_idx" ON "legal_document_templates" USING btree ("scope");--> statement-breakpoint
CREATE INDEX "legal_document_templates_type_idx" ON "legal_document_templates" USING btree ("template_type");--> statement-breakpoint
CREATE INDEX "legal_document_templates_active_idx" ON "legal_document_templates" USING btree ("active");--> statement-breakpoint
CREATE INDEX "legal_document_templates_area_idx" ON "legal_document_templates" USING btree ("legal_area_id");