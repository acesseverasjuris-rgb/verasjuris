import { createHash, randomUUID } from "node:crypto";
import {
  type AIGateway,
  LEGAL_ANALYSIS_INSTRUCTIONS,
  type LegalAnalysisOutput,
  legalAnalysisOutputSchema,
} from "@verasjuris/ai";
import { recordAudit } from "@verasjuris/audit";
import {
  policyAIAnalysis,
  policyAiLegalAnalysisRequest,
  policyLegalAnalysis,
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
  legalAiAnalyses,
  legalAnalysisAmounts,
  legalAnalysisClaims,
  legalAnalysisContradictions,
  legalAnalysisDates,
  legalAnalysisEvidenceLinks,
  legalAnalysisFacts,
  legalAnalysisGrounds,
  legalAnalysisMissingInfo,
  legalAnalysisObligations,
  legalAnalysisParties,
  legalMatters,
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
const MAX_SCOPE_DOCUMENTS = 20;
const FEATURE = "legal_analysis";

export type LegalAnalysisDeps = { db: AppDatabase; gateway: AIGateway };

export type CreateLegalAnalysisInput = {
  analysisType: string;
  legalMatterId?: string | undefined;
  judicialProcessId?: string | undefined;
  administrativeProcessId?: string | undefined;
  documentId?: string | undefined;
  idempotencyKey?: string | undefined;
};

/* ─── Serialização ─── */

function serializeAnalysis(row: typeof legalAiAnalyses.$inferSelect) {
  return {
    id: row.id,
    analysisType: row.analysisType,
    status: row.status,
    version: row.version,
    /** Sempre `requires_review`: a análise é apoio assistivo e nunca é aplicada ao domínio. */
    disposition: row.disposition,
    assistive: true,
    appliedToDomain: false,
    summary: row.summary,
    legalMatterId: row.legalMatterId,
    judicialProcessId: row.judicialProcessId,
    administrativeProcessId: row.administrativeProcessId,
    documentId: row.documentId,
    aiRequestId: row.aiRequestId,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewComment: row.reviewComment,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const withEffective = <
  T extends { text: string; correctedText: string | null; reviewStatus: string },
>(
  row: T,
) => ({
  ...row,
  effectiveText: row.reviewStatus === "rejected" ? null : (row.correctedText ?? row.text),
});

async function loadSections(db: AppDatabase, organizationId: string, analysisId: string) {
  const where = (candidate: unknown) => {
    const table = candidate as typeof legalAnalysisFacts;
    return and(eq(table.organizationId, organizationId), eq(table.analysisId, analysisId));
  };
  const [
    facts,
    claims,
    grounds,
    evidence,
    contradictions,
    dates,
    parties,
    amounts,
    obligations,
    missing,
  ] = await Promise.all([
    db.query.legalAnalysisFacts.findMany({
      where: where(legalAnalysisFacts),
      orderBy: [asc(legalAnalysisFacts.createdAt), asc(legalAnalysisFacts.id)],
    }),
    db.query.legalAnalysisClaims.findMany({
      where: where(legalAnalysisClaims),
      orderBy: [asc(legalAnalysisClaims.createdAt), asc(legalAnalysisClaims.id)],
    }),
    db.query.legalAnalysisGrounds.findMany({ where: where(legalAnalysisGrounds) }),
    db.query.legalAnalysisEvidenceLinks.findMany({ where: where(legalAnalysisEvidenceLinks) }),
    db.query.legalAnalysisContradictions.findMany({ where: where(legalAnalysisContradictions) }),
    db.query.legalAnalysisDates.findMany({ where: where(legalAnalysisDates) }),
    db.query.legalAnalysisParties.findMany({ where: where(legalAnalysisParties) }),
    db.query.legalAnalysisAmounts.findMany({ where: where(legalAnalysisAmounts) }),
    db.query.legalAnalysisObligations.findMany({ where: where(legalAnalysisObligations) }),
    db.query.legalAnalysisMissingInfo.findMany({ where: where(legalAnalysisMissingInfo) }),
  ]);
  const strip = <T extends { organizationId: string; createdAt: Date }>(row: T) => {
    const { organizationId: _org, createdAt, ...rest } = row;
    return { ...rest, createdAt: createdAt.toISOString() };
  };
  return {
    facts: facts.map((row) => strip(withEffective(row))),
    claims: claims.map((row) => strip(withEffective(row))),
    grounds: grounds.map((row) => ({
      ...strip(row),
      /** Fundamento sugerido pela IA nunca é "constante no documento" e exige verificação humana. */
      presentInDocument: row.kind === "present_in_document",
      requiresHumanVerification: row.kind === "suggested_by_ai",
    })),
    evidence: evidence.map(strip),
    contradictions: contradictions.map(strip),
    dates: dates.map(strip),
    parties: parties.map(strip),
    amounts: amounts.map(strip),
    obligations: obligations.map(strip),
    missingInformation: missing.map(strip),
  };
}

type Sections = Awaited<ReturnType<typeof loadSections>>;

function countPending(sections: Sections): number {
  return Object.values(sections)
    .flat()
    .filter((item) => (item as { reviewStatus: string }).reviewStatus === "unreviewed").length;
}

/* ─── Acesso ─── */

async function sourceDocumentIds(
  db: AppDatabase,
  organizationId: string,
  row: typeof legalAiAnalyses.$inferSelect,
) {
  const ids = new Set<string>();
  if (row.documentId) ids.add(row.documentId);
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

/** A análise herda o ACL/confidencialidade dos documentos-fonte: sem acesso a todos => 404. */
async function canReadAnalysis(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  row: typeof legalAiAnalyses.$inferSelect,
): Promise<boolean> {
  for (const documentId of await sourceDocumentIds(db, organizationId, row)) {
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

async function requireAnalysis(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  analysisId: string,
) {
  const row = await db.query.legalAiAnalyses.findFirst({
    where: and(
      eq(legalAiAnalyses.id, analysisId),
      eq(legalAiAnalyses.organizationId, organizationId),
    ),
  });
  if (!row || !(await canReadAnalysis(db, account, organizationId, row))) {
    throw new AppError("NOT_FOUND", "Não encontramos esta análise no seu acesso.");
  }
  return row;
}

/* ─── Criação ─── */

async function assertScope(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: CreateLegalAnalysisInput,
) {
  const notFound = (what: string) =>
    new AppError("NOT_FOUND", `Não encontramos ${what} no seu acesso.`);
  if (input.documentId) {
    const doc = await requireDocumentInOrg(db, organizationId, input.documentId);
    await assertCanReadDocument(db, account, organizationId, doc);
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
  textHash: string | null;
  text: string;
};

async function collectSources(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: CreateLegalAnalysisInput,
): Promise<{ documents: SourceDocument[]; truncated: boolean; ownerMatterId: string | null }> {
  let candidates: (typeof documents.$inferSelect)[] = [];
  let ownerMatterId: string | null = null;
  const explicit = Boolean(input.documentId);
  if (input.documentId) {
    const doc = await requireDocumentInOrg(db, organizationId, input.documentId);
    await assertCanReadDocument(db, account, organizationId, doc);
    candidates = [doc];
    if (doc.ownerType === "legal_matter") ownerMatterId = doc.ownerId;
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
        limit: MAX_SCOPE_DOCUMENTS,
      });
      candidates.push(...rows);
    }
  }

  const collected: SourceDocument[] = [];
  let total = 0;
  let truncated = false;
  for (const doc of candidates) {
    if (!explicit) {
      try {
        await assertCanReadDocument(db, account, organizationId, doc);
      } catch {
        continue; // documentos sem acesso nunca entram na análise
      }
    }
    if (!doc.currentVersionId) continue;
    const version = await db.query.documentVersions.findFirst({
      where: and(
        eq(documentVersions.id, doc.currentVersionId),
        eq(documentVersions.organizationId, organizationId),
      ),
    });
    if (!version || version.status !== "available") continue;
    const pages = await db.query.documentPages.findMany({
      where: and(
        eq(documentPages.documentVersionId, version.id),
        eq(documentPages.organizationId, organizationId),
      ),
      orderBy: [asc(documentPages.pageNumber)],
    });
    if (pages.length === 0) continue;
    const body = pages.map((page) => `[página ${page.pageNumber}]\n${page.text}`).join("\n\n");
    const header = `### DOCUMENTO ${doc.id} v${version.versionNumber}\n`;
    let text = `${header}${body}`;
    if (total + text.length > MAX_INPUT_CHARS) {
      text = text.slice(0, Math.max(0, MAX_INPUT_CHARS - total));
      truncated = true;
    }
    if (text.length === 0) break;
    total += text.length;
    collected.push({
      documentId: doc.id,
      versionId: version.id,
      title: doc.title,
      versionNumber: version.versionNumber,
      textHash: createHash("sha256").update(body, "utf8").digest("hex"),
      text,
    });
    if (truncated) break;
  }
  return { documents: collected, truncated, ownerMatterId };
}

function eqOrNull(column: Column, value: string | null | undefined): SQL {
  return value ? eq(column, value) : isNull(column);
}

export async function createLegalAnalysis(
  deps: LegalAnalysisDeps,
  account: SessionAccount,
  organizationId: string,
  input: CreateLegalAnalysisInput,
  meta: RequestMeta,
) {
  const { db } = deps;
  const membership = authorize(account, organizationId, policyAiLegalAnalysisRequest);
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
    input.documentId ??
    input.legalMatterId ??
    input.judicialProcessId ??
    input.administrativeProcessId ??
    "unknown";
  const inputReference = `legal_analysis:${input.analysisType}:${scopeReference}`;

  if (input.idempotencyKey) {
    const existing = await findAiRequestByIdempotency(
      db,
      organizationId,
      FEATURE,
      input.idempotencyKey,
    );
    if (existing) {
      const analysis = await db.query.legalAiAnalyses.findFirst({
        where: and(
          eq(legalAiAnalyses.aiRequestId, existing.id),
          eq(legalAiAnalyses.organizationId, organizationId),
        ),
      });
      if (!analysis) {
        throw new AppError(
          "CONFLICT",
          "Já existe uma requisição de análise com esta chave de idempotência.",
        );
      }
      return {
        replayed: true,
        ...(await getLegalAnalysis(db, account, organizationId, analysis.id)),
      };
    }
  }

  // Sem provedor: recusa antes de qualquer trabalho e registra a tentativa (nenhum conteúdo é gerado).
  if (deps.gateway.describe().status === "not_configured") {
    await recordAiNotConfigured(ctx, { feature: FEATURE, inputReference });
  }

  const sources = await collectSources(db, account, organizationId, input);
  if (sources.documents.length === 0) {
    throw new AppError(
      "CONFLICT",
      "Não há texto extraído e acessível para analisar. Processe os documentos antes de solicitar a análise.",
    );
  }

  const outcome = await runStructuredAi(ctx, {
    feature: FEATURE,
    promptKey: FEATURE,
    defaultInstructions: LEGAL_ANALYSIS_INSTRUCTIONS,
    input: sources.documents.map((doc) => doc.text).join("\n\n"),
    inputLabel: `analise:${input.analysisType}`,
    inputReference,
    schema: legalAnalysisOutputSchema,
    schemaName: "LegalAnalysis",
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  });

  const output: LegalAnalysisOutput = outcome.data;
  const matterId = input.legalMatterId ?? sources.ownerMatterId ?? null;

  try {
    const analysisId = await db.transaction(async (tx) => {
      const versionFilters = [
        eq(legalAiAnalyses.organizationId, organizationId),
        eq(legalAiAnalyses.analysisType, input.analysisType),
      ];
      if (matterId) {
        versionFilters.push(eq(legalAiAnalyses.legalMatterId, matterId));
      } else {
        versionFilters.push(
          eqOrNull(legalAiAnalyses.judicialProcessId, input.judicialProcessId),
          eqOrNull(legalAiAnalyses.administrativeProcessId, input.administrativeProcessId),
          eqOrNull(legalAiAnalyses.documentId, input.documentId),
          isNull(legalAiAnalyses.legalMatterId),
        );
      }
      const [agg] = await tx
        .select({ value: max(legalAiAnalyses.version) })
        .from(legalAiAnalyses)
        .where(and(...versionFilters));

      const [analysis] = await tx
        .insert(legalAiAnalyses)
        .values({
          organizationId,
          legalMatterId: matterId,
          judicialProcessId: input.judicialProcessId ?? null,
          administrativeProcessId: input.administrativeProcessId ?? null,
          documentId: input.documentId ?? null,
          aiRequestId: outcome.requestId,
          analysisType: input.analysisType,
          status: "requires_review",
          version: (agg?.value ?? 0) + 1,
          disposition: "requires_review",
          summary: output.summary ?? null,
          structuredResult: output as unknown as Record<string, unknown>,
          createdByMembershipId: membership.membershipId,
        })
        .returning();
      if (!analysis) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar a análise.");

      const base = { organizationId, analysisId: analysis.id };
      // createdAt distinto por item preserva a ordem original do modelo na leitura.
      const orderBase = Date.now();
      const factIds = output.facts.map(() => randomUUID());
      const claimIds = output.claims.map(() => randomUUID());

      if (output.facts.length > 0) {
        await tx.insert(legalAnalysisFacts).values(
          output.facts.map((fact, index) => ({
            ...base,
            id: factIds[index] as string,
            createdAt: new Date(orderBase + index),
            text: fact.text,
            category: fact.category ?? null,
            disputeStatus: fact.disputeStatus,
            sourceLabel: fact.sourceLabel ?? null,
            pageNumber: fact.pageNumber ?? null,
            confidence: fact.confidence,
          })),
        );
      }
      if (output.claims.length > 0) {
        await tx.insert(legalAnalysisClaims).values(
          output.claims.map((claim, index) => ({
            ...base,
            id: claimIds[index] as string,
            createdAt: new Date(orderBase + index),
            text: claim.text,
            claimType: claim.claimType ?? null,
            relatedParty: claim.relatedParty ?? null,
            sourceLabel: claim.sourceLabel ?? null,
            pageNumber: claim.pageNumber ?? null,
            observation: claim.observation ?? null,
          })),
        );
      }
      const grounds = [
        ...output.groundsPresent.map((ground) => ({
          ...base,
          kind: ground.kind,
          text: ground.text,
          sourceLabel: ground.sourceLabel,
          pageNumber: ground.pageNumber ?? null,
          confidence: ground.confidence,
        })),
        ...output.groundsSuggested.map((ground) => ({
          ...base,
          kind: ground.kind,
          text: ground.text,
          sourceLabel: null,
          pageNumber: null,
          confidence: ground.confidence,
        })),
      ];
      if (grounds.length > 0) await tx.insert(legalAnalysisGrounds).values(grounds);
      if (output.evidence.length > 0) {
        await tx.insert(legalAnalysisEvidenceLinks).values(
          output.evidence.map((item) => ({
            ...base,
            factId: item.factIndex !== undefined ? (factIds[item.factIndex] ?? null) : null,
            claimId: item.claimIndex !== undefined ? (claimIds[item.claimIndex] ?? null) : null,
            proposition: item.proposition,
            pageNumber: item.pageNumber ?? null,
            excerptReference: item.excerptReference ?? null,
            relevance: item.relevance ?? null,
          })),
        );
      }
      if (output.contradictions.length > 0) {
        await tx.insert(legalAnalysisContradictions).values(
          output.contradictions.map((item) => ({
            ...base,
            statementA: item.statementA,
            sourceA: item.sourceA ?? null,
            statementB: item.statementB,
            sourceB: item.sourceB ?? null,
            explanation: item.explanation ?? null,
            severity: item.severity,
            confidence: item.confidence,
          })),
        );
      }
      if (output.dates.length > 0) {
        await tx.insert(legalAnalysisDates).values(
          output.dates.map((item) => ({
            ...base,
            dateValue: item.dateValue,
            dateType: item.dateType ?? null,
            description: item.description ?? null,
            sourcePage: item.sourcePage ?? null,
            confidence: item.confidence,
          })),
        );
      }
      if (output.parties.length > 0) {
        await tx.insert(legalAnalysisParties).values(
          output.parties.map((item) => ({
            ...base,
            name: item.name,
            inferredRole: item.inferredRole ?? null,
            sourceLabel: item.sourceLabel ?? null,
            pageNumber: item.pageNumber ?? null,
            confidence: item.confidence,
          })),
        );
      }
      if (output.amounts.length > 0) {
        await tx.insert(legalAnalysisAmounts).values(
          output.amounts.map((item) => ({
            ...base,
            originalText: item.originalText,
            amountCents: item.amountCents,
            currency: item.currency.toUpperCase(),
            context: item.context ?? null,
            sourceLabel: item.sourceLabel ?? null,
            pageNumber: item.pageNumber ?? null,
            confidence: item.confidence,
          })),
        );
      }
      if (output.obligations.length > 0) {
        await tx.insert(legalAnalysisObligations).values(
          output.obligations.map((item) => ({
            ...base,
            obligor: item.obligor ?? null,
            beneficiary: item.beneficiary ?? null,
            action: item.action,
            condition: item.condition ?? null,
            deadlineText: item.deadlineText ?? null,
            amountCents: item.amountCents ?? null,
            sourceLabel: item.sourceLabel ?? null,
            confidence: item.confidence,
          })),
        );
      }
      if (output.missingInformation.length > 0) {
        await tx.insert(legalAnalysisMissingInfo).values(
          output.missingInformation.map((item) => ({
            ...base,
            category: item.category,
            description: item.description,
          })),
        );
      }
      await tx.insert(aiResultSources).values(
        sources.documents.map((doc) => ({
          organizationId,
          aiRequestId: outcome.requestId,
          resourceType: "legal_analysis",
          resourceId: analysis.id,
          documentId: doc.documentId,
          documentVersionId: doc.versionId,
          sourceLabel: `Documento v${doc.versionNumber}`,
          sourceHash: doc.textHash,
        })),
      );
      await recordAudit(tx, {
        actorUserId: account.user.id,
        organizationId,
        action: "legal_analysis.created",
        resourceType: "legal_analysis",
        resourceId: analysis.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        // Somente contagens e referências — nunca o conteúdo analisado.
        metadata: {
          analysisType: input.analysisType,
          version: analysis.version,
          aiRequestId: outcome.requestId,
          documents: sources.documents.length,
          truncatedInput: sources.truncated,
          facts: output.facts.length,
          claims: output.claims.length,
          grounds: grounds.length,
        },
      });
      return analysis.id;
    });
    await recordInProcessJob(db, {
      organizationId,
      membershipId: membership.membershipId,
      jobType: "legal_analysis",
      resourceType: "legal_analysis",
      resourceId: analysisId,
      status: "succeeded",
    });
    return {
      replayed: false,
      ...(await getLegalAnalysis(db, account, organizationId, analysisId)),
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("CONFLICT", "Conflito de versão da análise. Tente novamente.");
    }
    throw error;
  }
}

/* ─── Consulta ─── */

export async function listLegalAnalyses(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: {
    legalMatterId?: string | undefined;
    documentId?: string | undefined;
    analysisType?: string | undefined;
    status?: string | undefined;
    limit: number;
    offset: number;
  },
) {
  authorize(account, organizationId, (access) =>
    policyLegalAnalysis(access, "legal_analysis.read"),
  );
  const filters = [eq(legalAiAnalyses.organizationId, organizationId)];
  if (query.legalMatterId) filters.push(eq(legalAiAnalyses.legalMatterId, query.legalMatterId));
  if (query.documentId) filters.push(eq(legalAiAnalyses.documentId, query.documentId));
  if (query.analysisType) filters.push(eq(legalAiAnalyses.analysisType, query.analysisType));
  if (query.status) {
    filters.push(
      eq(legalAiAnalyses.status, query.status as typeof legalAiAnalyses.$inferSelect.status),
    );
  }
  const where = and(...filters);
  const rows = await db.query.legalAiAnalyses.findMany({
    where,
    orderBy: [desc(legalAiAnalyses.createdAt)],
    limit: 500,
  });
  const visible = [];
  for (const row of rows) {
    if (await canReadAnalysis(db, account, organizationId, row))
      visible.push(serializeAnalysis(row));
  }
  return {
    items: visible.slice(query.offset, query.offset + query.limit),
    total: visible.length,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function getLegalAnalysis(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  analysisId: string,
) {
  authorize(account, organizationId, (access) =>
    policyLegalAnalysis(access, "legal_analysis.read"),
  );
  const row = await requireAnalysis(db, account, organizationId, analysisId);
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
  return {
    analysis: {
      ...serializeAnalysis(row),
      /** Todo texto é texto simples (sanitizado); nunca renderize como HTML. */
      contentFormat: "plain_text" as const,
      provider: request?.provider ?? null,
      pendingReviewItems: countPending(sections),
      ...sections,
      sources: sources.map((source) => ({
        documentId: source.documentId,
        documentVersionId: source.documentVersionId,
        sourceLabel: source.sourceLabel,
      })),
    },
  };
}

export async function listLegalAnalysisVersions(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  analysisId: string,
) {
  authorize(account, organizationId, (access) =>
    policyLegalAnalysis(access, "legal_analysis.read"),
  );
  const row = await requireAnalysis(db, account, organizationId, analysisId);
  const filters = [
    eq(legalAiAnalyses.organizationId, organizationId),
    eq(legalAiAnalyses.analysisType, row.analysisType),
  ];
  if (row.legalMatterId) {
    filters.push(eq(legalAiAnalyses.legalMatterId, row.legalMatterId));
    filters.push(eqOrNull(legalAiAnalyses.documentId, row.documentId));
  } else {
    filters.push(
      isNull(legalAiAnalyses.legalMatterId),
      eqOrNull(legalAiAnalyses.judicialProcessId, row.judicialProcessId),
      eqOrNull(legalAiAnalyses.administrativeProcessId, row.administrativeProcessId),
      eqOrNull(legalAiAnalyses.documentId, row.documentId),
    );
  }
  const rows = await db.query.legalAiAnalyses.findMany({
    where: and(...filters),
    orderBy: [desc(legalAiAnalyses.version)],
  });
  const items = [];
  for (const item of rows) {
    if (await canReadAnalysis(db, account, organizationId, item))
      items.push(serializeAnalysis(item));
  }
  return { items, currentId: row.id };
}

/* ─── Revisão humana ─── */

const SECTION_TABLES = {
  facts: legalAnalysisFacts,
  claims: legalAnalysisClaims,
  grounds: legalAnalysisGrounds,
  evidence: legalAnalysisEvidenceLinks,
  contradictions: legalAnalysisContradictions,
  dates: legalAnalysisDates,
  parties: legalAnalysisParties,
  amounts: legalAnalysisAmounts,
  obligations: legalAnalysisObligations,
  missing: legalAnalysisMissingInfo,
} as const;

export type LegalAnalysisSection = keyof typeof SECTION_TABLES;

export async function reviewLegalAnalysisItem(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  analysisId: string,
  section: LegalAnalysisSection,
  itemId: string,
  input: {
    action: "accept" | "reject" | "correct";
    correctedText?: string | undefined;
    comment?: string | undefined;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) => policyAIAnalysis(access, "legal_analysis.review"));
  const analysis = await requireAnalysis(db, account, organizationId, analysisId);
  if (analysis.status === "reviewed") {
    throw new AppError("CONFLICT", "Esta análise já foi revisada e está fechada para alterações.");
  }
  const table = SECTION_TABLES[section] as typeof legalAnalysisFacts;
  const [item] = await db
    .select({ id: table.id, reviewStatus: table.reviewStatus })
    .from(table)
    .where(
      and(
        eq(table.id, itemId),
        eq(table.analysisId, analysisId),
        eq(table.organizationId, organizationId),
      ),
    );
  if (!item) throw new AppError("NOT_FOUND", "Item da análise não encontrado.");

  const canCorrectText = section === "facts" || section === "claims";
  if (input.action === "correct" && !canCorrectText) {
    throw new AppError("VALIDATION_ERROR", "Esta seção só aceita aceitar ou rejeitar itens.", [
      { path: "action", message: "Correção de texto disponível apenas em fatos e pedidos." },
    ]);
  }
  const reviewStatus =
    input.action === "accept" ? "accepted" : input.action === "reject" ? "rejected" : "corrected";
  const patch: Record<string, unknown> = { reviewStatus };
  if (input.action === "correct") patch.correctedText = input.correctedText;
  if (section === "facts" && input.comment !== undefined) patch.reviewComment = input.comment;

  await db.transaction(async (tx) => {
    await tx
      .update(table)
      .set(patch as never)
      .where(
        and(
          eq(table.id, itemId),
          eq(table.analysisId, analysisId),
          eq(table.organizationId, organizationId),
        ),
      );
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "legal_analysis.item_reviewed",
      resourceType: "legal_analysis",
      resourceId: analysisId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      metadata: { section, itemId, action: input.action },
    });
  });
  return getLegalAnalysis(db, account, organizationId, analysisId);
}

/** Fecha a revisão. NÃO aplica nada ao caso/processo: a análise permanece apoio assistivo. */
export async function reviewLegalAnalysis(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  analysisId: string,
  input: { comment?: string | undefined },
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyAIAnalysis(access, "legal_analysis.review"),
  );
  const analysis = await requireAnalysis(db, account, organizationId, analysisId);
  if (analysis.status !== "requires_review") {
    throw new AppError("CONFLICT", "Somente análises pendentes de revisão podem ser fechadas.");
  }
  await db.transaction(async (tx) => {
    await tx
      .update(legalAiAnalyses)
      .set({
        status: "reviewed",
        reviewedAt: new Date(),
        reviewedByMembershipId: membership.membershipId,
        reviewComment: input.comment ?? null,
        updatedAt: new Date(),
      })
      .where(eq(legalAiAnalyses.id, analysisId));
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "legal_analysis.reviewed",
      resourceType: "legal_analysis",
      resourceId: analysisId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      metadata: { version: analysis.version },
    });
  });
  return getLegalAnalysis(db, account, organizationId, analysisId);
}
