/**
 * Núcleo jurídico comum — módulos de área, features, checklists e rule sets versionados.
 * Extensões 1:1/1:N ligam LegalMatter sem duplicar Client/Document/Task/Deadline.
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { administrativeProcesses } from "./administrative.js";
import { crmClients } from "./crm.js";
import { documents } from "./documents.js";
import { organizations } from "./identity.js";
import { legalDocumentTemplates } from "./legal-templates.js";
import { legalMatters } from "./matters.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const LEGAL_AREA_MODULE_KEYS = [
  "TAX",
  "CIVIL",
  "CONSUMER",
  "FAMILY",
  "SUCCESSION",
  "CORPORATE",
  "CRIMINAL",
  "ADMINISTRATIVE",
  "MEDICAL",
  "REAL_ESTATE",
  "ENVIRONMENTAL",
  "ELECTORAL",
  "SPORTS",
  "DIGITAL",
  "INTERNATIONAL",
  "ARBITRATION",
  "MEDIATION",
] as const;

export type LegalAreaModuleKey = (typeof LEGAL_AREA_MODULE_KEYS)[number];

export const legalAreaModuleKeyEnum = pgEnum("legal_area_module_key", [...LEGAL_AREA_MODULE_KEYS]);

export const versionedRuleSetStatusEnum = pgEnum("versioned_rule_set_status", [
  "draft",
  "active",
  "deprecated",
  "archived",
]);

export const legalAreaChecklistStatusEnum = pgEnum("legal_area_checklist_status", [
  "draft",
  "active",
  "deprecated",
  "archived",
]);

export const matterExtensionConfidentialityEnum = pgEnum("matter_extension_confidentiality", [
  "standard",
  "confidential",
  "highly_restricted",
]);

/** Catálogo de módulos de área (sistema). */
export const legalAreaModules = pgTable(
  "legal_area_modules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: legalAreaModuleKeyEnum("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    version: text("version").notNull().default("1"),
    configuration: jsonb("configuration").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("legal_area_modules_key_unique").on(table.key),
    index("legal_area_modules_active_idx").on(table.active),
  ],
);

/** Capacidades registradas por área (evita if area === ...). */
export const legalAreaFeatureConfig = pgTable(
  "legal_area_feature_config",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => legalAreaModules.id, { onDelete: "cascade" }),
    featureKey: text("feature_key").notNull(),
    active: boolean("active").notNull().default(true),
    configuration: jsonb("configuration").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("legal_area_feature_config_module_feature_unique").on(
      table.moduleId,
      table.featureKey,
    ),
    index("legal_area_feature_config_feature_idx").on(table.featureKey),
  ],
);

/** Packs de templates por área. */
export const legalAreaTemplatePacks = pgTable(
  "legal_area_template_packs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => legalAreaModules.id, { onDelete: "cascade" }),
    legalDocumentTemplateId: uuid("legal_document_template_id").references(
      () => legalDocumentTemplates.id,
      { onDelete: "set null" },
    ),
    packKey: text("pack_key").notNull(),
    title: text("title").notNull(),
    isSystem: boolean("is_system").notNull().default(false),
    active: boolean("active").notNull().default(true),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    index("legal_area_template_packs_module_idx").on(table.moduleId),
    index("legal_area_template_packs_org_idx").on(table.organizationId),
    uniqueIndex("legal_area_template_packs_org_module_key_unique").on(
      table.organizationId,
      table.moduleId,
      table.packKey,
    ),
  ],
);

/** Checklists versionados por área. */
export const legalAreaChecklists = pgTable(
  "legal_area_checklists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => legalAreaModules.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    title: text("title").notNull(),
    version: text("version").notNull().default("1"),
    status: legalAreaChecklistStatusEnum("status").notNull().default("active"),
    items: jsonb("items").$type<Array<{ key: string; label: string; required?: boolean }>>(),
    isSystem: boolean("is_system").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("legal_area_checklists_module_key_version_unique").on(
      table.moduleId,
      table.key,
      table.version,
    ),
    index("legal_area_checklists_org_idx").on(table.organizationId),
    index("legal_area_checklists_status_idx").on(table.status),
  ],
);

/** Configuração de workflow sobre o motor existente (sem state machine por área). */
export const legalAreaWorkflowConfigs = pgTable(
  "legal_area_workflow_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => legalAreaModules.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    title: text("title").notNull(),
    stages: jsonb("stages").$type<Array<{ key: string; label: string; order: number }>>(),
    active: boolean("active").notNull().default(true),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("legal_area_workflow_configs_module_key_unique").on(table.moduleId, table.key),
    index("legal_area_workflow_configs_org_idx").on(table.organizationId),
  ],
);

/**
 * Rule sets versionados transversais (tax, civil damages, etc.).
 * Regra usada historicamente é imutável (locked após uso).
 */
export const versionedRuleSets = pgTable(
  "versioned_rule_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    key: text("key").notNull(),
    domain: text("domain").notNull(),
    version: text("version").notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true, mode: "date" }).notNull(),
    effectiveTo: timestamp("effective_to", { withTimezone: true, mode: "date" }),
    source: text("source").notNull().default("system"),
    sourceUrl: text("source_url"),
    status: versionedRuleSetStatusEnum("status").notNull().default("active"),
    locked: boolean("locked").notNull().default(false),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("versioned_rule_sets_domain_key_version_unique").on(
      table.domain,
      table.key,
      table.version,
    ),
    index("versioned_rule_sets_domain_idx").on(table.domain),
    index("versioned_rule_sets_status_idx").on(table.status),
    index("versioned_rule_sets_effective_idx").on(table.effectiveFrom, table.effectiveTo),
  ],
);

/** Vínculo LegalMatter ↔ módulo de área (metadata + confidentiality). */
export const legalMatterAreaBindings = pgTable(
  "legal_matter_area_bindings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id")
      .notNull()
      .references(() => legalMatters.id, { onDelete: "cascade" }),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => legalAreaModules.id, { onDelete: "restrict" }),
    confidentiality: matterExtensionConfidentialityEnum("confidentiality")
      .notNull()
      .default("standard"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("legal_matter_area_bindings_matter_module_unique").on(
      table.legalMatterId,
      table.moduleId,
    ),
    index("legal_matter_area_bindings_org_idx").on(table.organizationId),
    index("legal_matter_area_bindings_module_idx").on(table.moduleId),
  ],
);

/* ---------- Extensões de área (mínimas e reais) ---------- */

export const civilClaimItemStatusEnum = pgEnum("civil_claim_item_status", [
  "draft",
  "active",
  "settled",
  "withdrawn",
  "rejected",
  "superseded",
]);

export const civilClaimItems = pgTable(
  "civil_claim_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id")
      .notNull()
      .references(() => legalMatters.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    claimKind: text("claim_kind").notNull().default("other"),
    amountCents: integer("amount_cents"),
    status: civilClaimItemStatusEnum("status").notNull().default("draft"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("civil_claim_items_org_matter_idx").on(table.organizationId, table.legalMatterId),
    index("civil_claim_items_status_idx").on(table.status),
  ],
);

export const civilDamages = pgTable(
  "civil_damages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id")
      .notNull()
      .references(() => legalMatters.id, { onDelete: "cascade" }),
    damageKind: text("damage_kind").notNull().default("other"),
    principalCents: integer("principal_cents").notNull().default(0),
    moralCents: integer("moral_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [index("civil_damages_org_matter_idx").on(table.organizationId, table.legalMatterId)],
);

export const civilObligations = pgTable(
  "civil_obligations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id")
      .notNull()
      .references(() => legalMatters.id, { onDelete: "cascade" }),
    obligationType: text("obligation_type").notNull().default("other"),
    description: text("description").notNull(),
    dueDate: timestamp("due_date", { withTimezone: true, mode: "date" }),
    status: text("status").notNull().default("open"),
    amountCents: integer("amount_cents"),
    ...timestamps,
  },
  (table) => [
    index("civil_obligations_org_matter_idx").on(table.organizationId, table.legalMatterId),
  ],
);

export const consumerCases = pgTable(
  "consumer_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id")
      .notNull()
      .references(() => legalMatters.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => crmClients.id, { onDelete: "restrict" }),
    supplierName: text("supplier_name"),
    productOrService: text("product_or_service"),
    defectKind: text("defect_kind"),
    complaintChannel: text("complaint_channel"),
    status: text("status").notNull().default("draft"),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    index("consumer_cases_org_idx").on(table.organizationId),
    index("consumer_cases_matter_idx").on(table.legalMatterId),
  ],
);

export const familyRelationships = pgTable(
  "family_relationships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id")
      .notNull()
      .references(() => legalMatters.id, { onDelete: "cascade" }),
    relationshipType: text("relationship_type").notNull(),
    partyALabel: text("party_a_label").notNull(),
    partyBLabel: text("party_b_label").notNull(),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("family_relationships_org_matter_idx").on(table.organizationId, table.legalMatterId),
  ],
);

export const custodyArrangements = pgTable(
  "custody_arrangements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id")
      .notNull()
      .references(() => legalMatters.id, { onDelete: "cascade" }),
    custodyType: text("custody_type").notNull().default("shared"),
    visitationNotes: text("visitation_notes"),
    status: text("status").notNull().default("draft"),
    ...timestamps,
  },
  (table) => [
    index("custody_arrangements_org_matter_idx").on(table.organizationId, table.legalMatterId),
  ],
);

export const supportObligations = pgTable(
  "support_obligations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id")
      .notNull()
      .references(() => legalMatters.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull().default(0),
    frequency: text("frequency").notNull().default("monthly"),
    beneficiaryLabel: text("beneficiary_label"),
    status: text("status").notNull().default("draft"),
    ...timestamps,
  },
  (table) => [
    index("support_obligations_org_matter_idx").on(table.organizationId, table.legalMatterId),
  ],
);

export const propertyDivisions = pgTable(
  "property_divisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id")
      .notNull()
      .references(() => legalMatters.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    shareBasisPoints: integer("share_basis_points"),
    status: text("status").notNull().default("draft"),
    ...timestamps,
  },
  (table) => [
    index("property_divisions_org_matter_idx").on(table.organizationId, table.legalMatterId),
  ],
);

export const estateCases = pgTable(
  "estate_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id")
      .notNull()
      .references(() => legalMatters.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => crmClients.id, { onDelete: "restrict" }),
    deceasedName: text("deceased_name"),
    deathDate: timestamp("death_date", { withTimezone: true, mode: "date" }),
    inventoryKind: text("inventory_kind").notNull().default("inventory"),
    status: text("status").notNull().default("draft"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("estate_cases_org_idx").on(table.organizationId),
    index("estate_cases_matter_idx").on(table.legalMatterId),
  ],
);

export const estateAssets = pgTable(
  "estate_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    estateCaseId: uuid("estate_case_id")
      .notNull()
      .references(() => estateCases.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    assetKind: text("asset_kind").notNull().default("other"),
    estimatedValueCents: integer("estimated_value_cents"),
    ...timestamps,
  },
  (table) => [index("estate_assets_case_idx").on(table.estateCaseId)],
);

export const estateHeirs = pgTable(
  "estate_heirs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    estateCaseId: uuid("estate_case_id")
      .notNull()
      .references(() => estateCases.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    heirKind: text("heir_kind").notNull().default("heir"),
    shareBasisPoints: integer("share_basis_points"),
    ...timestamps,
  },
  (table) => [index("estate_heirs_case_idx").on(table.estateCaseId)],
);

export const estateShares = pgTable(
  "estate_shares",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    estateCaseId: uuid("estate_case_id")
      .notNull()
      .references(() => estateCases.id, { onDelete: "cascade" }),
    heirId: uuid("heir_id").references(() => estateHeirs.id, { onDelete: "set null" }),
    assetId: uuid("asset_id").references(() => estateAssets.id, { onDelete: "set null" }),
    shareBasisPoints: integer("share_basis_points").notNull().default(0),
    amountCents: integer("amount_cents"),
    ...timestamps,
  },
  (table) => [index("estate_shares_case_idx").on(table.estateCaseId)],
);

export const corporateCases = pgTable(
  "corporate_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id")
      .notNull()
      .references(() => legalMatters.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => crmClients.id, { onDelete: "restrict" }),
    companyName: text("company_name"),
    operationKind: text("operation_kind").notNull().default("other"),
    status: text("status").notNull().default("draft"),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    index("corporate_cases_org_idx").on(table.organizationId),
    index("corporate_cases_matter_idx").on(table.legalMatterId),
  ],
);

export const criminalCases = pgTable(
  "criminal_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id")
      .notNull()
      .references(() => legalMatters.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => crmClients.id, { onDelete: "restrict" }),
    phase: text("phase").notNull().default("investigation"),
    confidentiality: matterExtensionConfidentialityEnum("confidentiality")
      .notNull()
      .default("highly_restricted"),
    status: text("status").notNull().default("draft"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("criminal_cases_org_idx").on(table.organizationId),
    index("criminal_cases_matter_idx").on(table.legalMatterId),
  ],
);

export const criminalCharges = pgTable(
  "criminal_charges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    criminalCaseId: uuid("criminal_case_id")
      .notNull()
      .references(() => criminalCases.id, { onDelete: "cascade" }),
    chargeLabel: text("charge_label").notNull(),
    legalBasisText: text("legal_basis_text"),
    status: text("status").notNull().default("draft"),
    ...timestamps,
  },
  (table) => [index("criminal_charges_case_idx").on(table.criminalCaseId)],
);

export const custodialMeasures = pgTable(
  "custodial_measures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    criminalCaseId: uuid("criminal_case_id")
      .notNull()
      .references(() => criminalCases.id, { onDelete: "cascade" }),
    measureType: text("measure_type").notNull(),
    status: text("status").notNull().default("active"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [index("custodial_measures_case_idx").on(table.criminalCaseId)],
);

export const sentencingInformation = pgTable(
  "sentencing_information",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    criminalCaseId: uuid("criminal_case_id")
      .notNull()
      .references(() => criminalCases.id, { onDelete: "cascade" }),
    sentenceSummary: text("sentence_summary"),
    sentenceDate: timestamp("sentence_date", { withTimezone: true, mode: "date" }),
    status: text("status").notNull().default("draft"),
    ...timestamps,
  },
  (table) => [index("sentencing_information_case_idx").on(table.criminalCaseId)],
);

export const administrativeLawCases = pgTable(
  "administrative_law_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id")
      .notNull()
      .references(() => legalMatters.id, { onDelete: "cascade" }),
    administrativeProcessId: uuid("administrative_process_id").references(
      () => administrativeProcesses.id,
      { onDelete: "set null" },
    ),
    caseKind: text("case_kind").notNull().default("other"),
    status: text("status").notNull().default("draft"),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    index("administrative_law_cases_org_idx").on(table.organizationId),
    index("administrative_law_cases_matter_idx").on(table.legalMatterId),
  ],
);

export const medicalCases = pgTable(
  "medical_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id")
      .notNull()
      .references(() => legalMatters.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => crmClients.id, { onDelete: "restrict" }),
    caseKind: text("case_kind").notNull().default("health_plan_denial"),
    confidentiality: matterExtensionConfidentialityEnum("confidentiality")
      .notNull()
      .default("confidential"),
    status: text("status").notNull().default("draft"),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    index("medical_cases_org_idx").on(table.organizationId),
    index("medical_cases_matter_idx").on(table.legalMatterId),
  ],
);

/** Imóvel reutilizável por outros domínios. */
export const realEstateAssets = pgTable(
  "real_estate_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id").references(() => legalMatters.id, {
      onDelete: "set null",
    }),
    registrationNumber: text("registration_number"),
    addressSummary: text("address_summary"),
    assetKind: text("asset_kind").notNull().default("property"),
    status: text("status").notNull().default("active"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    index("real_estate_assets_org_idx").on(table.organizationId),
    index("real_estate_assets_matter_idx").on(table.legalMatterId),
  ],
);

export const realEstateCases = pgTable(
  "real_estate_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id")
      .notNull()
      .references(() => legalMatters.id, { onDelete: "cascade" }),
    realEstateAssetId: uuid("real_estate_asset_id").references(() => realEstateAssets.id, {
      onDelete: "set null",
    }),
    caseKind: text("case_kind").notNull().default("other"),
    status: text("status").notNull().default("draft"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("real_estate_cases_org_idx").on(table.organizationId),
    index("real_estate_cases_matter_idx").on(table.legalMatterId),
  ],
);

export const environmentalCases = pgTable(
  "environmental_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id")
      .notNull()
      .references(() => legalMatters.id, { onDelete: "cascade" }),
    caseKind: text("case_kind").notNull().default("licensing"),
    status: text("status").notNull().default("draft"),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    index("environmental_cases_org_idx").on(table.organizationId),
    index("environmental_cases_matter_idx").on(table.legalMatterId),
  ],
);

export const electoralCases = pgTable(
  "electoral_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id")
      .notNull()
      .references(() => legalMatters.id, { onDelete: "cascade" }),
    caseKind: text("case_kind").notNull().default("other"),
    electionYear: integer("election_year"),
    status: text("status").notNull().default("draft"),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    index("electoral_cases_org_idx").on(table.organizationId),
    index("electoral_cases_matter_idx").on(table.legalMatterId),
  ],
);

export const sportsCases = pgTable(
  "sports_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id")
      .notNull()
      .references(() => legalMatters.id, { onDelete: "cascade" }),
    athleteName: text("athlete_name"),
    clubName: text("club_name"),
    federationName: text("federation_name"),
    caseKind: text("case_kind").notNull().default("other"),
    status: text("status").notNull().default("draft"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("sports_cases_org_idx").on(table.organizationId),
    index("sports_cases_matter_idx").on(table.legalMatterId),
  ],
);

export const digitalCases = pgTable(
  "digital_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id")
      .notNull()
      .references(() => legalMatters.id, { onDelete: "cascade" }),
    caseKind: text("case_kind").notNull().default("lgpd"),
    status: text("status").notNull().default("draft"),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    index("digital_cases_org_idx").on(table.organizationId),
    index("digital_cases_matter_idx").on(table.legalMatterId),
  ],
);

export const internationalCases = pgTable(
  "international_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id")
      .notNull()
      .references(() => legalMatters.id, { onDelete: "cascade" }),
    country: text("country"),
    jurisdiction: text("jurisdiction"),
    applicableLaw: text("applicable_law"),
    language: text("language"),
    currency: text("currency"),
    caseKind: text("case_kind").notNull().default("other"),
    status: text("status").notNull().default("draft"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("international_cases_org_idx").on(table.organizationId),
    index("international_cases_matter_idx").on(table.legalMatterId),
  ],
);

export const arbitrationCases = pgTable(
  "arbitration_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id")
      .notNull()
      .references(() => legalMatters.id, { onDelete: "cascade" }),
    institution: text("institution"),
    rules: text("rules"),
    seat: text("seat"),
    language: text("language"),
    tribunalComposition: text("tribunal_composition"),
    claimantLabel: text("claimant_label"),
    respondentLabel: text("respondent_label"),
    arbitrationNumber: text("arbitration_number"),
    status: text("status").notNull().default("draft"),
    confidential: boolean("confidential").notNull().default(true),
    awardDate: timestamp("award_date", { withTimezone: true, mode: "date" }),
    awardDocumentId: uuid("award_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("arbitration_cases_org_idx").on(table.organizationId),
    index("arbitration_cases_matter_idx").on(table.legalMatterId),
  ],
);

export const mediationCases = pgTable(
  "mediation_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id")
      .notNull()
      .references(() => legalMatters.id, { onDelete: "cascade" }),
    mediatorName: text("mediator_name"),
    institution: text("institution"),
    status: text("status").notNull().default("draft"),
    confidentiality: boolean("confidentiality").notNull().default(true),
    settlementReached: boolean("settlement_reached").notNull().default(false),
    settlementDocumentId: uuid("settlement_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("mediation_cases_org_idx").on(table.organizationId),
    index("mediation_cases_matter_idx").on(table.legalMatterId),
  ],
);

/* ---------- Relations ---------- */

export const legalAreaModulesRelations = relations(legalAreaModules, ({ many }) => ({
  features: many(legalAreaFeatureConfig),
  checklists: many(legalAreaChecklists),
  templatePacks: many(legalAreaTemplatePacks),
  workflowConfigs: many(legalAreaWorkflowConfigs),
  bindings: many(legalMatterAreaBindings),
}));

export const legalAreaFeatureConfigRelations = relations(legalAreaFeatureConfig, ({ one }) => ({
  module: one(legalAreaModules, {
    fields: [legalAreaFeatureConfig.moduleId],
    references: [legalAreaModules.id],
  }),
}));

export const legalAreaTemplatePacksRelations = relations(legalAreaTemplatePacks, ({ one }) => ({
  module: one(legalAreaModules, {
    fields: [legalAreaTemplatePacks.moduleId],
    references: [legalAreaModules.id],
  }),
  organization: one(organizations, {
    fields: [legalAreaTemplatePacks.organizationId],
    references: [organizations.id],
  }),
  template: one(legalDocumentTemplates, {
    fields: [legalAreaTemplatePacks.legalDocumentTemplateId],
    references: [legalDocumentTemplates.id],
  }),
}));

export const legalAreaChecklistsRelations = relations(legalAreaChecklists, ({ one }) => ({
  module: one(legalAreaModules, {
    fields: [legalAreaChecklists.moduleId],
    references: [legalAreaModules.id],
  }),
}));

export const legalAreaWorkflowConfigsRelations = relations(legalAreaWorkflowConfigs, ({ one }) => ({
  module: one(legalAreaModules, {
    fields: [legalAreaWorkflowConfigs.moduleId],
    references: [legalAreaModules.id],
  }),
}));

export const versionedRuleSetsRelations = relations(versionedRuleSets, ({ one }) => ({
  organization: one(organizations, {
    fields: [versionedRuleSets.organizationId],
    references: [organizations.id],
  }),
}));

export const legalMatterAreaBindingsRelations = relations(legalMatterAreaBindings, ({ one }) => ({
  organization: one(organizations, {
    fields: [legalMatterAreaBindings.organizationId],
    references: [organizations.id],
  }),
  matter: one(legalMatters, {
    fields: [legalMatterAreaBindings.legalMatterId],
    references: [legalMatters.id],
  }),
  module: one(legalAreaModules, {
    fields: [legalMatterAreaBindings.moduleId],
    references: [legalAreaModules.id],
  }),
}));

export const civilClaimItemsRelations = relations(civilClaimItems, ({ one }) => ({
  matter: one(legalMatters, {
    fields: [civilClaimItems.legalMatterId],
    references: [legalMatters.id],
  }),
}));

export const civilDamagesRelations = relations(civilDamages, ({ one }) => ({
  matter: one(legalMatters, {
    fields: [civilDamages.legalMatterId],
    references: [legalMatters.id],
  }),
}));

export const civilObligationsRelations = relations(civilObligations, ({ one }) => ({
  matter: one(legalMatters, {
    fields: [civilObligations.legalMatterId],
    references: [legalMatters.id],
  }),
}));

export const consumerCasesRelations = relations(consumerCases, ({ one }) => ({
  matter: one(legalMatters, {
    fields: [consumerCases.legalMatterId],
    references: [legalMatters.id],
  }),
  client: one(crmClients, { fields: [consumerCases.clientId], references: [crmClients.id] }),
}));

export const familyRelationshipsRelations = relations(familyRelationships, ({ one }) => ({
  matter: one(legalMatters, {
    fields: [familyRelationships.legalMatterId],
    references: [legalMatters.id],
  }),
}));

export const custodyArrangementsRelations = relations(custodyArrangements, ({ one }) => ({
  matter: one(legalMatters, {
    fields: [custodyArrangements.legalMatterId],
    references: [legalMatters.id],
  }),
}));

export const supportObligationsRelations = relations(supportObligations, ({ one }) => ({
  matter: one(legalMatters, {
    fields: [supportObligations.legalMatterId],
    references: [legalMatters.id],
  }),
}));

export const propertyDivisionsRelations = relations(propertyDivisions, ({ one }) => ({
  matter: one(legalMatters, {
    fields: [propertyDivisions.legalMatterId],
    references: [legalMatters.id],
  }),
}));

export const estateCasesRelations = relations(estateCases, ({ one, many }) => ({
  matter: one(legalMatters, { fields: [estateCases.legalMatterId], references: [legalMatters.id] }),
  client: one(crmClients, { fields: [estateCases.clientId], references: [crmClients.id] }),
  assets: many(estateAssets),
  heirs: many(estateHeirs),
  shares: many(estateShares),
}));

export const estateAssetsRelations = relations(estateAssets, ({ one }) => ({
  estateCase: one(estateCases, {
    fields: [estateAssets.estateCaseId],
    references: [estateCases.id],
  }),
}));

export const estateHeirsRelations = relations(estateHeirs, ({ one }) => ({
  estateCase: one(estateCases, {
    fields: [estateHeirs.estateCaseId],
    references: [estateCases.id],
  }),
}));

export const estateSharesRelations = relations(estateShares, ({ one }) => ({
  estateCase: one(estateCases, {
    fields: [estateShares.estateCaseId],
    references: [estateCases.id],
  }),
}));

export const corporateCasesRelations = relations(corporateCases, ({ one }) => ({
  matter: one(legalMatters, {
    fields: [corporateCases.legalMatterId],
    references: [legalMatters.id],
  }),
  client: one(crmClients, { fields: [corporateCases.clientId], references: [crmClients.id] }),
}));

export const criminalCasesRelations = relations(criminalCases, ({ one, many }) => ({
  matter: one(legalMatters, {
    fields: [criminalCases.legalMatterId],
    references: [legalMatters.id],
  }),
  client: one(crmClients, { fields: [criminalCases.clientId], references: [crmClients.id] }),
  charges: many(criminalCharges),
  measures: many(custodialMeasures),
  sentencing: many(sentencingInformation),
}));

export const criminalChargesRelations = relations(criminalCharges, ({ one }) => ({
  criminalCase: one(criminalCases, {
    fields: [criminalCharges.criminalCaseId],
    references: [criminalCases.id],
  }),
}));

export const custodialMeasuresRelations = relations(custodialMeasures, ({ one }) => ({
  criminalCase: one(criminalCases, {
    fields: [custodialMeasures.criminalCaseId],
    references: [criminalCases.id],
  }),
}));

export const sentencingInformationRelations = relations(sentencingInformation, ({ one }) => ({
  criminalCase: one(criminalCases, {
    fields: [sentencingInformation.criminalCaseId],
    references: [criminalCases.id],
  }),
}));

export const administrativeLawCasesRelations = relations(administrativeLawCases, ({ one }) => ({
  matter: one(legalMatters, {
    fields: [administrativeLawCases.legalMatterId],
    references: [legalMatters.id],
  }),
  administrativeProcess: one(administrativeProcesses, {
    fields: [administrativeLawCases.administrativeProcessId],
    references: [administrativeProcesses.id],
  }),
}));

export const medicalCasesRelations = relations(medicalCases, ({ one }) => ({
  matter: one(legalMatters, {
    fields: [medicalCases.legalMatterId],
    references: [legalMatters.id],
  }),
  client: one(crmClients, { fields: [medicalCases.clientId], references: [crmClients.id] }),
}));

export const realEstateAssetsRelations = relations(realEstateAssets, ({ one }) => ({
  matter: one(legalMatters, {
    fields: [realEstateAssets.legalMatterId],
    references: [legalMatters.id],
  }),
}));

export const realEstateCasesRelations = relations(realEstateCases, ({ one }) => ({
  matter: one(legalMatters, {
    fields: [realEstateCases.legalMatterId],
    references: [legalMatters.id],
  }),
  asset: one(realEstateAssets, {
    fields: [realEstateCases.realEstateAssetId],
    references: [realEstateAssets.id],
  }),
}));

export const environmentalCasesRelations = relations(environmentalCases, ({ one }) => ({
  matter: one(legalMatters, {
    fields: [environmentalCases.legalMatterId],
    references: [legalMatters.id],
  }),
}));

export const electoralCasesRelations = relations(electoralCases, ({ one }) => ({
  matter: one(legalMatters, {
    fields: [electoralCases.legalMatterId],
    references: [legalMatters.id],
  }),
}));

export const sportsCasesRelations = relations(sportsCases, ({ one }) => ({
  matter: one(legalMatters, { fields: [sportsCases.legalMatterId], references: [legalMatters.id] }),
}));

export const digitalCasesRelations = relations(digitalCases, ({ one }) => ({
  matter: one(legalMatters, {
    fields: [digitalCases.legalMatterId],
    references: [legalMatters.id],
  }),
}));

export const internationalCasesRelations = relations(internationalCases, ({ one }) => ({
  matter: one(legalMatters, {
    fields: [internationalCases.legalMatterId],
    references: [legalMatters.id],
  }),
}));

export const arbitrationCasesRelations = relations(arbitrationCases, ({ one }) => ({
  matter: one(legalMatters, {
    fields: [arbitrationCases.legalMatterId],
    references: [legalMatters.id],
  }),
  awardDocument: one(documents, {
    fields: [arbitrationCases.awardDocumentId],
    references: [documents.id],
  }),
}));

export const mediationCasesRelations = relations(mediationCases, ({ one }) => ({
  matter: one(legalMatters, {
    fields: [mediationCases.legalMatterId],
    references: [legalMatters.id],
  }),
  settlementDocument: one(documents, {
    fields: [mediationCases.settlementDocumentId],
    references: [documents.id],
  }),
}));
