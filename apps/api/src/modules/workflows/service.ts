import type { WorkflowWebhookProvider } from "@verasjuris/ai";
import { recordAudit } from "@verasjuris/audit";
import { policyWorkflowDefinition, policyWorkflowRun, type SessionAccount } from "@verasjuris/auth";
import {
  isUniqueViolation,
  workflowDefinitions,
  workflowTemplates,
  workflowVersions,
  workflowRuns,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, desc, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { authorize, iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";
import { assertNoArbitraryUrl, resolveActionDefinition } from "./action-registry.js";
import { assertSafeConditionTree, type ConditionNode } from "./condition-engine.js";
import { WorkflowEngine, type WorkflowBody } from "./engine.js";

export type WorkflowModuleDeps = {
  workflowWebhookProvider?: WorkflowWebhookProvider;
};

const SEED_TEMPLATES: Array<{
  key: string;
  name: string;
  description: string;
  domain: string;
  body: WorkflowBody;
}> = [
  {
    key: "deadline_reminder",
    name: "Lembrete de prazo",
    description: "Cria notificação quando prazo está próximo.",
    domain: "deadlines",
    body: {
      trigger: { type: "schedule", cron: "0 9 * * *" },
      conditions: {
        operator: "equals",
        field: "deadline.status",
        value: "confirmed",
      },
      actions: [
        {
          type: "create_notification",
          params: { title: "Prazo próximo", body: "Revise o prazo confirmado." },
        },
      ],
    },
  },
  {
    key: "approval_gate",
    name: "Portão de aprovação",
    description: "Solicita aprovação e aguarda.",
    domain: "control",
    body: {
      trigger: { type: "manual" },
      actions: [
        {
          type: "request_approval",
          params: {
            type: "generic",
            referenceType: "workflow",
            referenceId: "00000000-0000-4000-8000-000000000001",
            approverPolicy: "single",
          },
          failurePolicy: "wait_for_review",
        },
        { type: "wait", params: { waitFor: "approval" } },
      ],
    },
  },
];

function serializeDefinition(row: typeof workflowDefinitions.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    key: row.key,
    name: row.name,
    description: row.description,
    domain: row.domain,
    version: row.version,
    status: row.status,
    activeFrom: iso(row.activeFrom),
    activeUntil: iso(row.activeUntil),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function validateBody(body: WorkflowBody) {
  if (!body.actions?.length) {
    throw new AppError("VALIDATION_ERROR", "Informe ao menos uma ação.");
  }
  if (body.conditions) assertSafeConditionTree(body.conditions);
  for (const action of body.actions) {
    const def = resolveActionDefinition(action.type) ?? resolveActionDefinition(action.key ?? "");
    if (!def) {
      throw new AppError("VALIDATION_ERROR", `Ação não suportada: ${action.type}`);
    }
    const params = action.params ?? {};
    try {
      assertNoArbitraryUrl(params);
      def.schema.parse(params);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Parâmetros de ação inválidos.";
      throw new AppError("VALIDATION_ERROR", message);
    }
  }
}

export async function seedWorkflowTemplates(db: AppDatabase) {
  for (const template of SEED_TEMPLATES) {
    const [existing] = await db
      .select({ id: workflowTemplates.id })
      .from(workflowTemplates)
      .where(eq(workflowTemplates.key, template.key))
      .limit(1);
    if (!existing) {
      await db.insert(workflowTemplates).values({
        key: template.key,
        name: template.name,
        description: template.description,
        domain: template.domain,
        version: 1,
        body: template.body as unknown as Record<string, unknown>,
        active: true,
      });
    }
  }
}

export async function listWorkflowTemplates(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  authorize(account, organizationId, (a) => policyWorkflowDefinition(a, "workflow.read"));
  await seedWorkflowTemplates(db);
  const rows = await db
    .select()
    .from(workflowTemplates)
    .where(eq(workflowTemplates.active, true))
    .orderBy(workflowTemplates.name);
  return {
    templates: rows.map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      description: r.description,
      domain: r.domain,
      version: r.version,
      body: r.body,
    })),
  };
}

export async function createWorkflowDefinition(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    key: string;
    name: string;
    description?: string;
    domain?: string;
    trigger: Record<string, unknown>;
    conditions?: ConditionNode;
    actions: WorkflowBody["actions"];
    activeFrom?: string;
    activeUntil?: string;
  },
  meta: RequestMeta,
) {
  const actor = authorize(account, organizationId, (a) =>
    policyWorkflowDefinition(a, "workflow.create"),
  );
  const body: WorkflowBody = {
    trigger: input.trigger,
    conditions: input.conditions,
    actions: input.actions,
  };
  validateBody(body);

  try {
    const [row] = await db
      .insert(workflowDefinitions)
      .values({
        organizationId,
        key: input.key,
        name: input.name,
        description: input.description ?? null,
        domain: input.domain ?? null,
        version: 1,
        status: "draft",
        activeFrom: input.activeFrom ? new Date(input.activeFrom) : null,
        activeUntil: input.activeUntil ? new Date(input.activeUntil) : null,
      })
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o workflow.");

    await db.insert(workflowVersions).values({
      definitionId: row.id,
      version: 1,
      body: body as unknown as Record<string, unknown>,
      publishedAt: null,
      publishedByMembershipId: null,
    });

    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "workflow.created",
      resourceType: "workflow_definition",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: serializeDefinition(row),
    });

    return { definition: serializeDefinition(row), actorMembershipId: actor.membershipId };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("CONFLICT", "Já existe um workflow com esta chave/versão.");
    }
    throw error;
  }
}

export async function updateWorkflowDefinition(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  definitionId: string,
  input: {
    name?: string;
    description?: string | null;
    domain?: string | null;
    trigger?: Record<string, unknown>;
    conditions?: ConditionNode | null;
    actions?: WorkflowBody["actions"];
    activeFrom?: string | null;
    activeUntil?: string | null;
    status?: "draft" | "paused" | "archived";
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (a) => policyWorkflowDefinition(a, "workflow.update"));
  const [existing] = await db
    .select()
    .from(workflowDefinitions)
    .where(
      and(
        eq(workflowDefinitions.id, definitionId),
        eq(workflowDefinitions.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!existing) throw new AppError("NOT_FOUND", "Não encontramos este workflow no seu acesso.");
  if (existing.status === "published") {
    throw new AppError(
      "CONFLICT",
      "Versão publicada é imutável. Crie/edite um draft ou publique nova versão.",
    );
  }

  const [version] = await db
    .select()
    .from(workflowVersions)
    .where(
      and(
        eq(workflowVersions.definitionId, existing.id),
        eq(workflowVersions.version, existing.version),
      ),
    )
    .limit(1);

  const currentBody = (version?.body ?? { actions: [] }) as unknown as WorkflowBody;
  const nextBody: WorkflowBody = {
    trigger: input.trigger ?? currentBody.trigger,
    conditions:
      input.conditions === undefined ? currentBody.conditions : (input.conditions ?? undefined),
    actions: input.actions ?? currentBody.actions,
  };
  if (input.trigger || input.conditions !== undefined || input.actions) {
    validateBody(nextBody);
  }

  const [row] = await db
    .update(workflowDefinitions)
    .set({
      name: input.name ?? existing.name,
      description: input.description === undefined ? existing.description : input.description,
      domain: input.domain === undefined ? existing.domain : input.domain,
      status: input.status ?? existing.status,
      activeFrom:
        input.activeFrom === undefined
          ? existing.activeFrom
          : input.activeFrom
            ? new Date(input.activeFrom)
            : null,
      activeUntil:
        input.activeUntil === undefined
          ? existing.activeUntil
          : input.activeUntil
            ? new Date(input.activeUntil)
            : null,
      updatedAt: new Date(),
    })
    .where(eq(workflowDefinitions.id, existing.id))
    .returning();

  if (version && (input.trigger || input.conditions !== undefined || input.actions)) {
    if (version.publishedAt) {
      throw new AppError("CONFLICT", "Corpo de versão publicada é imutável.");
    }
    await db
      .update(workflowVersions)
      .set({ body: nextBody as unknown as Record<string, unknown> })
      .where(eq(workflowVersions.id, version.id));
  }

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "workflow.updated",
    resourceType: "workflow_definition",
    resourceId: existing.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });

  return { definition: serializeDefinition(row ?? existing) };
}

export async function publishWorkflowDefinition(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  definitionId: string,
  input: { notes?: string },
  meta: RequestMeta,
) {
  const actor = authorize(account, organizationId, (a) =>
    policyWorkflowDefinition(a, "workflow.publish"),
  );
  const [existing] = await db
    .select()
    .from(workflowDefinitions)
    .where(
      and(
        eq(workflowDefinitions.id, definitionId),
        eq(workflowDefinitions.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!existing) throw new AppError("NOT_FOUND", "Não encontramos este workflow no seu acesso.");

  return db.transaction(async (tx) => {
    const [draftVersion] = await tx
      .select()
      .from(workflowVersions)
      .where(
        and(
          eq(workflowVersions.definitionId, existing.id),
          eq(workflowVersions.version, existing.version),
        ),
      )
      .limit(1);
    if (!draftVersion) {
      throw new AppError("VALIDATION_ERROR", "Workflow sem corpo de versão para publicar.");
    }

    // Immutable published copy
    const publishVersion =
      existing.status === "published" ? existing.version + 1 : existing.version;
    let versionRow = draftVersion;
    if (existing.status === "published" || draftVersion.publishedAt) {
      const [copied] = await tx
        .insert(workflowVersions)
        .values({
          definitionId: existing.id,
          version: publishVersion,
          body: draftVersion.body,
          publishedAt: new Date(),
          publishedByMembershipId: actor.membershipId,
        })
        .returning();
      if (!copied) throw new AppError("INTERNAL_ERROR", "Falha ao copiar versão.");
      versionRow = copied;
    } else {
      const [published] = await tx
        .update(workflowVersions)
        .set({
          publishedAt: new Date(),
          publishedByMembershipId: actor.membershipId,
        })
        .where(eq(workflowVersions.id, draftVersion.id))
        .returning();
      if (published) versionRow = published;
    }

    const [row] = await tx
      .update(workflowDefinitions)
      .set({
        status: "published",
        version: versionRow.version,
        updatedAt: new Date(),
      })
      .where(eq(workflowDefinitions.id, existing.id))
      .returning();

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "workflow.published",
      resourceType: "workflow_definition",
      resourceId: existing.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      metadata: { version: versionRow.version, notes: input.notes ?? null },
    });

    return {
      definition: serializeDefinition(row ?? existing),
      version: {
        id: versionRow.id,
        version: versionRow.version,
        publishedAt: iso(versionRow.publishedAt),
        immutable: true,
      },
    };
  });
}

export async function pauseWorkflowDefinition(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  definitionId: string,
  input: { reason?: string },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (a) => policyWorkflowDefinition(a, "workflow.update"));
  const [existing] = await db
    .select()
    .from(workflowDefinitions)
    .where(
      and(
        eq(workflowDefinitions.id, definitionId),
        eq(workflowDefinitions.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!existing) throw new AppError("NOT_FOUND", "Não encontramos este workflow no seu acesso.");
  const [row] = await db
    .update(workflowDefinitions)
    .set({ status: "paused", updatedAt: new Date() })
    .where(eq(workflowDefinitions.id, existing.id))
    .returning();
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "workflow.paused",
    resourceType: "workflow_definition",
    resourceId: existing.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    metadata: { reason: input.reason ?? null },
  });
  return { definition: serializeDefinition(row ?? existing) };
}

export async function listWorkflowDefinitions(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { limit: number; offset: number; status?: string; domain?: string },
) {
  authorize(account, organizationId, (a) => policyWorkflowDefinition(a, "workflow.read"));
  const filters = [eq(workflowDefinitions.organizationId, organizationId)];
  if (query.status) {
    filters.push(
      eq(
        workflowDefinitions.status,
        query.status as typeof workflowDefinitions.$inferSelect.status,
      ),
    );
  }
  if (query.domain) filters.push(eq(workflowDefinitions.domain, query.domain));
  const rows = await db
    .select()
    .from(workflowDefinitions)
    .where(and(...filters))
    .orderBy(desc(workflowDefinitions.updatedAt))
    .limit(query.limit)
    .offset(query.offset);
  return { definitions: rows.map(serializeDefinition) };
}

export async function runWorkflow(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  definitionId: string,
  input: {
    triggerReference?: string;
    payload?: Record<string, unknown>;
    dryRun: boolean;
    idempotencyKey?: string;
  },
  meta: RequestMeta,
  deps: WorkflowModuleDeps = {},
) {
  const actor = authorize(account, organizationId, (a) => policyWorkflowRun(a, "workflow.run"));
  const [definition] = await db
    .select()
    .from(workflowDefinitions)
    .where(
      and(
        eq(workflowDefinitions.id, definitionId),
        eq(workflowDefinitions.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!definition) throw new AppError("NOT_FOUND", "Não encontramos este workflow no seu acesso.");
  if (!["published", "draft"].includes(definition.status) && !input.dryRun) {
    throw new AppError("CONFLICT", "Workflow precisa estar publicado (ou use dryRun).");
  }

  const [version] = await db
    .select()
    .from(workflowVersions)
    .where(
      and(
        eq(workflowVersions.definitionId, definition.id),
        eq(workflowVersions.version, definition.version),
      ),
    )
    .limit(1);
  if (!version) throw new AppError("VALIDATION_ERROR", "Workflow sem versão.");

  const body = version.body as unknown as WorkflowBody;
  const engine = new WorkflowEngine(db, {
    workflowWebhookProvider: deps.workflowWebhookProvider,
    actorUserId: account.user.id,
    membershipId: actor.membershipId,
  });

  const result = await engine.startRun({
    organizationId,
    definitionId: definition.id,
    versionId: version.id,
    version: version.version,
    triggerType: "manual",
    triggerReference: input.triggerReference,
    idempotencyKey: input.idempotencyKey ?? `manual:${randomBytes(16).toString("hex")}`,
    dryRun: input.dryRun,
    body,
    payload: input.payload,
  });

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "workflow.run_started",
    resourceType: "workflow_run",
    resourceId: result.run.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    metadata: { dryRun: input.dryRun },
  });

  return result;
}

export async function listWorkflowRuns(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { limit: number; offset: number; definitionId?: string; status?: string },
) {
  authorize(account, organizationId, (a) => policyWorkflowRun(a, "workflow.read"));
  const filters = [eq(workflowRuns.organizationId, organizationId)];
  if (query.definitionId) filters.push(eq(workflowRuns.definitionId, query.definitionId));
  if (query.status) {
    filters.push(eq(workflowRuns.status, query.status as typeof workflowRuns.$inferSelect.status));
  }
  const rows = await db
    .select()
    .from(workflowRuns)
    .where(and(...filters))
    .orderBy(desc(workflowRuns.createdAt))
    .limit(query.limit)
    .offset(query.offset);
  return {
    runs: rows.map((r) => ({
      id: r.id,
      definitionId: r.definitionId,
      version: r.version,
      status: r.status,
      dryRun: r.dryRun,
      idempotencyKey: r.idempotencyKey,
      startedAt: iso(r.startedAt),
      completedAt: iso(r.completedAt),
      createdAt: iso(r.createdAt),
    })),
  };
}

export async function cancelWorkflowRun(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  runId: string,
  input: { reason?: string },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (a) => policyWorkflowRun(a, "workflow.cancel"));
  const [run] = await db
    .select()
    .from(workflowRuns)
    .where(and(eq(workflowRuns.id, runId), eq(workflowRuns.organizationId, organizationId)))
    .limit(1);
  if (!run) throw new AppError("NOT_FOUND", "Não encontramos esta execução no seu acesso.");
  if (["completed", "cancelled", "failed"].includes(run.status)) {
    throw new AppError("CONFLICT", "Esta execução já está finalizada.");
  }
  const [updated] = await db
    .update(workflowRuns)
    .set({ status: "cancelled", completedAt: new Date(), updatedAt: new Date() })
    .where(eq(workflowRuns.id, run.id))
    .returning();
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "workflow.run_cancelled",
    resourceType: "workflow_run",
    resourceId: run.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    metadata: { reason: input.reason ?? null },
  });
  return {
    run: {
      id: updated?.id ?? run.id,
      status: updated?.status ?? "cancelled",
    },
  };
}
