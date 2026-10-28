import { z } from "zod";

const uuid = z.string().uuid("O identificador não é válido.");
const optionalUuid = uuid.optional();
const nullableUuid = uuid.nullable().optional();
const datetime = z.string().datetime({ offset: true });
const optionalDatetime = datetime.optional();
const nullableDatetime = datetime.nullable().optional();
const cents = z
  .number()
  .int("Informe um valor inteiro em centavos.")
  .min(0)
  .max(Number.MAX_SAFE_INTEGER);

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

export const VERSIONED_RULE_SET_STATUSES = ["draft", "active", "deprecated", "archived"] as const;
export const LEGAL_AREA_CHECKLIST_STATUSES = ["draft", "active", "deprecated", "archived"] as const;
export const MATTER_EXTENSION_CONFIDENTIALITY = [
  "standard",
  "confidential",
  "highly_restricted",
] as const;
export const CIVIL_CLAIM_ITEM_STATUSES = [
  "draft",
  "active",
  "settled",
  "withdrawn",
  "rejected",
  "superseded",
] as const;

export const updateLegalAreaModuleSchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    active: z.boolean().optional(),
    version: z.string().trim().min(1).max(40).optional(),
    configuration: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const legalAreaModuleListQuerySchema = z.object({
  key: z.enum(LEGAL_AREA_MODULE_KEYS).optional(),
  active: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const createLegalAreaFeatureConfigSchema = z.object({
  moduleId: uuid,
  featureKey: z.string().trim().min(1).max(80),
  active: z.boolean().default(true),
  configuration: z.record(z.string(), z.unknown()).optional(),
});

export const updateLegalAreaFeatureConfigSchema = z
  .object({
    active: z.boolean().optional(),
    configuration: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createLegalAreaTemplatePackSchema = z.object({
  moduleId: uuid,
  legalDocumentTemplateId: optionalUuid,
  packKey: z.string().trim().min(1).max(80),
  title: z.string().trim().min(2).max(200),
  active: z.boolean().default(true),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateLegalAreaTemplatePackSchema = createLegalAreaTemplatePackSchema
  .omit({ moduleId: true, packKey: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createLegalAreaChecklistSchema = z.object({
  moduleId: uuid,
  key: z.string().trim().min(1).max(80),
  title: z.string().trim().min(2).max(200),
  version: z.string().trim().min(1).max(40).default("1"),
  status: z.enum(LEGAL_AREA_CHECKLIST_STATUSES).default("active"),
  items: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(80),
        label: z.string().trim().min(1).max(300),
        required: z.boolean().optional(),
      }),
    )
    .max(200)
    .optional(),
});

export const updateLegalAreaChecklistSchema = createLegalAreaChecklistSchema
  .omit({ moduleId: true, key: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const legalAreaChecklistListQuerySchema = z.object({
  moduleId: optionalUuid,
  status: z.enum(LEGAL_AREA_CHECKLIST_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const createLegalAreaWorkflowConfigSchema = z.object({
  moduleId: uuid,
  key: z.string().trim().min(1).max(80),
  title: z.string().trim().min(2).max(200),
  stages: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(80),
        label: z.string().trim().min(1).max(200),
        order: z.number().int().min(0).max(10_000),
      }),
    )
    .max(100)
    .optional(),
  active: z.boolean().default(true),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateLegalAreaWorkflowConfigSchema = createLegalAreaWorkflowConfigSchema
  .omit({ moduleId: true, key: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createVersionedRuleSetSchema = z.object({
  key: z.string().trim().min(1).max(80),
  domain: z.string().trim().min(1).max(80),
  version: z.string().trim().min(1).max(40),
  effectiveFrom: datetime,
  effectiveTo: nullableDatetime,
  source: z.string().trim().min(1).max(120).default("system"),
  sourceUrl: z.string().trim().url().max(500).optional(),
  status: z.enum(VERSIONED_RULE_SET_STATUSES).default("active"),
  locked: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateVersionedRuleSetSchema = createVersionedRuleSetSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const versionedRuleSetListQuerySchema = z.object({
  domain: z.string().trim().max(80).optional(),
  status: z.enum(VERSIONED_RULE_SET_STATUSES).optional(),
  key: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const createLegalMatterAreaBindingSchema = z.object({
  legalMatterId: uuid,
  moduleId: uuid,
  confidentiality: z.enum(MATTER_EXTENSION_CONFIDENTIALITY).default("standard"),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const createLegalMatterAreaBindingBodySchema = createLegalMatterAreaBindingSchema.omit({
  legalMatterId: true,
});

export const updateLegalMatterAreaBindingSchema = z
  .object({
    confidentiality: z.enum(MATTER_EXTENSION_CONFIDENTIALITY).optional(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const legalMatterAreaBindingListQuerySchema = z.object({
  legalMatterId: optionalUuid,
  moduleId: optionalUuid,
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const createCivilClaimItemSchema = z.object({
  legalMatterId: uuid,
  title: z.string().trim().min(1).max(200),
  claimKind: z.string().trim().min(1).max(80).default("other"),
  amountCents: cents.optional(),
  status: z.enum(CIVIL_CLAIM_ITEM_STATUSES).default("draft"),
  notes: z.string().trim().max(4000).optional(),
});

export const updateCivilClaimItemSchema = createCivilClaimItemSchema
  .omit({ legalMatterId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createCivilDamageSchema = z.object({
  legalMatterId: uuid,
  damageKind: z.string().trim().min(1).max(80).default("other"),
  principalCents: cents.default(0),
  moralCents: cents.default(0),
  totalCents: cents.default(0),
  notes: z.string().trim().max(4000).optional(),
});

export const updateCivilDamageSchema = createCivilDamageSchema
  .omit({ legalMatterId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createCivilObligationSchema = z.object({
  legalMatterId: uuid,
  obligationType: z.string().trim().min(1).max(80).default("other"),
  description: z.string().trim().min(1).max(4000),
  dueDate: optionalDatetime,
  status: z.string().trim().min(1).max(40).default("open"),
  amountCents: cents.optional(),
});

export const updateCivilObligationSchema = createCivilObligationSchema
  .omit({ legalMatterId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createConsumerCaseSchema = z.object({
  legalMatterId: uuid,
  clientId: uuid,
  supplierName: z.string().trim().max(200).optional(),
  productOrService: z.string().trim().max(300).optional(),
  defectKind: z.string().trim().max(120).optional(),
  complaintChannel: z.string().trim().max(120).optional(),
  status: z.string().trim().min(1).max(40).default("draft"),
  notes: z.string().trim().max(8000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateConsumerCaseSchema = createConsumerCaseSchema
  .omit({ legalMatterId: true, clientId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const areaExtensionCaseListQuerySchema = z.object({
  legalMatterId: optionalUuid,
  clientId: optionalUuid,
  status: z.string().trim().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const createCorporateCaseSchema = z.object({
  legalMatterId: uuid,
  clientId: uuid,
  companyName: z.string().trim().max(200).optional(),
  operationKind: z.string().trim().min(1).max(80).default("other"),
  status: z.string().trim().min(1).max(40).default("draft"),
  notes: z.string().trim().max(8000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateCorporateCaseSchema = createCorporateCaseSchema
  .omit({ legalMatterId: true, clientId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createCriminalCaseSchema = z.object({
  legalMatterId: uuid,
  clientId: uuid,
  phase: z.string().trim().min(1).max(80).default("investigation"),
  confidentiality: z.enum(MATTER_EXTENSION_CONFIDENTIALITY).default("highly_restricted"),
  status: z.string().trim().min(1).max(40).default("draft"),
  notes: z.string().trim().max(8000).optional(),
});

export const updateCriminalCaseSchema = createCriminalCaseSchema
  .omit({ legalMatterId: true, clientId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createCriminalChargeSchema = z.object({
  criminalCaseId: uuid,
  chargeLabel: z.string().trim().min(1).max(300),
  legalBasisText: z.string().trim().max(8000).optional(),
  status: z.string().trim().min(1).max(40).default("draft"),
});

export const updateCriminalChargeSchema = createCriminalChargeSchema
  .omit({ criminalCaseId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createMedicalCaseSchema = z.object({
  legalMatterId: uuid,
  clientId: uuid,
  caseKind: z.string().trim().min(1).max(80).default("health_plan_denial"),
  confidentiality: z.enum(MATTER_EXTENSION_CONFIDENTIALITY).default("confidential"),
  status: z.string().trim().min(1).max(40).default("draft"),
  notes: z.string().trim().max(8000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateMedicalCaseSchema = createMedicalCaseSchema
  .omit({ legalMatterId: true, clientId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createAdministrativeLawCaseSchema = z.object({
  legalMatterId: uuid,
  administrativeProcessId: optionalUuid,
  caseKind: z.string().trim().min(1).max(80).default("other"),
  status: z.string().trim().min(1).max(40).default("draft"),
  notes: z.string().trim().max(8000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateAdministrativeLawCaseSchema = createAdministrativeLawCaseSchema
  .omit({ legalMatterId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createEstateCaseSchema = z.object({
  legalMatterId: uuid,
  clientId: uuid,
  deceasedName: z.string().trim().max(200).optional(),
  deathDate: optionalDatetime,
  inventoryKind: z.string().trim().min(1).max(80).default("inventory"),
  status: z.string().trim().min(1).max(40).default("draft"),
  notes: z.string().trim().max(8000).optional(),
});

export const updateEstateCaseSchema = createEstateCaseSchema
  .omit({ legalMatterId: true, clientId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createArbitrationCaseSchema = z.object({
  legalMatterId: uuid,
  institution: z.string().trim().max(200).optional(),
  rules: z.string().trim().max(200).optional(),
  seat: z.string().trim().max(200).optional(),
  language: z.string().trim().max(40).optional(),
  tribunalComposition: z.string().trim().max(500).optional(),
  claimantLabel: z.string().trim().max(200).optional(),
  respondentLabel: z.string().trim().max(200).optional(),
  arbitrationNumber: z.string().trim().max(120).optional(),
  status: z.string().trim().min(1).max(40).default("draft"),
  confidential: z.boolean().default(true),
  awardDate: optionalDatetime,
  awardDocumentId: optionalUuid,
  notes: z.string().trim().max(8000).optional(),
});

export const updateArbitrationCaseSchema = createArbitrationCaseSchema
  .omit({ legalMatterId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createMediationCaseSchema = z.object({
  legalMatterId: uuid,
  mediatorName: z.string().trim().max(200).optional(),
  institution: z.string().trim().max(200).optional(),
  status: z.string().trim().min(1).max(40).default("draft"),
  confidentiality: z.boolean().default(true),
  settlementReached: z.boolean().default(false),
  settlementDocumentId: optionalUuid,
  notes: z.string().trim().max(8000).optional(),
});

export const updateMediationCaseSchema = createMediationCaseSchema
  .omit({ legalMatterId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createFamilyRelationshipSchema = z.object({
  relationshipType: z.string().trim().min(1).max(80),
  partyALabel: z.string().trim().min(1).max(200),
  partyBLabel: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(4000).optional(),
});

export const createCustodyArrangementSchema = z.object({
  custodyType: z.string().trim().min(1).max(80).default("shared"),
  visitationNotes: z.string().trim().max(4000).optional(),
  status: z.string().trim().min(1).max(40).default("draft"),
});

export const createSupportObligationSchema = z.object({
  amountCents: cents.default(0),
  frequency: z.string().trim().min(1).max(40).default("monthly"),
  beneficiaryLabel: z.string().trim().max(200).optional(),
  status: z.string().trim().min(1).max(40).default("draft"),
});

export const createPropertyDivisionSchema = z.object({
  description: z.string().trim().min(1).max(4000),
  shareBasisPoints: z.number().int().min(0).max(10_000).optional(),
  status: z.string().trim().min(1).max(40).default("draft"),
});

export const createEstateAssetSchema = z.object({
  description: z.string().trim().min(1).max(4000),
  assetKind: z.string().trim().min(1).max(80).default("other"),
  estimatedValueCents: cents.optional(),
});

export const createEstateHeirSchema = z.object({
  displayName: z.string().trim().min(1).max(200),
  heirKind: z.string().trim().min(1).max(80).default("heir"),
  shareBasisPoints: z.number().int().min(0).max(10_000).optional(),
});

export const createEstateShareSchema = z.object({
  heirId: optionalUuid,
  assetId: optionalUuid,
  shareBasisPoints: z.number().int().min(0).max(10_000).default(0),
  amountCents: cents.optional(),
});

export const createRealEstateAssetSchema = z.object({
  registrationNumber: z.string().trim().max(120).optional(),
  addressSummary: z.string().trim().max(500).optional(),
  assetKind: z.string().trim().min(1).max(80).default("property"),
  status: z.string().trim().min(1).max(40).default("active"),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const createRealEstateCaseSchema = z.object({
  realEstateAssetId: optionalUuid,
  caseKind: z.string().trim().min(1).max(80).default("other"),
  status: z.string().trim().min(1).max(40).default("draft"),
  notes: z.string().trim().max(8000).optional(),
});

export const createEnvironmentalCaseSchema = z.object({
  caseKind: z.string().trim().min(1).max(80).default("licensing"),
  status: z.string().trim().min(1).max(40).default("draft"),
  notes: z.string().trim().max(8000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const createElectoralCaseSchema = z.object({
  caseKind: z.string().trim().min(1).max(80).default("other"),
  electionYear: z.number().int().min(1900).max(2100).optional(),
  status: z.string().trim().min(1).max(40).default("draft"),
  notes: z.string().trim().max(8000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const createSportsCaseSchema = z.object({
  athleteName: z.string().trim().max(200).optional(),
  clubName: z.string().trim().max(200).optional(),
  federationName: z.string().trim().max(200).optional(),
  caseKind: z.string().trim().min(1).max(80).default("other"),
  status: z.string().trim().min(1).max(40).default("draft"),
  notes: z.string().trim().max(8000).optional(),
});

export const createDigitalCaseSchema = z.object({
  caseKind: z.string().trim().min(1).max(80).default("lgpd"),
  status: z.string().trim().min(1).max(40).default("draft"),
  notes: z.string().trim().max(8000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const createInternationalCaseSchema = z.object({
  country: z.string().trim().max(80).optional(),
  jurisdiction: z.string().trim().max(200).optional(),
  applicableLaw: z.string().trim().max(200).optional(),
  language: z.string().trim().max(40).optional(),
  currency: z.string().trim().max(16).optional(),
  caseKind: z.string().trim().min(1).max(80).default("other"),
  status: z.string().trim().min(1).max(40).default("draft"),
  notes: z.string().trim().max(8000).optional(),
});

export const createCustodialMeasureSchema = z.object({
  measureType: z.string().trim().min(1).max(120),
  status: z.string().trim().min(1).max(40).default("active"),
  notes: z.string().trim().max(4000).optional(),
});

export const createSentencingInformationSchema = z.object({
  sentenceSummary: z.string().trim().max(8000).optional(),
  sentenceDate: optionalDatetime,
  status: z.string().trim().min(1).max(40).default("draft"),
});

export const matterExtensionListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const createLegalAreaFeatureByKeySchema = z.object({
  featureKey: z.string().trim().min(1).max(80),
  active: z.boolean().default(true),
  configuration: z.record(z.string(), z.unknown()).optional(),
});

export const legalAreaModuleKeyParamSchema = z.enum(LEGAL_AREA_MODULE_KEYS);
