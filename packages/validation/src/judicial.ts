import { z } from "zod";
import { cnjNumberSchema } from "./cnj.js";

const uuidSchema = z.string().uuid("O identificador não é válido.");

const judicialProcessStatus = z.enum(["active", "suspended", "closed", "archived"]);
const confidentialityLevel = z.enum(["public", "restricted", "secret"]);
const partyRole = z.enum([
  "author",
  "defendant",
  "appellant",
  "appellee",
  "exequente",
  "executado",
  "impetrante",
  "coatora",
  "third_party",
  "interested",
  "other",
]);
const partySide = z.enum(["active", "passive", "neutral", "other"]);
const lawyerRepresentation = z.enum([
  "counsel",
  "correspondent",
  "public_defender",
  "prosecutor",
  "other",
]);
const hearingType = z.enum(["conciliation", "instruction", "judgment", "una", "other"]);
const hearingStatus = z.enum(["scheduled", "confirmed", "rescheduled", "held", "cancelled"]);
const hearingLocation = z.enum(["in_person", "remote", "hybrid", "undetermined"]);
const decisionType = z.enum(["interlocutory", "sentence", "acordao", "despacho", "other"]);
const appealStatus = z.enum([
  "draft",
  "planned",
  "filed",
  "pending",
  "decided",
  "withdrawn",
  "not_filed",
]);
const enforcementType = z.enum(["compliance", "execution", "provisional", "other"]);
const enforcementStatus = z.enum(["planned", "active", "suspended", "ended"]);

const optionalUuid = uuidSchema.optional();
const nullableUuid = uuidSchema.nullable().optional();
const datetime = z.string().datetime();

export const createJudicialProcessSchema = z.object({
  cnjNumber: cnjNumberSchema,
  tribunalId: uuidSchema,
  courtUnitId: optionalUuid,
  courtUnitText: z.string().trim().max(200).optional(),
  districtId: optionalUuid,
  districtText: z.string().trim().max(200).optional(),
  proceduralClassId: optionalUuid,
  primarySubjectId: optionalUuid,
  subjectIds: z.array(uuidSchema).max(20).optional(),
  currentPhaseId: optionalUuid,
  filingDate: datetime.optional(),
  distributionDate: datetime.optional(),
  confidentialityLevel: confidentialityLevel.optional(),
  source: z.literal("manual").optional(),
  sourceReference: z.string().trim().max(200).optional(),
});

export const updateJudicialProcessSchema = z
  .object({
    tribunalId: optionalUuid,
    courtUnitId: nullableUuid,
    courtUnitText: z.string().trim().max(200).nullable().optional(),
    districtId: nullableUuid,
    districtText: z.string().trim().max(200).nullable().optional(),
    proceduralClassId: nullableUuid,
    primarySubjectId: nullableUuid,
    subjectIds: z.array(uuidSchema).max(20).optional(),
    filingDate: datetime.nullable().optional(),
    distributionDate: datetime.nullable().optional(),
    confidentialityLevel: confidentialityLevel.optional(),
    status: z.enum(["active", "suspended"]).optional(),
    sourceReference: z.string().trim().max(200).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const judicialProcessListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: judicialProcessStatus.optional(),
  tribunalId: optionalUuid,
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const closeJudicialProcessSchema = z.object({
  closureReason: z.string().trim().min(1).max(500).optional(),
  closureNotes: z.string().trim().max(4000).optional(),
});

export const reopenJudicialProcessSchema = z.object({
  notes: z.string().trim().max(4000).optional(),
});

export const changeJudicialPhaseSchema = z.object({
  phaseId: uuidSchema,
  notes: z.string().trim().max(2000).optional(),
});

export const createJudicialPartySchema = z.object({
  displayName: z.string().trim().min(1).max(200),
  proceduralRole: partyRole.default("other"),
  side: partySide.default("other"),
  matterPartyId: optionalUuid,
  clientId: optionalUuid,
  contactId: optionalUuid,
  documentNormalized: z.string().trim().max(40).optional(),
  isPrimary: z.boolean().optional(),
  active: z.boolean().optional(),
});

export const updateJudicialPartySchema = createJudicialPartySchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createJudicialLawyerSchema = z.object({
  displayName: z.string().trim().min(1).max(200),
  partyId: optionalUuid,
  userId: optionalUuid,
  professionalProfileId: optionalUuid,
  oabNumber: z.string().trim().max(20).optional(),
  oabState: z.string().trim().max(2).optional(),
  representationType: lawyerRepresentation.default("counsel"),
  active: z.boolean().optional(),
  source: z.literal("manual").optional(),
});

export const updateJudicialLawyerSchema = createJudicialLawyerSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createJudicialMovementSchema = z.object({
  occurredAt: datetime,
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(8000).optional(),
  movementCode: z.string().trim().max(60).optional(),
  sequence: z.number().int().min(0).max(1_000_000).optional(),
  source: z.literal("manual").optional(),
  sourceReference: z.string().trim().max(200).optional(),
});

export const createJudicialHearingSchema = z.object({
  type: hearingType.default("other"),
  scheduledAt: datetime,
  timezone: z.string().trim().min(2).max(64).default("America/Sao_Paulo"),
  locationType: hearingLocation.default("undetermined"),
  locationText: z.string().trim().max(500).optional(),
  meetingUrl: z.string().trim().max(500).optional(),
  status: hearingStatus.default("scheduled"),
  notes: z.string().trim().max(4000).optional(),
  resultSummary: z.string().trim().max(4000).optional(),
  source: z.literal("manual").optional(),
});

export const updateJudicialHearingSchema = z
  .object({
    type: hearingType.optional(),
    scheduledAt: datetime.optional(),
    timezone: z.string().trim().min(2).max(64).optional(),
    locationType: hearingLocation.optional(),
    locationText: z.string().trim().max(500).nullable().optional(),
    meetingUrl: z.string().trim().max(500).nullable().optional(),
    status: hearingStatus.optional(),
    notes: z.string().trim().max(4000).nullable().optional(),
    resultSummary: z.string().trim().max(4000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createJudicialDecisionSchema = z.object({
  decisionType: decisionType.default("other"),
  decidedAt: datetime.optional(),
  publishedAt: datetime.optional(),
  title: z.string().trim().min(1).max(300),
  summary: z.string().trim().max(8000).optional(),
  outcome: z.string().trim().max(2000).optional(),
  source: z.literal("manual").optional(),
  sourceReference: z.string().trim().max(200).optional(),
});

export const createJudicialAppealSchema = z
  .object({
    appealType: z.string().trim().min(1).max(120),
    parentDecisionId: optionalUuid,
    appellantPartyId: optionalUuid,
    appelleePartyId: optionalUuid,
    filedAt: datetime.optional(),
    protocolReference: z.string().trim().max(200).optional(),
    status: appealStatus.default("draft"),
    resultDecisionId: optionalUuid,
    source: z.literal("manual").optional(),
  })
  .superRefine((value, ctx) => {
    if (value.status === "filed" && !value.protocolReference?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe a referência de protocolo ao registrar recurso como protocolado.",
        path: ["protocolReference"],
      });
    }
  });

export const updateJudicialAppealSchema = z
  .object({
    appealType: z.string().trim().min(1).max(120).optional(),
    parentDecisionId: nullableUuid,
    appellantPartyId: nullableUuid,
    appelleePartyId: nullableUuid,
    filedAt: datetime.nullable().optional(),
    protocolReference: z.string().trim().max(200).nullable().optional(),
    status: appealStatus.optional(),
    resultDecisionId: nullableUuid,
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createJudicialEnforcementSchema = z.object({
  type: enforcementType.default("compliance"),
  status: enforcementStatus.default("planned"),
  startedAt: datetime.optional(),
  endedAt: datetime.optional(),
  summary: z.string().trim().max(4000).optional(),
  source: z.literal("manual").optional(),
});

export const updateJudicialEnforcementSchema = z
  .object({
    type: enforcementType.optional(),
    status: enforcementStatus.optional(),
    startedAt: datetime.optional(),
    endedAt: datetime.nullable().optional(),
    summary: z.string().trim().max(4000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });
