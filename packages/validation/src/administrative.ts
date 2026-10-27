import { z } from "zod";

const uuidSchema = z.string().uuid("O identificador não é válido.");
const optionalUuid = uuidSchema.optional();
const nullableUuid = uuidSchema.nullable().optional();
const datetime = z.string().datetime();

const processStatus = z.enum([
  "draft",
  "active",
  "waiting_body",
  "waiting_client",
  "requirement_open",
  "under_analysis",
  "decided",
  "appeal",
  "suspended",
  "closed",
  "archived",
]);

const priority = z.enum(["low", "normal", "high", "urgent"]);
const dataSource = z.literal("manual");
const protocolSource = z.enum(["manual", "document", "import"]);

const requestStatus = z.enum([
  "draft",
  "review",
  "approved",
  "ready_to_submit",
  "submitted",
  "confirmed",
  "rejected",
  "cancelled",
]);

const requirementStatus = z.enum([
  "open",
  "in_progress",
  "responded",
  "accepted",
  "not_applicable",
  "cancelled",
  "overdue",
]);

const deadlineStatus = z.enum([
  "suggested",
  "pending_confirmation",
  "confirmed",
  "completed",
  "cancelled",
]);

const appealStatus = z.enum([
  "draft",
  "review",
  "approved",
  "ready_to_file",
  "filed",
  "confirmed",
  "decided",
  "withdrawn",
  "cancelled",
]);

function refineSubmittedRequest(
  value: {
    status?: string;
    submittedAt?: string | null;
    protocolNumber?: string | null;
    justification?: string | null;
    source?: string;
  },
  ctx: z.RefinementCtx,
) {
  if (value.status !== "submitted") return;
  if (!value.submittedAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Informe a data de protocolo/envio ao registrar como submetido.",
      path: ["submittedAt"],
    });
  }
  const hasProtocol = Boolean(value.protocolNumber?.trim());
  const hasJustification = Boolean(value.justification?.trim());
  if (!hasProtocol && !hasJustification) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Informe o número de protocolo ou uma justificativa ao registrar o envio.",
      path: ["protocolNumber"],
    });
  }
  if (value.source !== undefined && value.source !== "manual") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Sem integração com o órgão, o envio só pode ser registrado como manual.",
      path: ["source"],
    });
  }
}

export const createAdministrativeProcessSchema = z.object({
  administrativeBodyId: uuidSchema,
  subject: z.string().trim().min(1).max(300),
  description: z.string().trim().max(8000).optional(),
  number: z.string().trim().min(1).max(120).optional(),
  protocolNumber: z.string().trim().max(120).optional(),
  protocolDate: datetime.optional(),
  protocolSource: protocolSource.optional(),
  protocolReference: z.string().trim().max(200).optional(),
  externalReference: z.string().trim().max(200).optional(),
  status: z
    .enum([
      "draft",
      "active",
      "waiting_body",
      "waiting_client",
      "requirement_open",
      "under_analysis",
    ])
    .optional(),
  currentPhase: z.string().trim().max(120).optional(),
  priority: priority.optional(),
  filedAt: datetime.optional(),
  startedAt: datetime.optional(),
  responsibleMembershipId: optionalUuid,
  source: dataSource.optional(),
  sourceReference: z.string().trim().max(200).optional(),
});

export const updateAdministrativeProcessSchema = z
  .object({
    administrativeBodyId: optionalUuid,
    subject: z.string().trim().min(1).max(300).optional(),
    description: z.string().trim().max(8000).nullable().optional(),
    number: z.string().trim().min(1).max(120).nullable().optional(),
    protocolNumber: z.string().trim().max(120).nullable().optional(),
    protocolDate: datetime.nullable().optional(),
    protocolSource: protocolSource.nullable().optional(),
    protocolReference: z.string().trim().max(200).nullable().optional(),
    externalReference: z.string().trim().max(200).nullable().optional(),
    status: z
      .enum([
        "draft",
        "active",
        "waiting_body",
        "waiting_client",
        "requirement_open",
        "under_analysis",
        "decided",
        "appeal",
        "suspended",
      ])
      .optional(),
    currentPhase: z.string().trim().max(120).nullable().optional(),
    priority: priority.optional(),
    filedAt: datetime.nullable().optional(),
    startedAt: datetime.nullable().optional(),
    responsibleMembershipId: nullableUuid,
    sourceReference: z.string().trim().max(200).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const administrativeProcessListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: processStatus.optional(),
  administrativeBodyId: optionalUuid,
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const closeAdministrativeProcessSchema = z.object({
  closureReason: z.string().trim().min(1).max(500).optional(),
  closureNotes: z.string().trim().max(4000).optional(),
});

export const reopenAdministrativeProcessSchema = z.object({
  notes: z.string().trim().max(4000).optional(),
});

export const createAdministrativeRequestSchema = z
  .object({
    requestType: z.string().trim().min(1).max(120),
    title: z.string().trim().min(1).max(300),
    description: z.string().trim().max(8000).optional(),
    status: requestStatus.default("draft"),
    requestedAt: datetime.optional(),
    submittedAt: datetime.optional(),
    protocolNumber: z.string().trim().max(120).optional(),
    protocolReference: z.string().trim().max(200).optional(),
    justification: z.string().trim().max(4000).optional(),
    source: dataSource.optional(),
  })
  .superRefine(refineSubmittedRequest);

export const updateAdministrativeRequestSchema = z
  .object({
    requestType: z.string().trim().min(1).max(120).optional(),
    title: z.string().trim().min(1).max(300).optional(),
    description: z.string().trim().max(8000).nullable().optional(),
    status: requestStatus.optional(),
    requestedAt: datetime.nullable().optional(),
    submittedAt: datetime.nullable().optional(),
    protocolNumber: z.string().trim().max(120).nullable().optional(),
    protocolReference: z.string().trim().max(200).nullable().optional(),
    justification: z.string().trim().max(4000).nullable().optional(),
    source: dataSource.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." })
  .superRefine(refineSubmittedRequest);

export const createAdministrativeRequirementSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(8000).optional(),
  relatedRequestId: optionalUuid,
  issuedAt: datetime.optional(),
  dueAt: datetime.optional(),
  status: requirementStatus.default("open"),
  source: dataSource.optional(),
  sourceReference: z.string().trim().max(200).optional(),
  respondedAt: datetime.optional(),
  responseSummary: z.string().trim().max(8000).optional(),
  responsibleMembershipId: optionalUuid,
});

export const updateAdministrativeRequirementSchema = z
  .object({
    title: z.string().trim().min(1).max(300).optional(),
    description: z.string().trim().max(8000).nullable().optional(),
    relatedRequestId: nullableUuid,
    issuedAt: datetime.nullable().optional(),
    dueAt: datetime.nullable().optional(),
    status: requirementStatus.optional(),
    sourceReference: z.string().trim().max(200).nullable().optional(),
    respondedAt: datetime.nullable().optional(),
    responseSummary: z.string().trim().max(8000).nullable().optional(),
    responsibleMembershipId: nullableUuid,
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createAdministrativeDeadlineSchema = z.object({
  title: z.string().trim().min(1).max(300),
  dueAt: datetime,
  timezone: z.string().trim().min(2).max(64).default("America/Sao_Paulo"),
  status: deadlineStatus.default("suggested"),
  requirementId: optionalUuid,
  calculationSource: z.string().trim().min(1).max(80).default("manual"),
  calculationNotes: z.string().trim().max(4000).optional(),
});

export const updateAdministrativeDeadlineSchema = z
  .object({
    title: z.string().trim().min(1).max(300).optional(),
    dueAt: datetime.optional(),
    timezone: z.string().trim().min(2).max(64).optional(),
    status: deadlineStatus.optional(),
    requirementId: nullableUuid,
    calculationSource: z.string().trim().min(1).max(80).optional(),
    calculationNotes: z.string().trim().max(4000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createAdministrativeDecisionSchema = z.object({
  decisionType: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(300),
  summary: z.string().trim().max(8000).optional(),
  outcome: z.string().trim().max(2000).optional(),
  relatedRequestId: optionalUuid,
  decidedAt: datetime.optional(),
  notifiedAt: datetime.optional(),
  source: dataSource.optional(),
  sourceReference: z.string().trim().max(200).optional(),
  documentId: optionalUuid,
});

export const updateAdministrativeDecisionSchema = z
  .object({
    decisionType: z.string().trim().min(1).max(120).optional(),
    title: z.string().trim().min(1).max(300).optional(),
    summary: z.string().trim().max(8000).nullable().optional(),
    outcome: z.string().trim().max(2000).nullable().optional(),
    relatedRequestId: nullableUuid,
    decidedAt: datetime.nullable().optional(),
    notifiedAt: datetime.nullable().optional(),
    sourceReference: z.string().trim().max(200).nullable().optional(),
    documentId: nullableUuid,
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createAdministrativeAppealSchema = z
  .object({
    appealType: z.string().trim().min(1).max(120),
    title: z.string().trim().min(1).max(300),
    summary: z.string().trim().max(8000).optional(),
    parentDecisionId: optionalUuid,
    status: appealStatus.default("draft"),
    deadlineId: optionalUuid,
    filedAt: datetime.optional(),
    protocolNumber: z.string().trim().max(120).optional(),
    source: dataSource.optional(),
    documentId: optionalUuid,
  })
  .superRefine((value, ctx) => {
    if (value.status === "filed" && !value.protocolNumber?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe o número de protocolo ao registrar o recurso como protocolado.",
        path: ["protocolNumber"],
      });
    }
  });

export const updateAdministrativeAppealSchema = z
  .object({
    appealType: z.string().trim().min(1).max(120).optional(),
    title: z.string().trim().min(1).max(300).optional(),
    summary: z.string().trim().max(8000).nullable().optional(),
    parentDecisionId: nullableUuid,
    status: appealStatus.optional(),
    deadlineId: nullableUuid,
    filedAt: datetime.nullable().optional(),
    protocolNumber: z.string().trim().max(120).nullable().optional(),
    documentId: nullableUuid,
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });
