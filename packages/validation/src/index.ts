import { AppError, SYSTEM_ROLE_KEYS, type FieldIssue } from "@verasjuris/types";
import { z } from "zod";

const roleKey = z.enum(SYSTEM_ROLE_KEYS);

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Informe o e-mail.")
  .max(320, "O e-mail é longo demais.")
  .email("Informe um e-mail válido.")
  .transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string()
  .min(12, "A senha precisa ter pelo menos 12 caracteres.")
  .max(128, "A senha é longa demais.");

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, "Informe o nome com pelo menos 2 caracteres.")
  .max(80, "O nome pode ter no máximo 80 caracteres.");

export const organizationNameSchema = z
  .string()
  .trim()
  .min(2, "Informe o nome da organização com pelo menos 2 caracteres.")
  .max(120, "O nome da organização pode ter no máximo 120 caracteres.");

export const registerSchema = z.object({
  displayName: displayNameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe a senha.").max(128),
});

export const tokenSchema = z
  .string()
  .trim()
  .min(20, "O token informado não é válido.")
  .max(200, "O token informado não é válido.");

export const emailOnlySchema = z.object({
  email: emailSchema,
});

export const confirmTokenSchema = z.object({
  token: tokenSchema,
});

export const passwordResetConfirmSchema = z.object({
  token: tokenSchema,
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Informe a senha atual.").max(128),
  newPassword: passwordSchema,
});

export const updateProfileSchema = z.object({
  displayName: displayNameSchema,
  locale: z.string().trim().min(2, "Informe o idioma.").max(16, "O idioma é longo demais."),
  timeZone: z
    .string()
    .trim()
    .min(2, "Informe o fuso horário.")
    .max(64, "O fuso horário é longo demais."),
});

export const createInvitationSchema = z.object({
  email: emailSchema,
  roleKey: z.enum(["administrator", "member"]).default("member"),
});

export const createOrganizationSchema = z.object({
  name: organizationNameSchema,
});

export const updateOrganizationSchema = z.object({
  name: organizationNameSchema,
});

export const addMemberSchema = z.object({
  email: emailSchema,
});

export const updateMembershipSchema = z
  .object({
    roleKeys: z
      .array(roleKey)
      .min(1, "Escolha ao menos um papel.")
      .max(3)
      .refine((keys) => new Set(keys).size === keys.length, {
        message: "Não informe o mesmo papel mais de uma vez.",
      })
      .optional(),
    status: z.enum(["active", "removed"]).optional(),
  })
  .refine((value) => value.roleKeys !== undefined || value.status !== undefined, {
    message: "Informe o papel ou a situação que deve mudar.",
    path: ["roleKeys"],
  });

export const uuidSchema = z.string().uuid("O identificador não é válido.");

export {
  digitsOnly,
  maskCnpj,
  maskCpf,
  normalizeCnpj,
  normalizeCpf,
} from "./documents.js";

const leadStatus = z.enum([
  "new",
  "contacted",
  "qualifying",
  "qualified",
  "unqualified",
  "converted",
  "archived",
]);

const personType = z.enum(["person", "organization"]);

const leadFieldsSchema = z.object({
  personType: personType.default("person"),
  name: z.string().trim().min(2).max(160),
  tradeName: z.string().trim().max(160).optional(),
  email: emailSchema
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" ? undefined : v)),
  phone: z.string().trim().max(40).optional(),
  summary: z.string().trim().max(2000).optional(),
  sourceId: uuidSchema.optional(),
  channelId: uuidSchema.optional(),
  ownerMembershipId: uuidSchema.optional(),
  tagIds: z.array(uuidSchema).max(20).optional(),
});

export const createLeadSchema = leadFieldsSchema.superRefine((value, ctx) => {
  if (value.personType === "organization" && !value.tradeName && value.name.length < 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Informe a razão social.",
      path: ["name"],
    });
  }
});

export const updateLeadSchema = leadFieldsSchema
  .partial()
  .extend({ status: leadStatus.optional() })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const createClientSchema = z.object({
  personType,
  fullName: z.string().trim().min(2).max(160).optional(),
  socialName: z.string().trim().max(160).optional(),
  cpf: z.string().trim().max(20).optional(),
  legalName: z.string().trim().min(2).max(160).optional(),
  tradeName: z.string().trim().max(160).optional(),
  cnpj: z.string().trim().max(22).optional(),
  email: emailSchema
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" ? undefined : v)),
  phone: z.string().trim().max(40).optional(),
  website: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(4000).optional(),
  sourceId: uuidSchema.optional(),
  channelId: uuidSchema.optional(),
  ownerMembershipId: uuidSchema.optional(),
  tagIds: z.array(uuidSchema).max(20).optional(),
});

export const updateClientSchema = createClientSchema
  .partial()
  .extend({
    status: z.enum(["active", "inactive", "archived"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const createTagSchema = z.object({
  name: z.string().trim().min(1).max(60),
  color: z.string().trim().max(20).optional(),
});

export const createNoteSchema = z.object({
  resourceType: z.enum(["lead", "client", "contact", "intake", "opportunity", "case"]),
  resourceId: uuidSchema,
  content: z.string().trim().min(1).max(8000),
  visibility: z.enum(["organization", "internal", "private"]).default("organization"),
});

export const createInteractionSchema = z.object({
  resourceType: z.enum(["lead", "client", "contact", "intake", "opportunity", "case"]),
  resourceId: uuidSchema,
  type: z.enum(["note", "call", "email", "meeting", "message"]),
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().max(8000).optional(),
});

const intakeStatus = z.enum([
  "open",
  "triage",
  "waiting_client",
  "under_review",
  "qualified",
  "not_qualified",
  "converted",
  "closed",
  "archived",
]);

const triageStatus = z.enum([
  "draft",
  "in_progress",
  "waiting_information",
  "ready_for_analysis",
  "reviewed",
  "closed",
]);

const intakeUrgency = z.enum(["normal", "attention", "urgent", "critical"]);
const serviceMode = z.enum(["online", "in_person", "phone", "video", "message", "other"]);

export const createIntakeSchema = z.object({
  title: z.string().trim().min(2).max(200),
  summary: z.string().trim().max(4000).optional(),
  leadId: uuidSchema.optional(),
  clientId: uuidSchema.optional(),
  contactId: uuidSchema.optional(),
  createLead: z
    .object({
      personType: personType.default("person"),
      name: z.string().trim().min(2).max(160),
      tradeName: z.string().trim().max(160).optional(),
      email: emailSchema
        .optional()
        .or(z.literal(""))
        .transform((v) => (v === "" ? undefined : v)),
      phone: z.string().trim().max(40).optional(),
    })
    .optional(),
  sourceId: uuidSchema.optional(),
  channelId: uuidSchema.optional(),
  legalAreaId: uuidSchema.optional(),
  serviceMode: serviceMode.default("online"),
  urgency: intakeUrgency.default("normal"),
  responsibleMembershipId: uuidSchema.optional(),
  preferredContactMethod: z.string().trim().max(80).optional(),
  externalReference: z.string().trim().max(120).optional(),
});

export const updateIntakeSchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    summary: z.string().trim().max(4000).optional(),
    status: intakeStatus.optional(),
    urgency: intakeUrgency.optional(),
    serviceMode: serviceMode.optional(),
    legalAreaId: uuidSchema.nullable().optional(),
    sourceId: uuidSchema.nullable().optional(),
    channelId: uuidSchema.nullable().optional(),
    responsibleMembershipId: uuidSchema.nullable().optional(),
    preferredContactMethod: z.string().trim().max(80).nullable().optional(),
    externalReference: z.string().trim().max(120).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const upsertTriageSchema = z.object({
  legalAreaId: uuidSchema.optional(),
  urgency: intakeUrgency.optional(),
  summary: z.string().trim().max(4000).optional(),
  facts: z.string().trim().max(8000).optional(),
  requestNeed: z.string().trim().max(4000).optional(),
  relevantDates: z.string().trim().max(2000).optional(),
  riskNotes: z.string().trim().max(4000).optional(),
  missingInformation: z.string().trim().max(4000).optional(),
  nextAction: z.string().trim().max(2000).optional(),
  responsibleMembershipId: uuidSchema.optional(),
  status: triageStatus.optional(),
});

export const createLegalAreaSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(500).optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});

export const registerIntakeDocumentSchema = z.object({
  filename: z.string().trim().min(1).max(200),
  status: z.enum(["pending", "received", "unavailable", "rejected"]).default("pending"),
  unavailableReason: z.string().trim().max(500).optional(),
  mimeType: z.string().trim().max(120).optional(),
  sizeBytes: z.number().int().min(0).max(50_000_000).optional(),
});

export const intakeListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: intakeStatus.optional(),
  urgency: intakeUrgency.optional(),
  legalAreaId: uuidSchema.optional(),
  responsibleMembershipId: uuidSchema.optional(),
  sourceId: uuidSchema.optional(),
  channelId: uuidSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
  sort: z.enum(["createdAt", "updatedAt", "startedAt", "urgency"]).default("updatedAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

const opportunityStage = z.enum([
  "lead",
  "intake",
  "triage",
  "analysis",
  "proposal",
  "contracting",
  "client",
  "case",
  "lost",
  "archived",
]);

export const createOpportunitySchema = z.object({
  title: z.string().trim().min(2).max(200),
  leadId: uuidSchema.optional(),
  intakeId: uuidSchema.optional(),
  legalAreaId: uuidSchema.optional(),
  responsibleMembershipId: uuidSchema.optional(),
  estimatedValueCents: z.number().int().min(0).max(100_000_000_000).optional(),
  currency: z.string().trim().length(3).default("BRL"),
});

export const updateOpportunitySchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    intakeId: uuidSchema.nullable().optional(),
    legalAreaId: uuidSchema.nullable().optional(),
    responsibleMembershipId: uuidSchema.nullable().optional(),
    estimatedValueCents: z.number().int().min(0).max(100_000_000_000).nullable().optional(),
    currency: z.string().trim().length(3).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const moveOpportunitySchema = z.object({
  stage: opportunityStage,
});

export const loseOpportunitySchema = z.object({
  lossReasonId: uuidSchema,
  lossNotes: z.string().trim().max(2000).optional(),
});

export const archiveOpportunitySchema = z.object({
  archiveReason: z.string().trim().max(2000).optional(),
});

export const upsertAnalysisSchema = z.object({
  summary: z.string().trim().max(4000).optional(),
  feasibilityNotes: z.string().trim().max(4000).optional(),
  riskNotes: z.string().trim().max(4000).optional(),
  missingInformation: z.string().trim().max(4000).optional(),
  recommendedNextStep: z.string().trim().max(2000).optional(),
  status: z.enum(["draft", "in_review", "completed"]).optional(),
});

export const createProposalSchema = z.object({
  title: z.string().trim().min(2).max(200),
  scope: z.string().trim().max(8000).optional(),
  exclusions: z.string().trim().max(4000).optional(),
  priceCents: z.number().int().min(0).max(100_000_000_000).default(0),
  currency: z.string().trim().length(3).default("BRL"),
  paymentTerms: z.string().trim().max(2000).optional(),
  validityUntil: z.string().datetime().optional(),
});

export const updateProposalSchema = createProposalSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: "Informe ao menos um campo.",
  });

export const createEngagementSchema = z.object({
  proposalId: uuidSchema.optional(),
  contractReference: z.string().trim().max(160).optional(),
});

const matterStatus = z.enum([
  "draft",
  "open",
  "active",
  "waiting",
  "suspended",
  "closed",
  "archived",
]);

const matterPriority = z.enum(["normal", "high", "urgent"]);

const matterPartyPosition = z.enum([
  "client",
  "opposing",
  "interested",
  "claimant",
  "respondent",
  "third_party",
  "beneficiary",
  "representative",
  "other",
]);

const matterPartyPersonType = z.enum(["person", "organization", "public_body", "other"]);

const matterTeamRole = z.enum([
  "responsible",
  "lawyer",
  "collaborator",
  "intern",
  "paralegal",
  "reviewer",
  "coordinator",
  "other",
]);

const matterFeeType = z.enum([
  "fixed",
  "success",
  "percentage",
  "hourly",
  "monthly",
  "hybrid",
  "pro_bono",
  "other",
]);

const matterFeeStatus = z.enum(["draft", "active", "superseded", "cancelled"]);

const centsSchema = z
  .number()
  .int("Informe um valor inteiro em centavos.")
  .min(0)
  .max(100_000_000_000);
const basisPointsSchema = z
  .number()
  .int("Informe basis points como inteiro (0–10000).")
  .min(0)
  .max(10_000);

export const createMatterSchema = z.object({
  title: z.string().trim().min(2).max(200),
  clientId: uuidSchema,
  summary: z.string().trim().max(4000).optional(),
  demandTypeId: uuidSchema.optional(),
  legalAreaId: uuidSchema.optional(),
  legalSubareaId: uuidSchema.optional(),
  priority: matterPriority.optional(),
  status: z.enum(["draft", "open", "active"]).optional(),
  responsibleMembershipId: uuidSchema.optional(),
  intakeId: uuidSchema.optional(),
  originatingOpportunityId: uuidSchema.optional(),
});

export const updateMatterSchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    summary: z.string().trim().max(4000).nullable().optional(),
    demandTypeId: uuidSchema.nullable().optional(),
    legalAreaId: uuidSchema.nullable().optional(),
    legalSubareaId: uuidSchema.nullable().optional(),
    priority: matterPriority.optional(),
    responsibleMembershipId: uuidSchema.nullable().optional(),
    intakeId: uuidSchema.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const matterListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  clientId: uuidSchema.optional(),
  responsibleMembershipId: uuidSchema.optional(),
  teamMembershipId: uuidSchema.optional(),
  legalAreaId: uuidSchema.optional(),
  legalSubareaId: uuidSchema.optional(),
  demandTypeId: uuidSchema.optional(),
  status: matterStatus.optional(),
  priority: matterPriority.optional(),
  tagId: uuidSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const createMatterPartySchema = z.object({
  displayName: z.string().trim().min(1).max(200),
  position: matterPartyPosition.default("other"),
  personType: matterPartyPersonType.default("person"),
  partyType: z.string().trim().min(1).max(60).default("party"),
  clientId: uuidSchema.optional(),
  contactId: uuidSchema.optional(),
  documentNormalized: z.string().trim().max(40).optional(),
  roleDescription: z.string().trim().max(500).optional(),
  isPrimary: z.boolean().optional(),
});

export const updateMatterPartySchema = createMatterPartySchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const addMatterTeamMemberSchema = z.object({
  membershipId: uuidSchema,
  teamRole: matterTeamRole.default("collaborator"),
  isPrimary: z.boolean().optional(),
});

export const createMatterFeeSchema = z.object({
  type: matterFeeType,
  fixedAmountCents: centsSchema.optional(),
  percentageBasisPoints: basisPointsSchema.optional(),
  hourlyRateCents: centsSchema.optional(),
  successFeeBasisPoints: basisPointsSchema.optional(),
  description: z.string().trim().max(2000).optional(),
  status: matterFeeStatus.optional(),
  effectiveFrom: z.string().datetime().optional(),
  effectiveUntil: z.string().datetime().optional(),
});

export const updateMatterFeeSchema = createMatterFeeSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const setMatterTagsSchema = z.object({
  tagIds: z.array(uuidSchema).max(20),
});

export const createDemandTypeSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(60).optional(),
  description: z.string().trim().max(1000).optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  active: z.boolean().optional(),
});

export const updateDemandTypeSchema = createDemandTypeSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createSubareaSchema = z.object({
  legalAreaId: uuidSchema,
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(60).optional(),
  description: z.string().trim().max(1000).optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  active: z.boolean().optional(),
});

export const updateSubareaSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    slug: z.string().trim().min(2).max(60).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const matterStatusTransitionSchema = z.object({
  status: matterStatus,
});

/** Compat pipeline — campos mínimos para abrir matter a partir da oportunidade. */
export const createCaseSchema = z.object({
  title: z.string().trim().min(2).max(200),
  summary: z.string().trim().max(4000).optional(),
  legalAreaId: uuidSchema.optional(),
  responsibleMembershipId: uuidSchema.optional(),
});

export const caseListQuerySchema = z.object({
  status: matterStatus.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const opportunityListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  stage: opportunityStage.optional(),
  status: z.enum(["active", "won", "lost", "archived"]).optional(),
  legalAreaId: uuidSchema.optional(),
  responsibleMembershipId: uuidSchema.optional(),
  sourceId: uuidSchema.optional(),
  channelId: uuidSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
  sort: z.enum(["createdAt", "updatedAt", "title"]).default("updatedAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export const lawyerProfileSchema = z.object({
  professionalName: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(4000).optional(),
  oabNumber: z.string().trim().max(20).optional(),
  oabUf: z.string().trim().max(2).optional(),
  oabSection: z.string().trim().max(80).optional(),
  oabSubsection: z.string().trim().max(80).optional(),
  declaredSituation: z.string().trim().max(80).optional(),
  practiceAreas: z.string().trim().max(1000).optional(),
  languages: z.string().trim().max(200).optional(),
  remoteAvailable: z.boolean().optional(),
  inPersonAvailable: z.boolean().optional(),
  serviceRegions: z.string().trim().max(500).optional(),
  visibility: z.enum(["public", "organization", "private", "internal"]).optional(),
});

export const partnerProfileSchema = z.object({
  category: z
    .enum([
      "correspondent",
      "accountant",
      "expert",
      "translator",
      "dispatcher",
      "teacher",
      "specialist",
      "supplier",
      "other",
    ])
    .optional(),
  presentation: z.string().trim().max(4000).optional(),
  services: z.string().trim().max(1000).optional(),
  regions: z.string().trim().max(500).optional(),
  remoteAvailable: z.boolean().optional(),
  inPersonAvailable: z.boolean().optional(),
  availabilityNotes: z.string().trim().max(1000).optional(),
  publicInfo: z.string().trim().max(2000).optional(),
  visibility: z.enum(["public", "organization", "private", "internal"]).optional(),
});

export const employeeProfileSchema = z.object({
  jobTitle: z.string().trim().min(2).max(120),
  department: z.string().trim().max(120).optional(),
  internalCode: z.string().trim().max(60).optional(),
  status: z.enum(["active", "inactive", "left"]).optional(),
  internalNotes: z.string().trim().max(2000).optional(),
});

export const contactsQuerySchema = z.object({
  clientId: uuidSchema.optional(),
  leadId: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const listQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.string().trim().max(40).optional(),
  sourceId: uuidSchema.optional(),
  channelId: uuidSchema.optional(),
  ownerMembershipId: uuidSchema.optional(),
  tagId: uuidSchema.optional(),
  personType: personType.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
  sort: z.enum(["createdAt", "updatedAt", "name"]).default("updatedAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export {
  cnjNumberSchema,
  computeCnjCheckDigits,
  formatCnjNumber,
  normalizeCnjNumber,
  validateCnjNumber,
  type CnjValidationResult,
} from "./cnj.js";

export {
  changeJudicialPhaseSchema,
  closeJudicialProcessSchema,
  createJudicialAppealSchema,
  createJudicialDecisionSchema,
  createJudicialEnforcementSchema,
  createJudicialHearingSchema,
  createJudicialLawyerSchema,
  createJudicialMovementSchema,
  createJudicialPartySchema,
  createJudicialProcessSchema,
  judicialProcessListQuerySchema,
  reopenJudicialProcessSchema,
  updateJudicialAppealSchema,
  updateJudicialEnforcementSchema,
  updateJudicialHearingSchema,
  updateJudicialLawyerSchema,
  updateJudicialPartySchema,
  updateJudicialProcessSchema,
} from "./judicial.js";

export {
  administrativeProcessListQuerySchema,
  closeAdministrativeProcessSchema,
  createAdministrativeAppealSchema,
  createAdministrativeDecisionSchema,
  createAdministrativeDeadlineSchema,
  createAdministrativeProcessSchema,
  createAdministrativeRequestSchema,
  createAdministrativeRequirementSchema,
  reopenAdministrativeProcessSchema,
  updateAdministrativeAppealSchema,
  updateAdministrativeDecisionSchema,
  updateAdministrativeDeadlineSchema,
  updateAdministrativeProcessSchema,
  updateAdministrativeRequestSchema,
  updateAdministrativeRequirementSchema,
} from "./administrative.js";

export {
  createDocumentAclSchema,
  createDocumentCategorySchema,
  createDocumentFolderSchema,
  createDocumentSchema,
  documentListQuerySchema,
  updateDocumentFolderSchema,
  updateDocumentSchema,
  uploadDocumentVersionFieldsSchema,
} from "./documents-domain.js";

export {
  addCalendarParticipantSchema,
  calculateDeadlineSchema,
  calendarListQuerySchema,
  changeDeadlineSchema,
  classifyDocumentSchema,
  confirmDeadlineSchema,
  createCalendarEventSchema,
  createChecklistItemSchema,
  createDeadlineAlertRuleSchema,
  createDeadlineEscalationRuleSchema,
  createDeadlineSchema,
  createDocumentLinkSchema,
  createSlaPolicySchema,
  createTaskCommentSchema,
  createTaskDependencySchema,
  createTaskSchema,
  deadlineListQuerySchema,
  dossierQuerySchema,
  linkHearingSchema,
  rescheduleCalendarEventSchema,
  taskListQuerySchema,
  updateCalendarEventSchema,
  updateChecklistItemSchema,
  updateDeadlineSchema,
  updateTaskSchema,
} from "./productivity.js";

export function slugifyName(value: string): string {
  const normalized = value.normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const slug = normalized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "organizacao";
}

export function parseInput<S extends z.ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const details: FieldIssue[] = parsed.error.issues.map((issue) => ({
      path: issue.path.map(String).join(".") || "body",
      message: issue.message,
    }));
    throw new AppError(
      "VALIDATION_ERROR",
      "Alguns campos precisam de correção. Nenhuma alteração foi confirmada.",
      details,
    );
  }
  return parsed.data;
}

export * from "./ai.js";
export * from "./legal-review.js";
export * from "./legal-research.js";
export * from "./citations.js";
export * from "./auctions.js";
export * from "./legal-templates.js";
export * from "./legal-drafts.js";
export * from "./legal-comparisons.js";
export * from "./auction-post-sale.js";
export * from "./previdentiary.js";
export * from "./labor.js";
export * from "./tax.js";
export * from "./contracts.js";
export * from "./legal-areas.js";
export * from "./client-portal.js";
export * from "./communication.js";
export * from "./online-lawyer.js";
export * from "./marketplace.js";
export * from "./professional-verification.js";
export * from "./diligence.js";
export * from "./extrajudicial.js";
export * from "./education.js";
export * from "./finance.js";
export * from "./monetization.js";
export * from "./control.js";
export * from "./analytics.js";
export * from "./workflows.js";

export * from "./security.js";
export * from "./privacy.js";
export * from "./enterprise.js";
export * from "./accessibility.js";
export * from "./assistant.js";
export * from "./integrations.js";
export * from "./i18n.js";
