import { z } from "zod";

export const WORKFLOW_ACTION_KEYS = [
  "CREATE_TASK",
  "CREATE_NOTIFICATION",
  "SEND_COMMUNICATION",
  "REQUEST_APPROVAL",
  "CREATE_DEADLINE",
  "UPDATE_ALLOWED_FIELD",
  "CREATE_DOCUMENT_REQUEST",
  "CREATE_INCIDENT",
  "CREATE_PAYABLE",
  "CALL_INTERNAL_SERVICE",
  "ENQUEUE_JOB",
  "WAIT",
  "WEBHOOK_EXTERNAL",
] as const;

export type WorkflowActionKey = (typeof WORKFLOW_ACTION_KEYS)[number];

export type WorkflowActionDefinition = {
  key: WorkflowActionKey;
  /** Maps to DB enum / validation lowercase */
  type: string;
  schema: z.ZodTypeAny;
  requiredPermission: string;
  idempotent: boolean;
  timeoutMsDefault: number;
  maxAttemptsDefault: number;
  /** Blocks dry-run from executing side effects */
  criticalMutation: boolean;
  externalSideEffect: boolean;
};

const nonEmpty = z.string().trim().min(1).max(200);

export const WorkflowActionRegistry: Record<WorkflowActionKey, WorkflowActionDefinition> = {
  CREATE_TASK: {
    key: "CREATE_TASK",
    type: "create_task",
    schema: z.object({
      title: nonEmpty,
      description: z.string().max(4000).optional(),
      dueAt: z.string().datetime({ offset: true }).optional(),
    }),
    requiredPermission: "task.create",
    idempotent: true,
    timeoutMsDefault: 10_000,
    maxAttemptsDefault: 3,
    criticalMutation: true,
    externalSideEffect: false,
  },
  CREATE_NOTIFICATION: {
    key: "CREATE_NOTIFICATION",
    type: "create_notification",
    schema: z.object({
      title: nonEmpty,
      body: z.string().max(2000).optional(),
      userId: z.string().uuid().optional(),
    }),
    requiredPermission: "workflow.run",
    idempotent: true,
    timeoutMsDefault: 5_000,
    maxAttemptsDefault: 3,
    criticalMutation: false,
    externalSideEffect: false,
  },
  SEND_COMMUNICATION: {
    key: "SEND_COMMUNICATION",
    type: "send_communication",
    schema: z.object({
      channel: z.enum(["email", "sms", "whatsapp", "push"]),
      templateKey: nonEmpty,
      to: z.string().max(320).optional(),
    }),
    requiredPermission: "communication.send",
    idempotent: true,
    timeoutMsDefault: 30_000,
    maxAttemptsDefault: 3,
    criticalMutation: false,
    externalSideEffect: true,
  },
  REQUEST_APPROVAL: {
    key: "REQUEST_APPROVAL",
    type: "request_approval",
    schema: z.object({
      type: nonEmpty,
      referenceType: nonEmpty,
      referenceId: z.string().uuid(),
      approverPolicy: z.enum(["single", "sequential", "parallel", "threshold"]).default("single"),
    }),
    requiredPermission: "control.approval.manage",
    idempotent: true,
    timeoutMsDefault: 15_000,
    maxAttemptsDefault: 2,
    criticalMutation: true,
    externalSideEffect: false,
  },
  CREATE_DEADLINE: {
    key: "CREATE_DEADLINE",
    type: "create_deadline",
    schema: z.object({
      title: nonEmpty,
      dueAt: z.string().datetime({ offset: true }),
    }),
    requiredPermission: "deadline.create",
    idempotent: true,
    timeoutMsDefault: 10_000,
    maxAttemptsDefault: 3,
    criticalMutation: true,
    externalSideEffect: false,
  },
  UPDATE_ALLOWED_FIELD: {
    key: "UPDATE_ALLOWED_FIELD",
    type: "update_allowed_field",
    schema: z.object({
      resourceType: z.enum(["task", "matter", "opportunity", "control_goal"]),
      resourceId: z.string().uuid(),
      field: z.enum(["status", "priority", "title"]),
      value: z.union([z.string().max(200), z.number(), z.boolean()]),
    }),
    requiredPermission: "workflow.run",
    idempotent: true,
    timeoutMsDefault: 10_000,
    maxAttemptsDefault: 2,
    criticalMutation: true,
    externalSideEffect: false,
  },
  CREATE_DOCUMENT_REQUEST: {
    key: "CREATE_DOCUMENT_REQUEST",
    type: "create_document_request",
    schema: z.object({
      title: nonEmpty,
      legalMatterId: z.string().uuid().optional(),
    }),
    requiredPermission: "document.create",
    idempotent: true,
    timeoutMsDefault: 10_000,
    maxAttemptsDefault: 2,
    criticalMutation: true,
    externalSideEffect: false,
  },
  CREATE_INCIDENT: {
    key: "CREATE_INCIDENT",
    type: "create_incident",
    schema: z.object({
      title: nonEmpty,
      type: z.string().max(40).default("operational"),
      severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
    }),
    requiredPermission: "control.compliance.manage",
    idempotent: true,
    timeoutMsDefault: 10_000,
    maxAttemptsDefault: 2,
    criticalMutation: true,
    externalSideEffect: false,
  },
  CREATE_PAYABLE: {
    key: "CREATE_PAYABLE",
    type: "create_payable",
    schema: z.object({
      amountCents: z.number().int().positive(),
      description: nonEmpty,
    }),
    requiredPermission: "finance.payable.create",
    idempotent: true,
    timeoutMsDefault: 15_000,
    maxAttemptsDefault: 1,
    criticalMutation: true,
    externalSideEffect: false,
  },
  CALL_INTERNAL_SERVICE: {
    key: "CALL_INTERNAL_SERVICE",
    type: "call_internal_service",
    schema: z.object({
      serviceKey: z.enum(["analytics.refresh", "control.kpi.refresh", "control.budget.variance"]),
      params: z.record(z.unknown()).default({}),
    }),
    requiredPermission: "workflow.run",
    idempotent: true,
    timeoutMsDefault: 30_000,
    maxAttemptsDefault: 2,
    criticalMutation: false,
    externalSideEffect: false,
  },
  ENQUEUE_JOB: {
    key: "ENQUEUE_JOB",
    type: "enqueue_job",
    schema: z.object({
      jobType: z
        .string()
        .regex(/^[A-Z][A-Z0-9_]+$/, "jobType inválido.")
        .max(80),
      payload: z.record(z.unknown()).default({}),
    }),
    requiredPermission: "workflow.admin",
    idempotent: true,
    timeoutMsDefault: 5_000,
    maxAttemptsDefault: 3,
    criticalMutation: false,
    externalSideEffect: false,
  },
  WAIT: {
    key: "WAIT",
    type: "wait",
    schema: z.object({
      until: z.string().datetime({ offset: true }).optional(),
      durationMs: z.number().int().min(0).max(86_400_000).optional(),
      waitFor: z.enum(["approval", "timeout"]).optional(),
    }),
    requiredPermission: "workflow.run",
    idempotent: true,
    timeoutMsDefault: 60_000,
    maxAttemptsDefault: 1,
    criticalMutation: false,
    externalSideEffect: false,
  },
  WEBHOOK_EXTERNAL: {
    key: "WEBHOOK_EXTERNAL",
    type: "webhook_external",
    schema: z.object({
      /** URL must go through WorkflowWebhookProvider allowlist — never raw SSRF. */
      urlRef: z.string().trim().min(1).max(120),
      method: z.enum(["POST", "PUT", "PATCH"]).default("POST"),
      body: z.unknown().optional(),
    }),
    requiredPermission: "workflow.admin",
    idempotent: true,
    timeoutMsDefault: 15_000,
    maxAttemptsDefault: 3,
    criticalMutation: false,
    externalSideEffect: true,
  },
};

export function resolveActionDefinition(typeOrKey: string): WorkflowActionDefinition | undefined {
  const upper = typeOrKey.toUpperCase();
  if (upper in WorkflowActionRegistry) {
    return WorkflowActionRegistry[upper as WorkflowActionKey];
  }
  return Object.values(WorkflowActionRegistry).find((d) => d.type === typeOrKey);
}

export function assertNoArbitraryUrl(params: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && /^https?:\/\//i.test(value) && key !== "urlRef") {
      throw new Error("URL arbitrária não permitida em parâmetros de workflow.");
    }
    if (key.toLowerCase().includes("url") && key !== "urlRef" && typeof value === "string") {
      throw new Error("Campo de URL não autorizado. Use urlRef com provedor allowlisted.");
    }
  }
}
