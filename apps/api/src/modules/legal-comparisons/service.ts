import { createHash, randomUUID } from "node:crypto";
import {
  type AIGateway,
  LEGAL_COMPARISON_FEATURE,
  LEGAL_COMPARISON_INSTRUCTIONS,
  LEGAL_COMPARISON_TYPE_INSTRUCTIONS,
  type LegalComparisonOutput,
  type LegalComparisonType,
  legalComparisonOutputSchema,
} from "@verasjuris/ai";
import { recordAudit } from "@verasjuris/audit";
import { policyLegalComparison, type SessionAccount } from "@verasjuris/auth";
import {
  type AppDatabase,
  documentPages,
  documents,
  documentVersions,
  isUniqueViolation,
  legalComparisonItems,
  legalComparisons,
  legalComparisonSources,
  legalMatters,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  findAiRequestByIdempotency,
  recordAiNotConfigured,
  recordInProcessJob,
  runStructuredAi,
} from "../ai/runner.js";
import { authorize, iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";
import { assertCanReadDocument, requireDocumentInOrg } from "../documents/service.js";

const MAX_INPUT_CHARS = 200_000;
const FEATURE = LEGAL_COMPARISON_FEATURE;

export type LegalComparisonDeps = { db: AppDatabase; gateway: AIGateway };

export type CreateLegalComparisonInput = {
  comparisonType: LegalComparisonType;
  legalMatterId?: string | undefined;
  title?: string | undefined;
  sources: Array<{
    documentId: string;
    documentVersionId?: string | undefined;
    roleInComparison: string;
    sortOrder: number;
  }>;
  idempotencyKey?: string | undefined;
};

type ComparisonRow = typeof legalComparisons.$inferSelect;
type ItemRow = typeof legalComparisonItems.$inferSelect;

function serializeComparison(row: ComparisonRow) {
  return {
    id: row.id,
    comparisonType: row.comparisonType,
    status: row.status,
    title: row.title,
    summary: row.summary,
    legalMatterId: row.legalMatterId,
    aiRequestId: row.aiRequestId,
    assistive: true as const,
    appliedToDomain: false as const,
    reviewComment: row.reviewComment,
    completedAt: iso(row.completedAt),
    reviewedAt: iso(row.reviewedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function hasProvenance(provenance: Record<string, unknown> | null | undefined): boolean {
  if (!provenance || typeof provenance !== "object") return false;
  const labelA = provenance.sourceALabel;
  const labelB = provenance.sourceBLabel;
  const pageA = provenance.pageA;
  const pageB = provenance.pageB;
  const excerptA = provenance.excerptA;
  const excerptB = provenance.excerptB;
  return Boolean(
    (typeof labelA === "string" && labelA.trim()) ||
      (typeof labelB === "string" && labelB.trim()) ||
      typeof pageA === "number" ||
      typeof pageB === "number" ||
      (typeof excerptA === "string" && excerptA.trim()) ||
      (typeof excerptB === "string" && excerptB.trim()),
  );
}

function serializeItem(row: ItemRow) {
  const provenance =
    row.provenance && typeof row.provenance === "object"
      ? (row.provenance as Record<string, unknown>)
      : null;
  return {
    id: row.id,
    category: row.category,
    sourceA: row.sourceA,
    sourceB: row.sourceB,
    finding: row.finding,
    severity: row.severity,
    confidence: row.confidence,
    provenance,
    unsupported: !hasProvenance(provenance),
    reviewStatus: row.reviewStatus,
    reviewerComment: row.reviewerComment,
    reviewedAt: iso(row.reviewedAt),
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function requireComparison(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  comparisonId: string,
) {
  authorize(account, organizationId, (access) =>
    policyLegalComparison(access, "legal_comparison.read"),
  );
  const row = await db.query.legalComparisons.findFirst({
    where: and(
      eq(legalComparisons.id, comparisonId),
      eq(legalComparisons.organizationId, organizationId),
    ),
  });
  if (!row) {
    throw new AppError("NOT_FOUND", "Não encontramos esta comparação no seu acesso.");
  }
  const sources = await db.query.legalComparisonSources.findMany({
    where: and(
      eq(legalComparisonSources.comparisonId, row.id),
      eq(legalComparisonSources.organizationId, organizationId),
    ),
  });
  for (const source of sources) {
    const doc = await db.query.documents.findFirst({
      where: and(eq(documents.id, source.documentId), eq(documents.organizationId, organizationId)),
    });
    if (!doc) continue;
    try {
      await assertCanReadDocument(db, account, organizationId, doc);
    } catch {
      throw new AppError("NOT_FOUND", "Não encontramos esta comparação no seu acesso.");
    }
  }
  return row;
}

async function loadSources(db: AppDatabase, organizationId: string, comparisonId: string) {
  const rows = await db.query.legalComparisonSources.findMany({
    where: and(
      eq(legalComparisonSources.comparisonId, comparisonId),
      eq(legalComparisonSources.organizationId, organizationId),
    ),
    orderBy: [asc(legalComparisonSources.sortOrder), asc(legalComparisonSources.createdAt)],
  });
  return rows.map((row) => ({
    id: row.id,
    documentId: row.documentId,
    documentVersionId: row.documentVersionId,
    roleInComparison: row.roleInComparison,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
  }));
}

async function loadItems(db: AppDatabase, organizationId: string, comparisonId: string) {
  const rows = await db.query.legalComparisonItems.findMany({
    where: and(
      eq(legalComparisonItems.comparisonId, comparisonId),
      eq(legalComparisonItems.organizationId, organizationId),
    ),
    orderBy: [asc(legalComparisonItems.sortOrder), asc(legalComparisonItems.createdAt)],
  });
  return rows.map(serializeItem);
}

async function buildSourceText(
  db: AppDatabase,
  organizationId: string,
  source: {
    documentId: string;
    documentVersionId: string | null;
    roleInComparison: string;
  },
): Promise<string> {
  const doc = await requireDocumentInOrg(db, organizationId, source.documentId);
  let versionId = source.documentVersionId ?? doc.currentVersionId;
  if (!versionId) {
    const latest = await db.query.documentVersions.findFirst({
      where: and(
        eq(documentVersions.documentId, doc.id),
        eq(documentVersions.organizationId, organizationId),
      ),
      orderBy: [desc(documentVersions.versionNumber)],
    });
    versionId = latest?.id ?? null;
  }
  if (!versionId) {
    return `[${source.roleInComparison}] ${doc.title}\n(sem texto extraído)`;
  }
  const pages = await db.query.documentPages.findMany({
    where: and(
      eq(documentPages.documentVersionId, versionId),
      eq(documentPages.organizationId, organizationId),
    ),
    orderBy: [asc(documentPages.pageNumber)],
  });
  const text = pages
    .map((page) => page.text?.trim() ?? "")
    .filter(Boolean)
    .join("\n\n");
  return `[${source.roleInComparison}] ${doc.title}\n${text || "(sem texto extraído)"}`;
}

export async function createLegalComparison(
  deps: LegalComparisonDeps,
  account: SessionAccount,
  organizationId: string,
  input: CreateLegalComparisonInput,
  meta: RequestMeta,
) {
  const actor = authorize(account, organizationId, (access) =>
    policyLegalComparison(access, "legal_comparison.create"),
  );

  if (input.legalMatterId) {
    const matter = await deps.db.query.legalMatters.findFirst({
      where: and(
        eq(legalMatters.id, input.legalMatterId),
        eq(legalMatters.organizationId, organizationId),
      ),
      columns: { id: true },
    });
    if (!matter) {
      throw new AppError("NOT_FOUND", "Não encontramos este caso no seu acesso.");
    }
  }

  for (const source of input.sources) {
    const doc = await requireDocumentInOrg(deps.db, organizationId, source.documentId);
    await assertCanReadDocument(deps.db, account, organizationId, doc);
    if (source.documentVersionId) {
      const version = await deps.db.query.documentVersions.findFirst({
        where: and(
          eq(documentVersions.id, source.documentVersionId),
          eq(documentVersions.documentId, doc.id),
          eq(documentVersions.organizationId, organizationId),
        ),
      });
      if (!version) {
        throw new AppError("NOT_FOUND", "Não encontramos esta versão de documento no seu acesso.");
      }
    }
  }

  try {
    const created = await deps.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(legalComparisons)
        .values({
          organizationId,
          legalMatterId: input.legalMatterId ?? null,
          comparisonType: input.comparisonType,
          status: "draft",
          title: input.title ?? null,
          createdByMembershipId: actor.membershipId,
        })
        .returning();
      if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a comparação.");

      await tx.insert(legalComparisonSources).values(
        input.sources.map((source) => ({
          organizationId,
          comparisonId: row.id,
          documentId: source.documentId,
          documentVersionId: source.documentVersionId ?? null,
          roleInComparison:
            source.roleInComparison as typeof legalComparisonSources.$inferInsert.roleInComparison,
          sortOrder: source.sortOrder,
        })),
      );

      await recordAudit(tx, {
        actorUserId: account.user.id,
        organizationId,
        action: "legal_comparison.created",
        resourceType: "legal_comparison",
        resourceId: row.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        after: {
          comparisonType: row.comparisonType,
          sourceCount: input.sources.length,
        },
      });
      return row;
    });

    const [sources, items] = await Promise.all([
      loadSources(deps.db, organizationId, created.id),
      loadItems(deps.db, organizationId, created.id),
    ]);
    return {
      comparison: { ...serializeComparison(created), sources, items, pendingReviewItems: 0 },
      replayed: false,
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("CONFLICT", "Já existe um recurso com esta chave de idempotência.");
    }
    throw error;
  }
}

export async function listLegalComparisons(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: {
    legalMatterId?: string | undefined;
    comparisonType?: string | undefined;
    status?: string | undefined;
    limit: number;
    offset: number;
  },
) {
  authorize(account, organizationId, (access) =>
    policyLegalComparison(access, "legal_comparison.read"),
  );
  const conditions = [eq(legalComparisons.organizationId, organizationId)];
  if (query.legalMatterId) {
    conditions.push(eq(legalComparisons.legalMatterId, query.legalMatterId));
  }
  if (query.comparisonType) {
    conditions.push(
      eq(legalComparisons.comparisonType, query.comparisonType as ComparisonRow["comparisonType"]),
    );
  }
  if (query.status) {
    conditions.push(eq(legalComparisons.status, query.status as ComparisonRow["status"]));
  }
  const rows = await db.query.legalComparisons.findMany({
    where: and(...conditions),
    orderBy: [desc(legalComparisons.createdAt)],
    limit: query.limit,
    offset: query.offset,
  });
  return { items: rows.map(serializeComparison), limit: query.limit, offset: query.offset };
}

export async function getLegalComparison(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  comparisonId: string,
) {
  const row = await requireComparison(db, account, organizationId, comparisonId);
  const [sources, items] = await Promise.all([
    loadSources(db, organizationId, row.id),
    loadItems(db, organizationId, row.id),
  ]);
  const pendingReviewItems = items.filter((item) => item.reviewStatus === "unreviewed").length;
  return {
    comparison: {
      ...serializeComparison(row),
      structuredResult: row.structuredResult,
      sources,
      items,
      pendingReviewItems,
    },
  };
}

async function persistItems(
  db: AppDatabase,
  organizationId: string,
  comparisonId: string,
  output: LegalComparisonOutput,
) {
  await db
    .delete(legalComparisonItems)
    .where(
      and(
        eq(legalComparisonItems.comparisonId, comparisonId),
        eq(legalComparisonItems.organizationId, organizationId),
      ),
    );
  if (output.items.length === 0) return;
  await db.insert(legalComparisonItems).values(
    output.items.map((item, index) => ({
      organizationId,
      comparisonId,
      category: item.category,
      sourceA: item.sourceA,
      sourceB: item.sourceB,
      finding: item.finding,
      severity: item.severity,
      confidence: item.confidence,
      provenance: item.provenance as Record<string, unknown>,
      sortOrder: index,
    })),
  );
}

export async function runLegalComparison(
  deps: LegalComparisonDeps,
  account: SessionAccount,
  organizationId: string,
  comparisonId: string,
  input: { idempotencyKey?: string | undefined },
  meta: RequestMeta,
) {
  const actor = authorize(account, organizationId, (access) =>
    policyLegalComparison(access, "legal_comparison.run"),
  );
  const row = await requireComparison(deps.db, account, organizationId, comparisonId);

  if (input.idempotencyKey) {
    const existing = await findAiRequestByIdempotency(
      deps.db,
      organizationId,
      FEATURE,
      input.idempotencyKey,
    );
    if (existing?.status === "succeeded") {
      return getLegalComparison(deps.db, account, organizationId, comparisonId);
    }
  }

  const sources = await deps.db.query.legalComparisonSources.findMany({
    where: and(
      eq(legalComparisonSources.comparisonId, row.id),
      eq(legalComparisonSources.organizationId, organizationId),
    ),
    orderBy: [asc(legalComparisonSources.sortOrder)],
  });

  const chunks: string[] = [];
  for (const source of sources) {
    chunks.push(await buildSourceText(deps.db, organizationId, source));
  }
  let joined = chunks.join("\n\n---\n\n");
  if (joined.length > MAX_INPUT_CHARS) {
    joined = joined.slice(0, MAX_INPUT_CHARS);
  }
  const inputReference = createHash("sha256")
    .update(`${row.id}:${row.comparisonType}:${joined.length}`)
    .digest("hex")
    .slice(0, 32);

  await deps.db
    .update(legalComparisons)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(legalComparisons.id, row.id));

  const ctx = {
    db: deps.db,
    gateway: deps.gateway,
    account,
    organizationId,
    membershipId: actor.membershipId,
    meta,
  };

  const description = deps.gateway.describe();
  if (description.status === "not_configured") {
    await deps.db
      .update(legalComparisons)
      .set({ status: "not_configured", updatedAt: new Date() })
      .where(eq(legalComparisons.id, row.id));
    await recordInProcessJob(deps.db, {
      organizationId,
      membershipId: actor.membershipId,
      jobType: FEATURE,
      resourceType: "legal_comparison",
      resourceId: row.id,
      status: "not_configured",
      errorCode: "AI_PROVIDER_NOT_CONFIGURED",
    });
    await recordAudit(deps.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "legal_comparison.run_not_configured",
      resourceType: "legal_comparison",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
    });
    await recordAiNotConfigured(ctx, { feature: FEATURE, inputReference });
  }

  const typeInstructions =
    LEGAL_COMPARISON_TYPE_INSTRUCTIONS[row.comparisonType as LegalComparisonType] ??
    LEGAL_COMPARISON_INSTRUCTIONS;

  try {
    const outcome = await runStructuredAi(ctx, {
      feature: FEATURE,
      promptKey: FEATURE,
      defaultInstructions: typeInstructions,
      input: `comparisonType=${row.comparisonType}\n\n${joined}`,
      inputLabel: "fontes_comparacao",
      inputReference,
      schema: legalComparisonOutputSchema,
      schemaName: "LegalComparisonOutput",
      idempotencyKey: input.idempotencyKey ?? `legal-comparison:${row.id}:${randomUUID()}`,
    });

    const output = outcome.data;
    await persistItems(deps.db, organizationId, row.id, output);
    const now = new Date();
    await deps.db
      .update(legalComparisons)
      .set({
        status: "human_review",
        summary: output.summary ?? null,
        structuredResult: output as unknown as Record<string, unknown>,
        aiRequestId: outcome.requestId,
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(legalComparisons.id, row.id));

    await recordInProcessJob(deps.db, {
      organizationId,
      membershipId: actor.membershipId,
      jobType: FEATURE,
      resourceType: "legal_comparison",
      resourceId: row.id,
      status: "succeeded",
    });
    await recordAudit(deps.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "legal_comparison.generated",
      resourceType: "legal_comparison",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { itemCount: output.items.length, aiRequestId: outcome.requestId },
    });

    return getLegalComparison(deps.db, account, organizationId, row.id);
  } catch (error) {
    if (error instanceof AppError && error.code === "AI_PROVIDER_NOT_CONFIGURED") {
      throw error;
    }
    await deps.db
      .update(legalComparisons)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(legalComparisons.id, row.id));
    throw error;
  }
}

export async function reviewLegalComparisonItem(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  comparisonId: string,
  itemId: string,
  input: { reviewStatus: string; reviewerComment?: string | undefined },
  meta: RequestMeta,
) {
  const actor = authorize(account, organizationId, (access) =>
    policyLegalComparison(access, "legal_comparison.review"),
  );
  await requireComparison(db, account, organizationId, comparisonId);
  const item = await db.query.legalComparisonItems.findFirst({
    where: and(
      eq(legalComparisonItems.id, itemId),
      eq(legalComparisonItems.comparisonId, comparisonId),
      eq(legalComparisonItems.organizationId, organizationId),
    ),
  });
  if (!item) {
    throw new AppError("NOT_FOUND", "Não encontramos este item de comparação no seu acesso.");
  }
  const now = new Date();
  const [updated] = await db
    .update(legalComparisonItems)
    .set({
      reviewStatus: input.reviewStatus as ItemRow["reviewStatus"],
      reviewerComment: input.reviewerComment ?? null,
      reviewedByMembershipId: actor.membershipId,
      reviewedAt: now,
      updatedAt: now,
    })
    .where(eq(legalComparisonItems.id, item.id))
    .returning();
  if (!updated) throw new AppError("INTERNAL_ERROR", "Não foi possível revisar o item.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "legal_comparison.item_reviewed",
    resourceType: "legal_comparison_item",
    resourceId: item.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { reviewStatus: input.reviewStatus },
  });
  return { item: serializeItem(updated) };
}

export async function reviewLegalComparison(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  comparisonId: string,
  input: { reviewComment?: string | undefined; status: "human_review" | "reviewed" | "closed" },
  meta: RequestMeta,
) {
  const actor = authorize(account, organizationId, (access) =>
    policyLegalComparison(access, "legal_comparison.review"),
  );
  const row = await requireComparison(db, account, organizationId, comparisonId);
  const now = new Date();
  const [updated] = await db
    .update(legalComparisons)
    .set({
      status: input.status,
      reviewComment: input.reviewComment ?? row.reviewComment,
      reviewedByMembershipId: actor.membershipId,
      reviewedAt: now,
      updatedAt: now,
    })
    .where(eq(legalComparisons.id, row.id))
    .returning();
  if (!updated) throw new AppError("INTERNAL_ERROR", "Não foi possível concluir a revisão.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "legal_comparison.reviewed",
    resourceType: "legal_comparison",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { status: input.status },
  });
  return getLegalComparison(db, account, organizationId, row.id);
}
