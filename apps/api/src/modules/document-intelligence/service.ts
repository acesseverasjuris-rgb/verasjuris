import { createHash } from "node:crypto";
import {
  type AIGateway,
  DOCUMENT_CLASSIFICATION_INSTRUCTIONS,
  type DocumentKind,
  documentClassificationOutputSchema,
  extractDocumentText,
  type OCRProvider,
  type TextExtractionResult,
} from "@verasjuris/ai";
import { recordAudit } from "@verasjuris/audit";
import {
  policyDocument,
  policyDocumentIntelligence,
  policyDocumentVersion,
  type SessionAccount,
} from "@verasjuris/auth";
import {
  type AppDatabase,
  aiRequests,
  aiUsage,
  documentClassifications,
  documentExtractedMetadata,
  documentPages,
  documentProcessingRuns,
  documents,
  documentTimelineEvents,
  documentVersions,
} from "@verasjuris/database";
import type { StorageProvider } from "@verasjuris/storage";
import { AppError } from "@verasjuris/types";
import { and, asc, count, desc, eq, ne, sql } from "drizzle-orm";
import { assertCanReadDocument, requireDocumentInOrg } from "../documents/service.js";
import { runStructuredAi, recordInProcessJob } from "../ai/runner.js";
import { accessOf, authorize, escapeLike, iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";

/**
 * Persiste custo de OCR em `ai_usage`.
 * Sem coluna `metadata`/`usageKind` na tabela: o discriminador OCR_USAGE vs LLM_USAGE
 * fica em `feature` (= "OCR_USAGE") para evitar migração extra (Prompt 15).
 */
async function recordOcrUsage(input: {
  db: AppDatabase;
  organizationId: string;
  userId: string;
  membershipId: string;
  provider: string;
  costMicros: number;
  durationMs?: number | null;
  correlationId?: string | null;
  documentVersionId: string;
}) {
  const [request] = await input.db
    .insert(aiRequests)
    .values({
      organizationId: input.organizationId,
      userId: input.userId,
      membershipId: input.membershipId,
      feature: "OCR_USAGE",
      provider: input.provider,
      status: "succeeded",
      outputDisposition: "assistive",
      inputReference: `ocr:${input.documentVersionId}`,
      correlationId: input.correlationId ?? null,
      finishedAt: new Date(),
      durationMs: input.durationMs ?? null,
    })
    .returning({ id: aiRequests.id });
  if (!request) return;
  await input.db.insert(aiUsage).values({
    aiRequestId: request.id,
    organizationId: input.organizationId,
    userId: input.userId,
    provider: input.provider,
    feature: "OCR_USAGE",
    estimatedCostMicros: input.costMicros,
    providerReportedCostMicros: input.costMicros,
    currency: "BRL",
    durationMs: input.durationMs ?? null,
    tokensAreEstimate: false,
  });
}

export type DocumentIntelligenceDeps = {
  db: AppDatabase;
  storage: StorageProvider;
  ocr: OCRProvider;
  gateway: AIGateway;
};

const MAX_PROCESSABLE_BYTES = 50 * 1024 * 1024;
const MAX_CLASSIFICATION_INPUT_CHARS = 20_000;

/* ─── Helpers ─── */

async function loadReadableDocument(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  documentId: string,
  permission:
    | "document_intelligence.read"
    | "document_intelligence.process"
    | "document_intelligence.review",
) {
  const membership = authorize(account, organizationId, (access) =>
    policyDocumentIntelligence(access, permission),
  );
  const doc = await requireDocumentInOrg(db, organizationId, documentId);
  await assertCanReadDocument(db, account, organizationId, doc);
  return { doc, membership };
}

async function requireVersion(
  db: AppDatabase,
  organizationId: string,
  documentId: string,
  versionId: string,
) {
  const version = await db.query.documentVersions.findFirst({
    where: and(
      eq(documentVersions.id, versionId),
      eq(documentVersions.documentId, documentId),
      eq(documentVersions.organizationId, organizationId),
    ),
  });
  if (!version) throw new AppError("NOT_FOUND", "Versão do documento não encontrada.");
  return version;
}

async function resolveVersion(
  db: AppDatabase,
  organizationId: string,
  doc: typeof documents.$inferSelect,
  versionId?: string,
) {
  const target = versionId ?? doc.currentVersionId;
  if (!target)
    throw new AppError("NOT_FOUND", "Este documento ainda não possui arquivo disponível.");
  return requireVersion(db, organizationId, doc.id, target);
}

function serializeRun(row: typeof documentProcessingRuns.$inferSelect) {
  return {
    id: row.id,
    documentId: row.documentId,
    documentVersionId: row.documentVersionId,
    status: row.status,
    processingStrategy: row.processingStrategy,
    ocrRequired: row.ocrRequired,
    ocrProvider: row.ocrProvider,
    extractionMethod: row.extractionMethod,
    textHash: row.textHash,
    pageCount: row.pageCount,
    charCount: row.charCount,
    startedAt: iso(row.startedAt),
    completedAt: iso(row.completedAt),
    errorCode: row.errorCode,
    errorSafeMessage: row.errorSafeMessage,
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeClassification(row: typeof documentClassifications.$inferSelect) {
  return {
    id: row.id,
    documentId: row.documentId,
    documentVersionId: row.documentVersionId,
    suggestedKind: row.suggestedKind,
    appliedKind: row.appliedKind,
    confidence: row.confidence,
    method: row.method,
    status: row.status,
    reviewStatus: row.reviewStatus,
    reviewedAt: iso(row.reviewedAt),
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeMetadata(row: typeof documentExtractedMetadata.$inferSelect) {
  return {
    id: row.id,
    documentId: row.documentId,
    documentVersionId: row.documentVersionId,
    fieldKey: row.fieldKey,
    originalValue: row.originalValue,
    correctedValue: row.correctedValue,
    effectiveValue:
      row.reviewStatus === "rejected" ? null : (row.correctedValue ?? row.originalValue),
    confidence: row.confidence,
    sourcePage: row.sourcePage,
    extractionMethod: row.extractionMethod,
    reviewStatus: row.reviewStatus,
    reviewedAt: iso(row.reviewedAt),
    reviewComment: row.reviewComment,
    createdAt: row.createdAt.toISOString(),
  };
}

async function readBytes(
  storage: StorageProvider,
  key: string,
  maxBytes: number,
): Promise<Uint8Array> {
  const object = await storage.getObject(key);
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of object.stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    total += buffer.byteLength;
    if (total > maxBytes) {
      object.stream.destroy();
      throw new AppError(
        "VALIDATION_ERROR",
        "O arquivo excede o limite para processamento de texto.",
      );
    }
    chunks.push(buffer);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/* ─── Processamento ─── */

type ProcessInput = { strategy: "auto" | "native_only" | "ocr"; force: boolean };

export async function processDocumentVersion(
  deps: DocumentIntelligenceDeps,
  account: SessionAccount,
  organizationId: string,
  documentId: string,
  versionId: string,
  input: ProcessInput,
  meta: RequestMeta,
) {
  const { db } = deps;
  const { doc, membership } = await loadReadableDocument(
    db,
    account,
    organizationId,
    documentId,
    "document_intelligence.process",
  );
  const downloadDecision = policyDocumentVersion(
    accessOf(account, organizationId),
    "document.download",
  );
  if (!downloadDecision.ok) throw new AppError(downloadDecision.code, downloadDecision.message);
  const version = await requireVersion(db, organizationId, doc.id, versionId);
  if (version.status !== "available") {
    throw new AppError(
      "CONFLICT",
      "Esta versão não está disponível para processamento (quarentena ou rejeitada).",
    );
  }

  if (!input.force) {
    const existing = await db.query.documentProcessingRuns.findFirst({
      where: and(
        eq(documentProcessingRuns.documentVersionId, version.id),
        eq(documentProcessingRuns.organizationId, organizationId),
        eq(documentProcessingRuns.status, "succeeded"),
      ),
      orderBy: [desc(documentProcessingRuns.createdAt)],
    });
    if (existing) return { run: serializeRun(existing), reused: true, warnings: [] as string[] };
  }

  const startedAt = new Date();
  const [created] = await db
    .insert(documentProcessingRuns)
    .values({
      organizationId,
      documentId: doc.id,
      documentVersionId: version.id,
      status: "running",
      processingStrategy: input.strategy,
      startedAt,
      createdByMembershipId: membership.membershipId,
    })
    .returning();
  if (!created) throw new AppError("INTERNAL_ERROR", "Não foi possível iniciar o processamento.");

  const finish = async (
    status: "succeeded" | "failed" | "not_configured",
    patch: Partial<typeof documentProcessingRuns.$inferInsert>,
    jobError: string | null,
  ) => {
    const [updated] = await db
      .update(documentProcessingRuns)
      .set({ ...patch, status, completedAt: new Date() })
      .where(eq(documentProcessingRuns.id, created.id))
      .returning();
    await recordInProcessJob(db, {
      organizationId,
      membershipId: membership.membershipId,
      jobType: "document_processing",
      resourceType: "document_version",
      resourceId: version.id,
      status,
      errorCode: jobError,
    });
    // Auditoria só com metadados — nunca o texto do documento.
    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "document_intelligence.processed",
      resourceType: "document_processing_run",
      resourceId: created.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      metadata: {
        documentId: doc.id,
        versionId: version.id,
        status,
        extractionMethod: updated?.extractionMethod ?? null,
        pageCount: updated?.pageCount ?? null,
        charCount: updated?.charCount ?? null,
        ocrRequired: updated?.ocrRequired ?? false,
        errorCode: jobError,
      },
    });
    return updated ?? created;
  };

  let bytes: Uint8Array;
  try {
    bytes = await readBytes(deps.storage, version.storageKey, MAX_PROCESSABLE_BYTES);
  } catch (error) {
    const code = error instanceof AppError ? error.code : "INTERNAL_ERROR";
    await finish(
      "failed",
      { errorCode: code, errorSafeMessage: "Não foi possível ler o arquivo armazenado." },
      code,
    );
    throw error;
  }

  const mimeType = version.mimeTypeDetected || version.mimeTypeDeclared;
  let extraction: TextExtractionResult | null = null;
  if (input.strategy !== "ocr") {
    extraction = await extractDocumentText({ data: bytes, mimeType });
  }
  const nativeText = extraction !== null && extraction.method !== "unavailable";
  const warnings = extraction?.warnings ?? [];

  const persistPages = async (
    pages: { pageNumber: number; text: string; confidence: number | null }[],
    method: "native_text" | "plain_text" | "ocr",
    run: { pageCount: number | null; ocrProvider: string | null; ocrRequired: boolean },
    fullText: string,
  ) => {
    await db.transaction(async (tx) => {
      await tx.delete(documentPages).where(eq(documentPages.documentVersionId, version.id));
      if (pages.length > 0) {
        await tx.insert(documentPages).values(
          pages.map((page) => ({
            organizationId,
            documentVersionId: version.id,
            processingRunId: created.id,
            pageNumber: page.pageNumber,
            text: page.text,
            extractionMethod: method,
            confidence: page.confidence,
            charCount: page.text.length,
          })),
        );
      }
      await tx
        .update(documentProcessingRuns)
        .set({
          extractionMethod: method,
          textHash: sha256(fullText),
          pageCount: run.pageCount,
          charCount: fullText.length,
          ocrRequired: run.ocrRequired,
          ocrProvider: run.ocrProvider,
        })
        .where(eq(documentProcessingRuns.id, created.id));
    });
  };

  // 1) Texto nativo primeiro.
  if (nativeText && extraction) {
    const perPage = extraction.pages.length > 0;
    const pages = perPage
      ? extraction.pages.map((page) => ({ ...page, confidence: null }))
      : [{ pageNumber: 1, text: extraction.text, confidence: null }];
    await persistPages(
      pages,
      extraction.method === "native_text" ? "native_text" : "plain_text",
      {
        pageCount: extraction.pageCount ?? 1,
        ocrProvider: null,
        ocrRequired: extraction.ocrRequired,
      },
      extraction.text,
    );
    const run = await finish("succeeded", {}, null);
    return {
      run: serializeRun(run),
      reused: false,
      pageMapping: perPage ? "per_page" : "single_block",
      warnings,
    };
  }

  // 2) Sem texto nativo: OCR somente se necessário e permitido.
  const ocrNeeded = input.strategy === "ocr" || extraction?.ocrRequired === true;
  if (!ocrNeeded) {
    const run = await finish(
      "failed",
      {
        errorCode: "TEXT_EXTRACTION_UNAVAILABLE",
        errorSafeMessage: "Não há extrator de texto para este tipo de arquivo.",
      },
      "TEXT_EXTRACTION_UNAVAILABLE",
    );
    return { run: serializeRun(run), reused: false, warnings };
  }
  if (input.strategy === "native_only") {
    const run = await finish(
      "failed",
      {
        ocrRequired: true,
        errorCode: "NATIVE_TEXT_UNAVAILABLE",
        errorSafeMessage:
          "O arquivo não tem camada de texto; é necessário OCR (estratégia native_only).",
      },
      "NATIVE_TEXT_UNAVAILABLE",
    );
    return { run: serializeRun(run), reused: false, warnings };
  }

  try {
    const ocr = await deps.ocr.recognize({
      data: bytes,
      mimeType,
      languageHints: ["pt-BR"],
      idempotencyKey: `${version.id}:${created.id}`,
    });
    const text = ocr.pages
      .map((page) => page.text)
      .join("\n\n")
      .trim();
    if (text.length === 0) {
      const run = await finish(
        "failed",
        {
          ocrRequired: true,
          ocrProvider: ocr.provider,
          errorCode: "OCR_EMPTY_RESULT",
          errorSafeMessage: "O OCR não reconheceu texto neste arquivo.",
        },
        "OCR_EMPTY_RESULT",
      );
      return { run: serializeRun(run), reused: false, warnings };
    }
    await persistPages(
      ocr.pages.map((page) => ({
        pageNumber: page.pageNumber,
        text: page.text,
        confidence: page.confidence,
      })),
      "ocr",
      { pageCount: ocr.pages.length, ocrProvider: ocr.provider, ocrRequired: true },
      text,
    );
    const costMicros = ocr.costMicros ?? ocr.providerReportedCostMicros;
    if (typeof costMicros === "number" && Number.isInteger(costMicros) && costMicros >= 0) {
      await recordOcrUsage({
        db,
        organizationId,
        userId: account.user.id,
        membershipId: membership.membershipId,
        provider: ocr.provider,
        costMicros,
        documentVersionId: version.id,
        correlationId: meta.requestId,
      });
    }
    const run = await finish("succeeded", {}, null);
    return { run: serializeRun(run), reused: false, pageMapping: "per_page", warnings };
  } catch (error) {
    if (error instanceof AppError && error.code === "OCR_PROVIDER_NOT_CONFIGURED") {
      await finish(
        "not_configured",
        {
          ocrRequired: true,
          ocrProvider: deps.ocr.id,
          errorCode: error.code,
          errorSafeMessage: error.message,
        },
        error.code,
      );
      throw error;
    }
    const code = error instanceof AppError ? error.code : "EXTERNAL_SERVICE_ERROR";
    await finish(
      "failed",
      {
        ocrRequired: true,
        ocrProvider: deps.ocr.id,
        errorCode: code,
        errorSafeMessage: "O provedor de OCR não conseguiu processar o arquivo.",
      },
      code,
    );
    throw error instanceof AppError
      ? error
      : new AppError(
          "EXTERNAL_SERVICE_ERROR",
          "O provedor de OCR não conseguiu processar o arquivo.",
        );
  }
}

/* ─── Consulta ─── */

export async function getDocumentIntelligence(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  documentId: string,
) {
  const { doc } = await loadReadableDocument(
    db,
    account,
    organizationId,
    documentId,
    "document_intelligence.read",
  );
  const runs = await db.query.documentProcessingRuns.findMany({
    where: and(
      eq(documentProcessingRuns.documentId, doc.id),
      eq(documentProcessingRuns.organizationId, organizationId),
    ),
    orderBy: [desc(documentProcessingRuns.createdAt)],
    limit: 10,
  });
  const classification = await db.query.documentClassifications.findFirst({
    where: and(
      eq(documentClassifications.documentId, doc.id),
      eq(documentClassifications.organizationId, organizationId),
    ),
    orderBy: [desc(documentClassifications.createdAt)],
  });
  const metadata = await db.query.documentExtractedMetadata.findMany({
    where: and(
      eq(documentExtractedMetadata.documentId, doc.id),
      eq(documentExtractedMetadata.organizationId, organizationId),
    ),
    orderBy: [asc(documentExtractedMetadata.fieldKey)],
  });
  let pageCount = 0;
  if (doc.currentVersionId) {
    const [row] = await db
      .select({ value: count() })
      .from(documentPages)
      .where(
        and(
          eq(documentPages.documentVersionId, doc.currentVersionId),
          eq(documentPages.organizationId, organizationId),
        ),
      );
    pageCount = row?.value ?? 0;
  }
  const lastRun = runs[0] ?? null;
  return {
    intelligence: {
      documentId: doc.id,
      currentVersionId: doc.currentVersionId,
      hasText: pageCount > 0,
      storedPages: pageCount,
      latestRun: lastRun ? serializeRun(lastRun) : null,
      runs: runs.map(serializeRun),
      classification: classification ? serializeClassification(classification) : null,
      metadata: metadata.map(serializeMetadata),
    },
  };
}

export async function listVersionPages(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  documentId: string,
  versionId: string,
  query: { page?: number | undefined; limit: number; offset: number },
) {
  const { doc } = await loadReadableDocument(
    db,
    account,
    organizationId,
    documentId,
    "document_intelligence.read",
  );
  // O texto extraído equivale ao conteúdo do arquivo: exige o mesmo direito de download.
  const downloadDecision = policyDocumentVersion(
    accessOf(account, organizationId),
    "document.download",
  );
  if (!downloadDecision.ok) throw new AppError(downloadDecision.code, downloadDecision.message);
  const version = await requireVersion(db, organizationId, doc.id, versionId);
  const filters = [
    eq(documentPages.documentVersionId, version.id),
    eq(documentPages.organizationId, organizationId),
  ];
  if (query.page) filters.push(eq(documentPages.pageNumber, query.page));
  const where = and(...filters);
  const [totalRow] = await db.select({ value: count() }).from(documentPages).where(where);
  const rows = await db.query.documentPages.findMany({
    where,
    orderBy: [asc(documentPages.pageNumber)],
    limit: query.limit,
    offset: query.offset,
  });
  return {
    items: rows.map((row) => ({
      id: row.id,
      pageNumber: row.pageNumber,
      text: row.text,
      /** O texto é DADO do documento: renderize como texto, nunca como HTML. */
      contentFormat: "plain_text" as const,
      extractionMethod: row.extractionMethod,
      confidence: row.confidence,
      charCount: row.charCount,
    })),
    total: totalRow?.value ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

/* ─── Classificação ─── */

async function applyDocumentKind(
  tx: Pick<AppDatabase, "update" | "insert">,
  organizationId: string,
  documentId: string,
  kind: DocumentKind,
  actorMembershipId: string,
) {
  await tx
    .update(documents)
    .set({ documentKind: kind, updatedAt: new Date() })
    .where(and(eq(documents.id, documentId), eq(documents.organizationId, organizationId)));
  await tx.insert(documentTimelineEvents).values({
    organizationId,
    documentId,
    eventType: "document.classified",
    title: `Documento classificado como ${kind}`,
    actorMembershipId,
    eventAt: new Date(),
  });
}

function requireDocumentUpdate(account: SessionAccount, organizationId: string) {
  const decision = policyDocument(accessOf(account, organizationId), "document.update");
  if (!decision.ok) throw new AppError(decision.code, decision.message);
}

export async function classifyDocumentManual(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  documentId: string,
  input: { kind: DocumentKind; versionId?: string | undefined },
  meta: RequestMeta,
) {
  const { doc, membership } = await loadReadableDocument(
    db,
    account,
    organizationId,
    documentId,
    "document_intelligence.review",
  );
  requireDocumentUpdate(account, organizationId);
  const version = await resolveVersion(db, organizationId, doc, input.versionId);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(documentClassifications)
      .values({
        organizationId,
        documentId: doc.id,
        documentVersionId: version.id,
        suggestedKind: null,
        appliedKind: input.kind,
        method: "manual",
        status: "manual",
        reviewStatus: "reviewed",
        reviewedByMembershipId: membership.membershipId,
        reviewedAt: new Date(),
      })
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar a classificação.");
    await applyDocumentKind(tx, organizationId, doc.id, input.kind, membership.membershipId);
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "document_intelligence.classified",
      resourceType: "document_classification",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      before: { documentKind: doc.documentKind },
      after: { documentKind: input.kind, method: "manual" },
    });
    return { classification: serializeClassification(row) };
  });
}

/** Sugestão de classificação via IA (NOT_CONFIGURED sem provedor). Nunca é aplicada sem revisão humana. */
export async function suggestDocumentClassification(
  deps: DocumentIntelligenceDeps,
  account: SessionAccount,
  organizationId: string,
  documentId: string,
  input: { versionId?: string | undefined; idempotencyKey?: string | undefined },
  meta: RequestMeta,
) {
  const { db } = deps;
  const { doc, membership } = await loadReadableDocument(
    db,
    account,
    organizationId,
    documentId,
    "document_intelligence.review",
  );
  const version = await resolveVersion(db, organizationId, doc, input.versionId);
  const pages = await db.query.documentPages.findMany({
    where: and(
      eq(documentPages.documentVersionId, version.id),
      eq(documentPages.organizationId, organizationId),
    ),
    orderBy: [asc(documentPages.pageNumber)],
    limit: 20,
  });
  const text = pages
    .map((page) => page.text)
    .join("\n\n")
    .slice(0, MAX_CLASSIFICATION_INPUT_CHARS);
  const ctx = {
    db,
    gateway: deps.gateway,
    account,
    organizationId,
    membershipId: membership.membershipId,
    meta,
  };
  if (text.length === 0 && deps.gateway.describe().status === "configured") {
    throw new AppError(
      "CONFLICT",
      "Processe o documento (extração de texto) antes de classificar.",
    );
  }
  const outcome = await runStructuredAi(ctx, {
    feature: "document_classification",
    promptKey: "document_classification",
    defaultInstructions: DOCUMENT_CLASSIFICATION_INSTRUCTIONS,
    input: text,
    inputLabel: `documento:${doc.id}`,
    inputReference: `document_version:${version.id}`,
    schema: documentClassificationOutputSchema,
    schemaName: "DocumentClassification",
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  });
  const [row] = await db
    .insert(documentClassifications)
    .values({
      organizationId,
      documentId: doc.id,
      documentVersionId: version.id,
      suggestedKind: outcome.data.suggestedKind,
      appliedKind: null,
      confidence: outcome.data.confidence,
      method: "ai",
      status: "suggested",
      reviewStatus: "unreviewed",
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar a sugestão.");
  return {
    classification: serializeClassification(row),
    rationale: outcome.data.rationale,
    alternatives: outcome.data.alternatives,
    outputDisposition: outcome.outputDisposition,
    aiRequestId: outcome.requestId,
    assistive: true,
  };
}

export async function reviewDocumentClassification(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  documentId: string,
  classificationId: string,
  input: { action: "accept" | "reject" | "correct"; kind?: DocumentKind | undefined },
  meta: RequestMeta,
) {
  const { doc, membership } = await loadReadableDocument(
    db,
    account,
    organizationId,
    documentId,
    "document_intelligence.review",
  );
  const row = await db.query.documentClassifications.findFirst({
    where: and(
      eq(documentClassifications.id, classificationId),
      eq(documentClassifications.documentId, doc.id),
      eq(documentClassifications.organizationId, organizationId),
    ),
  });
  if (!row) throw new AppError("NOT_FOUND", "Classificação não encontrada.");
  if (row.reviewStatus !== "unreviewed") {
    throw new AppError("CONFLICT", "Esta classificação já foi revisada.");
  }
  if (input.action !== "reject") requireDocumentUpdate(account, organizationId);
  const appliedKind =
    input.action === "accept"
      ? (row.suggestedKind as DocumentKind | null)
      : input.action === "correct"
        ? (input.kind ?? null)
        : null;
  if (input.action !== "reject" && !appliedKind) {
    throw new AppError("VALIDATION_ERROR", "Não há tipo para aplicar nesta classificação.");
  }
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(documentClassifications)
      .set({
        appliedKind,
        reviewStatus:
          input.action === "accept"
            ? "reviewed"
            : input.action === "correct"
              ? "corrected"
              : "rejected",
        reviewedByMembershipId: membership.membershipId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(documentClassifications.id, row.id))
      .returning();
    if (appliedKind) {
      await applyDocumentKind(tx, organizationId, doc.id, appliedKind, membership.membershipId);
    }
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "document_intelligence.classification_reviewed",
      resourceType: "document_classification",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      metadata: { action: input.action, appliedKind },
    });
    return { classification: serializeClassification(updated ?? row) };
  });
}

/* ─── Metadata ─── */

export async function listDocumentMetadata(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  documentId: string,
) {
  const { doc } = await loadReadableDocument(
    db,
    account,
    organizationId,
    documentId,
    "document_intelligence.read",
  );
  const rows = await db.query.documentExtractedMetadata.findMany({
    where: and(
      eq(documentExtractedMetadata.documentId, doc.id),
      eq(documentExtractedMetadata.organizationId, organizationId),
    ),
    orderBy: [asc(documentExtractedMetadata.fieldKey), desc(documentExtractedMetadata.createdAt)],
  });
  return { items: rows.map(serializeMetadata) };
}

export async function createDocumentMetadata(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  documentId: string,
  input: {
    versionId?: string | undefined;
    fieldKey: string;
    value: string;
    sourcePage?: number | undefined;
  },
  meta: RequestMeta,
) {
  const { doc } = await loadReadableDocument(
    db,
    account,
    organizationId,
    documentId,
    "document_intelligence.review",
  );
  const version = await resolveVersion(db, organizationId, doc, input.versionId);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(documentExtractedMetadata)
      .values({
        organizationId,
        documentId: doc.id,
        documentVersionId: version.id,
        fieldKey: input.fieldKey,
        originalValue: input.value,
        sourcePage: input.sourcePage ?? null,
        extractionMethod: "manual",
        reviewStatus: "unreviewed",
      })
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar o metadado.");
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "document_intelligence.metadata_created",
      resourceType: "document_extracted_metadata",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      metadata: { documentId: doc.id, fieldKey: input.fieldKey },
    });
    return { metadata: serializeMetadata(row) };
  });
}

export async function reviewDocumentMetadata(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  documentId: string,
  metadataId: string,
  input: {
    action: "reviewed" | "corrected" | "rejected";
    correctedValue?: string | undefined;
    comment?: string | undefined;
  },
  meta: RequestMeta,
) {
  const { doc, membership } = await loadReadableDocument(
    db,
    account,
    organizationId,
    documentId,
    "document_intelligence.review",
  );
  const row = await db.query.documentExtractedMetadata.findFirst({
    where: and(
      eq(documentExtractedMetadata.id, metadataId),
      eq(documentExtractedMetadata.documentId, doc.id),
      eq(documentExtractedMetadata.organizationId, organizationId),
    ),
  });
  if (!row) throw new AppError("NOT_FOUND", "Metadado não encontrado.");
  return db.transaction(async (tx) => {
    // O valor original (da extração) é preservado; a correção humana fica em campo separado.
    const [updated] = await tx
      .update(documentExtractedMetadata)
      .set({
        reviewStatus: input.action,
        correctedValue: input.action === "corrected" ? (input.correctedValue ?? null) : null,
        reviewedByMembershipId: membership.membershipId,
        reviewedAt: new Date(),
        reviewComment: input.comment ?? null,
        updatedAt: new Date(),
      })
      .where(eq(documentExtractedMetadata.id, row.id))
      .returning();
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "document_intelligence.metadata_reviewed",
      resourceType: "document_extracted_metadata",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      metadata: { action: input.action, fieldKey: row.fieldKey },
    });
    return { metadata: serializeMetadata(updated ?? row) };
  });
}

/* ─── Busca ─── */

const SEARCH_SCAN_CAP = 500;

/**
 * Busca textual literal nas páginas da VERSÃO ATUAL de cada documento da organização. O resultado é
 * filtrado por ACL/confidencialidade documento a documento; devolve só trechos curtos, nunca o texto
 * completo.
 */
export async function searchDocumentText(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { q: string; limit: number; offset: number },
) {
  authorize(account, organizationId, (access) =>
    policyDocumentIntelligence(access, "document_intelligence.read"),
  );
  const needle = query.q;
  const rows = await db
    .select({
      doc: documents,
      versionId: documentPages.documentVersionId,
      pageNumber: documentPages.pageNumber,
      snippet: sql<string>`substr(${documentPages.text}, greatest(strpos(lower(${documentPages.text}), lower(${needle})) - 60, 1), 200)`,
    })
    .from(documentPages)
    .innerJoin(
      documents,
      and(
        eq(documents.currentVersionId, documentPages.documentVersionId),
        eq(documents.organizationId, documentPages.organizationId),
      ),
    )
    .where(
      and(
        eq(documentPages.organizationId, organizationId),
        ne(documents.status, "archived"),
        sql`${documentPages.text} ilike ${`%${escapeLike(needle)}%`} escape '\\'`,
      ),
    )
    .orderBy(desc(documents.updatedAt), asc(documentPages.pageNumber))
    .limit(SEARCH_SCAN_CAP);

  const seen = new Set<string>();
  const visible: {
    documentId: string;
    title: string;
    versionId: string;
    pageNumber: number;
    snippet: string;
  }[] = [];
  for (const row of rows) {
    if (seen.has(row.doc.id)) continue;
    try {
      await assertCanReadDocument(db, account, organizationId, row.doc);
    } catch {
      continue;
    }
    seen.add(row.doc.id);
    visible.push({
      documentId: row.doc.id,
      title: row.doc.title,
      versionId: row.versionId,
      pageNumber: row.pageNumber,
      snippet: sanitizeSnippet(row.snippet),
    });
  }
  return {
    items: visible.slice(query.offset, query.offset + query.limit),
    total: visible.length,
    truncated: rows.length >= SEARCH_SCAN_CAP,
    limit: query.limit,
    offset: query.offset,
    contentFormat: "plain_text" as const,
  };
}

function sanitizeSnippet(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
