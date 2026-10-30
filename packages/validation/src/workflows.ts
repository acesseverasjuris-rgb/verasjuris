import { z } from "zod";

const uuid = z.string().uuid("O identificador não é válido.");
const optionalUuid = uuid.optional();
const datetime = z.string().datetime({ offset: true });
const optionalDatetime = datetime.optional();

export const WORKFLOW_DEFINITION_STATUSES = ["draft", "published", "paused", "archived"] as const;

export const WORKFLOW_TRIGGER_TYPES = [
  "domain_event",
  "schedule",
  "manual",
  "webhook",
  "threshold",
  "state_change",
] as const;

export const WORKFLOW_CONDITION_OPERATORS = [
  "equals",
  "not_equals",
  "in",
  "not_in",
  "greater_than",
  "less_than",
  "exists",
  "not_exists",
  "and",
  "or",
] as const;

export const WORKFLOW_ACTION_TYPES = [
  "create_task",
  "create_notification",
  "send_communication",
  "request_approval",
  "create_deadline",
  "update_allowed_field",
  "create_document_request",
  "create_incident",
  "create_payable",
  "call_internal_service",
  "enqueue_job",
  "wait",
  "webhook_external",
] as const;

export const WORKFLOW_FAILURE_POLICIES = [
  "stop",
  "continue",
  "retry",
  "escalate",
  "wait_for_review",
] as const;

export const WORKFLOW_RUN_STATUSES = [
  "queued",
  "running",
  "waiting",
  "completed",
  "failed",
  "cancelled",
  "timed_out",
  "partially_completed",
] as const;

export const WORKFLOW_STEP_STATUSES = [
  "queued",
  "running",
  "waiting",
  "completed",
  "failed",
  "skipped",
  "cancelled",
  "timed_out",
] as const;

const listPagination = {
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
  q: z.string().trim().max(120).optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
};

const workflowKeySchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/, "Informe uma chave válida.");

const conditionNodeSchema: z.ZodType<{
  operator: (typeof WORKFLOW_CONDITION_OPERATORS)[number];
  field?: string;
  value?: unknown;
  children?: unknown[];
}> = z.lazy(() =>
  z.object({
    operator: z.enum(WORKFLOW_CONDITION_OPERATORS),
    field: z.string().trim().max(120).optional(),
    value: z.unknown().optional(),
    children: z.array(conditionNodeSchema).max(20).optional(),
  }),
);

const actionConfigSchema = z.object({
  type: z.enum(WORKFLOW_ACTION_TYPES),
  key: z.string().trim().min(1).max(80).optional(),
  params: z.record(z.unknown()).default({}),
  timeoutMs: z.number().int().min(100).max(3_600_000).optional(),
  maxAttempts: z.number().int().min(1).max(20).optional(),
  failurePolicy: z.enum(WORKFLOW_FAILURE_POLICIES).optional(),
  requiredPermission: z.string().trim().max(120).optional(),
});

const triggerConfigSchema = z.object({
  type: z.enum(WORKFLOW_TRIGGER_TYPES),
  eventName: z.string().trim().max(160).optional(),
  /** Expressão cron validada no serviço — aqui só tamanho/formato básico. */
  cron: z
    .string()
    .trim()
    .max(120)
    .regex(/^[\d*/,\-A-Za-z\s]+$/, "Informe uma expressão cron válida.")
    .optional(),
  webhookKey: z.string().trim().max(80).optional(),
  thresholdMetricKey: z.string().trim().max(120).optional(),
  config: z.record(z.unknown()).optional(),
});

export const createWorkflowDefinitionSchema = z.object({
  key: workflowKeySchema,
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(4000).optional(),
  domain: z.string().trim().max(80).optional(),
  organizationId: optionalUuid,
  trigger: triggerConfigSchema,
  conditions: conditionNodeSchema.optional(),
  actions: z.array(actionConfigSchema).min(1).max(50),
  activeFrom: optionalDatetime,
  activeUntil: optionalDatetime,
});

export const updateWorkflowDefinitionSchema = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    description: z.string().trim().max(4000).nullable().optional(),
    domain: z.string().trim().max(80).nullable().optional(),
    trigger: triggerConfigSchema.optional(),
    conditions: conditionNodeSchema.nullable().optional(),
    actions: z.array(actionConfigSchema).min(1).max(50).optional(),
    activeFrom: optionalDatetime.nullable(),
    activeUntil: optionalDatetime.nullable(),
    status: z.enum(["draft", "paused", "archived"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const publishWorkflowDefinitionSchema = z.object({
  notes: z.string().trim().max(2000).optional(),
});

export const pauseWorkflowDefinitionSchema = z.object({
  reason: z.string().trim().max(2000).optional(),
});

export const runWorkflowSchema = z.object({
  triggerReference: z.string().trim().max(200).optional(),
  payload: z.record(z.unknown()).optional(),
  dryRun: z.boolean().default(false),
  idempotencyKey: z.string().trim().min(8).max(200).optional(),
});

export const cancelWorkflowRunSchema = z.object({
  reason: z.string().trim().max(2000).optional(),
});

export const workflowDefinitionListQuerySchema = z.object({
  ...listPagination,
  status: z.enum(WORKFLOW_DEFINITION_STATUSES).optional(),
  domain: z.string().trim().max(80).optional(),
  organizationId: optionalUuid,
  sort: z.enum(["createdAt", "updatedAt", "name", "key"]).default("updatedAt"),
});

export const workflowRunListQuerySchema = z.object({
  ...listPagination,
  definitionId: optionalUuid,
  status: z.enum(WORKFLOW_RUN_STATUSES).optional(),
  triggerType: z.enum(WORKFLOW_TRIGGER_TYPES).optional(),
  from: optionalDatetime,
  to: optionalDatetime,
  sort: z.enum(["startedAt", "completedAt", "createdAt"]).default("startedAt"),
});

export const createWorkflowTemplateSchema = z.object({
  key: workflowKeySchema,
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(4000).optional(),
  domain: z.string().trim().max(80).optional(),
  body: z.object({
    trigger: triggerConfigSchema,
    conditions: conditionNodeSchema.optional(),
    actions: z.array(actionConfigSchema).min(1).max(50),
    failurePolicy: z.enum(WORKFLOW_FAILURE_POLICIES).optional(),
  }),
});

export const updateWorkflowTemplateSchema = createWorkflowTemplateSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const workflowTemplateListQuerySchema = z.object({
  ...listPagination,
  domain: z.string().trim().max(80).optional(),
  sort: z.enum(["createdAt", "name", "key"]).default("name"),
});
