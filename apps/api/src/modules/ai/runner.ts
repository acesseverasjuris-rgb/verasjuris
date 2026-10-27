import {
  type AIGateway,
  type AIResult,
  type AIStructuredRequest,
  DEFAULT_AI_FEATURES,
  toAiAppError,
} from "@verasjuris/ai";
import { recordAudit } from "@verasjuris/audit";
import type { SessionAccount } from "@verasjuris/auth";
import {
  aiBudgets,
  aiJobs,
  aiModels,
  aiPromptVersions,
  aiPrompts,
  aiRequests,
  aiResponses,
  aiUsage,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { RequestMeta } from "../auth/service.js";
import { sanitizeAiOutput } from "./sanitize.js";

export const NOT_CONFIGURED_CODES = new Set(["AI_PROVIDER_NOT_CONFIGURED", "NOT_CONFIGURED"]);

export type AiRunContext = {
  db: AppDatabase;
  gateway: AIGateway;
  account: SessionAccount;
  organizationId: string;
  membershipId: string;
  meta: RequestMeta;
};

/** Referência estável a recurso de entrada — NUNCA o conteúdo. */
export type AiInputReference = string;

function periodStart(period: "daily" | "monthly", now = new Date()): Date {
  return period === "daily"
    ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function spentMicros(
  db: AppDatabase,
  organizationId: string,
  since: Date,
): Promise<number> {
  const [row] = await db
    .select({
      total: sql<string>`coalesce(sum(${aiUsage.estimatedCostMicros}), 0)::text`,
    })
    .from(aiUsage)
    .where(and(eq(aiUsage.organizationId, organizationId), gte(aiUsage.recordedAt, since)));
  return Number(row?.total ?? 0);
}

/** Menor saldo restante entre os orçamentos ativos com limite rígido; undefined = sem limite. */
export async function remainingBudgetMicros(
  db: AppDatabase,
  organizationId: string,
): Promise<number | undefined> {
  const budgets = await db.query.aiBudgets.findMany({
    where: and(eq(aiBudgets.organizationId, organizationId), eq(aiBudgets.active, true)),
  });
  let remaining: number | undefined;
  for (const budget of budgets) {
    if (budget.hardLimitMicros == null) continue;
    const spent = await spentMicros(db, organizationId, periodStart(budget.period));
    const left = budget.hardLimitMicros - spent;
    remaining = remaining === undefined ? left : Math.min(remaining, left);
  }
  return remaining;
}

/** Prompt ativo (catálogo global); sem versão ativa usa o texto padrão do código. */
export async function resolveActivePrompt(
  db: AppDatabase,
  key: string,
  defaultInstructions: string,
): Promise<{ instructions: string; promptVersionId: string | null; label: string }> {
  const prompt = await db.query.aiPrompts.findFirst({
    where: and(eq(aiPrompts.key, key), eq(aiPrompts.active, true)),
  });
  if (prompt) {
    const version = await db.query.aiPromptVersions.findFirst({
      where: and(eq(aiPromptVersions.promptId, prompt.id), eq(aiPromptVersions.status, "active")),
      orderBy: [desc(aiPromptVersions.version)],
    });
    if (version) {
      return {
        instructions: version.systemTemplate,
        promptVersionId: version.id,
        label: `${key}@${version.version}`,
      };
    }
  }
  return { instructions: defaultInstructions, promptVersionId: null, label: `${key}@builtin` };
}

export async function findAiRequestByIdempotency(
  db: AppDatabase,
  organizationId: string,
  feature: string,
  idempotencyKey: string,
) {
  return db.query.aiRequests.findFirst({
    where: and(
      eq(aiRequests.organizationId, organizationId),
      eq(aiRequests.feature, feature),
      eq(aiRequests.idempotencyKey, idempotencyKey),
    ),
  });
}

/**
 * Registra o job como executado em processo local (runtime `local_in_process`). Não existe fila
 * distribuída: o registro apenas dá rastreabilidade ao que foi executado dentro da requisição.
 */
export async function recordInProcessJob(
  db: AppDatabase,
  input: {
    organizationId: string;
    membershipId: string;
    jobType: string;
    resourceType: string;
    resourceId: string;
    status: "succeeded" | "failed" | "not_configured";
    errorCode?: string | null;
  },
): Promise<string> {
  const now = new Date();
  const [row] = await db
    .insert(aiJobs)
    .values({
      organizationId: input.organizationId,
      jobType: input.jobType,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      status: input.status,
      progress: input.status === "succeeded" ? 100 : 0,
      attempts: 1,
      runtime: "local_in_process",
      startedAt: now,
      completedAt: input.status === "succeeded" ? now : null,
      failedAt: input.status === "succeeded" ? null : now,
      lastErrorCode: input.errorCode ?? null,
      createdByMembershipId: input.membershipId,
    })
    .returning({ id: aiJobs.id });
  return row?.id ?? "";
}

async function resolveModelId(db: AppDatabase, provider: string, model: string) {
  const row = await db.query.aiModels.findFirst({
    where: and(eq(aiModels.providerKey, provider), eq(aiModels.externalModelId, model)),
    columns: { id: true },
  });
  return row?.id ?? null;
}

export type StructuredAiParams<T> = {
  feature: string;
  promptKey: string;
  defaultInstructions: string;
  input: string;
  inputLabel?: string;
  inputReference: AiInputReference;
  schema: AIStructuredRequest<T>["schema"];
  schemaName: string;
  idempotencyKey?: string;
  maxOutputTokens?: number;
};

export type StructuredAiOutcome<T> = {
  requestId: string;
  data: T;
  provider: string;
  model: string;
  promptVersion: string;
  outputDisposition: "draft" | "assistive" | "requires_review";
};

/** Registra a requisição como NOT_CONFIGURED e lança o erro padrão (sem chamar nenhum provedor). */
export async function recordAiNotConfigured(
  ctx: AiRunContext,
  params: { feature: string; inputReference: string },
  error?: AppError,
): Promise<never> {
  const failure =
    error ??
    new AppError(
      "AI_PROVIDER_NOT_CONFIGURED",
      "Nenhum provedor de IA está configurado. Nenhum texto foi gerado e nenhum fornecedor foi chamado.",
    );
  const [row] = await ctx.db
    .insert(aiRequests)
    .values({
      organizationId: ctx.organizationId,
      userId: ctx.account.user.id,
      membershipId: ctx.membershipId,
      feature: params.feature,
      provider: "not_configured",
      status: "not_configured",
      outputDisposition:
        DEFAULT_AI_FEATURES[params.feature]?.outputDisposition ?? "requires_review",
      inputReference: params.inputReference,
      correlationId: ctx.meta.requestId,
      finishedAt: new Date(),
      errorCode: failure.code,
      errorSafeMessage: failure.message,
    })
    .returning({ id: aiRequests.id });
  await recordAudit(ctx.db, {
    actorUserId: ctx.account.user.id,
    organizationId: ctx.organizationId,
    action: "ai.failed",
    resourceType: "ai_request",
    resourceId: row?.id ?? null,
    source: "api",
    requestId: ctx.meta.requestId,
    ip: ctx.meta.ip,
    metadata: {
      feature: params.feature,
      status: "not_configured",
      code: failure.code,
      inputReference: params.inputReference,
    },
  });
  throw failure;
}

/**
 * Executa uma geração estruturada via `AIGateway` com registro completo (requisição, resposta, uso em
 * micros, auditoria). A saída é sanitizada (sem HTML) e continua sendo apenas sugestão para revisão.
 * Auditoria/ai_requests guardam apenas referências e códigos — nunca o texto do documento.
 */
export async function runStructuredAi<T>(
  ctx: AiRunContext,
  params: StructuredAiParams<T>,
): Promise<StructuredAiOutcome<T>> {
  const description = ctx.gateway.describe();
  if (description.status === "not_configured") {
    return recordAiNotConfigured(ctx, {
      feature: params.feature,
      inputReference: params.inputReference,
    });
  }

  const prompt = await resolveActivePrompt(ctx.db, params.promptKey, params.defaultInstructions);
  const disposition = DEFAULT_AI_FEATURES[params.feature]?.outputDisposition ?? "requires_review";
  const startedAt = new Date();

  const [request] = await ctx.db
    .insert(aiRequests)
    .values({
      organizationId: ctx.organizationId,
      userId: ctx.account.user.id,
      membershipId: ctx.membershipId,
      feature: params.feature,
      provider: description.provider,
      promptVersionId: prompt.promptVersionId,
      status: "running",
      outputDisposition: disposition,
      inputReference: params.inputReference,
      correlationId: ctx.meta.requestId,
      idempotencyKey: params.idempotencyKey ?? null,
      startedAt,
    })
    .returning();
  if (!request)
    throw new AppError("INTERNAL_ERROR", "Não foi possível registrar a requisição de IA.");

  await recordAudit(ctx.db, {
    actorUserId: ctx.account.user.id,
    organizationId: ctx.organizationId,
    action: "ai.requested",
    resourceType: "ai_request",
    resourceId: request.id,
    source: "api",
    requestId: ctx.meta.requestId,
    ip: ctx.meta.ip,
    metadata: {
      feature: params.feature,
      provider: description.provider,
      promptVersion: prompt.label,
      inputReference: params.inputReference,
    },
  });

  const fail = async (raw: unknown): Promise<never> => {
    const error = toAiAppError(raw);
    const notConfigured = NOT_CONFIGURED_CODES.has(error.code);
    await ctx.db
      .update(aiRequests)
      .set({
        status: notConfigured ? "not_configured" : "failed",
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
        errorCode: error.code,
        errorSafeMessage: error.message,
      })
      .where(eq(aiRequests.id, request.id));
    await recordAudit(ctx.db, {
      actorUserId: ctx.account.user.id,
      organizationId: ctx.organizationId,
      action: "ai.failed",
      resourceType: "ai_request",
      resourceId: request.id,
      source: "api",
      requestId: ctx.meta.requestId,
      ip: ctx.meta.ip,
      metadata: { feature: params.feature, code: error.code },
    });
    throw error;
  };

  let remaining: number | undefined;
  try {
    remaining = await remainingBudgetMicros(ctx.db, ctx.organizationId);
    if (remaining !== undefined && remaining <= 0) {
      throw new AppError("AI_BUDGET_EXCEEDED", "O orçamento de IA da organização foi atingido.");
    }
  } catch (error) {
    return fail(error);
  }

  let result: AIResult<T>;
  try {
    result = await ctx.gateway.generateStructured({
      userId: ctx.account.user.id,
      organizationId: ctx.organizationId,
      feature: params.feature,
      promptVersion: prompt.label.slice(0, 40),
      instructions: prompt.instructions,
      input: params.input,
      ...(params.inputLabel ? { inputLabel: params.inputLabel } : {}),
      schema: params.schema,
      schemaName: params.schemaName,
      ...(params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : {}),
      ...(params.maxOutputTokens ? { maxOutputTokens: params.maxOutputTokens } : {}),
      ...(remaining !== undefined ? { remainingBudgetMicros: remaining } : {}),
    });
  } catch (error) {
    return fail(error);
  }

  const data = sanitizeAiOutput(result.data);
  const finishedAt = new Date();
  const modelId = await resolveModelId(ctx.db, result.provider, result.model);

  await ctx.db.transaction(async (tx) => {
    await tx
      .update(aiRequests)
      .set({
        status: "succeeded",
        modelId,
        finishedAt,
        durationMs: result.durationMs,
      })
      .where(eq(aiRequests.id, request.id));
    await tx.insert(aiResponses).values({
      aiRequestId: request.id,
      organizationId: ctx.organizationId,
      outputType: "structured",
      structuredResult: data as Record<string, unknown>,
      finishReason: result.finishReason,
      modelVersion: result.model,
    });
    await tx.insert(aiUsage).values({
      aiRequestId: request.id,
      organizationId: ctx.organizationId,
      userId: ctx.account.user.id,
      provider: result.provider,
      modelExternalId: result.model,
      feature: params.feature,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      cachedInputTokens: result.usage.cachedInputTokens,
      totalTokens: result.usage.totalTokens,
      tokensAreEstimate: result.usage.tokensAreEstimate,
      estimatedCostMicros: result.usage.estimatedCostMicros,
      providerReportedCostMicros: result.usage.providerReportedCostMicros,
      currency: result.usage.currency,
      durationMs: result.durationMs,
    });
    await recordAudit(tx, {
      actorUserId: ctx.account.user.id,
      organizationId: ctx.organizationId,
      action: "ai.completed",
      resourceType: "ai_request",
      resourceId: request.id,
      source: "api",
      requestId: ctx.meta.requestId,
      ip: ctx.meta.ip,
      metadata: {
        feature: params.feature,
        provider: result.provider,
        model: result.model,
        totalTokens: result.usage.totalTokens,
        estimatedCostMicros: result.usage.estimatedCostMicros,
      },
    });
  });

  return {
    requestId: request.id,
    data,
    provider: result.provider,
    model: result.model,
    promptVersion: prompt.label,
    outputDisposition: result.outputDisposition,
  };
}
