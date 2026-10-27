import {
  DEFAULT_AI_FEATURES,
  type AIGateway,
  type OCRProvider,
  type PublicOpportunityProvider,
} from "@verasjuris/ai";
import { recordAudit } from "@verasjuris/audit";
import {
  policyAIConfiguration,
  policyAIJob,
  policyAIPrompt,
  policyAIUsage,
  type SessionAccount,
} from "@verasjuris/auth";
import {
  aiBudgets,
  aiJobs,
  aiModels,
  aiPromptVersions,
  aiPrompts,
  aiRequests,
  aiResultSources,
  aiUsage,
  type AppDatabase,
  isUniqueViolation,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, asc, count, desc, eq, gte, lte, max, sql } from "drizzle-orm";
import type { RequestMeta } from "../auth/service.js";
import { remainingBudgetMicros, spentMicros } from "./runner.js";
import { authorize, iso } from "./shared.js";

export type AiModuleDeps = {
  gateway: AIGateway;
  ocr: OCRProvider;
  publicOpportunities: PublicOpportunityProvider;
};

/* ─── Status / configuração ─── */

export async function getAiStatus(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  deps: AiModuleDeps,
) {
  authorize(account, organizationId, (access) => policyAIUsage(access, "ai.use"));
  const description = deps.gateway.describe();
  const [aiHealth, ocrHealth, publicHealth] = await Promise.all([
    deps.gateway.healthCheck(),
    deps.ocr.healthCheck(),
    deps.publicOpportunities.healthCheck(),
  ]);
  const remaining = await remainingBudgetMicros(db, organizationId);
  return {
    ai: {
      status: description.status,
      provider: description.provider,
      capabilities: description.status === "configured" ? [...description.capabilities] : [],
      health: aiHealth,
      features: Object.entries(DEFAULT_AI_FEATURES).map(([key, definition]) => ({
        key,
        outputDisposition: definition.outputDisposition,
      })),
      /** Toda saída de IA é assistiva e exige revisão humana; nada é aplicado automaticamente. */
      outputPolicy: { assistive: true, requiresReview: true, autoApply: false },
    },
    ocr: { status: ocrHealth.status, provider: deps.ocr.id, health: ocrHealth },
    publicOpportunityProvider: {
      status: publicHealth.status,
      provider: deps.publicOpportunities.id,
      health: publicHealth,
    },
    budget: {
      /** Micros inteiros; null = sem limite rígido ativo. */
      remainingMicros: remaining ?? null,
    },
  };
}

/* ─── Modelos ─── */

export async function listAiModels(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  authorize(account, organizationId, (access) => policyAIUsage(access, "ai.use"));
  const rows = await db.query.aiModels.findMany({
    where: eq(aiModels.active, true),
    orderBy: [asc(aiModels.providerKey), asc(aiModels.displayName)],
  });
  return {
    items: rows.map((row) => ({
      id: row.id,
      providerKey: row.providerKey,
      externalModelId: row.externalModelId,
      displayName: row.displayName,
      modelFamily: row.modelFamily,
      capabilities: row.capabilities,
      contextWindow: row.contextWindow,
      inputCostPerMillionMicros: row.inputCostPerMillionMicros,
      outputCostPerMillionMicros: row.outputCostPerMillionMicros,
      currency: row.currency,
      configured: row.configured,
    })),
  };
}

/* ─── Prompts ─── */

function serializePromptVersion(row: typeof aiPromptVersions.$inferSelect) {
  return {
    id: row.id,
    version: row.version,
    status: row.status,
    systemTemplate: row.systemTemplate,
    userTemplate: row.userTemplate,
    safetyInstructions: row.safetyInstructions,
    changelog: row.changelog,
    activatedAt: iso(row.activatedAt),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listAiPrompts(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  authorize(account, organizationId, (access) => policyAIPrompt(access, "ai.prompts.read"));
  const prompts = await db.query.aiPrompts.findMany({
    where: eq(aiPrompts.active, true),
    orderBy: [asc(aiPrompts.key)],
  });
  const items = [];
  for (const prompt of prompts) {
    const versions = await db.query.aiPromptVersions.findMany({
      where: eq(aiPromptVersions.promptId, prompt.id),
      orderBy: [desc(aiPromptVersions.version)],
    });
    items.push({
      id: prompt.id,
      key: prompt.key,
      name: prompt.name,
      feature: prompt.feature,
      description: prompt.description,
      activeVersion: versions.find((v) => v.status === "active")?.version ?? null,
      versions: versions.map(serializePromptVersion),
    });
  }
  return { items };
}

export async function createAiPromptVersion(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    key: string;
    name: string;
    feature: string;
    description?: string | undefined;
    systemTemplate: string;
    userTemplate: string;
    safetyInstructions?: string | undefined;
    changelog?: string | undefined;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) => policyAIPrompt(access, "ai.prompts.manage"));
  if (!DEFAULT_AI_FEATURES[input.feature]) {
    throw new AppError("VALIDATION_ERROR", "Funcionalidade de IA desconhecida.", [
      { path: "feature", message: "Use uma funcionalidade registrada no gateway." },
    ]);
  }
  return db.transaction(async (tx) => {
    let prompt = await tx.query.aiPrompts.findFirst({ where: eq(aiPrompts.key, input.key) });
    if (!prompt) {
      const [created] = await tx
        .insert(aiPrompts)
        .values({
          key: input.key,
          name: input.name,
          feature: input.feature,
          description: input.description ?? null,
        })
        .returning();
      prompt = created;
    }
    if (!prompt) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar o prompt.");
    const [agg] = await tx
      .select({ value: max(aiPromptVersions.version) })
      .from(aiPromptVersions)
      .where(eq(aiPromptVersions.promptId, prompt.id));
    const [version] = await tx
      .insert(aiPromptVersions)
      .values({
        promptId: prompt.id,
        version: (agg?.value ?? 0) + 1,
        systemTemplate: input.systemTemplate,
        userTemplate: input.userTemplate,
        safetyInstructions: input.safetyInstructions ?? null,
        changelog: input.changelog ?? null,
        status: "draft",
        createdByUserId: account.user.id,
      })
      .returning();
    if (!version) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar a versão.");
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "ai.prompt_version_created",
      resourceType: "ai_prompt_version",
      resourceId: version.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      metadata: { key: prompt.key, version: version.version },
    });
    return { promptId: prompt.id, key: prompt.key, version: serializePromptVersion(version) };
  });
}

/** Ativa uma versão (as anteriores ativas são marcadas como depreciadas; versões são imutáveis). */
export async function activateAiPromptVersion(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  promptKey: string,
  versionNumber: number,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) => policyAIPrompt(access, "ai.prompts.manage"));
  const prompt = await db.query.aiPrompts.findFirst({ where: eq(aiPrompts.key, promptKey) });
  if (!prompt) throw new AppError("NOT_FOUND", "Prompt não encontrado.");
  const target = await db.query.aiPromptVersions.findFirst({
    where: and(
      eq(aiPromptVersions.promptId, prompt.id),
      eq(aiPromptVersions.version, versionNumber),
    ),
  });
  if (!target) throw new AppError("NOT_FOUND", "Versão de prompt não encontrada.");
  if (target.status === "deprecated") {
    throw new AppError("CONFLICT", "Versões depreciadas não podem ser reativadas.");
  }
  return db.transaction(async (tx) => {
    await tx
      .update(aiPromptVersions)
      .set({ status: "deprecated" })
      .where(and(eq(aiPromptVersions.promptId, prompt.id), eq(aiPromptVersions.status, "active")));
    const [updated] = await tx
      .update(aiPromptVersions)
      .set({ status: "active", activatedAt: new Date(), approvedByUserId: account.user.id })
      .where(eq(aiPromptVersions.id, target.id))
      .returning();
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "ai.prompt_version_activated",
      resourceType: "ai_prompt_version",
      resourceId: target.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      metadata: { key: prompt.key, version: target.version },
    });
    return { key: prompt.key, version: updated ? serializePromptVersion(updated) : null };
  });
}

/* ─── Uso e requisições ─── */

export async function getAiUsage(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: {
    feature?: string | undefined;
    from?: string | undefined;
    to?: string | undefined;
    limit: number;
    offset: number;
  },
) {
  authorize(account, organizationId, (access) => policyAIUsage(access, "ai.usage.read"));
  const filters = [eq(aiUsage.organizationId, organizationId)];
  if (query.feature) filters.push(eq(aiUsage.feature, query.feature));
  if (query.from) filters.push(gte(aiUsage.recordedAt, new Date(query.from)));
  if (query.to) filters.push(lte(aiUsage.recordedAt, new Date(query.to)));
  const where = and(...filters);

  const [totals] = await db
    .select({
      requests: count(),
      inputTokens: sql<string>`coalesce(sum(${aiUsage.inputTokens}), 0)::text`,
      outputTokens: sql<string>`coalesce(sum(${aiUsage.outputTokens}), 0)::text`,
      totalTokens: sql<string>`coalesce(sum(${aiUsage.totalTokens}), 0)::text`,
      estimatedCostMicros: sql<string>`coalesce(sum(${aiUsage.estimatedCostMicros}), 0)::text`,
      providerReportedCostMicros: sql<string>`coalesce(sum(${aiUsage.providerReportedCostMicros}), 0)::text`,
    })
    .from(aiUsage)
    .where(where);

  const byFeature = await db
    .select({
      feature: aiUsage.feature,
      requests: count(),
      totalTokens: sql<string>`coalesce(sum(${aiUsage.totalTokens}), 0)::text`,
      estimatedCostMicros: sql<string>`coalesce(sum(${aiUsage.estimatedCostMicros}), 0)::text`,
    })
    .from(aiUsage)
    .where(where)
    .groupBy(aiUsage.feature)
    .orderBy(asc(aiUsage.feature));

  const rows = await db.query.aiUsage.findMany({
    where,
    orderBy: [desc(aiUsage.recordedAt)],
    limit: query.limit,
    offset: query.offset,
  });

  return {
    totals: {
      requests: totals?.requests ?? 0,
      inputTokens: Number(totals?.inputTokens ?? 0),
      outputTokens: Number(totals?.outputTokens ?? 0),
      totalTokens: Number(totals?.totalTokens ?? 0),
      /** Custos em micros inteiros: estimado (gateway) e informado pelo provedor são distintos. */
      estimatedCostMicros: Number(totals?.estimatedCostMicros ?? 0),
      providerReportedCostMicros: Number(totals?.providerReportedCostMicros ?? 0),
    },
    byFeature: byFeature.map((row) => ({
      feature: row.feature,
      requests: row.requests,
      totalTokens: Number(row.totalTokens),
      estimatedCostMicros: Number(row.estimatedCostMicros),
    })),
    items: rows.map((row) => ({
      id: row.id,
      aiRequestId: row.aiRequestId,
      provider: row.provider,
      model: row.modelExternalId,
      feature: row.feature,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      totalTokens: row.totalTokens,
      tokensAreEstimate: row.tokensAreEstimate,
      estimatedCostMicros: row.estimatedCostMicros,
      providerReportedCostMicros: row.providerReportedCostMicros,
      currency: row.currency,
      durationMs: row.durationMs,
      recordedAt: row.recordedAt.toISOString(),
    })),
    limit: query.limit,
    offset: query.offset,
  };
}

function serializeAiRequest(row: typeof aiRequests.$inferSelect) {
  return {
    id: row.id,
    feature: row.feature,
    provider: row.provider,
    status: row.status,
    outputDisposition: row.outputDisposition,
    inputReference: row.inputReference,
    correlationId: row.correlationId,
    requestedAt: row.requestedAt.toISOString(),
    startedAt: iso(row.startedAt),
    finishedAt: iso(row.finishedAt),
    durationMs: row.durationMs,
    errorCode: row.errorCode,
    errorSafeMessage: row.errorSafeMessage,
  };
}

export async function listAiRequests(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: {
    feature?: string | undefined;
    status?: string | undefined;
    limit: number;
    offset: number;
  },
) {
  authorize(account, organizationId, (access) => policyAIUsage(access, "ai.usage.read"));
  const filters = [eq(aiRequests.organizationId, organizationId)];
  if (query.feature) filters.push(eq(aiRequests.feature, query.feature));
  if (query.status) {
    filters.push(eq(aiRequests.status, query.status as typeof aiRequests.$inferSelect.status));
  }
  const where = and(...filters);
  const [totalRow] = await db.select({ value: count() }).from(aiRequests).where(where);
  const rows = await db.query.aiRequests.findMany({
    where,
    orderBy: [desc(aiRequests.requestedAt)],
    limit: query.limit,
    offset: query.offset,
  });
  return {
    items: rows.map(serializeAiRequest),
    total: totalRow?.value ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function getAiRequest(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  requestId: string,
) {
  authorize(account, organizationId, (access) => policyAIUsage(access, "ai.usage.read"));
  const row = await db.query.aiRequests.findFirst({
    where: and(eq(aiRequests.id, requestId), eq(aiRequests.organizationId, organizationId)),
  });
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos esta requisição de IA no seu acesso.");
  const [usage, sources] = await Promise.all([
    db.query.aiUsage.findFirst({
      where: and(eq(aiUsage.aiRequestId, row.id), eq(aiUsage.organizationId, organizationId)),
    }),
    db.query.aiResultSources.findMany({
      where: and(
        eq(aiResultSources.aiRequestId, row.id),
        eq(aiResultSources.organizationId, organizationId),
      ),
    }),
  ]);
  return {
    request: {
      ...serializeAiRequest(row),
      usage: usage
        ? {
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            totalTokens: usage.totalTokens,
            tokensAreEstimate: usage.tokensAreEstimate,
            estimatedCostMicros: usage.estimatedCostMicros,
            providerReportedCostMicros: usage.providerReportedCostMicros,
            currency: usage.currency,
          }
        : null,
      sources: sources.map((source) => ({
        id: source.id,
        documentId: source.documentId,
        documentVersionId: source.documentVersionId,
        sourceLabel: source.sourceLabel,
        sourceHash: source.sourceHash,
      })),
    },
  };
}

/* ─── Jobs ─── */

function serializeJob(row: typeof aiJobs.$inferSelect) {
  return {
    id: row.id,
    jobType: row.jobType,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    status: row.status,
    progress: row.progress,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    /** `local_in_process`: execução local no processo; não há fila distribuída. */
    runtime: row.runtime,
    startedAt: iso(row.startedAt),
    completedAt: iso(row.completedAt),
    failedAt: iso(row.failedAt),
    lastErrorCode: row.lastErrorCode,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listAiJobs(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: {
    status?: string | undefined;
    jobType?: string | undefined;
    limit: number;
    offset: number;
  },
) {
  authorize(account, organizationId, (access) => policyAIJob(access, "ai.jobs.read"));
  const filters = [eq(aiJobs.organizationId, organizationId)];
  if (query.status)
    filters.push(eq(aiJobs.status, query.status as typeof aiJobs.$inferSelect.status));
  if (query.jobType) filters.push(eq(aiJobs.jobType, query.jobType));
  const where = and(...filters);
  const [totalRow] = await db.select({ value: count() }).from(aiJobs).where(where);
  const rows = await db.query.aiJobs.findMany({
    where,
    orderBy: [desc(aiJobs.createdAt)],
    limit: query.limit,
    offset: query.offset,
  });
  return {
    items: rows.map(serializeJob),
    total: totalRow?.value ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

async function requireJob(db: AppDatabase, organizationId: string, jobId: string) {
  const row = await db.query.aiJobs.findFirst({
    where: and(eq(aiJobs.id, jobId), eq(aiJobs.organizationId, organizationId)),
  });
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos este job no seu acesso.");
  return row;
}

export async function getAiJob(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  jobId: string,
) {
  authorize(account, organizationId, (access) => policyAIJob(access, "ai.jobs.read"));
  return { job: serializeJob(await requireJob(db, organizationId, jobId)) };
}

export async function cancelAiJob(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  jobId: string,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) => policyAIJob(access, "ai.jobs.manage"));
  const job = await requireJob(db, organizationId, jobId);
  if (job.status !== "pending" && job.status !== "queued") {
    throw new AppError("CONFLICT", "Somente jobs pendentes ou enfileirados podem ser cancelados.");
  }
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(aiJobs)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(and(eq(aiJobs.id, jobId), eq(aiJobs.organizationId, organizationId)))
      .returning();
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "ai.job_cancelled",
      resourceType: "ai_job",
      resourceId: jobId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      metadata: { jobType: job.jobType },
    });
    return { job: serializeJob(updated ?? job) };
  });
}

/* ─── Orçamentos (micros inteiros) ─── */

function serializeBudget(row: typeof aiBudgets.$inferSelect, spent: number) {
  return {
    id: row.id,
    period: row.period,
    softLimitMicros: row.softLimitMicros,
    hardLimitMicros: row.hardLimitMicros,
    currency: row.currency,
    active: row.active,
    spentMicros: spent,
    softLimitExceeded: row.softLimitMicros != null && spent >= row.softLimitMicros,
    hardLimitExceeded: row.hardLimitMicros != null && spent >= row.hardLimitMicros,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function budgetSince(period: "daily" | "monthly") {
  const now = new Date();
  return period === "daily"
    ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function listAiBudgets(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  authorize(account, organizationId, (access) => policyAIUsage(access, "ai.usage.read"));
  const rows = await db.query.aiBudgets.findMany({
    where: eq(aiBudgets.organizationId, organizationId),
    orderBy: [asc(aiBudgets.period)],
  });
  const items = [];
  for (const row of rows) {
    items.push(
      serializeBudget(row, await spentMicros(db, organizationId, budgetSince(row.period))),
    );
  }
  return { items };
}

export async function upsertAiBudget(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    period: "daily" | "monthly";
    softLimitMicros?: number | null | undefined;
    hardLimitMicros?: number | null | undefined;
    currency: string;
    active: boolean;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) => policyAIConfiguration(access, "ai.config.manage"));
  try {
    return await db.transaction(async (tx) => {
      const existing = await tx.query.aiBudgets.findFirst({
        where: and(
          eq(aiBudgets.organizationId, organizationId),
          eq(aiBudgets.period, input.period),
        ),
      });
      const values = {
        softLimitMicros: input.softLimitMicros ?? null,
        hardLimitMicros: input.hardLimitMicros ?? null,
        currency: input.currency.toUpperCase(),
        active: input.active,
        updatedAt: new Date(),
      };
      const [row] = existing
        ? await tx.update(aiBudgets).set(values).where(eq(aiBudgets.id, existing.id)).returning()
        : await tx
            .insert(aiBudgets)
            .values({ organizationId, period: input.period, ...values })
            .returning();
      if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível salvar o orçamento.");
      await recordAudit(tx, {
        actorUserId: account.user.id,
        organizationId,
        action: "ai.budget_updated",
        resourceType: "ai_budget",
        resourceId: row.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        before: existing
          ? { softLimitMicros: existing.softLimitMicros, hardLimitMicros: existing.hardLimitMicros }
          : null,
        after: { softLimitMicros: row.softLimitMicros, hardLimitMicros: row.hardLimitMicros },
      });
      return {
        budget: serializeBudget(
          row,
          await spentMicros(tx as unknown as AppDatabase, organizationId, budgetSince(row.period)),
        ),
      };
    });
  } catch (error) {
    if (isUniqueViolation(error))
      throw new AppError("CONFLICT", "Orçamento já existente para o período.");
    throw error;
  }
}
