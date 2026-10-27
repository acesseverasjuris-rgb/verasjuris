import { createHash } from "node:crypto";
import type {
  LegalResearchQueryFilters,
  LegalSourceCapability,
  ResearchGateway,
} from "@verasjuris/ai";
import { recordAudit } from "@verasjuris/audit";
import {
  policyLegalMatterResearchLink,
  policyLegalResearch,
  policyLegalResearchExecute,
  policySavedResearch,
  type SessionAccount,
} from "@verasjuris/auth";
import {
  type AppDatabase,
  caseLawRecords,
  doctrineSources,
  generalRepercussionThemes,
  isUniqueViolation,
  legalMatterResearchLinks,
  legalMatters,
  legalPrecedents,
  legalResearchQueries,
  legalResearchResults,
  legalSources,
  legalSummaries,
  repetitiveThemes,
  savedResearches,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, count, desc, eq, ilike, isNull, or, type SQL } from "drizzle-orm";
import { authorize, escapeLike, iso } from "../ai/shared.js";
import { sanitizeAiText } from "../ai/sanitize.js";
import type { RequestMeta } from "../auth/service.js";

export type LegalResearchModuleDeps = {
  researchGateway: ResearchGateway;
};

type SourceType =
  | "legislation"
  | "case_law"
  | "summary"
  | "theme"
  | "general_repercussion"
  | "precedent"
  | "doctrine"
  | "internal_document";

type LocalHit = {
  sourceType: SourceType;
  sourceId: string;
  title: string;
  excerpt: string | null;
  provider: "manual" | "official_provider" | "import" | "not_configured";
  sourceUrl: string | null;
};

const CAPABILITY_BY_SOURCE: Partial<Record<SourceType, LegalSourceCapability>> = {
  legislation: "LEGISLATION",
  case_law: "CASE_LAW",
  summary: "SUMULA",
  theme: "REPETITIVE_THEME",
  general_repercussion: "GENERAL_REPERCUSSION",
  precedent: "PRECEDENT",
  doctrine: "DOCTRINE",
};

function contentHashOf(parts: string[]): string {
  return createHash("sha256").update(parts.join("|"), "utf8").digest("hex");
}

function serializeQuery(row: typeof legalResearchQueries.$inferSelect) {
  return {
    id: row.id,
    query: row.query,
    filters: row.filters,
    status: row.status,
    provider: row.provider,
    resultCount: row.resultCount,
    completedAt: iso(row.completedAt),
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeSaved(row: typeof savedResearches.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    query: row.query,
    filters: row.filters,
    queryId: row.queryId,
    legalMatterId: row.legalMatterId,
    selectedResultIds: row.selectedResultIds,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function orgOrGlobal(organizationId: string, column: { organizationId: unknown }) {
  return or(
    eq(column.organizationId as never, organizationId),
    isNull(column.organizationId as never),
  );
}

async function requireMatterInOrg(db: AppDatabase, organizationId: string, legalMatterId: string) {
  const matter = await db.query.legalMatters.findFirst({
    where: and(eq(legalMatters.id, legalMatterId), eq(legalMatters.organizationId, organizationId)),
    columns: { id: true },
  });
  if (!matter) throw new AppError("NOT_FOUND", "Não encontramos este caso no seu acesso.");
  return matter;
}

async function assertSourceExists(
  db: AppDatabase,
  organizationId: string,
  sourceType: SourceType,
  sourceId: string,
) {
  const record = await getRecordByType(db, organizationId, sourceType, sourceId);
  if (!record) throw new AppError("NOT_FOUND", "Não encontramos esta fonte no seu acesso.");
  return record;
}

async function getRecordByType(
  db: AppDatabase,
  organizationId: string,
  sourceType: SourceType,
  sourceId: string,
) {
  switch (sourceType) {
    case "legislation": {
      const row = await db.query.legalSources.findFirst({
        where: and(eq(legalSources.id, sourceId), orgOrGlobal(organizationId, legalSources)),
      });
      return row ? { sourceType, record: serializeLegislation(row, organizationId) } : null;
    }
    case "case_law": {
      const row = await db.query.caseLawRecords.findFirst({
        where: and(eq(caseLawRecords.id, sourceId), orgOrGlobal(organizationId, caseLawRecords)),
      });
      return row ? { sourceType, record: serializeCaseLaw(row, organizationId) } : null;
    }
    case "summary": {
      const row = await db.query.legalSummaries.findFirst({
        where: and(eq(legalSummaries.id, sourceId), orgOrGlobal(organizationId, legalSummaries)),
      });
      return row ? { sourceType, record: serializeSummary(row, organizationId) } : null;
    }
    case "theme": {
      const row = await db.query.repetitiveThemes.findFirst({
        where: and(
          eq(repetitiveThemes.id, sourceId),
          orgOrGlobal(organizationId, repetitiveThemes),
        ),
      });
      return row ? { sourceType, record: serializeTheme(row, organizationId) } : null;
    }
    case "general_repercussion": {
      const row = await db.query.generalRepercussionThemes.findFirst({
        where: and(
          eq(generalRepercussionThemes.id, sourceId),
          orgOrGlobal(organizationId, generalRepercussionThemes),
        ),
      });
      return row ? { sourceType, record: serializeGeneralRepercussion(row, organizationId) } : null;
    }
    case "precedent": {
      const row = await db.query.legalPrecedents.findFirst({
        where: and(eq(legalPrecedents.id, sourceId), orgOrGlobal(organizationId, legalPrecedents)),
      });
      return row ? { sourceType, record: serializePrecedent(row, organizationId) } : null;
    }
    case "doctrine": {
      const row = await db.query.doctrineSources.findFirst({
        where: and(eq(doctrineSources.id, sourceId), orgOrGlobal(organizationId, doctrineSources)),
      });
      return row ? { sourceType, record: serializeDoctrine(row, organizationId) } : null;
    }
    case "internal_document":
      return null;
    default:
      return null;
  }
}

function serializeLegislation(row: typeof legalSources.$inferSelect, organizationId: string) {
  return {
    id: row.id,
    scope: row.organizationId === null ? "global" : "organization",
    editable: row.organizationId === organizationId,
    sourceProvider: row.sourceProvider,
    sourceType: row.sourceType,
    title: row.title,
    identifier: row.identifier,
    jurisdiction: row.jurisdiction,
    authority: row.authority,
    sourceUrl: row.sourceUrl,
    publicationDate: iso(row.publicationDate),
    effectiveDate: iso(row.effectiveDate),
    contentHash: row.contentHash,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeCaseLaw(row: typeof caseLawRecords.$inferSelect, organizationId: string) {
  return {
    id: row.id,
    scope: row.organizationId === null ? "global" : "organization",
    editable: row.organizationId === organizationId,
    provider: row.provider,
    court: row.court,
    caseNumber: row.caseNumber,
    caseNumberNormalized: row.caseNumberNormalized,
    courtUnit: row.courtUnit,
    rapporteur: row.rapporteur,
    judgingBody: row.judgingBody,
    judgmentDate: iso(row.judgmentDate),
    publicationDate: iso(row.publicationDate),
    proceduralClass: row.proceduralClass,
    subject: row.subject,
    headnote: row.headnote,
    sourceUrl: row.sourceUrl,
    sourceHash: row.sourceHash,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeSummary(row: typeof legalSummaries.$inferSelect, organizationId: string) {
  return {
    id: row.id,
    scope: row.organizationId === null ? "global" : "organization",
    editable: row.organizationId === organizationId,
    court: row.court,
    number: row.number,
    text: row.text,
    binding: row.binding,
    status: row.status,
    sourceUrl: row.sourceUrl,
    approvalDate: iso(row.approvalDate),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeTheme(row: typeof repetitiveThemes.$inferSelect, organizationId: string) {
  return {
    id: row.id,
    scope: row.organizationId === null ? "global" : "organization",
    editable: row.organizationId === organizationId,
    court: row.court,
    themeNumber: row.themeNumber,
    title: row.title,
    controversy: row.controversy,
    thesis: row.thesis,
    status: row.status,
    sourceUrl: row.sourceUrl,
    judgmentDate: iso(row.judgmentDate),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeGeneralRepercussion(
  row: typeof generalRepercussionThemes.$inferSelect,
  organizationId: string,
) {
  return {
    id: row.id,
    scope: row.organizationId === null ? "global" : "organization",
    editable: row.organizationId === organizationId,
    themeNumber: row.themeNumber,
    title: row.title,
    controversy: row.controversy,
    thesis: row.thesis,
    status: row.status,
    leadingCaseNumber: row.leadingCaseNumber,
    sourceUrl: row.sourceUrl,
    judgmentDate: iso(row.judgmentDate),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializePrecedent(row: typeof legalPrecedents.$inferSelect, organizationId: string) {
  return {
    id: row.id,
    scope: row.organizationId === null ? "global" : "organization",
    editable: row.organizationId === organizationId,
    title: row.title,
    jurisdiction: row.jurisdiction,
    hierarchy: row.hierarchy,
    bindingStatus: row.bindingStatus,
    applicabilityNotes: row.applicabilityNotes,
    decisionReference: row.decisionReference,
    sourceUrl: row.sourceUrl,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeDoctrine(row: typeof doctrineSources.$inferSelect, organizationId: string) {
  return {
    id: row.id,
    scope: row.organizationId === null ? "global" : "organization",
    editable: row.organizationId === organizationId,
    title: row.title,
    author: row.author,
    publisher: row.publisher,
    edition: row.edition,
    year: row.year,
    identifier: row.identifier,
    isbn: row.isbn,
    licensed: row.licensed,
    /** Sem licença: apenas referência bibliográfica — nunca conteúdo integral inventado. */
    fullTextAvailable: row.licensed,
    sourceUrl: row.sourceUrl,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function localSearch(
  db: AppDatabase,
  organizationId: string,
  query: string,
  sourceTypes: SourceType[] | undefined,
  limit: number,
): Promise<LocalHit[]> {
  const pattern = `%${escapeLike(query)}%`;
  const wanted = new Set(
    sourceTypes?.length
      ? sourceTypes
      : (["legislation", "case_law", "summary", "theme", "precedent", "doctrine"] as SourceType[]),
  );
  const hits: LocalHit[] = [];

  if (wanted.has("legislation")) {
    const rows = await db.query.legalSources.findMany({
      where: and(
        orgOrGlobal(organizationId, legalSources),
        or(ilike(legalSources.title, pattern), ilike(legalSources.identifier, pattern)),
      ),
      limit,
    });
    for (const row of rows) {
      hits.push({
        sourceType: "legislation",
        sourceId: row.id,
        title: row.title,
        excerpt: row.identifier,
        provider: row.sourceProvider,
        sourceUrl: row.sourceUrl,
      });
    }
  }

  if (wanted.has("case_law")) {
    const rows = await db.query.caseLawRecords.findMany({
      where: and(
        orgOrGlobal(organizationId, caseLawRecords),
        or(
          ilike(caseLawRecords.caseNumber, pattern),
          ilike(caseLawRecords.subject, pattern),
          ilike(caseLawRecords.headnote, pattern),
          ilike(caseLawRecords.court, pattern),
        ),
      ),
      limit,
    });
    for (const row of rows) {
      hits.push({
        sourceType: "case_law",
        sourceId: row.id,
        title: `${row.court} ${row.caseNumber}`,
        excerpt: row.headnote ? sanitizeAiText(row.headnote) : row.subject,
        provider: row.provider,
        sourceUrl: row.sourceUrl,
      });
    }
  }

  if (wanted.has("summary")) {
    const rows = await db.query.legalSummaries.findMany({
      where: and(
        orgOrGlobal(organizationId, legalSummaries),
        or(ilike(legalSummaries.number, pattern), ilike(legalSummaries.text, pattern)),
      ),
      limit,
    });
    for (const row of rows) {
      hits.push({
        sourceType: "summary",
        sourceId: row.id,
        title: `${row.court} Súmula ${row.number}`,
        excerpt: sanitizeAiText(row.text).slice(0, 500),
        provider: "manual",
        sourceUrl: row.sourceUrl,
      });
    }
  }

  if (wanted.has("theme") || wanted.has("general_repercussion")) {
    if (wanted.has("theme")) {
      const rows = await db.query.repetitiveThemes.findMany({
        where: and(
          orgOrGlobal(organizationId, repetitiveThemes),
          or(
            ilike(repetitiveThemes.title, pattern),
            ilike(repetitiveThemes.themeNumber, pattern),
            ilike(repetitiveThemes.thesis, pattern),
          ),
        ),
        limit,
      });
      for (const row of rows) {
        hits.push({
          sourceType: "theme",
          sourceId: row.id,
          title: row.title,
          excerpt: row.thesis,
          provider: "manual",
          sourceUrl: row.sourceUrl,
        });
      }
    }
    if (wanted.has("general_repercussion") || wanted.has("theme")) {
      const rows = await db.query.generalRepercussionThemes.findMany({
        where: and(
          orgOrGlobal(organizationId, generalRepercussionThemes),
          or(
            ilike(generalRepercussionThemes.title, pattern),
            ilike(generalRepercussionThemes.themeNumber, pattern),
            ilike(generalRepercussionThemes.thesis, pattern),
          ),
        ),
        limit,
      });
      for (const row of rows) {
        hits.push({
          sourceType: "general_repercussion",
          sourceId: row.id,
          title: row.title,
          excerpt: row.thesis,
          provider: "manual",
          sourceUrl: row.sourceUrl,
        });
      }
    }
  }

  if (wanted.has("precedent")) {
    const rows = await db.query.legalPrecedents.findMany({
      where: and(
        orgOrGlobal(organizationId, legalPrecedents),
        or(
          ilike(legalPrecedents.title, pattern),
          ilike(legalPrecedents.decisionReference, pattern),
        ),
      ),
      limit,
    });
    for (const row of rows) {
      hits.push({
        sourceType: "precedent",
        sourceId: row.id,
        title: row.title,
        excerpt: row.applicabilityNotes,
        provider: "manual",
        sourceUrl: row.sourceUrl,
      });
    }
  }

  if (wanted.has("doctrine")) {
    const rows = await db.query.doctrineSources.findMany({
      where: and(
        orgOrGlobal(organizationId, doctrineSources),
        or(ilike(doctrineSources.title, pattern), ilike(doctrineSources.author, pattern)),
      ),
      limit,
    });
    for (const row of rows) {
      hits.push({
        sourceType: "doctrine",
        sourceId: row.id,
        title: row.title,
        excerpt: row.author,
        provider: "manual",
        sourceUrl: row.sourceUrl,
      });
    }
  }

  return hits.slice(0, limit);
}

/* ─── Provider status ─── */

export async function getLegalResearchProviderStatus(
  account: SessionAccount,
  organizationId: string,
  gateway: ResearchGateway,
) {
  authorize(account, organizationId, (access) =>
    policyLegalResearch(access, "legal_research.read"),
  );
  const description = gateway.describe();
  const health = await gateway.healthCheck();
  return {
    provider: description.status === "configured" ? description.provider : "not_configured",
    status: description.status === "configured" ? health.status : "not_configured",
    health,
    capabilities:
      description.status === "configured" ? [...description.capabilities] : ([] as string[]),
    localCatalogAvailable: true,
  };
}

/* ─── Execute research ─── */

export async function executeResearch(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    query: string;
    filters?: {
      sourceType?: SourceType | undefined;
      court?: string | undefined;
      jurisdiction?: string | undefined;
      subject?: string | undefined;
      proceduralClass?: string | undefined;
      rapporteur?: string | undefined;
      status?: string | undefined;
      from?: string | undefined;
      to?: string | undefined;
    };
    sourceTypes?: SourceType[] | undefined;
  },
  gateway: ResearchGateway,
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyLegalResearchExecute(access),
  );
  const filtersPayload = (input.filters ?? {}) as Record<string, unknown>;
  const sourceTypes =
    input.sourceTypes ?? (input.filters?.sourceType ? [input.filters.sourceType] : undefined);

  const [queryRow] = await db
    .insert(legalResearchQueries)
    .values({
      organizationId,
      userId: account.user.id,
      membershipId: membership.membershipId,
      query: input.query,
      filters: { ...filtersPayload, ...(sourceTypes ? { sourceTypes } : {}) },
      status: "running",
      provider: "not_configured",
    })
    .returning();
  if (!queryRow) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar a pesquisa.");

  const description = gateway.describe();
  let hits: LocalHit[] = [];
  let status: typeof legalResearchQueries.$inferSelect.status = "not_configured";
  let provider: typeof legalResearchQueries.$inferSelect.provider = "not_configured";

  if (description.status === "configured") {
    try {
      const capabilities = sourceTypes
        ?.map((type) => CAPABILITY_BY_SOURCE[type])
        .filter((value): value is LegalSourceCapability => Boolean(value));
      const gatewayFilters: LegalResearchQueryFilters = {
        ...(capabilities?.length ? { capabilities } : {}),
        ...(input.filters?.court ? { court: input.filters.court } : {}),
        ...(input.filters?.jurisdiction ? { jurisdiction: input.filters.jurisdiction } : {}),
        ...(input.filters?.from ? { dateFrom: input.filters.from } : {}),
        ...(input.filters?.to ? { dateTo: input.filters.to } : {}),
      };
      const page = await gateway.search({
        text: input.query,
        ...(Object.keys(gatewayFilters).length ? { filters: gatewayFilters } : {}),
        limit: 20,
      });
      provider = "official_provider";
      // Provider results only surface when real; never invent. Local DB remains source of truth for IDs.
      hits = await localSearch(db, organizationId, input.query, sourceTypes, 20);
      if (page.items.length === 0 && hits.length === 0) status = "empty";
      else status = "succeeded";
      // If provider returned items but none map to local catalog yet, keep empty — no invented IDs.
      if (page.items.length > 0 && hits.length === 0) status = "empty";
    } catch (error) {
      if (
        error instanceof AppError &&
        (error.code === "LEGAL_SOURCE_PROVIDER_NOT_CONFIGURED" || error.code === "NOT_CONFIGURED")
      ) {
        hits = await localSearch(db, organizationId, input.query, sourceTypes, 20);
        status = "not_configured";
        provider = "not_configured";
      } else {
        await db
          .update(legalResearchQueries)
          .set({ status: "failed", completedAt: new Date() })
          .where(eq(legalResearchQueries.id, queryRow.id));
        throw error;
      }
    }
  } else {
    hits = await localSearch(db, organizationId, input.query, sourceTypes, 20);
    status = "not_configured";
    provider = "not_configured";
  }

  const completedAt = new Date();
  return db.transaction(async (tx) => {
    const resultRows = [];
    for (const [index, hit] of hits.entries()) {
      const [row] = await tx
        .insert(legalResearchResults)
        .values({
          organizationId,
          queryId: queryRow.id,
          sourceType: hit.sourceType,
          sourceId: hit.sourceId,
          rank: index + 1,
          relevance: Math.max(0, 100 - index),
          provider: hit.provider === "not_configured" ? "manual" : hit.provider,
        })
        .returning();
      if (row) resultRows.push(row);
    }

    const [updated] = await tx
      .update(legalResearchQueries)
      .set({
        status,
        provider,
        resultCount: resultRows.length,
        completedAt,
      })
      .where(eq(legalResearchQueries.id, queryRow.id))
      .returning();

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "legal_research.executed",
      resourceType: "legal_research_query",
      resourceId: queryRow.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: {
        status,
        provider,
        resultCount: resultRows.length,
        invented: false,
      },
    });

    return {
      status,
      provider,
      query: serializeQuery(
        updated ?? { ...queryRow, status, provider, resultCount: resultRows.length, completedAt },
      ),
      results: hits.map((hit, index) => ({
        rank: index + 1,
        sourceType: hit.sourceType,
        sourceId: hit.sourceId,
        title: hit.title,
        excerpt: hit.excerpt,
        sourceUrl: hit.sourceUrl,
        provider: hit.provider,
      })),
      message:
        status === "not_configured"
          ? "Nenhum provedor de fontes jurídicas está configurado. Resultados locais do catálogo (se houver); nada foi inventado."
          : null,
    };
  });
}

export async function listResearchQueries(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: {
    q?: string | undefined;
    status?: string | undefined;
    limit: number;
    offset: number;
  },
) {
  authorize(account, organizationId, (access) =>
    policyLegalResearch(access, "legal_research.read"),
  );
  const filters: SQL[] = [eq(legalResearchQueries.organizationId, organizationId)];
  if (query.status) {
    filters.push(
      eq(
        legalResearchQueries.status,
        query.status as typeof legalResearchQueries.$inferSelect.status,
      ),
    );
  }
  if (query.q) {
    filters.push(ilike(legalResearchQueries.query, `%${escapeLike(query.q)}%`));
  }
  const where = and(...filters);
  const [totalRow] = await db.select({ value: count() }).from(legalResearchQueries).where(where);
  const rows = await db.query.legalResearchQueries.findMany({
    where,
    orderBy: [desc(legalResearchQueries.createdAt)],
    limit: query.limit,
    offset: query.offset,
  });
  return {
    items: rows.map(serializeQuery),
    total: totalRow?.value ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

/* ─── Catalog lists ─── */

export async function listLegislation(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { q?: string | undefined; limit: number; offset: number },
) {
  authorize(account, organizationId, (access) =>
    policyLegalResearch(access, "legal_research.read"),
  );
  const filters: SQL[] = [orgOrGlobal(organizationId, legalSources) as SQL];
  if (query.q) {
    const pattern = `%${escapeLike(query.q)}%`;
    filters.push(
      or(ilike(legalSources.title, pattern), ilike(legalSources.identifier, pattern)) as SQL,
    );
  }
  const where = and(...filters);
  const [totalRow] = await db.select({ value: count() }).from(legalSources).where(where);
  const rows = await db.query.legalSources.findMany({
    where,
    orderBy: [desc(legalSources.updatedAt)],
    limit: query.limit,
    offset: query.offset,
  });
  return {
    items: rows.map((row) => serializeLegislation(row, organizationId)),
    total: totalRow?.value ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function listCaseLaw(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { q?: string | undefined; court?: string | undefined; limit: number; offset: number },
) {
  authorize(account, organizationId, (access) =>
    policyLegalResearch(access, "legal_research.read"),
  );
  const filters: SQL[] = [orgOrGlobal(organizationId, caseLawRecords) as SQL];
  if (query.court) filters.push(eq(caseLawRecords.court, query.court));
  if (query.q) {
    const pattern = `%${escapeLike(query.q)}%`;
    filters.push(
      or(
        ilike(caseLawRecords.caseNumber, pattern),
        ilike(caseLawRecords.subject, pattern),
        ilike(caseLawRecords.headnote, pattern),
      ) as SQL,
    );
  }
  const where = and(...filters);
  const [totalRow] = await db.select({ value: count() }).from(caseLawRecords).where(where);
  const rows = await db.query.caseLawRecords.findMany({
    where,
    orderBy: [desc(caseLawRecords.updatedAt)],
    limit: query.limit,
    offset: query.offset,
  });
  return {
    items: rows.map((row) => serializeCaseLaw(row, organizationId)),
    total: totalRow?.value ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function listSummaries(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { q?: string | undefined; limit: number; offset: number },
) {
  authorize(account, organizationId, (access) =>
    policyLegalResearch(access, "legal_research.read"),
  );
  const filters: SQL[] = [orgOrGlobal(organizationId, legalSummaries) as SQL];
  if (query.q) {
    const pattern = `%${escapeLike(query.q)}%`;
    filters.push(
      or(ilike(legalSummaries.number, pattern), ilike(legalSummaries.text, pattern)) as SQL,
    );
  }
  const where = and(...filters);
  const [totalRow] = await db.select({ value: count() }).from(legalSummaries).where(where);
  const rows = await db.query.legalSummaries.findMany({
    where,
    orderBy: [desc(legalSummaries.updatedAt)],
    limit: query.limit,
    offset: query.offset,
  });
  return {
    items: rows.map((row) => serializeSummary(row, organizationId)),
    total: totalRow?.value ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function listThemes(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { q?: string | undefined; limit: number; offset: number },
) {
  authorize(account, organizationId, (access) =>
    policyLegalResearch(access, "legal_research.read"),
  );
  const filters: SQL[] = [orgOrGlobal(organizationId, repetitiveThemes) as SQL];
  if (query.q) {
    const pattern = `%${escapeLike(query.q)}%`;
    filters.push(
      or(
        ilike(repetitiveThemes.title, pattern),
        ilike(repetitiveThemes.themeNumber, pattern),
        ilike(repetitiveThemes.thesis, pattern),
      ) as SQL,
    );
  }
  const where = and(...filters);
  const [totalRow] = await db.select({ value: count() }).from(repetitiveThemes).where(where);
  const rows = await db.query.repetitiveThemes.findMany({
    where,
    orderBy: [desc(repetitiveThemes.updatedAt)],
    limit: query.limit,
    offset: query.offset,
  });
  return {
    items: rows.map((row) => serializeTheme(row, organizationId)),
    total: totalRow?.value ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function listPrecedents(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { q?: string | undefined; limit: number; offset: number },
) {
  authorize(account, organizationId, (access) =>
    policyLegalResearch(access, "legal_research.read"),
  );
  const filters: SQL[] = [orgOrGlobal(organizationId, legalPrecedents) as SQL];
  if (query.q) {
    const pattern = `%${escapeLike(query.q)}%`;
    filters.push(
      or(
        ilike(legalPrecedents.title, pattern),
        ilike(legalPrecedents.decisionReference, pattern),
      ) as SQL,
    );
  }
  const where = and(...filters);
  const [totalRow] = await db.select({ value: count() }).from(legalPrecedents).where(where);
  const rows = await db.query.legalPrecedents.findMany({
    where,
    orderBy: [desc(legalPrecedents.updatedAt)],
    limit: query.limit,
    offset: query.offset,
  });
  return {
    items: rows.map((row) => serializePrecedent(row, organizationId)),
    total: totalRow?.value ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function listDoctrine(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { q?: string | undefined; limit: number; offset: number },
) {
  authorize(account, organizationId, (access) =>
    policyLegalResearch(access, "legal_research.read"),
  );
  const filters: SQL[] = [orgOrGlobal(organizationId, doctrineSources) as SQL];
  if (query.q) {
    const pattern = `%${escapeLike(query.q)}%`;
    filters.push(
      or(ilike(doctrineSources.title, pattern), ilike(doctrineSources.author, pattern)) as SQL,
    );
  }
  const where = and(...filters);
  const [totalRow] = await db.select({ value: count() }).from(doctrineSources).where(where);
  const rows = await db.query.doctrineSources.findMany({
    where,
    orderBy: [desc(doctrineSources.updatedAt)],
    limit: query.limit,
    offset: query.offset,
  });
  return {
    items: rows.map((row) => serializeDoctrine(row, organizationId)),
    total: totalRow?.value ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function getResearchRecord(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  sourceType: SourceType,
  sourceId: string,
) {
  authorize(account, organizationId, (access) =>
    policyLegalResearch(access, "legal_research.read"),
  );
  const found = await getRecordByType(db, organizationId, sourceType, sourceId);
  if (!found) throw new AppError("NOT_FOUND", "Não encontramos este registro no seu acesso.");
  return found;
}

/* ─── Manual create (manage) ─── */

export async function createLegislation(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    sourceType:
      | "legislation"
      | "constitution"
      | "decree"
      | "resolution"
      | "instruction"
      | "ordinance"
      | "regulation"
      | "other";
    title: string;
    identifier?: string | undefined;
    jurisdiction?: string | undefined;
    authority?: string | undefined;
    sourceUrl: string;
    publicationDate?: string | undefined;
    effectiveDate?: string | undefined;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyLegalResearch(access, "legal_research.manage"),
  );
  if (!input.sourceUrl.startsWith("https://")) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Proveniência incompleta: sourceUrl https é obrigatória.",
      [{ path: "sourceUrl", message: "Informe a URL https da fonte oficial." }],
    );
  }
  const hash = contentHashOf([
    input.sourceType,
    input.title,
    input.identifier ?? "",
    input.sourceUrl,
  ]);
  const existing = await db.query.legalSources.findFirst({
    where: and(
      eq(legalSources.organizationId, organizationId),
      or(eq(legalSources.sourceUrl, input.sourceUrl), eq(legalSources.contentHash, hash)),
    ),
  });
  if (existing) {
    return { legislation: serializeLegislation(existing, organizationId), deduplicated: true };
  }
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(legalSources)
        .values({
          organizationId,
          sourceProvider: "manual",
          sourceType: input.sourceType,
          title: input.title,
          identifier: input.identifier ?? null,
          jurisdiction: input.jurisdiction ?? null,
          authority: input.authority ?? null,
          sourceUrl: input.sourceUrl,
          publicationDate: input.publicationDate ? new Date(input.publicationDate) : null,
          effectiveDate: input.effectiveDate ? new Date(input.effectiveDate) : null,
          contentHash: hash,
        })
        .returning();
      if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível cadastrar a legislação.");
      await recordAudit(tx, {
        actorUserId: account.user.id,
        organizationId,
        action: "legal_source.created",
        resourceType: "legal_source",
        resourceId: row.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        after: { sourceType: row.sourceType, sourceProvider: "manual" },
      });
      return { legislation: serializeLegislation(row, organizationId), deduplicated: false };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("CONFLICT", "Fonte legislativa já cadastrada.");
    }
    throw error;
  }
}

export async function createCaseLaw(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    court: string;
    caseNumber: string;
    caseNumberNormalized?: string | undefined;
    courtUnit?: string | undefined;
    rapporteur?: string | undefined;
    judgingBody?: string | undefined;
    judgmentDate?: string | undefined;
    publicationDate?: string | undefined;
    proceduralClass?: string | undefined;
    subject?: string | undefined;
    headnote?: string | undefined;
    sourceUrl: string;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyLegalResearch(access, "legal_research.manage"),
  );
  if (!input.sourceUrl.startsWith("https://")) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Proveniência incompleta: sourceUrl https é obrigatória.",
      [{ path: "sourceUrl", message: "Informe a URL https da fonte oficial." }],
    );
  }
  const headnote = input.headnote ? sanitizeAiText(input.headnote) : null;
  const hash = contentHashOf([input.court, input.caseNumber, input.sourceUrl, headnote ?? ""]);
  const existing = await db.query.caseLawRecords.findFirst({
    where: and(
      eq(caseLawRecords.organizationId, organizationId),
      or(eq(caseLawRecords.sourceUrl, input.sourceUrl), eq(caseLawRecords.sourceHash, hash)),
    ),
  });
  if (existing) {
    return { caseLaw: serializeCaseLaw(existing, organizationId), deduplicated: true };
  }
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(caseLawRecords)
        .values({
          organizationId,
          provider: "manual",
          court: input.court,
          caseNumber: input.caseNumber,
          caseNumberNormalized: input.caseNumberNormalized ?? input.caseNumber.replace(/\D/g, ""),
          courtUnit: input.courtUnit ?? null,
          rapporteur: input.rapporteur ?? null,
          judgingBody: input.judgingBody ?? null,
          judgmentDate: input.judgmentDate ? new Date(input.judgmentDate) : null,
          publicationDate: input.publicationDate ? new Date(input.publicationDate) : null,
          proceduralClass: input.proceduralClass ?? null,
          subject: input.subject ?? null,
          headnote,
          sourceUrl: input.sourceUrl,
          sourceHash: hash,
          status: "available",
        })
        .returning();
      if (!row)
        throw new AppError("INTERNAL_ERROR", "Não foi possível cadastrar a jurisprudência.");
      await recordAudit(tx, {
        actorUserId: account.user.id,
        organizationId,
        action: "legal_source.created",
        resourceType: "case_law_record",
        resourceId: row.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        after: { court: row.court, caseNumber: row.caseNumber, provider: "manual" },
      });
      return { caseLaw: serializeCaseLaw(row, organizationId), deduplicated: false };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("CONFLICT", "Jurisprudência já cadastrada.");
    }
    throw error;
  }
}

/* ─── Saved research ─── */

export async function saveResearch(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    name: string;
    query: string;
    filters?: Record<string, unknown> | undefined;
    queryId?: string | undefined;
    legalMatterId?: string | undefined;
    selectedResultIds?: string[] | undefined;
    notes?: string | undefined;
  },
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policySavedResearch(access, "legal_research.save"),
  );
  if (input.legalMatterId) {
    await requireMatterInOrg(db, organizationId, input.legalMatterId);
  }
  if (input.queryId) {
    const query = await db.query.legalResearchQueries.findFirst({
      where: and(
        eq(legalResearchQueries.id, input.queryId),
        eq(legalResearchQueries.organizationId, organizationId),
      ),
      columns: { id: true },
    });
    if (!query) throw new AppError("NOT_FOUND", "Não encontramos esta pesquisa no seu acesso.");
  }
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(savedResearches)
      .values({
        organizationId,
        name: input.name,
        query: input.query,
        filters: input.filters ?? null,
        queryId: input.queryId ?? null,
        legalMatterId: input.legalMatterId ?? null,
        selectedResultIds: input.selectedResultIds ?? null,
        notes: input.notes ?? null,
        createdByMembershipId: membership.membershipId,
      })
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível salvar a pesquisa.");
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "legal_research.saved",
      resourceType: "saved_research",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { name: row.name, legalMatterId: row.legalMatterId },
    });
    return { savedResearch: serializeSaved(row) };
  });
}

export async function listSavedResearch(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { limit: number; offset: number },
) {
  authorize(account, organizationId, (access) =>
    policySavedResearch(access, "legal_research.read"),
  );
  const where = eq(savedResearches.organizationId, organizationId);
  const [totalRow] = await db.select({ value: count() }).from(savedResearches).where(where);
  const rows = await db.query.savedResearches.findMany({
    where,
    orderBy: [desc(savedResearches.updatedAt)],
    limit: query.limit,
    offset: query.offset,
  });
  return {
    items: rows.map(serializeSaved),
    total: totalRow?.value ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function getSavedResearch(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  savedId: string,
) {
  authorize(account, organizationId, (access) =>
    policySavedResearch(access, "legal_research.read"),
  );
  const row = await db.query.savedResearches.findFirst({
    where: and(eq(savedResearches.id, savedId), eq(savedResearches.organizationId, organizationId)),
  });
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos esta pesquisa salva no seu acesso.");
  return { savedResearch: serializeSaved(row) };
}

/* ─── Matter links ─── */

export async function linkToLegalMatter(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    legalMatterId: string;
    sourceType: SourceType;
    sourceId: string;
    savedResearchId?: string | undefined;
    notes?: string | undefined;
  },
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyLegalMatterResearchLink(access, "legal_research.save"),
  );
  await requireMatterInOrg(db, organizationId, input.legalMatterId);
  await assertSourceExists(db, organizationId, input.sourceType, input.sourceId);
  if (input.savedResearchId) {
    const saved = await db.query.savedResearches.findFirst({
      where: and(
        eq(savedResearches.id, input.savedResearchId),
        eq(savedResearches.organizationId, organizationId),
      ),
      columns: { id: true },
    });
    if (!saved)
      throw new AppError("NOT_FOUND", "Não encontramos esta pesquisa salva no seu acesso.");
  }
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(legalMatterResearchLinks)
        .values({
          organizationId,
          legalMatterId: input.legalMatterId,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          savedResearchId: input.savedResearchId ?? null,
          notes: input.notes ?? null,
          createdByMembershipId: membership.membershipId,
        })
        .returning();
      if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível vincular a fonte ao caso.");
      await recordAudit(tx, {
        actorUserId: account.user.id,
        organizationId,
        action: "legal_source.linked",
        resourceType: "legal_matter_research_link",
        resourceId: row.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        after: {
          legalMatterId: row.legalMatterId,
          sourceType: row.sourceType,
          sourceId: row.sourceId,
        },
      });
      return {
        link: {
          id: row.id,
          legalMatterId: row.legalMatterId,
          sourceType: row.sourceType,
          sourceId: row.sourceId,
          savedResearchId: row.savedResearchId,
          notes: row.notes,
          createdAt: row.createdAt.toISOString(),
        },
      };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("CONFLICT", "Esta fonte já está vinculada ao caso.");
    }
    throw error;
  }
}
