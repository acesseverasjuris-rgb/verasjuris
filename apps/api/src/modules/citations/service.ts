import { randomUUID } from "node:crypto";
import { CitationEngine, type ResearchGateway, UNVERIFIED_SOURCE_LABEL } from "@verasjuris/ai";
import { recordAudit } from "@verasjuris/audit";
import { policyCitation, policyCitationVerification, type SessionAccount } from "@verasjuris/auth";
import {
  type AppDatabase,
  caseLawRecords,
  doctrineSources,
  isUniqueViolation,
  legalCitations,
  legalPrecedents,
  legalSources,
  legalSummaries,
  repetitiveThemes,
  sourceVerifications,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, count, desc, eq, isNull, or } from "drizzle-orm";
import { authorize, iso } from "../ai/shared.js";
import { sanitizeAiText } from "../ai/sanitize.js";
import type { RequestMeta } from "../auth/service.js";

export type CitationsModuleDeps = {
  researchGateway: ResearchGateway;
  citationEngine?: CitationEngine;
};

const CITATION_KIND_SOURCE = "SOURCE_DOCUMENT_CITATION";
const CITATION_KIND_EXTERNAL = "EXTERNAL_LEGAL_CITATION";

type CitationSourceType =
  | "legislation"
  | "case_law"
  | "summary"
  | "theme"
  | "precedent"
  | "doctrine"
  | "internal_document";

function engineOf(deps: CitationsModuleDeps) {
  return deps.citationEngine ?? new CitationEngine();
}

function serializeCitation(row: typeof legalCitations.$inferSelect) {
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  const citationKind =
    typeof metadata.citationKind === "string" ? metadata.citationKind : CITATION_KIND_EXTERNAL;
  return {
    id: row.id,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    citationKind,
    citationStyle: row.citationStyle,
    formattedCitation: row.formattedCitation,
    court: row.court,
    caseNumber: row.caseNumber,
    rapporteur: row.rapporteur,
    judgingBody: row.judgingBody,
    judgmentDate: iso(row.judgmentDate),
    publicationDate: iso(row.publicationDate),
    sourceUrl: row.sourceUrl,
    excerpt: row.excerpt,
    excerptLocation: row.excerptLocation,
    excerptStart: row.excerptStart,
    excerptEnd: row.excerptEnd,
    pageNumber: row.pageNumber,
    sourceHash: row.sourceHash,
    verificationStatus: row.verificationStatus,
    verifiedAt: iso(row.verifiedAt),
    /** Texto pronto para colar; nunca implica verificação automática. */
    copyText: row.formattedCitation,
    createdAt: row.createdAt.toISOString(),
  };
}

function orgOrGlobal(organizationId: string, column: { organizationId: unknown }) {
  return or(
    eq(column.organizationId as never, organizationId),
    isNull(column.organizationId as never),
  );
}

async function loadSourceMetadata(
  db: AppDatabase,
  organizationId: string,
  sourceType: CitationSourceType,
  sourceId: string,
): Promise<{
  title?: string | null;
  court?: string | null;
  caseNumber?: string | null;
  rapporteur?: string | null;
  judgingBody?: string | null;
  decisionDate?: string | null;
  publicationDate?: string | null;
  legislationRef?: string | null;
  sourceUrl?: string | null;
  excerpt?: string | null;
  contentHash?: string | null;
} | null> {
  switch (sourceType) {
    case "legislation": {
      const row = await db.query.legalSources.findFirst({
        where: and(eq(legalSources.id, sourceId), orgOrGlobal(organizationId, legalSources)),
      });
      if (!row) return null;
      return {
        title: row.title,
        legislationRef: row.identifier ?? row.title,
        publicationDate: row.publicationDate?.toISOString() ?? null,
        sourceUrl: row.sourceUrl,
        contentHash: row.contentHash,
      };
    }
    case "case_law": {
      const row = await db.query.caseLawRecords.findFirst({
        where: and(eq(caseLawRecords.id, sourceId), orgOrGlobal(organizationId, caseLawRecords)),
      });
      if (!row) return null;
      return {
        title: `${row.court} ${row.caseNumber}`,
        court: row.court,
        caseNumber: row.caseNumber,
        rapporteur: row.rapporteur,
        judgingBody: row.judgingBody,
        decisionDate: row.judgmentDate?.toISOString() ?? null,
        publicationDate: row.publicationDate?.toISOString() ?? null,
        sourceUrl: row.sourceUrl,
        excerpt: row.headnote,
        contentHash: row.sourceHash,
      };
    }
    case "summary": {
      const row = await db.query.legalSummaries.findFirst({
        where: and(eq(legalSummaries.id, sourceId), orgOrGlobal(organizationId, legalSummaries)),
      });
      if (!row) return null;
      return {
        title: `${row.court} Súmula ${row.number}`,
        court: row.court,
        sourceUrl: row.sourceUrl,
        excerpt: row.text,
      };
    }
    case "theme": {
      const row = await db.query.repetitiveThemes.findFirst({
        where: and(
          eq(repetitiveThemes.id, sourceId),
          orgOrGlobal(organizationId, repetitiveThemes),
        ),
      });
      if (!row) return null;
      return {
        title: row.title,
        court: row.court,
        sourceUrl: row.sourceUrl,
        excerpt: row.thesis,
      };
    }
    case "precedent": {
      const row = await db.query.legalPrecedents.findFirst({
        where: and(eq(legalPrecedents.id, sourceId), orgOrGlobal(organizationId, legalPrecedents)),
      });
      if (!row) return null;
      return {
        title: row.title,
        sourceUrl: row.sourceUrl,
        excerpt: row.applicabilityNotes,
      };
    }
    case "doctrine": {
      const row = await db.query.doctrineSources.findFirst({
        where: and(eq(doctrineSources.id, sourceId), orgOrGlobal(organizationId, doctrineSources)),
      });
      if (!row) return null;
      return {
        title: row.title,
        sourceUrl: row.sourceUrl,
        excerpt: row.author,
      };
    }
    default:
      return null;
  }
}

export async function createCitation(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    sourceType: CitationSourceType;
    sourceId?: string | undefined;
    citationStyle: string;
    formattedCitation?: string | undefined;
    title?: string | undefined;
    legislationRef?: string | undefined;
    court?: string | undefined;
    caseNumber?: string | undefined;
    rapporteur?: string | undefined;
    judgingBody?: string | undefined;
    judgmentDate?: string | undefined;
    publicationDate?: string | undefined;
    sourceUrl?: string | undefined;
    excerpt?: string | undefined;
    excerptLocation?: string | undefined;
    excerptStart?: number | undefined;
    excerptEnd?: number | undefined;
    pageNumber?: number | undefined;
    sourceHash?: string | undefined;
  },
  deps: CitationsModuleDeps,
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyCitation(access, "citation.create"),
  );

  let citationKind = CITATION_KIND_EXTERNAL;
  let sourceId = input.sourceId ?? null;
  let fromSource: Awaited<ReturnType<typeof loadSourceMetadata>> = null;

  if (sourceId) {
    fromSource = await loadSourceMetadata(db, organizationId, input.sourceType, sourceId);
    if (!fromSource) {
      throw new AppError("NOT_FOUND", "Não encontramos esta fonte no seu acesso.");
    }
    citationKind = CITATION_KIND_SOURCE;
  } else {
    sourceId = randomUUID();
  }

  const excerptRaw = input.excerpt ?? fromSource?.excerpt ?? null;
  const excerpt = excerptRaw ? sanitizeAiText(excerptRaw) : null;

  const resolved = engineOf(deps).resolve({
    sourceType: input.sourceType,
    sourceId,
    title: input.title ?? fromSource?.title ?? null,
    court: input.court ?? fromSource?.court ?? null,
    caseNumber: input.caseNumber ?? fromSource?.caseNumber ?? null,
    rapporteur: input.rapporteur ?? fromSource?.rapporteur ?? null,
    judgingBody: input.judgingBody ?? fromSource?.judgingBody ?? null,
    decisionDate: input.judgmentDate ?? fromSource?.decisionDate ?? null,
    publicationDate: input.publicationDate ?? fromSource?.publicationDate ?? null,
    legislationRef: input.legislationRef ?? fromSource?.legislationRef ?? null,
    sourceUrl: input.sourceUrl ?? fromSource?.sourceUrl ?? null,
    excerpt,
    pageNumber: input.pageNumber ?? null,
    contentHash: input.sourceHash ?? fromSource?.contentHash ?? null,
    verificationStatus: "unverified",
  });

  if (
    resolved.incomplete ||
    resolved.verificationStatus === "invalid" ||
    resolved.rejectionReason
  ) {
    throw new AppError("VALIDATION_ERROR", UNVERIFIED_SOURCE_LABEL, [
      {
        path: "citation",
        message: resolved.rejectionReason ?? UNVERIFIED_SOURCE_LABEL,
      },
    ]);
  }

  const formatted =
    input.formattedCitation && input.formattedCitation.trim().length >= 2
      ? sanitizeAiText(input.formattedCitation)
      : resolved.formattedCitation;

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(legalCitations)
      .values({
        organizationId,
        sourceType: input.sourceType,
        sourceId,
        citationStyle: input.citationStyle,
        formattedCitation: formatted,
        court: resolved.court,
        caseNumber: resolved.caseNumber,
        rapporteur: resolved.rapporteur,
        judgingBody: resolved.judgingBody,
        judgmentDate: resolved.decisionDate ? new Date(resolved.decisionDate) : null,
        publicationDate: resolved.publicationDate ? new Date(resolved.publicationDate) : null,
        sourceUrl: resolved.sourceUrl,
        excerpt,
        excerptLocation: input.excerptLocation ?? null,
        excerptStart: input.excerptStart ?? null,
        excerptEnd: input.excerptEnd ?? null,
        pageNumber: resolved.pageNumber,
        sourceHash: resolved.contentHash,
        verificationStatus: resolved.verificationStatus,
        createdByMembershipId: membership.membershipId,
        metadata: {
          citationKind,
          legislationRef: resolved.legislationRef,
          provider: resolved.provider,
        },
      })
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a citação.");
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "citation.created",
      resourceType: "legal_citation",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: {
        sourceType: row.sourceType,
        verificationStatus: row.verificationStatus,
        citationKind,
      },
    });
    return { citation: serializeCitation(row) };
  });
}

export async function getCitation(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  citationId: string,
) {
  authorize(account, organizationId, (access) => policyCitation(access, "citation.read"));
  const row = await db.query.legalCitations.findFirst({
    where: and(
      eq(legalCitations.id, citationId),
      eq(legalCitations.organizationId, organizationId),
    ),
  });
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos esta citação no seu acesso.");
  return { citation: serializeCitation(row) };
}

export async function listCitations(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: {
    sourceType?: CitationSourceType | undefined;
    sourceId?: string | undefined;
    verificationStatus?: string | undefined;
    limit: number;
    offset: number;
  },
) {
  authorize(account, organizationId, (access) => policyCitation(access, "citation.read"));
  const filters = [eq(legalCitations.organizationId, organizationId)];
  if (query.sourceType) filters.push(eq(legalCitations.sourceType, query.sourceType));
  if (query.sourceId) filters.push(eq(legalCitations.sourceId, query.sourceId));
  if (query.verificationStatus) {
    filters.push(
      eq(
        legalCitations.verificationStatus,
        query.verificationStatus as typeof legalCitations.$inferSelect.verificationStatus,
      ),
    );
  }
  const where = and(...filters);
  const [totalRow] = await db.select({ value: count() }).from(legalCitations).where(where);
  const rows = await db.query.legalCitations.findMany({
    where,
    orderBy: [desc(legalCitations.createdAt)],
    limit: query.limit,
    offset: query.offset,
  });
  return {
    items: rows.map(serializeCitation),
    total: totalRow?.value ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

/**
 * Verificação real só com provedor configurado.
 * Nunca marca `verified` sem checagem; invalidação manual permanece permitida.
 */
export async function verifyCitation(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  citationId: string,
  input: {
    verificationStatus:
      | "source_available"
      | "verified"
      | "source_unavailable"
      | "invalid"
      | "stale";
    sourceUrl?: string | undefined;
    sourceHash?: string | undefined;
    notes?: string | undefined;
  },
  deps: CitationsModuleDeps,
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyCitationVerification(access),
  );
  const existing = await db.query.legalCitations.findFirst({
    where: and(
      eq(legalCitations.id, citationId),
      eq(legalCitations.organizationId, organizationId),
    ),
  });
  if (!existing) throw new AppError("NOT_FOUND", "Não encontramos esta citação no seu acesso.");

  const description = deps.researchGateway.describe();
  const wantsPositive =
    input.verificationStatus === "verified" || input.verificationStatus === "source_available";

  if (wantsPositive && description.status !== "configured") {
    return {
      status: "not_configured" as const,
      provider: "not_configured",
      citation: serializeCitation(existing),
      message:
        "Nenhum provedor de fontes jurídicas está configurado. A citação permanece não verificada.",
    };
  }

  if (input.verificationStatus === "verified" && description.status === "configured") {
    // Sem integração remota real nesta etapa: nunca promover a verified.
    throw new AppError(
      "NOT_CONFIGURED",
      "Verificação remota de citações ainda não está disponível. A citação não foi marcada como verificada.",
    );
  }

  const nextStatus = input.verificationStatus;
  const now = new Date();
  const isInvalidation = nextStatus === "invalid" || nextStatus === "stale";

  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .update(legalCitations)
        .set({
          verificationStatus: nextStatus === "verified" ? existing.verificationStatus : nextStatus,
          ...(input.sourceUrl ? { sourceUrl: input.sourceUrl } : {}),
          ...(input.sourceHash ? { sourceHash: input.sourceHash } : {}),
          ...(nextStatus === "source_available" || isInvalidation
            ? { verifiedAt: isInvalidation ? null : now }
            : {}),
        })
        .where(eq(legalCitations.id, existing.id))
        .returning();
      if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível atualizar a citação.");

      await tx.insert(sourceVerifications).values({
        organizationId,
        citationId: row.id,
        sourceType: row.sourceType,
        sourceId: row.sourceId,
        verificationStatus: row.verificationStatus,
        sourceUrl: input.sourceUrl ?? row.sourceUrl,
        sourceHash: input.sourceHash ?? row.sourceHash,
        provider: description.status === "configured" ? description.provider : "not_configured",
        notes: input.notes ?? null,
        verifiedAt: row.verifiedAt,
        verifiedByMembershipId: membership.membershipId,
      });

      await recordAudit(tx, {
        actorUserId: account.user.id,
        organizationId,
        action: isInvalidation ? "citation.invalidated" : "citation.verified",
        resourceType: "legal_citation",
        resourceId: row.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        before: { verificationStatus: existing.verificationStatus },
        after: { verificationStatus: row.verificationStatus },
      });

      return {
        status: "ok" as const,
        citation: serializeCitation(row),
      };
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError("CONFLICT", "Conflito ao verificar citação.");
    throw error;
  }
}
