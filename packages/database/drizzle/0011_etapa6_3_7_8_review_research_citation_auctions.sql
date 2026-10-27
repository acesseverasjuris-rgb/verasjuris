CREATE TYPE "public"."auction_asset_type" AS ENUM('real_estate', 'vehicle', 'machinery', 'equipment', 'vessel', 'aircraft', 'business_asset', 'right', 'shares', 'movable_goods', 'scrap', 'material', 'other');--> statement-breakpoint
CREATE TYPE "public"."auction_due_diligence_item_status" AS ENUM('pending', 'in_progress', 'done', 'not_applicable', 'blocked', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."auction_event_status" AS ENUM('scheduled', 'open', 'closed', 'cancelled', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."auction_event_type" AS ENUM('first_session', 'second_session', 'session', 'closing', 'direct_sale', 'other');--> statement-breakpoint
CREATE TYPE "public"."auction_interest_status" AS ENUM('saved', 'watching', 'reviewing', 'visit_planned', 'intends_to_bid', 'participated', 'won', 'lost', 'archived');--> statement-breakpoint
CREATE TYPE "public"."auction_lot_status" AS ENUM('draft', 'open', 'sold', 'unsold', 'cancelled', 'archived', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."auction_occupancy_status" AS ENUM('unknown', 'vacant', 'occupied', 'possession_disputed', 'other');--> statement-breakpoint
CREATE TYPE "public"."auction_source" AS ENUM('manual', 'public_provider', 'import', 'not_configured');--> statement-breakpoint
CREATE TYPE "public"."auction_status" AS ENUM('draft', 'published', 'open', 'closed', 'cancelled', 'archived', 'not_configured');--> statement-breakpoint
CREATE TYPE "public"."auction_sync_status" AS ENUM('pending', 'running', 'succeeded', 'failed', 'not_configured');--> statement-breakpoint
CREATE TYPE "public"."auction_type" AS ENUM('judicial', 'extrajudicial', 'administrative', 'public_asset', 'seized_asset', 'tax', 'bank', 'insolvency', 'bankruptcy', 'other');--> statement-breakpoint
CREATE TYPE "public"."auctioneer_verification_status" AS ENUM('unverified', 'source_available', 'verified', 'source_unavailable', 'not_configured');--> statement-breakpoint
CREATE TYPE "public"."citation_source_type" AS ENUM('legislation', 'case_law', 'summary', 'theme', 'precedent', 'doctrine', 'internal_document');--> statement-breakpoint
CREATE TYPE "public"."citation_verification_status" AS ENUM('unverified', 'source_available', 'verified', 'source_unavailable', 'invalid', 'stale');--> statement-breakpoint
CREATE TYPE "public"."case_law_record_status" AS ENUM('draft', 'available', 'verified', 'unavailable', 'stale', 'not_configured');--> statement-breakpoint
CREATE TYPE "public"."legal_precedent_binding" AS ENUM('binding', 'persuasive', 'non_binding', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."legal_research_query_status" AS ENUM('pending', 'running', 'succeeded', 'failed', 'empty', 'not_configured');--> statement-breakpoint
CREATE TYPE "public"."legal_research_result_source_type" AS ENUM('legislation', 'case_law', 'summary', 'theme', 'general_repercussion', 'precedent', 'doctrine', 'internal_document');--> statement-breakpoint
CREATE TYPE "public"."legal_source_provider" AS ENUM('manual', 'official_provider', 'import', 'not_configured');--> statement-breakpoint
CREATE TYPE "public"."legal_source_type" AS ENUM('legislation', 'constitution', 'decree', 'resolution', 'instruction', 'ordinance', 'regulation', 'other');--> statement-breakpoint
CREATE TYPE "public"."legal_summary_binding" AS ENUM('binding', 'non_binding', 'cancelled', 'superseded', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."legal_theme_status" AS ENUM('pending', 'judged', 'affected', 'cancelled', 'superseded', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."legal_ai_review_status" AS ENUM('draft', 'processing', 'generated', 'human_review', 'reviewed', 'closed', 'failed', 'not_configured');--> statement-breakpoint
CREATE TYPE "public"."legal_ai_review_type" AS ENUM('formal_review', 'content_review', 'cross_document_review', 'procedural_risk_review', 'claims_review', 'evidence_review', 'contract_review', 'decision_response_review', 'administrative_review');--> statement-breakpoint
CREATE TYPE "public"."legal_review_document_role" AS ENUM('initial_petition', 'defense', 'reply', 'expert_report', 'medical_report', 'decision', 'appeal', 'contract', 'evidence', 'administrative_request', 'administrative_decision', 'other');--> statement-breakpoint
CREATE TYPE "public"."legal_review_item_status" AS ENUM('unreviewed', 'confirmed', 'rejected', 'corrected');--> statement-breakpoint
CREATE TYPE "public"."legal_review_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TABLE "auction_alert_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"auction_types" jsonb,
	"asset_types" jsonb,
	"state_codes" jsonb,
	"municipalities" jsonb,
	"min_value_cents" bigint,
	"max_value_cents" bigint,
	"occupancy_statuses" jsonb,
	"filters" jsonb,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auction_bid_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auction_id" uuid,
	"lot_id" uuid,
	"minimum_bid_cents" bigint,
	"increment_cents" bigint,
	"payment_terms" text,
	"commission_basis_points" integer,
	"deposit_required" boolean DEFAULT false NOT NULL,
	"deposit_required_cents" bigint,
	"registration_required" boolean DEFAULT false NOT NULL,
	"eligibility_description" text,
	"notes" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auction_due_diligence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"auction_id" uuid NOT NULL,
	"lot_id" uuid,
	"item_key" text NOT NULL,
	"label" text NOT NULL,
	"category" text,
	"status" "auction_due_diligence_item_status" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"reviewed_by_membership_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auction_encumbrances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lot_id" uuid NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"source" text,
	"responsibility" text,
	"status" text DEFAULT 'informed' NOT NULL,
	"amount_cents" bigint,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auction_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auction_id" uuid NOT NULL,
	"event_type" "auction_event_type" DEFAULT 'session' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"minimum_rule" text,
	"status" "auction_event_status" DEFAULT 'scheduled' NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auction_interests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"auction_id" uuid NOT NULL,
	"lot_id" uuid,
	"status" "auction_interest_status" DEFAULT 'saved' NOT NULL,
	"notes" text,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auction_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auction_id" uuid NOT NULL,
	"lot_number" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"asset_type" "auction_asset_type" DEFAULT 'other' NOT NULL,
	"status" "auction_lot_status" DEFAULT 'draft' NOT NULL,
	"appraisal_value_cents" bigint,
	"first_minimum_bid_cents" bigint,
	"second_minimum_bid_cents" bigint,
	"current_reference_value_cents" bigint,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"increment_cents" bigint,
	"commission_basis_points" integer,
	"buyer_fee_cents" bigint,
	"deposit_required_cents" bigint,
	"location" text,
	"state_code" text,
	"municipality" text,
	"latitude" text,
	"longitude" text,
	"occupancy_status" "auction_occupancy_status" DEFAULT 'unknown' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auction_real_estate_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lot_id" uuid NOT NULL,
	"property_type" text,
	"registry_number" text,
	"registry_office" text,
	"area" text,
	"built_area" text,
	"occupancy_status" "auction_occupancy_status" DEFAULT 'unknown' NOT NULL,
	"possession_status" text,
	"address" text,
	"property_tax_reference" text,
	"condominium_info" text,
	"liens_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auction_sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"provider" text DEFAULT 'not_configured' NOT NULL,
	"status" "auction_sync_status" DEFAULT 'not_configured' NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"records_fetched" integer DEFAULT 0 NOT NULL,
	"records_upserted" integer DEFAULT 0 NOT NULL,
	"last_error_code" text,
	"last_error_safe_message" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auction_vehicle_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lot_id" uuid NOT NULL,
	"make" text,
	"model" text,
	"year" integer,
	"model_year" integer,
	"plate_masked" text,
	"renavam_masked" text,
	"mileage" integer,
	"condition" text,
	"documentation_status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auctioneers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"registration_number" text,
	"state_code" text,
	"entity_name" text,
	"website" text,
	"verification_status" "auctioneer_verification_status" DEFAULT 'unverified' NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auctions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"source_provider" "auction_source" DEFAULT 'manual' NOT NULL,
	"source_reference" text,
	"source_url" text,
	"auction_type" "auction_type" DEFAULT 'other' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"seller_type" text,
	"seller_name" text,
	"public_body_id" uuid,
	"court_id" uuid,
	"judicial_process_id" uuid,
	"auctioneer_id" uuid,
	"status" "auction_status" DEFAULT 'draft' NOT NULL,
	"timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"publication_date" timestamp with time zone,
	"registration_deadline" timestamp with time zone,
	"inspection_start_at" timestamp with time zone,
	"inspection_end_at" timestamp with time zone,
	"first_event_at" timestamp with time zone,
	"second_event_at" timestamp with time zone,
	"closing_at" timestamp with time zone,
	"source_updated_at" timestamp with time zone,
	"metadata" jsonb,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_citations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"source_type" "citation_source_type" NOT NULL,
	"source_id" uuid NOT NULL,
	"citation_style" text DEFAULT 'default' NOT NULL,
	"formatted_citation" text NOT NULL,
	"court" text,
	"case_number" text,
	"rapporteur" text,
	"judging_body" text,
	"judgment_date" timestamp with time zone,
	"publication_date" timestamp with time zone,
	"source_url" text,
	"excerpt" text,
	"excerpt_location" text,
	"excerpt_start" integer,
	"excerpt_end" integer,
	"page_number" integer,
	"source_hash" text,
	"verified_at" timestamp with time zone,
	"verification_status" "citation_verification_status" DEFAULT 'unverified' NOT NULL,
	"created_by_membership_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"citation_id" uuid,
	"source_type" "citation_source_type" NOT NULL,
	"source_id" uuid NOT NULL,
	"verification_status" "citation_verification_status" DEFAULT 'unverified' NOT NULL,
	"source_url" text,
	"source_hash" text,
	"provider" text,
	"notes" text,
	"verified_at" timestamp with time zone,
	"verified_by_membership_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_law_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"provider" "legal_source_provider" DEFAULT 'manual' NOT NULL,
	"court" text NOT NULL,
	"court_unit" text,
	"case_number" text NOT NULL,
	"case_number_normalized" text,
	"rapporteur" text,
	"judging_body" text,
	"judgment_date" timestamp with time zone,
	"publication_date" timestamp with time zone,
	"procedural_class" text,
	"subject" text,
	"headnote" text,
	"full_text_reference" text,
	"source_url" text,
	"source_hash" text,
	"source_updated_at" timestamp with time zone,
	"status" "case_law_record_status" DEFAULT 'draft' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doctrine_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"title" text NOT NULL,
	"author" text,
	"publisher" text,
	"edition" text,
	"year" integer,
	"identifier" text,
	"isbn" text,
	"licensed" boolean DEFAULT false NOT NULL,
	"license_reference" text,
	"source" text,
	"source_url" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "general_repercussion_themes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"theme_number" text NOT NULL,
	"title" text NOT NULL,
	"controversy" text,
	"thesis" text,
	"status" "legal_theme_status" DEFAULT 'unknown' NOT NULL,
	"leading_case_number" text,
	"judgment_date" timestamp with time zone,
	"source_url" text,
	"source_updated_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_matter_research_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid NOT NULL,
	"source_type" "legal_research_result_source_type" NOT NULL,
	"source_id" uuid NOT NULL,
	"saved_research_id" uuid,
	"notes" text,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_precedents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"title" text NOT NULL,
	"jurisdiction" text,
	"hierarchy" text,
	"binding_status" "legal_precedent_binding" DEFAULT 'unknown' NOT NULL,
	"applicability_notes" text,
	"case_law_record_id" uuid,
	"legal_summary_id" uuid,
	"repetitive_theme_id" uuid,
	"general_repercussion_theme_id" uuid,
	"decision_reference" text,
	"source_url" text,
	"source_updated_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_research_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"membership_id" uuid,
	"query" text NOT NULL,
	"filters" jsonb,
	"status" "legal_research_query_status" DEFAULT 'pending' NOT NULL,
	"provider" "legal_source_provider" DEFAULT 'not_configured' NOT NULL,
	"result_count" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_research_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"query_id" uuid NOT NULL,
	"source_type" "legal_research_result_source_type" NOT NULL,
	"source_id" uuid NOT NULL,
	"rank" integer DEFAULT 0 NOT NULL,
	"relevance" integer,
	"provider" "legal_source_provider" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"source_provider" "legal_source_provider" DEFAULT 'manual' NOT NULL,
	"source_type" "legal_source_type" DEFAULT 'legislation' NOT NULL,
	"jurisdiction" text,
	"authority" text,
	"identifier" text,
	"title" text NOT NULL,
	"publication_date" timestamp with time zone,
	"effective_date" timestamp with time zone,
	"repealed_at" timestamp with time zone,
	"source_url" text,
	"source_updated_at" timestamp with time zone,
	"content_hash" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"court" text NOT NULL,
	"number" text NOT NULL,
	"text" text NOT NULL,
	"approval_date" timestamp with time zone,
	"binding" "legal_summary_binding" DEFAULT 'unknown' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"source_url" text,
	"source_updated_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repetitive_themes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"court" text NOT NULL,
	"theme_number" text NOT NULL,
	"title" text NOT NULL,
	"controversy" text,
	"thesis" text,
	"status" "legal_theme_status" DEFAULT 'unknown' NOT NULL,
	"affected_cases_info" text,
	"judgment_date" timestamp with time zone,
	"source_url" text,
	"source_updated_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_researches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"query_id" uuid,
	"legal_matter_id" uuid,
	"name" text NOT NULL,
	"query" text NOT NULL,
	"filters" jsonb,
	"selected_result_ids" jsonb,
	"notes" text,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_ai_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid,
	"judicial_process_id" uuid,
	"administrative_process_id" uuid,
	"primary_document_id" uuid,
	"review_set_id" uuid,
	"ai_request_id" uuid,
	"review_type" "legal_ai_review_type" DEFAULT 'content_review' NOT NULL,
	"status" "legal_ai_review_status" DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"summary" text,
	"structured_result" jsonb,
	"created_by_membership_id" uuid,
	"reviewed_by_membership_id" uuid,
	"review_comment" text,
	"completed_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_review_contradictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"review_id" uuid NOT NULL,
	"statement_a" text NOT NULL,
	"source_a" text,
	"page_a" integer,
	"document_a_id" uuid,
	"statement_b" text NOT NULL,
	"source_b" text,
	"page_b" integer,
	"document_b_id" uuid,
	"explanation" text,
	"severity" "legal_review_severity" DEFAULT 'medium' NOT NULL,
	"confidence" integer,
	"review_status" "legal_review_item_status" DEFAULT 'unreviewed' NOT NULL,
	"corrected_text" text,
	"review_comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_review_formal_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"review_id" uuid NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"document_id" uuid,
	"document_version_id" uuid,
	"page_number" integer,
	"excerpt_reference" text,
	"source_label" text,
	"severity" "legal_review_severity" DEFAULT 'medium' NOT NULL,
	"confidence" integer,
	"review_status" "legal_review_item_status" DEFAULT 'unreviewed' NOT NULL,
	"corrected_text" text,
	"review_comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_review_inconsistencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"review_id" uuid NOT NULL,
	"point" text NOT NULL,
	"document_a_id" uuid,
	"document_a_label" text,
	"document_b_id" uuid,
	"document_b_label" text,
	"divergence" text NOT NULL,
	"source_label" text,
	"potential_impact" text,
	"severity" "legal_review_severity" DEFAULT 'medium' NOT NULL,
	"confidence" integer,
	"review_status" "legal_review_item_status" DEFAULT 'unreviewed' NOT NULL,
	"review_comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_review_missing_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"review_id" uuid NOT NULL,
	"expected_document_type" text NOT NULL,
	"reason_expected" text NOT NULL,
	"related_claim" text,
	"related_fact" text,
	"source_label" text,
	"severity" "legal_review_severity" DEFAULT 'medium' NOT NULL,
	"confidence" integer,
	"review_status" "legal_review_item_status" DEFAULT 'unreviewed' NOT NULL,
	"review_comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_review_risks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"review_id" uuid NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"source_label" text,
	"related_documents" jsonb,
	"severity" "legal_review_severity" DEFAULT 'medium' NOT NULL,
	"confidence" integer,
	"recommendation" text,
	"requires_human_review" boolean DEFAULT true NOT NULL,
	"review_status" "legal_review_item_status" DEFAULT 'unreviewed' NOT NULL,
	"review_comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_review_set_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"review_set_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"document_version_id" uuid,
	"role_in_review" "legal_review_document_role" DEFAULT 'other' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_review_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_matter_id" uuid,
	"name" text NOT NULL,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_review_unaddressed_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"review_id" uuid NOT NULL,
	"claim" text NOT NULL,
	"source_document_id" uuid,
	"source_page" integer,
	"expected_response_context" text,
	"response_located" boolean DEFAULT false NOT NULL,
	"response_document_id" uuid,
	"response_page" integer,
	"notes" text,
	"confidence" integer,
	"review_status" "legal_review_item_status" DEFAULT 'unreviewed' NOT NULL,
	"review_comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_review_unanswered_grounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"review_id" uuid NOT NULL,
	"ground" text NOT NULL,
	"source_label" text,
	"source_document_id" uuid,
	"opposing_document_id" uuid,
	"response_located" boolean DEFAULT false NOT NULL,
	"response_reference" text,
	"impact" text,
	"confidence" integer,
	"review_status" "legal_review_item_status" DEFAULT 'unreviewed' NOT NULL,
	"review_comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auction_alert_rules" ADD CONSTRAINT "auction_alert_rules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_alert_rules" ADD CONSTRAINT "auction_alert_rules_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_bid_rules" ADD CONSTRAINT "auction_bid_rules_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_bid_rules" ADD CONSTRAINT "auction_bid_rules_lot_id_auction_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."auction_lots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_due_diligence" ADD CONSTRAINT "auction_due_diligence_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_due_diligence" ADD CONSTRAINT "auction_due_diligence_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_due_diligence" ADD CONSTRAINT "auction_due_diligence_lot_id_auction_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."auction_lots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_due_diligence" ADD CONSTRAINT "auction_due_diligence_reviewed_by_membership_id_organization_members_id_fk" FOREIGN KEY ("reviewed_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_encumbrances" ADD CONSTRAINT "auction_encumbrances_lot_id_auction_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."auction_lots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_events" ADD CONSTRAINT "auction_events_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_interests" ADD CONSTRAINT "auction_interests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_interests" ADD CONSTRAINT "auction_interests_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_interests" ADD CONSTRAINT "auction_interests_lot_id_auction_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."auction_lots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_interests" ADD CONSTRAINT "auction_interests_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_lots" ADD CONSTRAINT "auction_lots_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_real_estate_details" ADD CONSTRAINT "auction_real_estate_details_lot_id_auction_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."auction_lots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_sync_runs" ADD CONSTRAINT "auction_sync_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_vehicle_details" ADD CONSTRAINT "auction_vehicle_details_lot_id_auction_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."auction_lots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_public_body_id_administrative_bodies_id_fk" FOREIGN KEY ("public_body_id") REFERENCES "public"."administrative_bodies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_court_id_courts_id_fk" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_judicial_process_id_judicial_processes_id_fk" FOREIGN KEY ("judicial_process_id") REFERENCES "public"."judicial_processes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_auctioneer_id_auctioneers_id_fk" FOREIGN KEY ("auctioneer_id") REFERENCES "public"."auctioneers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_citations" ADD CONSTRAINT "legal_citations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_citations" ADD CONSTRAINT "legal_citations_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_verifications" ADD CONSTRAINT "source_verifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_verifications" ADD CONSTRAINT "source_verifications_citation_id_legal_citations_id_fk" FOREIGN KEY ("citation_id") REFERENCES "public"."legal_citations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_verifications" ADD CONSTRAINT "source_verifications_verified_by_membership_id_organization_members_id_fk" FOREIGN KEY ("verified_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_law_records" ADD CONSTRAINT "case_law_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctrine_sources" ADD CONSTRAINT "doctrine_sources_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "general_repercussion_themes" ADD CONSTRAINT "general_repercussion_themes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_matter_research_links" ADD CONSTRAINT "legal_matter_research_links_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_matter_research_links" ADD CONSTRAINT "legal_matter_research_links_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_matter_research_links" ADD CONSTRAINT "legal_matter_research_links_saved_research_id_saved_researches_id_fk" FOREIGN KEY ("saved_research_id") REFERENCES "public"."saved_researches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_matter_research_links" ADD CONSTRAINT "legal_matter_research_links_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_precedents" ADD CONSTRAINT "legal_precedents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_precedents" ADD CONSTRAINT "legal_precedents_case_law_record_id_case_law_records_id_fk" FOREIGN KEY ("case_law_record_id") REFERENCES "public"."case_law_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_precedents" ADD CONSTRAINT "legal_precedents_legal_summary_id_legal_summaries_id_fk" FOREIGN KEY ("legal_summary_id") REFERENCES "public"."legal_summaries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_precedents" ADD CONSTRAINT "legal_precedents_repetitive_theme_id_repetitive_themes_id_fk" FOREIGN KEY ("repetitive_theme_id") REFERENCES "public"."repetitive_themes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_precedents" ADD CONSTRAINT "legal_precedents_general_repercussion_theme_id_general_repercussion_themes_id_fk" FOREIGN KEY ("general_repercussion_theme_id") REFERENCES "public"."general_repercussion_themes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_research_queries" ADD CONSTRAINT "legal_research_queries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_research_queries" ADD CONSTRAINT "legal_research_queries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_research_queries" ADD CONSTRAINT "legal_research_queries_membership_id_organization_members_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_research_results" ADD CONSTRAINT "legal_research_results_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_research_results" ADD CONSTRAINT "legal_research_results_query_id_legal_research_queries_id_fk" FOREIGN KEY ("query_id") REFERENCES "public"."legal_research_queries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_sources" ADD CONSTRAINT "legal_sources_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_summaries" ADD CONSTRAINT "legal_summaries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repetitive_themes" ADD CONSTRAINT "repetitive_themes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_researches" ADD CONSTRAINT "saved_researches_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_researches" ADD CONSTRAINT "saved_researches_query_id_legal_research_queries_id_fk" FOREIGN KEY ("query_id") REFERENCES "public"."legal_research_queries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_researches" ADD CONSTRAINT "saved_researches_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_researches" ADD CONSTRAINT "saved_researches_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_ai_reviews" ADD CONSTRAINT "legal_ai_reviews_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_ai_reviews" ADD CONSTRAINT "legal_ai_reviews_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_ai_reviews" ADD CONSTRAINT "legal_ai_reviews_judicial_process_id_judicial_processes_id_fk" FOREIGN KEY ("judicial_process_id") REFERENCES "public"."judicial_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_ai_reviews" ADD CONSTRAINT "legal_ai_reviews_administrative_process_id_administrative_processes_id_fk" FOREIGN KEY ("administrative_process_id") REFERENCES "public"."administrative_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_ai_reviews" ADD CONSTRAINT "legal_ai_reviews_primary_document_id_documents_id_fk" FOREIGN KEY ("primary_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_ai_reviews" ADD CONSTRAINT "legal_ai_reviews_review_set_id_legal_review_sets_id_fk" FOREIGN KEY ("review_set_id") REFERENCES "public"."legal_review_sets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_ai_reviews" ADD CONSTRAINT "legal_ai_reviews_ai_request_id_ai_requests_id_fk" FOREIGN KEY ("ai_request_id") REFERENCES "public"."ai_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_ai_reviews" ADD CONSTRAINT "legal_ai_reviews_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_ai_reviews" ADD CONSTRAINT "legal_ai_reviews_reviewed_by_membership_id_organization_members_id_fk" FOREIGN KEY ("reviewed_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_review_contradictions" ADD CONSTRAINT "legal_review_contradictions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_review_contradictions" ADD CONSTRAINT "legal_review_contradictions_review_id_legal_ai_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."legal_ai_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_review_formal_issues" ADD CONSTRAINT "legal_review_formal_issues_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_review_formal_issues" ADD CONSTRAINT "legal_review_formal_issues_review_id_legal_ai_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."legal_ai_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_review_inconsistencies" ADD CONSTRAINT "legal_review_inconsistencies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_review_inconsistencies" ADD CONSTRAINT "legal_review_inconsistencies_review_id_legal_ai_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."legal_ai_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_review_missing_documents" ADD CONSTRAINT "legal_review_missing_documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_review_missing_documents" ADD CONSTRAINT "legal_review_missing_documents_review_id_legal_ai_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."legal_ai_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_review_risks" ADD CONSTRAINT "legal_review_risks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_review_risks" ADD CONSTRAINT "legal_review_risks_review_id_legal_ai_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."legal_ai_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_review_set_documents" ADD CONSTRAINT "legal_review_set_documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_review_set_documents" ADD CONSTRAINT "legal_review_set_documents_review_set_id_legal_review_sets_id_fk" FOREIGN KEY ("review_set_id") REFERENCES "public"."legal_review_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_review_set_documents" ADD CONSTRAINT "legal_review_set_documents_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_review_set_documents" ADD CONSTRAINT "legal_review_set_documents_document_version_id_document_versions_id_fk" FOREIGN KEY ("document_version_id") REFERENCES "public"."document_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_review_sets" ADD CONSTRAINT "legal_review_sets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_review_sets" ADD CONSTRAINT "legal_review_sets_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_review_sets" ADD CONSTRAINT "legal_review_sets_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_review_unaddressed_claims" ADD CONSTRAINT "legal_review_unaddressed_claims_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_review_unaddressed_claims" ADD CONSTRAINT "legal_review_unaddressed_claims_review_id_legal_ai_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."legal_ai_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_review_unanswered_grounds" ADD CONSTRAINT "legal_review_unanswered_grounds_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_review_unanswered_grounds" ADD CONSTRAINT "legal_review_unanswered_grounds_review_id_legal_ai_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."legal_ai_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auction_alert_rules_org_idx" ON "auction_alert_rules" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "auction_alert_rules_active_idx" ON "auction_alert_rules" USING btree ("organization_id","active");--> statement-breakpoint
CREATE INDEX "auction_bid_rules_auction_idx" ON "auction_bid_rules" USING btree ("auction_id");--> statement-breakpoint
CREATE INDEX "auction_bid_rules_lot_idx" ON "auction_bid_rules" USING btree ("lot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auction_due_diligence_org_lot_item_unique" ON "auction_due_diligence" USING btree ("organization_id","auction_id","lot_id","item_key");--> statement-breakpoint
CREATE INDEX "auction_due_diligence_org_idx" ON "auction_due_diligence" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "auction_due_diligence_auction_idx" ON "auction_due_diligence" USING btree ("auction_id");--> statement-breakpoint
CREATE INDEX "auction_encumbrances_lot_idx" ON "auction_encumbrances" USING btree ("lot_id");--> statement-breakpoint
CREATE INDEX "auction_events_auction_idx" ON "auction_events" USING btree ("auction_id");--> statement-breakpoint
CREATE INDEX "auction_events_starts_idx" ON "auction_events" USING btree ("starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "auction_interests_org_auction_lot_unique" ON "auction_interests" USING btree ("organization_id","auction_id","lot_id");--> statement-breakpoint
CREATE INDEX "auction_interests_org_idx" ON "auction_interests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "auction_interests_status_idx" ON "auction_interests" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "auction_lots_auction_number_unique" ON "auction_lots" USING btree ("auction_id","lot_number");--> statement-breakpoint
CREATE INDEX "auction_lots_auction_idx" ON "auction_lots" USING btree ("auction_id");--> statement-breakpoint
CREATE INDEX "auction_lots_asset_type_idx" ON "auction_lots" USING btree ("asset_type");--> statement-breakpoint
CREATE INDEX "auction_lots_state_idx" ON "auction_lots" USING btree ("state_code");--> statement-breakpoint
CREATE INDEX "auction_lots_status_idx" ON "auction_lots" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "auction_real_estate_details_lot_unique" ON "auction_real_estate_details" USING btree ("lot_id");--> statement-breakpoint
CREATE INDEX "auction_sync_runs_org_idx" ON "auction_sync_runs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "auction_sync_runs_status_idx" ON "auction_sync_runs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "auction_vehicle_details_lot_unique" ON "auction_vehicle_details" USING btree ("lot_id");--> statement-breakpoint
CREATE INDEX "auctioneers_name_idx" ON "auctioneers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "auctioneers_state_idx" ON "auctioneers" USING btree ("state_code");--> statement-breakpoint
CREATE INDEX "auctions_org_idx" ON "auctions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "auctions_type_idx" ON "auctions" USING btree ("auction_type");--> statement-breakpoint
CREATE INDEX "auctions_status_idx" ON "auctions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "auctions_auctioneer_idx" ON "auctions" USING btree ("auctioneer_id");--> statement-breakpoint
CREATE INDEX "auctions_first_event_idx" ON "auctions" USING btree ("first_event_at");--> statement-breakpoint
CREATE INDEX "auctions_court_idx" ON "auctions" USING btree ("court_id");--> statement-breakpoint
CREATE INDEX "legal_citations_org_idx" ON "legal_citations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "legal_citations_source_idx" ON "legal_citations" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "legal_citations_verification_idx" ON "legal_citations" USING btree ("verification_status");--> statement-breakpoint
CREATE INDEX "source_verifications_org_idx" ON "source_verifications" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "source_verifications_citation_idx" ON "source_verifications" USING btree ("citation_id");--> statement-breakpoint
CREATE INDEX "source_verifications_source_idx" ON "source_verifications" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "source_verifications_status_idx" ON "source_verifications" USING btree ("verification_status");--> statement-breakpoint
CREATE INDEX "case_law_records_org_idx" ON "case_law_records" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "case_law_records_court_idx" ON "case_law_records" USING btree ("court");--> statement-breakpoint
CREATE INDEX "case_law_records_case_number_idx" ON "case_law_records" USING btree ("case_number_normalized");--> statement-breakpoint
CREATE INDEX "case_law_records_status_idx" ON "case_law_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "doctrine_sources_org_idx" ON "doctrine_sources" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "doctrine_sources_author_idx" ON "doctrine_sources" USING btree ("author");--> statement-breakpoint
CREATE UNIQUE INDEX "general_repercussion_themes_number_unique" ON "general_repercussion_themes" USING btree ("theme_number");--> statement-breakpoint
CREATE INDEX "general_repercussion_themes_org_idx" ON "general_repercussion_themes" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_matter_research_links_unique" ON "legal_matter_research_links" USING btree ("legal_matter_id","source_type","source_id");--> statement-breakpoint
CREATE INDEX "legal_matter_research_links_org_idx" ON "legal_matter_research_links" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "legal_matter_research_links_matter_idx" ON "legal_matter_research_links" USING btree ("legal_matter_id");--> statement-breakpoint
CREATE INDEX "legal_precedents_org_idx" ON "legal_precedents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "legal_precedents_binding_idx" ON "legal_precedents" USING btree ("binding_status");--> statement-breakpoint
CREATE INDEX "legal_research_queries_org_idx" ON "legal_research_queries" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "legal_research_queries_user_idx" ON "legal_research_queries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "legal_research_queries_status_idx" ON "legal_research_queries" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "legal_research_results_query_idx" ON "legal_research_results" USING btree ("query_id");--> statement-breakpoint
CREATE INDEX "legal_research_results_org_idx" ON "legal_research_results" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "legal_research_results_source_idx" ON "legal_research_results" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "legal_sources_org_idx" ON "legal_sources" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "legal_sources_type_idx" ON "legal_sources" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "legal_sources_identifier_idx" ON "legal_sources" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_summaries_court_number_unique" ON "legal_summaries" USING btree ("court","number");--> statement-breakpoint
CREATE INDEX "legal_summaries_org_idx" ON "legal_summaries" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "repetitive_themes_court_number_unique" ON "repetitive_themes" USING btree ("court","theme_number");--> statement-breakpoint
CREATE INDEX "repetitive_themes_org_idx" ON "repetitive_themes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "saved_researches_org_idx" ON "saved_researches" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "saved_researches_matter_idx" ON "saved_researches" USING btree ("legal_matter_id");--> statement-breakpoint
CREATE INDEX "legal_ai_reviews_org_idx" ON "legal_ai_reviews" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "legal_ai_reviews_matter_idx" ON "legal_ai_reviews" USING btree ("legal_matter_id");--> statement-breakpoint
CREATE INDEX "legal_ai_reviews_status_idx" ON "legal_ai_reviews" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "legal_ai_reviews_document_idx" ON "legal_ai_reviews" USING btree ("primary_document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_ai_reviews_org_type_version_unique" ON "legal_ai_reviews" USING btree ("organization_id","legal_matter_id","review_type","version");--> statement-breakpoint
CREATE INDEX "legal_review_contradictions_review_idx" ON "legal_review_contradictions" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "legal_review_formal_issues_review_idx" ON "legal_review_formal_issues" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "legal_review_formal_issues_org_idx" ON "legal_review_formal_issues" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "legal_review_inconsistencies_review_idx" ON "legal_review_inconsistencies" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "legal_review_missing_documents_review_idx" ON "legal_review_missing_documents" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "legal_review_risks_review_idx" ON "legal_review_risks" USING btree ("review_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_review_set_documents_unique" ON "legal_review_set_documents" USING btree ("review_set_id","document_id");--> statement-breakpoint
CREATE INDEX "legal_review_set_documents_set_idx" ON "legal_review_set_documents" USING btree ("review_set_id");--> statement-breakpoint
CREATE INDEX "legal_review_set_documents_org_idx" ON "legal_review_set_documents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "legal_review_sets_org_idx" ON "legal_review_sets" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "legal_review_sets_matter_idx" ON "legal_review_sets" USING btree ("legal_matter_id");--> statement-breakpoint
CREATE INDEX "legal_review_unaddressed_claims_review_idx" ON "legal_review_unaddressed_claims" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "legal_review_unanswered_grounds_review_idx" ON "legal_review_unanswered_grounds" USING btree ("review_id");