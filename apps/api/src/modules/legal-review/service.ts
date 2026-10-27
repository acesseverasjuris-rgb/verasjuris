import { createHash, randomUUID } from "node:crypto";
import {
  type AIGateway,
  LEGAL_REVIEW_INSTRUCTIONS,
  type LegalReviewOutput,
  legalReviewOutputSchema,
} from "@verasjuris/ai";
import { recordAudit } from "@verasjuris/audit";
import {
  policyAiLegalReviewRequest,
  policyLegalReview,
  policyLegalReviewItem,
  policyLegalReviewSet,
  type SessionAccount,
} from "@verasjuris/auth";
import {
  administrativeProcesses,
  type AppDatabase,
  aiRequests,
  aiResultSources,
  documentPages,
  documents,
  documentVersions,
  isUniqueViolation,
  judicialProcesses,
  legalAiReviews,
  legalMatters,
  legalReviewContradictions,
  legalReviewFormalIssues,
  legalReviewInconsistencies,
  legalReviewMissingDocuments,
  legalReviewRisks,
  legalReviewSetDocuments,
  legalReviewSets,
  legalReviewUnaddressedClaims,
  legalReviewUnansweredGrounds,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, asc, type Column, desc, eq, isNull, max, ne, type SQL } from "drizzle-orm";
import {
  findAiRequestByIdempotency,
  recordAiNotConfigured,
  recordInProcessJob,
  runStructuredAi,
} from "../ai/runner.js";
import { authorize } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";
import { assertCanReadDocument, requireDocumentInOrg } from "../documents/service.js";

const MAX_INPUT_CHARS = 200_000;
const FEATURE = "legal_review";
const MISSING_DOC_MESSAGE = "Documento não localizado no conjunto analisado.";

export type LegalReviewDeps = { db: AppDatabase; gateway: AIGateway };

export type CreateLegalReviewSetInput = {
  name: string;
  legalMatterId?: string | undefined;
  documents: Array<{
    documentId: string;
    documentVersionId?: string | undefined;
    roleInReview: string;
    sortOrder: number;
  }>;
};

export type CreateLegalReviewInput = {
  reviewType: string;
  legalMatterId?: string | undefined;
  judicialProcessId?: string | undefined;
  administrativeProcessId?: string | undefined;
  primaryDocumentId?: string | undefined;
  reviewSetId?: string | undefined;
  idempotencyKey?: string | undefined;
};

/* ─── Serialização ─── */

function serializeReview(row: typeof legalAiReviews.$inferSelect) {
  return {
    id: row.id,
    reviewType: row.reviewType,
    status: row.status,
    version: row.version,
    /** Apoio assistivo: nunca se aplica automaticamente ao domínio. */
    assistive: true,
    appliedToDomain: false,
    summary: row.summary,
    legalMatterId: row.legalMatterId,
    judicialProcessId: row.judicialProcessId,
    administrativeProcessId: row.administrativeProcessId,
    primaryDocumentId: row.primaryDocumentId,
    reviewSetId: row.reviewSetId,
    aiRequestId: row.aiRequestId,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    reviewComment: row.reviewComment,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeSet(row: typeof legalReviewSets.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    legalMatterId: row.legalMatterId,
    createdAt: row.createdAt.toISOString(),
  };
}

function hasProvenance(source?: string | null, page?: number | null): boolean {
  return Boolean((source && source.trim().length > 0) || page != null);
}

function stripOrgCreated<T extends { organizationId: string; createdAt: Date }>(row: T) {
  const { organizationId: _org, createdAt, ...rest } = row;
  return { ...rest, createdAt: createdAt.toISOString() };
}

async function loadSections(db: AppDatabase, organizationId: string, reviewId: string) {
  const where = (candidate: unknown) => {
    const table = candidate as typeof legalReviewFormalIssues;
    return and(eq(table.organizationId, organizationId), eq(table.reviewId, reviewId));
  };
  const [
    formalIssues,
    missingDocuments,
    unaddressedClaims,
    unansweredGrounds,
    risks,
    inconsistencies,
    contradictions,
  ] = await Promise.all([
    db.query.legalReviewFormalIssues.findMany({
      where: where(legalReviewFormalIssues),
      orderBy: [asc(legalReviewFormalIssues.createdAt), asc(legalReviewFormalIssues.id)],
    }),
    db.query.legalReviewMissingDocuments.findMany({
      where: where(legalReviewMissingDocuments),
      orderBy: [asc(legalReviewMissingDocuments.createdAt), asc(legalReviewMissingDocuments.id)],
    }),
    db.query.legalReviewUnaddressedClaims.findMany({
      where: where(legalReviewUnaddressedClaims),
      orderBy: [asc(legalReviewUnaddressedClaims.createdAt), asc(legalReviewUnaddressedClaims.id)],
    }),
    db.query.legalReviewUnansweredGrounds.findMany({
      where: where(legalReviewUnansweredGrounds),
    }),
    db.query.legalReviewRisks.findMany({ where: where(legalReviewRisks) }),
    db.query.legalReviewInconsistencies.findMany({ where: where(legalReviewInconsistencies) }),
    db.query.legalReviewContradictions.findMany({ where: where(legalReviewContradictions) }),
  ]);

  return {
    formalIssues: formalIssues.map((row) => ({
      ...stripOrgCreated(row),
      unsupported: !hasProvenance(row.sourceLabel, row.pageNumber),
    })),
    missingDocuments: missingDocuments.map((row) => ({
      ...stripOrgCreated(row),
      message: MISSING_DOC_MESSAGE,
      unsupported: !hasProvenance(row.sourceLabel, null),
    })),
    unaddressedClaims: unaddressedClaims.map((row) => ({
      ...stripOrgCreated(row),
      unsupported: !hasProvenance(null, row.sourcePage),
    })),
    unansweredGrounds: unansweredGrounds.map((row) => ({
      ...stripOrgCreated(row),
      /** Procedência jurídica nunca é afirmada pela IA. */
      juridicallyFounded: false,
      unsupported: !hasProvenance(row.sourceLabel, null),
    })),
    risks: risks.map((row) => ({
      ...stripOrgCreated(row),
      unsupported: !hasProvenance(row.sourceLabel, null),
    })),
    inconsistencies: inconsistencies.map((row) => ({
      ...stripOrgCreated(row),
      unsupported: !hasProvenance(row.sourceLabel, null),
    })),
    contradictions: contradictions.map((row) => ({
      ...stripOrgCreated(row),
      /** UI: sempre “possível contradição” até revisão humana confirmar. */
      possibleContradiction: true,
      unsupported: !hasProvenance(row.sourceA ?? row.sourceB, row.pageA ?? row.pageB),
    })),
  };
}

type Sections = Awaited<ReturnType<typeof loadSections>>;

function countPending(sections: Sections): number {
  return Object.values(sections)
    .flat()
    .filter((item) => (item as { reviewStatus: string }).reviewStatus === "unreviewed").length;
}

/* ─── Acesso ─── */

async function sourceDocumentIdsForReview(
  db: AppDatabase,
  organizationId: string,
  row: typeof legalAiReviews.$inferSelect,
) {
  const ids = new Set<string>();
  if (row.primaryDocumentId) ids.add(row.primaryDocumentId);
  if (row.reviewSetId) {
    const setDocs = await db.query.legalReviewSetDocuments.findMany({
      where: and(
        eq(legalReviewSetDocuments.reviewSetId, row.reviewSetId),
        eq(legalReviewSetDocuments.organizationId, organizationId),
      ),
      columns: { documentId: true },
    });
    for (const doc of setDocs) ids.add(doc.documentId);
  }
  if (row.aiRequestId) {
    const sources = await db.query.aiResultSources.findMany({
      where: and(
        eq(aiResultSources.aiRequestId, row.aiRequestId),
        eq(aiResultSources.organizationId, organizationId),
      ),
      columns: { documentId: true },
    });
    for (const source of sources) if (source.documentId) ids.add(source.documentId);
  }
  return [...ids];
}

async function canReadReview(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  row: typeof legalAiReviews.$inferSelect,
): Promise<boolean> {
  for (const documentId of await sourceDocumentIdsForReview(db, organizationId, row)) {
    const doc = await db.query.documents.findFirst({
      where: and(eq(documents.id, documentId), eq(documents.organizationId, organizationId)),
    });
    if (!doc) continue;
    try {
      await assertCanReadDocument(db, account, organizationId, doc);
    } catch {
      return false;
    }
  }
  return true;
}

async function requireReview(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  reviewId: string,
) {
  const row = await db.query.legalAiReviews.findFirst({
    where: and(eq(legalAiReviews.id, reviewId), eq(legalAiReviews.organizationId, organizationId)),
  });
  if (!row || !(await canReadReview(db, account, organizationId, row))) {
    throw new AppError("NOT_FOUND", "Não encontramos esta revisão no seu acesso.");
  }
  return row;
}

async function requireReviewSet(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  setId: string,
) {
  const row = await db.query.legalReviewSets.findFirst({
    where: and(eq(legalReviewSets.id, setId), eq(legalReviewSets.organizationId, organizationId)),
  });
  if (!row) {
    throw new AppError("NOT_FOUND", "Não encontramos este conjunto de revisão no seu acesso.");
  }
  const setDocs = await db.query.legalReviewSetDocuments.findMany({
    where: and(
      eq(legalReviewSetDocuments.reviewSetId, setId),
      eq(legalReviewSetDocuments.organizationId, organizationId),
    ),
  });
  for (const entry of setDocs) {
    const doc = await db.query.documents.findFirst({
      where: and(eq(documents.id, entry.documentId), eq(documents.organizationId, organizationId)),
    });
    if (!doc) {
      throw new AppError("NOT_FOUND", "Não encontramos este conjunto de revisão no seu acesso.");
    }
    try {
      await assertCanReadDocument(db, account, organizationId, doc);
    } catch {
      throw new AppError("NOT_FOUND", "Não encontramos este conjunto de revisão no seu acesso.");
    }
  }
  return { set: row, documents: setDocs };
}

/* ─── Conjuntos ─── */

export async function createLegalReviewSet(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: CreateLegalReviewSetInput,
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyLegalReviewSet(access, "legal_review.create"),
  );
  if (input.legalMatterId) {
    const matter = await db.query.legalMatters.findFirst({
      where: and(
        eq(legalMatters.id, input.legalMatterId),
        eq(legalMatters.organizationId, organizationId),
      ),
      columns: { id: true },
    });
    if (!matter) throw new AppError("NOT_FOUND", "Não encontramos este caso no seu acesso.");
  }

  const resolved: Array<{
    documentId: string;
    documentVersionId: string | null;
    roleInReview: string;
    sortOrder: number;
  }> = [];
  for (const entry of input.documents) {
    const doc = await requireDocumentInOrg(db, organizationId, entry.documentId);
    await assertCanReadDocument(db, account, organizationId, doc);
    let versionId = entry.documentVersionId ?? doc.currentVersionId ?? null;
    if (entry.documentVersionId) {
      const version = await db.query.documentVersions.findFirst({
        where: and(
          eq(documentVersions.id, entry.documentVersionId),
          eq(documentVersions.organizationId, organizationId),
          eq(documentVersions.documentId, entry.documentId),
        ),
        columns: { id: true },
      });
      if (!version) {
        throw new AppError("NOT_FOUND", "Não encontramos esta versão do documento no seu acesso.");
      }
      versionId = version.id;
    }
    resolved.push({
      documentId: doc.id,
      documentVersionId: versionId,
      roleInReview: entry.roleInReview,
      sortOrder: entry.sortOrder,
    });
  }

  const setId = await db.transaction(async (tx) => {
    const [set] = await tx
      .insert(legalReviewSets)
      .values({
        organizationId,
        name: input.name,
        legalMatterId: input.legalMatterId ?? null,
        createdByMembershipId: membership.membershipId,
      })
      .returning();
    if (!set) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o conjunto de revisão.");
    await tx.insert(legalReviewSetDocuments).values(
      resolved.map((entry) => ({
        organizationId,
        reviewSetId: set.id,
        documentId: entry.documentId,
        documentVersionId: entry.documentVersionId,
        roleInReview:
          entry.roleInReview as typeof legalReviewSetDocuments.$inferInsert.roleInReview,
        sortOrder: entry.sortOrder,
      })),
    );
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "legal_review_set.created",
      resourceType: "legal_review_set",
      resourceId: set.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      metadata: { documents: resolved.length, legalMatterId: input.legalMatterId ?? null },
    });
    return set.id;
  });
  return getLegalReviewSet(db, account, organizationId, setId);
}

export async function listLegalReviewSets(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { legalMatterId?: string | undefined; limit: number; offset: number },
) {
  authorize(account, organizationId, (access) => policyLegalReviewSet(access, "legal_review.read"));
  const filters = [eq(legalReviewSets.organizationId, organizationId)];
  if (query.legalMatterId) filters.push(eq(legalReviewSets.legalMatterId, query.legalMatterId));
  const rows = await db.query.legalReviewSets.findMany({
    where: and(...filters),
    orderBy: [desc(legalReviewSets.createdAt)],
    limit: 500,
  });
  const visible = [];
  for (const row of rows) {
    try {
      await requireReviewSet(db, account, organizationId, row.id);
      visible.push(serializeSet(row));
    } catch {
      // sem ACL em todos os documentos do conjunto => omitido
    }
  }
  return {
    items: visible.slice(query.offset, query.offset + query.limit),
    total: visible.length,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function getLegalReviewSet(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  setId: string,
) {
  authorize(account, organizationId, (access) => policyLegalReviewSet(access, "legal_review.read"));
  const { set, documents: setDocs } = await requireReviewSet(db, account, organizationId, setId);
  return {
    reviewSet: {
      ...serializeSet(set),
      documents: setDocs
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime())
        .map((entry) => ({
          id: entry.id,
          documentId: entry.documentId,
          documentVersionId: entry.documentVersionId,
          roleInReview: entry.roleInReview,
          sortOrder: entry.sortOrder,
          createdAt: entry.createdAt.toISOString(),
        })),
    },
  };
}

/* ─── Fontes / escopo ─── */

async function assertScope(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: CreateLegalReviewInput,
) {
  const notFound = (what: string) =>
    new AppError("NOT_FOUND", `Não encontramos ${what} no seu acesso.`);
  if (input.primaryDocumentId) {
    const doc = await requireDocumentInOrg(db, organizationId, input.primaryDocumentId);
    await assertCanReadDocument(db, account, organizationId, doc);
  }
  if (input.reviewSetId) {
    await requireReviewSet(db, account, organizationId, input.reviewSetId);
  }
  if (input.legalMatterId) {
    const row = await db.query.legalMatters.findFirst({
      where: and(
        eq(legalMatters.id, input.legalMatterId),
        eq(legalMatters.organizationId, organizationId),
      ),
      columns: { id: true },
    });
    if (!row) throw notFound("este caso");
  }
  if (input.judicialProcessId) {
    const row = await db.query.judicialProcesses.findFirst({
      where: and(
        eq(judicialProcesses.id, input.judicialProcessId),
        eq(judicialProcesses.organizationId, organizationId),
      ),
      columns: { id: true },
    });
    if (!row) throw notFound("este processo judicial");
  }
  if (input.administrativeProcessId) {
    const row = await db.query.administrativeProcesses.findFirst({
      where: and(
        eq(administrativeProcesses.id, input.administrativeProcessId),
        eq(administrativeProcesses.organizationId, organizationId),
      ),
      columns: { id: true },
    });
    if (!row) throw notFound("este processo administrativo");
  }
}

type SourceDocument = {
  documentId: string;
  versionId: string;
  title: string;
  versionNumber: number;
  roleInReview: string | null;
  textHash: string | null;
  text: string;
};

async function loadDocumentText(
  db: AppDatabase,
  organizationId: string,
  doc: typeof documents.$inferSelect,
  versionIdHint?: string | null,
  roleInReview?: string | null,
): Promise<SourceDocument | null> {
  const versionId = versionIdHint ?? doc.currentVersionId;
  if (!versionId) return null;
  const version = await db.query.documentVersions.findFirst({
    where: and(
      eq(documentVersions.id, versionId),
      eq(documentVersions.organizationId, organizationId),
      eq(documentVersions.documentId, doc.id),
    ),
  });
  if (!version || version.status !== "available") return null;
  const pages = await db.query.documentPages.findMany({
    where: and(
      eq(documentPages.documentVersionId, version.id),
      eq(documentPages.organizationId, organizationId),
    ),
    orderBy: [asc(documentPages.pageNumber)],
  });
  if (pages.length === 0) return null;
  const body = pages.map((page) => `[página ${page.pageNumber}]\n${page.text}`).join("\n\n");
  const roleLabel = roleInReview ? ` papel=${roleInReview}` : "";
  const header = `### DOCUMENTO ${doc.id} v${version.versionNumber}${roleLabel}\n`;
  return {
    documentId: doc.id,
    versionId: version.id,
    title: doc.title,
    versionNumber: version.versionNumber,
    roleInReview: roleInReview ?? null,
    textHash: createHash("sha256").update(body, "utf8").digest("hex"),
    text: `${header}${body}`,
  };
}

async function collectSources(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: CreateLegalReviewInput,
): Promise<{ documents: SourceDocument[]; truncated: boolean; ownerMatterId: string | null }> {
  const collected: SourceDocument[] = [];
  let total = 0;
  let truncated = false;
  let ownerMatterId: string | null = null;

  const push = (source: SourceDocument) => {
    let text = source.text;
    if (total + text.length > MAX_INPUT_CHARS) {
      text = text.slice(0, Math.max(0, MAX_INPUT_CHARS - total));
      truncated = true;
    }
    if (text.length === 0) return false;
    total += text.length;
    collected.push({ ...source, text });
    return !truncated;
  };

  if (input.reviewSetId) {
    const { set, documents: setDocs } = await requireReviewSet(
      db,
      account,
      organizationId,
      input.reviewSetId,
    );
    ownerMatterId = set.legalMatterId;
    const ordered = setDocs
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime());
    for (const entry of ordered) {
      const doc = await requireDocumentInOrg(db, organizationId, entry.documentId);
      await assertCanReadDocument(db, account, organizationId, doc);
      if (doc.ownerType === "legal_matter" && !ownerMatterId) ownerMatterId = doc.ownerId;
      const source = await loadDocumentText(
        db,
        organizationId,
        doc,
        entry.documentVersionId,
        entry.roleInReview,
      );
      if (!source) continue;
      if (!push(source)) break;
    }
  } else if (input.primaryDocumentId) {
    const doc = await requireDocumentInOrg(db, organizationId, input.primaryDocumentId);
    await assertCanReadDocument(db, account, organizationId, doc);
    if (doc.ownerType === "legal_matter") ownerMatterId = doc.ownerId;
    const source = await loadDocumentText(db, organizationId, doc);
    if (source) push(source);
  } else {
    const scopes: {
      type: "legal_matter" | "judicial_process" | "administrative_process";
      id: string;
    }[] = [];
    if (input.legalMatterId) scopes.push({ type: "legal_matter", id: input.legalMatterId });
    if (input.judicialProcessId)
      scopes.push({ type: "judicial_process", id: input.judicialProcessId });
    if (input.administrativeProcessId) {
      scopes.push({ type: "administrative_process", id: input.administrativeProcessId });
    }
    for (const scope of scopes) {
      const rows = await db.query.documents.findMany({
        where: and(
          eq(documents.organizationId, organizationId),
          eq(documents.ownerType, scope.type),
          eq(documents.ownerId, scope.id),
          ne(documents.status, "archived"),
        ),
        orderBy: [asc(documents.createdAt)],
        limit: 20,
      });
      for (const doc of rows) {
        try {
          await assertCanReadDocument(db, account, organizationId, doc);
        } catch {
          continue;
        }
        if (doc.ownerType === "legal_matter" && !ownerMatterId) ownerMatterId = doc.ownerId;
        const source = await loadDocumentText(db, organizationId, doc);
        if (!source) continue;
        if (!push(source)) break;
      }
      if (truncated) break;
    }
  }

  return { documents: collected, truncated, ownerMatterId };
}

function eqOrNull(column: Column, value: string | null | undefined): SQL {
  return value ? eq(column, value) : isNull(column);
}

async function nextReviewVersion(
  tx: Pick<AppDatabase, "select">,
  organizationId: string,
  reviewType: string,
  matterId: string | null,
  input: CreateLegalReviewInput,
) {
  const versionFilters = [
    eq(legalAiReviews.organizationId, organizationId),
    eq(legalAiReviews.reviewType, reviewType as typeof legalAiReviews.$inferSelect.reviewType),
  ];
  if (matterId) {
    versionFilters.push(eq(legalAiReviews.legalMatterId, matterId));
  } else {
    versionFilters.push(
      eqOrNull(legalAiReviews.judicialProcessId, input.judicialProcessId),
      eqOrNull(legalAiReviews.administrativeProcessId, input.administrativeProcessId),
      eqOrNull(legalAiReviews.primaryDocumentId, input.primaryDocumentId),
      eqOrNull(legalAiReviews.reviewSetId, input.reviewSetId),
      isNull(legalAiReviews.legalMatterId),
    );
  }
  const [agg] = await tx
    .select({ value: max(legalAiReviews.version) })
    .from(legalAiReviews)
    .where(and(...versionFilters));
  return (agg?.value ?? 0) + 1;
}

async function persistSections(
  tx: Pick<AppDatabase, "insert">,
  organizationId: string,
  reviewId: string,
  output: LegalReviewOutput,
) {
  const base = { organizationId, reviewId };
  const orderBase = Date.now();

  if (output.formalIssues.length > 0) {
    await tx.insert(legalReviewFormalIssues).values(
      output.formalIssues.map((item, index) => ({
        ...base,
        createdAt: new Date(orderBase + index),
        category: item.category,
        description: item.description,
        sourceLabel: item.sourceLabel ?? null,
        pageNumber: item.pageNumber ?? null,
        severity: item.severity,
        confidence: item.confidence,
      })),
    );
  }
  if (output.missingDocuments.length > 0) {
    await tx.insert(legalReviewMissingDocuments).values(
      output.missingDocuments.map((item, index) => ({
        ...base,
        createdAt: new Date(orderBase + index),
        expectedDocumentType: item.expectedDocument ?? "documento_citado",
        reasonExpected: item.description || MISSING_DOC_MESSAGE,
        relatedClaim: item.citedBy ?? null,
        sourceLabel: item.citedBy ?? null,
        severity: "medium" as const,
        confidence: item.confidence,
      })),
    );
  }
  if (output.unaddressedClaims.length > 0) {
    await tx.insert(legalReviewUnaddressedClaims).values(
      output.unaddressedClaims.map((item, index) => ({
        ...base,
        createdAt: new Date(orderBase + index),
        claim: item.claim,
        sourcePage: item.sourcePage ?? null,
        expectedResponseContext: item.expectedResponseContext ?? null,
        responseLocated: item.responseLocated,
        responsePage: item.responsePage ?? null,
        notes:
          [item.sourceDocument, item.responseDocument, item.notes].filter(Boolean).join(" | ") ||
          null,
        confidence: item.confidence,
      })),
    );
  }
  if (output.unansweredGrounds.length > 0) {
    await tx.insert(legalReviewUnansweredGrounds).values(
      output.unansweredGrounds.map((item, index) => ({
        ...base,
        createdAt: new Date(orderBase + index),
        ground: item.identifiedThesis,
        sourceLabel: item.source ?? null,
        responseLocated: item.responseLocated,
        responseReference: item.responseReference ?? null,
        impact: item.impact ?? null,
        confidence: item.confidence,
      })),
    );
  }
  if (output.risks.length > 0) {
    await tx.insert(legalReviewRisks).values(
      output.risks.map((item, index) => ({
        ...base,
        createdAt: new Date(orderBase + index),
        category: item.category,
        description: item.description,
        sourceLabel: item.source ?? null,
        relatedDocuments: item.relatedDocuments,
        severity: item.severity,
        confidence: item.confidence,
        recommendation: item.recommendation ?? null,
        requiresHumanReview: true,
      })),
    );
  }
  if (output.inconsistencies.length > 0) {
    await tx.insert(legalReviewInconsistencies).values(
      output.inconsistencies.map((item, index) => ({
        ...base,
        createdAt: new Date(orderBase + index),
        point: item.matrixPoint,
        documentALabel: item.documentA,
        documentBLabel: item.documentB,
        divergence: item.divergence,
        sourceLabel: item.source ?? null,
        potentialImpact: item.potentialImpact ?? null,
        severity: item.severity,
        confidence: item.confidence,
      })),
    );
  }
  if (output.contradictions.length > 0) {
    await tx.insert(legalReviewContradictions).values(
      output.contradictions.map((item, index) => ({
        ...base,
        createdAt: new Date(orderBase + index),
        statementA: item.statementA,
        sourceA: item.sourceA ?? null,
        pageA: item.pageA ?? null,
        statementB: item.statementB,
        sourceB: item.sourceB ?? null,
        pageB: item.pageB ?? null,
        explanation: item.explanation ?? null,
        severity: item.severity,
        confidence: item.confidence,
      })),
    );
  }
}

/* ─── Criação da revisão ─── */

export async function createLegalReview(
  deps: LegalReviewDeps,
  account: SessionAccount,
  organizationId: string,
  input: CreateLegalReviewInput,
  meta: RequestMeta,
) {
  const { db } = deps;
  const membership = authorize(account, organizationId, policyAiLegalReviewRequest);
  await assertScope(db, account, organizationId, input);

  const ctx = {
    db,
    gateway: deps.gateway,
    account,
    organizationId,
    membershipId: membership.membershipId,
    meta,
  };
  const scopeReference =
    input.reviewSetId ??
    input.primaryDocumentId ??
    input.legalMatterId ??
    input.judicialProcessId ??
    input.administrativeProcessId ??
    "unknown";
  const inputReference = `legal_review:${input.reviewType}:${scopeReference}`;

  if (input.idempotencyKey) {
    const existing = await findAiRequestByIdempotency(
      db,
      organizationId,
      FEATURE,
      input.idempotencyKey,
    );
    if (existing) {
      const review = await db.query.legalAiReviews.findFirst({
        where: and(
          eq(legalAiReviews.aiRequestId, existing.id),
          eq(legalAiReviews.organizationId, organizationId),
        ),
      });
      if (!review) {
        throw new AppError(
          "CONFLICT",
          "Já existe uma requisição de revisão com esta chave de idempotência.",
        );
      }
      return {
        replayed: true,
        ...(await getLegalReview(db, account, organizationId, review.id)),
      };
    }
  }

  const sourcesPreview = await collectSources(db, account, organizationId, input);
  if (
    sourcesPreview.documents.length === 0 &&
    deps.gateway.describe().status !== "not_configured"
  ) {
    throw new AppError(
      "CONFLICT",
      "Não há texto extraído e acessível para revisar. Processe os documentos antes de solicitar a revisão.",
    );
  }
  const matterId = input.legalMatterId ?? sourcesPreview.ownerMatterId ?? null;

  let reviewId: string;
  try {
    reviewId = await db.transaction(async (tx) => {
      const version = await nextReviewVersion(
        tx,
        organizationId,
        input.reviewType,
        matterId,
        input,
      );
      const [review] = await tx
        .insert(legalAiReviews)
        .values({
          organizationId,
          legalMatterId: matterId,
          judicialProcessId: input.judicialProcessId ?? null,
          administrativeProcessId: input.administrativeProcessId ?? null,
          primaryDocumentId: input.primaryDocumentId ?? null,
          reviewSetId: input.reviewSetId ?? null,
          reviewType: input.reviewType as typeof legalAiReviews.$inferSelect.reviewType,
          status: "draft",
          version,
          createdByMembershipId: membership.membershipId,
        })
        .returning();
      if (!review) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar a revisão.");
      await tx
        .update(legalAiReviews)
        .set({ status: "processing", updatedAt: new Date() })
        .where(eq(legalAiReviews.id, review.id));
      return review.id;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("CONFLICT", "Conflito de versão da revisão. Tente novamente.");
    }
    throw error;
  }

  const markFailed = async (code: string) => {
    await db
      .update(legalAiReviews)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(legalAiReviews.id, reviewId));
    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "legal_review.failed",
      resourceType: "legal_review",
      resourceId: reviewId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      metadata: { code, reviewType: input.reviewType },
    });
  };

  const markNotConfigured = async () => {
    await db
      .update(legalAiReviews)
      .set({ status: "not_configured", updatedAt: new Date() })
      .where(eq(legalAiReviews.id, reviewId));
  };

  try {
    if (deps.gateway.describe().status === "not_configured") {
      await markNotConfigured();
      await recordInProcessJob(db, {
        organizationId,
        membershipId: membership.membershipId,
        jobType: "legal_review",
        resourceType: "legal_review",
        resourceId: reviewId,
        status: "not_configured",
        errorCode: "AI_PROVIDER_NOT_CONFIGURED",
      });
      await recordAiNotConfigured(ctx, { feature: FEATURE, inputReference });
    }

    const sources = sourcesPreview.documents.length
      ? sourcesPreview
      : await collectSources(db, account, organizationId, input);
    if (sources.documents.length === 0) {
      await markFailed("NO_EXTRACTED_TEXT");
      throw new AppError(
        "CONFLICT",
        "Não há texto extraído e acessível para revisar. Processe os documentos antes de solicitar a revisão.",
      );
    }

    const outcome = await runStructuredAi(ctx, {
      feature: FEATURE,
      promptKey: FEATURE,
      defaultInstructions: LEGAL_REVIEW_INSTRUCTIONS,
      input: sources.documents.map((doc) => doc.text).join("\n\n"),
      inputLabel: `revisao:${input.reviewType}`,
      inputReference,
      schema: legalReviewOutputSchema,
      schemaName: "LegalReview",
      ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
    });

    const output: LegalReviewOutput = outcome.data;

    await db.transaction(async (tx) => {
      // generated → human_review (resultado exige revisão humana; nunca aplica correções).
      await tx
        .update(legalAiReviews)
        .set({
          status: "generated",
          aiRequestId: outcome.requestId,
          summary: output.summary ?? null,
          structuredResult: output as unknown as Record<string, unknown>,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(legalAiReviews.id, reviewId));

      await persistSections(tx, organizationId, reviewId, output);

      await tx.insert(aiResultSources).values(
        sources.documents.map((doc) => ({
          organizationId,
          aiRequestId: outcome.requestId,
          resourceType: "legal_review",
          resourceId: reviewId,
          documentId: doc.documentId,
          documentVersionId: doc.versionId,
          sourceLabel: `Documento v${doc.versionNumber}`,
          sourceHash: doc.textHash,
        })),
      );

      await tx
        .update(legalAiReviews)
        .set({ status: "human_review", updatedAt: new Date() })
        .where(eq(legalAiReviews.id, reviewId));

      await recordAudit(tx, {
        actorUserId: account.user.id,
        organizationId,
        action: "legal_review.created",
        resourceType: "legal_review",
        resourceId: reviewId,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        metadata: {
          reviewType: input.reviewType,
          aiRequestId: outcome.requestId,
          documents: sources.documents.length,
          truncatedInput: sources.truncated,
        },
      });
      await recordAudit(tx, {
        actorUserId: account.user.id,
        organizationId,
        action: "legal_review.generated",
        resourceType: "legal_review",
        resourceId: reviewId,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        metadata: {
          formalIssues: output.formalIssues.length,
          missingDocuments: output.missingDocuments.length,
          contradictions: output.contradictions.length,
          risks: output.risks.length,
          suggestedCorrections: output.suggestedCorrections.length,
          autoApplied: false,
        },
      });
    });

    await recordInProcessJob(db, {
      organizationId,
      membershipId: membership.membershipId,
      jobType: "legal_review",
      resourceType: "legal_review",
      resourceId: reviewId,
      status: "succeeded",
    });

    return {
      replayed: false,
      ...(await getLegalReview(db, account, organizationId, reviewId)),
    };
  } catch (error) {
    if (error instanceof AppError && error.code === "AI_PROVIDER_NOT_CONFIGURED") {
      throw error;
    }
    const current = await db.query.legalAiReviews.findFirst({
      where: eq(legalAiReviews.id, reviewId),
      columns: { status: true },
    });
    if (current && (current.status === "processing" || current.status === "draft")) {
      const code =
        error instanceof AppError
          ? error.code
          : (((error as { code?: unknown } | null)?.code as string | undefined) ?? "AI_FAILED");
      await markFailed(typeof code === "string" ? code : "AI_FAILED");
    }
    throw error;
  }
}

/* ─── Consulta ─── */

export async function listLegalReviews(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: {
    legalMatterId?: string | undefined;
    primaryDocumentId?: string | undefined;
    reviewType?: string | undefined;
    status?: string | undefined;
    limit: number;
    offset: number;
  },
) {
  authorize(account, organizationId, (access) => policyLegalReview(access, "legal_review.read"));
  const filters = [eq(legalAiReviews.organizationId, organizationId)];
  if (query.legalMatterId) filters.push(eq(legalAiReviews.legalMatterId, query.legalMatterId));
  if (query.primaryDocumentId)
    filters.push(eq(legalAiReviews.primaryDocumentId, query.primaryDocumentId));
  if (query.reviewType) {
    filters.push(
      eq(
        legalAiReviews.reviewType,
        query.reviewType as typeof legalAiReviews.$inferSelect.reviewType,
      ),
    );
  }
  if (query.status) {
    filters.push(
      eq(legalAiReviews.status, query.status as typeof legalAiReviews.$inferSelect.status),
    );
  }
  const rows = await db.query.legalAiReviews.findMany({
    where: and(...filters),
    orderBy: [desc(legalAiReviews.createdAt)],
    limit: 500,
  });
  const visible = [];
  for (const row of rows) {
    if (await canReadReview(db, account, organizationId, row)) visible.push(serializeReview(row));
  }
  return {
    items: visible.slice(query.offset, query.offset + query.limit),
    total: visible.length,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function getLegalReview(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  reviewId: string,
) {
  authorize(account, organizationId, (access) => policyLegalReview(access, "legal_review.read"));
  const row = await requireReview(db, account, organizationId, reviewId);
  const sections = await loadSections(db, organizationId, row.id);
  const sources = row.aiRequestId
    ? await db.query.aiResultSources.findMany({
        where: and(
          eq(aiResultSources.aiRequestId, row.aiRequestId),
          eq(aiResultSources.organizationId, organizationId),
        ),
      })
    : [];
  const request = row.aiRequestId
    ? await db.query.aiRequests.findFirst({
        where: and(
          eq(aiRequests.id, row.aiRequestId),
          eq(aiRequests.organizationId, organizationId),
        ),
      })
    : null;
  const suggestedCorrections =
    (row.structuredResult as LegalReviewOutput | null)?.suggestedCorrections ?? [];
  return {
    review: {
      ...serializeReview(row),
      contentFormat: "plain_text" as const,
      provider: request?.provider ?? null,
      pendingReviewItems: countPending(sections),
      ...sections,
      suggestedCorrections: suggestedCorrections.map((item) => ({
        ...item,
        autoEdit: false as const,
      })),
      sources: sources.map((source) => ({
        documentId: source.documentId,
        documentVersionId: source.documentVersionId,
        sourceLabel: source.sourceLabel,
      })),
    },
  };
}

/* ─── Revisão humana ─── */

const SECTION_TABLES = {
  formal_issues: legalReviewFormalIssues,
  missing_documents: legalReviewMissingDocuments,
  unaddressed_claims: legalReviewUnaddressedClaims,
  unanswered_grounds: legalReviewUnansweredGrounds,
  risks: legalReviewRisks,
  inconsistencies: legalReviewInconsistencies,
  contradictions: legalReviewContradictions,
} as const;

export type LegalReviewSection = keyof typeof SECTION_TABLES;

const CORRECTABLE_SECTIONS = new Set<LegalReviewSection>(["formal_issues", "contradictions"]);

export async function reviewLegalReviewItem(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  reviewId: string,
  section: LegalReviewSection,
  itemId: string,
  input: {
    action: "confirm" | "reject" | "correct";
    correctedText?: string | undefined;
    comment?: string | undefined;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyLegalReviewItem(access, "legal_review.review"),
  );
  const review = await requireReview(db, account, organizationId, reviewId);
  if (review.status === "reviewed" || review.status === "closed") {
    throw new AppError("CONFLICT", "Esta revisão já foi fechada para alterações.");
  }
  if (review.status !== "human_review" && review.status !== "generated") {
    throw new AppError("CONFLICT", "Somente revisões pendentes de revisão humana aceitam itens.");
  }

  const table = SECTION_TABLES[section] as typeof legalReviewFormalIssues;
  const [item] = await db
    .select({ id: table.id, reviewStatus: table.reviewStatus })
    .from(table)
    .where(
      and(
        eq(table.id, itemId),
        eq(table.reviewId, reviewId),
        eq(table.organizationId, organizationId),
      ),
    );
  if (!item) throw new AppError("NOT_FOUND", "Item da revisão não encontrado.");

  if (input.action === "correct" && !CORRECTABLE_SECTIONS.has(section)) {
    throw new AppError("VALIDATION_ERROR", "Esta seção só aceita confirmar ou rejeitar itens.", [
      {
        path: "action",
        message: "Correção de texto disponível apenas em formal_issues e contradictions.",
      },
    ]);
  }

  const reviewStatus =
    input.action === "confirm" ? "confirmed" : input.action === "reject" ? "rejected" : "corrected";
  const patch: Record<string, unknown> = { reviewStatus };
  if (input.action === "correct") patch.correctedText = input.correctedText;
  if (input.comment !== undefined) patch.reviewComment = input.comment;

  const auditAction =
    input.action === "confirm"
      ? "legal_review.item_confirmed"
      : input.action === "reject"
        ? "legal_review.item_rejected"
        : "legal_review.item_confirmed";

  await db.transaction(async (tx) => {
    await tx
      .update(table)
      .set(patch as never)
      .where(
        and(
          eq(table.id, itemId),
          eq(table.reviewId, reviewId),
          eq(table.organizationId, organizationId),
        ),
      );
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: auditAction,
      resourceType: "legal_review",
      resourceId: reviewId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      metadata: { section, itemId, action: input.action },
    });
  });
  return getLegalReview(db, account, organizationId, reviewId);
}

/** Fecha a revisão humana. NÃO aplica correções aos documentos-fonte. */
export async function reviewLegalReview(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  reviewId: string,
  input: { comment?: string | undefined },
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyLegalReview(access, "legal_review.review"),
  );
  const review = await requireReview(db, account, organizationId, reviewId);
  if (review.status !== "human_review" && review.status !== "generated") {
    throw new AppError(
      "CONFLICT",
      "Somente revisões pendentes de revisão humana podem ser fechadas.",
    );
  }
  await db.transaction(async (tx) => {
    // human_review → reviewed → closed (sem mutar documentos).
    await tx
      .update(legalAiReviews)
      .set({
        status: "reviewed",
        reviewedAt: new Date(),
        reviewedByMembershipId: membership.membershipId,
        reviewComment: input.comment ?? null,
        updatedAt: new Date(),
      })
      .where(eq(legalAiReviews.id, reviewId));
    await tx
      .update(legalAiReviews)
      .set({ status: "closed", updatedAt: new Date() })
      .where(eq(legalAiReviews.id, reviewId));
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "legal_review.reviewed",
      resourceType: "legal_review",
      resourceId: reviewId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      metadata: { version: review.version, appliedToDomain: false },
    });
  });
  return getLegalReview(db, account, organizationId, reviewId);
}
