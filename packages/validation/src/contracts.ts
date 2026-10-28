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
const emailOptional = z
  .string()
  .trim()
  .email("Informe um e-mail válido.")
  .max(320)
  .optional()
  .or(z.literal(""))
  .transform((v) => (v === "" ? undefined : v));

export const CONTRACT_STATUSES = [
  "draft",
  "internal_review",
  "pending_approval",
  "approved",
  "pending_signature",
  "partially_signed",
  "signed",
  "active",
  "expiring",
  "expired",
  "terminated",
  "cancelled",
  "archived",
] as const;
export const CONTRACT_RENEWAL_TYPES = ["automatic", "manual", "none"] as const;
export const CONTRACT_VERSION_STATUSES = [
  "draft",
  "in_review",
  "approved",
  "signed",
  "superseded",
  "cancelled",
] as const;
export const CONTRACT_PARTY_ROLES = [
  "contractor",
  "contractee",
  "buyer",
  "seller",
  "lessor",
  "lessee",
  "provider",
  "customer",
  "partner",
  "guarantor",
  "witness",
  "other",
] as const;
export const CONTRACT_APPROVAL_TYPES = ["single", "sequential", "parallel", "dual"] as const;
export const CONTRACT_APPROVAL_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;
export const SIGNATURE_REQUEST_STATUSES = [
  "draft",
  "ready",
  "sent",
  "viewed",
  "partially_signed",
  "signed",
  "declined",
  "expired",
  "cancelled",
  "failed",
  "not_configured",
] as const;
export const SIGNATURE_SIGNER_STATUSES = [
  "pending",
  "notified",
  "viewed",
  "signed",
  "declined",
  "expired",
  "cancelled",
] as const;
export const SIGNATURE_METHODS = ["provider", "manual", "wet_ink", "other"] as const;
export const CONTRACT_RENEWAL_STATUSES = [
  "draft",
  "notice_pending",
  "proposed",
  "approved",
  "completed",
  "cancelled",
  "expired",
] as const;
export const CONTRACT_OBLIGATION_STATUSES = [
  "open",
  "pending",
  "fulfilled",
  "overdue",
  "waived",
  "cancelled",
] as const;
export const CONTRACT_TERMINATION_TYPES = [
  "mutual",
  "unilateral",
  "breach",
  "expiration",
  "other",
] as const;
export const CONTRACT_TERMINATION_STATUSES = [
  "draft",
  "notice_pending",
  "notice_sent",
  "under_negotiation",
  "approved",
  "effective",
  "cancelled",
  "disputed",
] as const;
export const CONTRACT_AMENDMENT_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "pending_signature",
  "signed",
  "effective",
  "cancelled",
] as const;
export const CONTRACT_CLAUSE_SOURCES = ["system", "organization"] as const;

export const createContractSchema = z.object({
  title: z.string().trim().min(2).max(300),
  legalMatterId: optionalUuid,
  clientId: optionalUuid,
  contractTemplateId: optionalUuid,
  contractType: z.string().trim().min(1).max(80).default("other"),
  status: z.enum(CONTRACT_STATUSES).default("draft"),
  effectiveDate: optionalDatetime,
  expirationDate: nullableDatetime,
  indefiniteTerm: z.boolean().default(false),
  renewalType: z.enum(CONTRACT_RENEWAL_TYPES).default("none"),
  renewalNoticeDays: z.number().int().min(0).max(3650).optional(),
  governingLaw: z.string().trim().max(200).optional(),
  jurisdiction: z.string().trim().max(200).optional(),
  currency: z.string().trim().length(3).default("BRL"),
  totalValueCents: cents.optional(),
  sourceDraftId: optionalUuid,
});

export const updateContractSchema = createContractSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const contractListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  clientId: optionalUuid,
  legalMatterId: optionalUuid,
  status: z.enum(CONTRACT_STATUSES).optional(),
  contractType: z.string().trim().max(80).optional(),
  expiringBefore: optionalDatetime,
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const createContractVersionSchema = z.object({
  contractId: uuid,
  sourceDraftId: optionalUuid,
  documentId: optionalUuid,
  documentVersionId: optionalUuid,
  contentSnapshot: z.string().trim().max(500_000).optional(),
  clauseSnapshot: z.array(z.unknown()).optional(),
  status: z.enum(CONTRACT_VERSION_STATUSES).default("draft"),
});

export const updateContractVersionSchema = z
  .object({
    sourceDraftId: nullableUuid,
    documentId: nullableUuid,
    documentVersionId: nullableUuid,
    contentSnapshot: z.string().trim().max(500_000).nullable().optional(),
    clauseSnapshot: z.array(z.unknown()).nullable().optional(),
    status: z.enum(CONTRACT_VERSION_STATUSES).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const contractVersionListQuerySchema = z.object({
  contractId: optionalUuid,
  status: z.enum(CONTRACT_VERSION_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const createContractPartySchema = z.object({
  contractId: uuid,
  partyRole: z.enum(CONTRACT_PARTY_ROLES).default("other"),
  displayName: z.string().trim().min(1).max(200),
  documentReference: z.string().trim().max(80).optional(),
  representative: z.string().trim().max(200).optional(),
  clientId: optionalUuid,
  signingOrder: z.number().int().min(1).max(100).default(1),
  signerRequired: z.boolean().default(true),
  email: emailOptional,
  phone: z.string().trim().max(40).optional(),
});

export const updateContractPartySchema = createContractPartySchema
  .omit({ contractId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const contractPartyListQuerySchema = z.object({
  contractId: optionalUuid,
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const createContractClauseSchema = z.object({
  key: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(80).default("general"),
  content: z.string().trim().min(1).max(100_000),
  version: z.string().trim().min(1).max(40).default("1"),
  source: z.enum(CONTRACT_CLAUSE_SOURCES).default("organization"),
  active: z.boolean().default(true),
  riskLevel: z.string().trim().max(40).optional(),
  locked: z.boolean().optional(),
});

export const updateContractClauseSchema = createContractClauseSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const contractClauseListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.string().trim().max(80).optional(),
  active: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const createContractClauseInstanceSchema = z.object({
  contractVersionId: uuid,
  clauseId: optionalUuid,
  sortOrder: z.number().int().min(0).max(10_000).default(0),
  key: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(200),
  contentSnapshot: z.string().trim().min(1).max(100_000),
  variablesSnapshot: z.record(z.string(), z.unknown()).optional(),
  negotiated: z.boolean().default(false),
});

export const createContractApprovalPolicySchema = z.object({
  name: z.string().trim().min(2).max(200),
  approvalType: z.enum(CONTRACT_APPROVAL_TYPES).default("single"),
  minValueCents: cents.optional(),
  contractType: z.string().trim().max(80).optional(),
  department: z.string().trim().max(120).optional(),
  riskLevel: z.string().trim().max(40).optional(),
  requireSecondApprover: z.boolean().default(false),
  active: z.boolean().default(true),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateContractApprovalPolicySchema = createContractApprovalPolicySchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createContractApprovalSchema = z.object({
  contractId: uuid,
  contractVersionId: uuid,
  approverMembershipId: uuid,
  approvalType: z.enum(CONTRACT_APPROVAL_TYPES).default("single"),
  status: z.enum(CONTRACT_APPROVAL_STATUSES).default("pending"),
  comment: z.string().trim().max(4000).optional(),
  sequenceOrder: z.number().int().min(1).max(100).default(1),
});

export const updateContractApprovalSchema = z
  .object({
    status: z.enum(CONTRACT_APPROVAL_STATUSES).optional(),
    comment: z.string().trim().max(4000).nullable().optional(),
    decidedAt: optionalDatetime,
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const contractApprovalListQuerySchema = z.object({
  contractId: optionalUuid,
  contractVersionId: optionalUuid,
  status: z.enum(CONTRACT_APPROVAL_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const createSignatureRequestSchema = z.object({
  contractId: uuid,
  contractVersionId: uuid,
  providerKey: z.string().trim().min(1).max(80).default("not_configured"),
  externalEnvelopeId: z.string().trim().max(200).optional(),
  status: z.enum(SIGNATURE_REQUEST_STATUSES).default("draft"),
  expiresAt: optionalDatetime,
  evidenceDocumentId: optionalUuid,
  certificateMetadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateSignatureRequestSchema = z
  .object({
    providerKey: z.string().trim().min(1).max(80).optional(),
    externalEnvelopeId: z.string().trim().max(200).nullable().optional(),
    status: z.enum(SIGNATURE_REQUEST_STATUSES).optional(),
    sentAt: optionalDatetime,
    completedAt: optionalDatetime,
    expiresAt: nullableDatetime,
    evidenceDocumentId: nullableUuid,
    certificateMetadata: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const signatureRequestListQuerySchema = z.object({
  contractId: optionalUuid,
  status: z.enum(SIGNATURE_REQUEST_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const createSignatureSignerSchema = z.object({
  signatureRequestId: uuid,
  contractPartyId: optionalUuid,
  name: z.string().trim().min(1).max(200),
  email: emailOptional,
  phone: z.string().trim().max(40).optional(),
  signingOrder: z.number().int().min(1).max(100).default(1),
  status: z.enum(SIGNATURE_SIGNER_STATUSES).default("pending"),
});

export const createManualSignatureRecordSchema = z.object({
  contractId: uuid,
  contractVersionId: uuid,
  contractPartyId: optionalUuid,
  signedAt: datetime,
  evidenceDocumentId: uuid,
  method: z.enum(SIGNATURE_METHODS).default("manual"),
  notes: z.string().trim().max(4000).optional(),
});

export const createContractRenewalSchema = z.object({
  contractId: uuid,
  renewalType: z.enum(CONTRACT_RENEWAL_TYPES).default("manual"),
  noticeDate: optionalDatetime,
  proposedNewExpiration: optionalDatetime,
  status: z.enum(CONTRACT_RENEWAL_STATUSES).default("draft"),
  documentId: optionalUuid,
  approvalId: optionalUuid,
  notes: z.string().trim().max(4000).optional(),
});

export const updateContractRenewalSchema = createContractRenewalSchema
  .omit({ contractId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const contractRenewalListQuerySchema = z.object({
  contractId: optionalUuid,
  status: z.enum(CONTRACT_RENEWAL_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const createContractObligationSchema = z.object({
  contractId: uuid,
  contractPartyId: optionalUuid,
  sourceClauseInstanceId: optionalUuid,
  description: z.string().trim().min(1).max(4000),
  dueDate: optionalDatetime,
  recurrence: z.string().trim().max(80).optional(),
  amountCents: cents.optional(),
  status: z.enum(CONTRACT_OBLIGATION_STATUSES).default("open"),
});

export const updateContractObligationSchema = createContractObligationSchema
  .omit({ contractId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const contractObligationListQuerySchema = z.object({
  contractId: optionalUuid,
  status: z.enum(CONTRACT_OBLIGATION_STATUSES).optional(),
  fromDueDate: optionalDatetime,
  toDueDate: optionalDatetime,
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const createContractTerminationSchema = z.object({
  contractId: uuid,
  terminationType: z.enum(CONTRACT_TERMINATION_TYPES).default("other"),
  requestedAt: datetime,
  effectiveAt: optionalDatetime,
  reason: z.string().trim().max(4000).optional(),
  noticePeriodDays: z.number().int().min(0).max(3650).optional(),
  penaltyCents: cents.optional(),
  status: z.enum(CONTRACT_TERMINATION_STATUSES).default("draft"),
  sourceDocumentId: optionalUuid,
});

export const updateContractTerminationSchema = createContractTerminationSchema
  .omit({ contractId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const contractTerminationListQuerySchema = z.object({
  contractId: optionalUuid,
  status: z.enum(CONTRACT_TERMINATION_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const createContractAmendmentSchema = z.object({
  parentContractId: uuid,
  amendmentType: z.string().trim().min(1).max(80).default("other"),
  effectiveDate: optionalDatetime,
  changedClauses: z.array(z.unknown()).optional(),
  documentId: optionalUuid,
  approvalStatus: z.enum(CONTRACT_APPROVAL_STATUSES).default("pending"),
  signatureStatus: z.enum(SIGNATURE_REQUEST_STATUSES).default("draft"),
  status: z.enum(CONTRACT_AMENDMENT_STATUSES).default("draft"),
  notes: z.string().trim().max(4000).optional(),
});

export const updateContractAmendmentSchema = createContractAmendmentSchema
  .omit({ parentContractId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createContractTemplateSchema = z.object({
  title: z.string().trim().min(2).max(300),
  legalDocumentTemplateId: optionalUuid,
  contractType: z.string().trim().min(1).max(80).default("other"),
  active: z.boolean().default(true),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateContractTemplateSchema = createContractTemplateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const contractTemplateListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  active: z.coerce.boolean().optional(),
  contractType: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});
