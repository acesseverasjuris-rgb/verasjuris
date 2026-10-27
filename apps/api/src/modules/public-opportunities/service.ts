import type { PublicOpportunityProvider } from "@verasjuris/ai";
import { recordAudit } from "@verasjuris/audit";
import {
  policyPublicOpportunity,
  policyPublicOpportunityInterest,
  policyPublicOpportunityMutation,
  policyPublicOpportunityRequirement,
  type SessionAccount,
} from "@verasjuris/auth";
import {
  administrativeBodies,
  type AppDatabase,
  documentLinks,
  documents,
  isUniqueViolation,
  publicOpportunities,
  publicOpportunityInterests,
  publicOpportunityRequirements,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, asc, count, desc, eq, gte, ilike, isNull, lte, ne, or, sql } from "drizzle-orm";
import { authorize, escapeLike, iso, accessOf } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";
import { assertCanReadDocument, requireDocumentInOrg } from "../documents/service.js";

const LINK_TARGET = "public_opportunity";
const RESTRICTED_STATUSES = new Set(["closed", "cancelled", "archived"]);

type OpportunityRow = typeof publicOpportunities.$inferSelect;

/* ─── Serialização ─── */

/**
 * Selo de origem. Cadastro manual NUNCA é apresentado como fonte oficial; `official` só é verdadeiro
 * para registros que vieram de um provedor público configurado.
 */
function sourceBadge(row: OpportunityRow) {
  if (row.sourceProvider === "public_provider") {
    return { kind: "public_provider", label: "Provedor público", official: true };
  }
  if (row.sourceProvider === "import") {
    return { kind: "import", label: "Importação", official: false };
  }
  return { kind: "manual", label: "Cadastro manual", official: false };
}

function serializeOpportunity(row: OpportunityRow, organizationId: string) {
  return {
    id: row.id,
    scope: row.organizationId === null ? "global" : "organization",
    editable: row.organizationId === organizationId,
    source: {
      provider: row.sourceProvider,
      reference: row.sourceReference,
      url: row.sourceUrl,
      badge: sourceBadge(row),
    },
    opportunityType: row.opportunityType,
    title: row.title,
    description: row.description,
    object: row.object,
    publicBodyId: row.publicBodyId,
    processNumber: row.processNumber,
    procurementNumber: row.procurementNumber,
    modality: row.modality,
    estimatedValueCents: row.estimatedValueCents,
    currency: row.currency,
    publicationDate: iso(row.publicationDate),
    proposalDeadline: iso(row.proposalDeadline),
    timezone: row.timezone,
    status: row.status,
    region: row.region,
    stateCode: row.stateCode,
    municipality: row.municipality,
    contentFormat: "plain_text" as const,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeInterest(row: typeof publicOpportunityInterests.$inferSelect) {
  return {
    id: row.id,
    opportunityId: row.opportunityId,
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeRequirement(row: typeof publicOpportunityRequirements.$inferSelect) {
  return {
    id: row.id,
    opportunityId: row.opportunityId,
    description: row.description,
    category: row.category,
    mandatory: row.mandatory,
    status: row.status,
    source: row.source,
    sortOrder: row.sortOrder,
    reviewedAt: iso(row.reviewedAt),
    reviewComment: row.reviewComment,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function checklistSummary(rows: (typeof publicOpportunityRequirements.$inferSelect)[]) {
  const byStatus: Record<string, number> = {
    pending: 0,
    met: 0,
    not_met: 0,
    waived: 0,
    unknown: 0,
  };
  for (const row of rows) byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
  const mandatory = rows.filter((row) => row.mandatory);
  return {
    total: rows.length,
    byStatus,
    mandatoryTotal: mandatory.length,
    mandatoryOpen: mandatory.filter((row) => row.status !== "met" && row.status !== "waived")
      .length,
  };
}

/* ─── Acesso ─── */

/** Oportunidade visível: da própria organização ou referência global (organizationId nulo). */
async function requireVisibleOpportunity(db: AppDatabase, organizationId: string, id: string) {
  const row = await db.query.publicOpportunities.findFirst({
    where: and(
      eq(publicOpportunities.id, id),
      or(
        eq(publicOpportunities.organizationId, organizationId),
        isNull(publicOpportunities.organizationId),
      ),
    ),
  });
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos esta oportunidade no seu acesso.");
  return row;
}

async function assertPublicBody(db: AppDatabase, publicBodyId: string | null | undefined) {
  if (!publicBodyId) return;
  const body = await db.query.administrativeBodies.findFirst({
    where: eq(administrativeBodies.id, publicBodyId),
    columns: { id: true },
  });
  if (!body) {
    throw new AppError("VALIDATION_ERROR", "Órgão público inválido.", [
      { path: "publicBodyId", message: "Selecione um órgão válido." },
    ]);
  }
}

/* ─── CRUD ─── */

export async function listPublicOpportunities(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: {
    q?: string | undefined;
    opportunityType?: string | undefined;
    status?: string | undefined;
    stateCode?: string | undefined;
    publicBodyId?: string | undefined;
    deadlineFrom?: string | undefined;
    deadlineTo?: string | undefined;
    interestStatus?: string | undefined;
    onlySaved?: boolean | undefined;
    limit: number;
    offset: number;
  },
) {
  authorize(account, organizationId, (access) =>
    policyPublicOpportunity(access, "public_opportunity.read"),
  );
  const opp = publicOpportunities;
  const interest = publicOpportunityInterests;
  const filters = [or(eq(opp.organizationId, organizationId), isNull(opp.organizationId))];
  if (query.status) {
    filters.push(eq(opp.status, query.status as OpportunityRow["status"]));
  } else {
    filters.push(ne(opp.status, "archived"));
  }
  if (query.opportunityType) {
    filters.push(
      eq(opp.opportunityType, query.opportunityType as OpportunityRow["opportunityType"]),
    );
  }
  if (query.stateCode) filters.push(eq(opp.stateCode, query.stateCode));
  if (query.publicBodyId) filters.push(eq(opp.publicBodyId, query.publicBodyId));
  if (query.deadlineFrom) filters.push(gte(opp.proposalDeadline, new Date(query.deadlineFrom)));
  if (query.deadlineTo) filters.push(lte(opp.proposalDeadline, new Date(query.deadlineTo)));
  if (query.q) {
    const pattern = `%${escapeLike(query.q)}%`;
    filters.push(
      or(
        ilike(opp.title, pattern),
        ilike(opp.object, pattern),
        ilike(opp.description, pattern),
        ilike(opp.processNumber, pattern),
        ilike(opp.procurementNumber, pattern),
      ) as never,
    );
  }
  if (query.interestStatus) {
    filters.push(eq(interest.status, query.interestStatus as typeof interest.$inferSelect.status));
  } else if (query.onlySaved) {
    filters.push(sql`${interest.id} is not null`);
  }
  const where = and(...filters);
  const join = and(eq(interest.opportunityId, opp.id), eq(interest.organizationId, organizationId));

  const [totalRow] = await db
    .select({ value: count() })
    .from(opp)
    .leftJoin(interest, join)
    .where(where);
  const rows = await db
    .select({ opportunity: opp, interest })
    .from(opp)
    .leftJoin(interest, join)
    .where(where)
    .orderBy(sql`${opp.proposalDeadline} asc nulls last`, desc(opp.createdAt))
    .limit(query.limit)
    .offset(query.offset);

  return {
    items: rows.map((row) => ({
      ...serializeOpportunity(row.opportunity, organizationId),
      interest: row.interest ? serializeInterest(row.interest) : null,
    })),
    total: totalRow?.value ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function createPublicOpportunity(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    opportunityType: OpportunityRow["opportunityType"];
    title: string;
    object: string;
    description?: string | undefined;
    publicBodyId?: string | undefined;
    processNumber?: string | undefined;
    procurementNumber?: string | undefined;
    modality?: string | undefined;
    estimatedValueCents?: number | undefined;
    currency: string;
    publicationDate?: string | undefined;
    proposalDeadline?: string | undefined;
    status: OpportunityRow["status"];
    region?: string | undefined;
    stateCode?: string | undefined;
    municipality?: string | undefined;
    sourceUrl?: string | undefined;
    sourceReference?: string | undefined;
  },
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyPublicOpportunity(access, "public_opportunity.create"),
  );
  if (RESTRICTED_STATUSES.has(input.status)) {
    authorize(account, organizationId, (access) =>
      policyPublicOpportunityMutation(
        access,
        "public_opportunity.manage",
        organizationId,
        organizationId,
      ),
    );
  }
  await assertPublicBody(db, input.publicBodyId);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(publicOpportunities)
      .values({
        organizationId,
        // Cadastro feito por usuário é sempre "manual": nunca se declara fonte oficial.
        sourceProvider: "manual",
        sourceReference: input.sourceReference ?? null,
        sourceUrl: input.sourceUrl ?? null,
        opportunityType: input.opportunityType,
        title: input.title,
        description: input.description ?? null,
        publicBodyId: input.publicBodyId ?? null,
        processNumber: input.processNumber ?? null,
        procurementNumber: input.procurementNumber ?? null,
        modality: input.modality ?? null,
        object: input.object,
        estimatedValueCents: input.estimatedValueCents ?? null,
        currency: input.currency.toUpperCase(),
        publicationDate: input.publicationDate ? new Date(input.publicationDate) : null,
        proposalDeadline: input.proposalDeadline ? new Date(input.proposalDeadline) : null,
        status: input.status,
        region: input.region ?? null,
        stateCode: input.stateCode ?? null,
        municipality: input.municipality ?? null,
        createdByMembershipId: membership.membershipId,
      })
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível cadastrar a oportunidade.");
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "public_opportunity.created",
      resourceType: "public_opportunity",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: {
        opportunityType: row.opportunityType,
        status: row.status,
        sourceProvider: row.sourceProvider,
      },
    });
    return { opportunity: serializeOpportunity(row, organizationId) };
  });
}

export async function getPublicOpportunity(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  opportunityId: string,
) {
  authorize(account, organizationId, (access) =>
    policyPublicOpportunity(access, "public_opportunity.read"),
  );
  const row = await requireVisibleOpportunity(db, organizationId, opportunityId);
  const [interest, requirements, links] = await Promise.all([
    db.query.publicOpportunityInterests.findFirst({
      where: and(
        eq(publicOpportunityInterests.opportunityId, row.id),
        eq(publicOpportunityInterests.organizationId, organizationId),
      ),
    }),
    db.query.publicOpportunityRequirements.findMany({
      where: and(
        eq(publicOpportunityRequirements.opportunityId, row.id),
        eq(publicOpportunityRequirements.organizationId, organizationId),
      ),
      orderBy: [
        asc(publicOpportunityRequirements.sortOrder),
        asc(publicOpportunityRequirements.createdAt),
      ],
    }),
    db.query.documentLinks.findMany({
      where: and(
        eq(documentLinks.organizationId, organizationId),
        eq(documentLinks.targetType, LINK_TARGET),
        eq(documentLinks.targetId, row.id),
      ),
    }),
  ]);
  return {
    opportunity: {
      ...serializeOpportunity(row, organizationId),
      interest: interest ? serializeInterest(interest) : null,
      requirements: requirements.map(serializeRequirement),
      checklist: checklistSummary(requirements),
      documentLinkCount: links.length,
    },
  };
}

export async function updatePublicOpportunity(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  opportunityId: string,
  input: Partial<{
    opportunityType: OpportunityRow["opportunityType"];
    title: string;
    object: string;
    description: string | null;
    publicBodyId: string | null;
    processNumber: string | null;
    procurementNumber: string | null;
    modality: string | null;
    estimatedValueCents: number | null;
    publicationDate: string | null;
    proposalDeadline: string | null;
    status: OpportunityRow["status"];
    region: string | null;
    stateCode: string | null;
    municipality: string | null;
    sourceUrl: string | null;
    sourceReference: string | null;
  }>,
  meta: RequestMeta,
) {
  const row = await requireVisibleOpportunity(db, organizationId, opportunityId);
  const access = accessOf(account, organizationId);
  const decision = policyPublicOpportunityMutation(
    access,
    "public_opportunity.update",
    row.organizationId,
    organizationId,
  );
  if (!decision.ok) throw new AppError(decision.code, decision.message);
  const touchesRestricted =
    (input.status !== undefined && RESTRICTED_STATUSES.has(input.status)) ||
    row.status === "archived";
  if (touchesRestricted) {
    const manage = policyPublicOpportunityMutation(
      access,
      "public_opportunity.manage",
      row.organizationId,
      organizationId,
    );
    if (!manage.ok) throw new AppError(manage.code, manage.message);
  }
  await assertPublicBody(db, input.publicBodyId);

  const values: Partial<typeof publicOpportunities.$inferInsert> = { updatedAt: new Date() };
  const assign = <K extends keyof typeof input>(
    key: K,
    map?: (value: NonNullable<(typeof input)[K]>) => unknown,
  ) => {
    if (input[key] === undefined) return;
    const value = input[key];
    (values as Record<string, unknown>)[key as string] =
      value === null || !map ? value : map(value as NonNullable<(typeof input)[K]>);
  };
  assign("opportunityType");
  assign("title");
  assign("object");
  assign("description");
  assign("publicBodyId");
  assign("processNumber");
  assign("procurementNumber");
  assign("modality");
  assign("estimatedValueCents");
  assign("publicationDate", (value) => new Date(value as string));
  assign("proposalDeadline", (value) => new Date(value as string));
  assign("status");
  assign("region");
  assign("stateCode");
  assign("municipality");
  assign("sourceUrl");
  assign("sourceReference");

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(publicOpportunities)
      .set(values)
      .where(
        and(
          eq(publicOpportunities.id, row.id),
          eq(publicOpportunities.organizationId, organizationId),
        ),
      )
      .returning();
    if (!updated)
      throw new AppError("NOT_FOUND", "Não encontramos esta oportunidade no seu acesso.");
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action:
        input.status === "archived" ? "public_opportunity.archived" : "public_opportunity.updated",
      resourceType: "public_opportunity",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      before: { status: row.status, proposalDeadline: iso(row.proposalDeadline) },
      after: { status: updated.status, proposalDeadline: iso(updated.proposalDeadline) },
      metadata: { fields: Object.keys(input) },
    });
    return { opportunity: serializeOpportunity(updated, organizationId) };
  });
}

/** Exclusão lógica: arquiva a oportunidade da organização (exige `public_opportunity.manage`). */
export async function archivePublicOpportunity(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  opportunityId: string,
  meta: RequestMeta,
) {
  return updatePublicOpportunity(
    db,
    account,
    organizationId,
    opportunityId,
    { status: "archived" },
    meta,
  );
}

/* ─── Interesse (salvar) ─── */

export async function upsertOpportunityInterest(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  opportunityId: string,
  input: {
    status: typeof publicOpportunityInterests.$inferSelect.status;
    notes?: string | null | undefined;
  },
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyPublicOpportunityInterest(access, "public_opportunity.save"),
  );
  const opportunity = await requireVisibleOpportunity(db, organizationId, opportunityId);
  try {
    return await db.transaction(async (tx) => {
      const existing = await tx.query.publicOpportunityInterests.findFirst({
        where: and(
          eq(publicOpportunityInterests.opportunityId, opportunity.id),
          eq(publicOpportunityInterests.organizationId, organizationId),
        ),
      });
      const [row] = existing
        ? await tx
            .update(publicOpportunityInterests)
            .set({
              status: input.status,
              ...(input.notes !== undefined ? { notes: input.notes } : {}),
              updatedAt: new Date(),
            })
            .where(eq(publicOpportunityInterests.id, existing.id))
            .returning()
        : await tx
            .insert(publicOpportunityInterests)
            .values({
              organizationId,
              opportunityId: opportunity.id,
              status: input.status,
              notes: input.notes ?? null,
              createdByMembershipId: membership.membershipId,
            })
            .returning();
      if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível salvar o interesse.");
      await recordAudit(tx, {
        actorUserId: account.user.id,
        organizationId,
        action: "public_opportunity.interest_saved",
        resourceType: "public_opportunity_interest",
        resourceId: row.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        before: existing ? { status: existing.status } : null,
        after: { opportunityId: opportunity.id, status: row.status },
      });
      return { interest: serializeInterest(row) };
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError("CONFLICT", "Interesse já registrado.");
    throw error;
  }
}

export async function removeOpportunityInterest(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  opportunityId: string,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyPublicOpportunityInterest(access, "public_opportunity.save"),
  );
  const opportunity = await requireVisibleOpportunity(db, organizationId, opportunityId);
  const existing = await db.query.publicOpportunityInterests.findFirst({
    where: and(
      eq(publicOpportunityInterests.opportunityId, opportunity.id),
      eq(publicOpportunityInterests.organizationId, organizationId),
    ),
  });
  if (!existing) throw new AppError("NOT_FOUND", "Não encontramos este interesse no seu acesso.");
  await db.transaction(async (tx) => {
    await tx
      .delete(publicOpportunityInterests)
      .where(eq(publicOpportunityInterests.id, existing.id));
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "public_opportunity.interest_removed",
      resourceType: "public_opportunity_interest",
      resourceId: existing.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      before: { opportunityId: opportunity.id, status: existing.status },
    });
  });
}

export async function listOpportunityInterests(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { status?: string | undefined; limit: number; offset: number },
) {
  authorize(account, organizationId, (access) =>
    policyPublicOpportunityInterest(access, "public_opportunity.read"),
  );
  const interest = publicOpportunityInterests;
  const filters = [eq(interest.organizationId, organizationId)];
  if (query.status)
    filters.push(eq(interest.status, query.status as typeof interest.$inferSelect.status));
  const where = and(...filters);
  const [totalRow] = await db.select({ value: count() }).from(interest).where(where);
  const rows = await db
    .select({ interest, opportunity: publicOpportunities })
    .from(interest)
    .innerJoin(publicOpportunities, eq(publicOpportunities.id, interest.opportunityId))
    .where(where)
    .orderBy(desc(interest.updatedAt))
    .limit(query.limit)
    .offset(query.offset);
  return {
    items: rows.map((row) => ({
      ...serializeInterest(row.interest),
      opportunity: serializeOpportunity(row.opportunity, organizationId),
    })),
    total: totalRow?.value ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

/* ─── Requisitos (checklist) ─── */

export async function listOpportunityRequirements(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  opportunityId: string,
) {
  authorize(account, organizationId, (access) =>
    policyPublicOpportunityRequirement(access, "public_opportunity.read"),
  );
  const opportunity = await requireVisibleOpportunity(db, organizationId, opportunityId);
  const rows = await db.query.publicOpportunityRequirements.findMany({
    where: and(
      eq(publicOpportunityRequirements.opportunityId, opportunity.id),
      eq(publicOpportunityRequirements.organizationId, organizationId),
    ),
    orderBy: [
      asc(publicOpportunityRequirements.sortOrder),
      asc(publicOpportunityRequirements.createdAt),
    ],
  });
  return { items: rows.map(serializeRequirement), checklist: checklistSummary(rows) };
}

export async function createOpportunityRequirement(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  opportunityId: string,
  input: {
    description: string;
    category?: string | undefined;
    mandatory: boolean;
    sortOrder: number;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyPublicOpportunityRequirement(access, "public_opportunity.manage_requirements"),
  );
  const opportunity = await requireVisibleOpportunity(db, organizationId, opportunityId);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(publicOpportunityRequirements)
      .values({
        organizationId,
        opportunityId: opportunity.id,
        description: input.description,
        category: input.category ?? null,
        mandatory: input.mandatory,
        sortOrder: input.sortOrder,
        source: "manual",
      })
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar o requisito.");
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "public_opportunity.requirement_created",
      resourceType: "public_opportunity_requirement",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { opportunityId: opportunity.id, mandatory: row.mandatory },
    });
    return { requirement: serializeRequirement(row) };
  });
}

export async function updateOpportunityRequirement(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  opportunityId: string,
  requirementId: string,
  input: Partial<{
    description: string;
    category: string | null;
    mandatory: boolean;
    status: typeof publicOpportunityRequirements.$inferSelect.status;
    sortOrder: number;
    reviewComment: string | null;
  }>,
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyPublicOpportunityRequirement(access, "public_opportunity.manage_requirements"),
  );
  const opportunity = await requireVisibleOpportunity(db, organizationId, opportunityId);
  const existing = await db.query.publicOpportunityRequirements.findFirst({
    where: and(
      eq(publicOpportunityRequirements.id, requirementId),
      eq(publicOpportunityRequirements.opportunityId, opportunity.id),
      eq(publicOpportunityRequirements.organizationId, organizationId),
    ),
  });
  if (!existing) throw new AppError("NOT_FOUND", "Não encontramos este requisito no seu acesso.");
  const statusChanged = input.status !== undefined && input.status !== existing.status;
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(publicOpportunityRequirements)
      .set({
        ...input,
        ...(statusChanged
          ? { reviewedByMembershipId: membership.membershipId, reviewedAt: new Date() }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(publicOpportunityRequirements.id, existing.id))
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível atualizar o requisito.");
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "public_opportunity.requirement_updated",
      resourceType: "public_opportunity_requirement",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      before: { status: existing.status },
      after: { status: row.status },
    });
    return { requirement: serializeRequirement(row) };
  });
}

/* ─── Documentos vinculados (document_links) ─── */

export async function linkOpportunityDocument(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  opportunityId: string,
  input: { documentId: string; linkType: string },
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyPublicOpportunity(access, "public_opportunity.manage_documents"),
  );
  const opportunity = await requireVisibleOpportunity(db, organizationId, opportunityId);
  const doc = await requireDocumentInOrg(db, organizationId, input.documentId);
  await assertCanReadDocument(db, account, organizationId, doc);
  const existing = await db.query.documentLinks.findFirst({
    where: and(
      eq(documentLinks.organizationId, organizationId),
      eq(documentLinks.documentId, doc.id),
      eq(documentLinks.targetType, LINK_TARGET),
      eq(documentLinks.targetId, opportunity.id),
      eq(documentLinks.linkType, input.linkType),
    ),
  });
  if (existing) throw new AppError("CONFLICT", "Este documento já está vinculado à oportunidade.");
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(documentLinks)
      .values({
        organizationId,
        documentId: doc.id,
        linkType: input.linkType,
        targetType: LINK_TARGET,
        targetId: opportunity.id,
        createdByMembershipId: membership.membershipId,
      })
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível vincular o documento.");
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "public_opportunity.document_linked",
      resourceType: "document_link",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { opportunityId: opportunity.id, documentId: doc.id, linkType: row.linkType },
    });
    return {
      link: {
        id: row.id,
        documentId: row.documentId,
        linkType: row.linkType,
        createdAt: row.createdAt.toISOString(),
      },
    };
  });
}

export async function listOpportunityDocuments(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  opportunityId: string,
) {
  authorize(account, organizationId, (access) =>
    policyPublicOpportunity(access, "public_opportunity.read"),
  );
  const opportunity = await requireVisibleOpportunity(db, organizationId, opportunityId);
  const rows = await db
    .select({ link: documentLinks, doc: documents })
    .from(documentLinks)
    .innerJoin(documents, eq(documents.id, documentLinks.documentId))
    .where(
      and(
        eq(documentLinks.organizationId, organizationId),
        eq(documentLinks.targetType, LINK_TARGET),
        eq(documentLinks.targetId, opportunity.id),
      ),
    )
    .orderBy(desc(documentLinks.createdAt));
  const items = [];
  for (const row of rows) {
    try {
      await assertCanReadDocument(db, account, organizationId, row.doc);
    } catch {
      continue;
    }
    items.push({
      id: row.link.id,
      linkType: row.link.linkType,
      documentId: row.doc.id,
      title: row.doc.title,
      status: row.doc.status,
      documentKind: row.doc.documentKind,
      createdAt: row.link.createdAt.toISOString(),
    });
  }
  return { items };
}

export async function unlinkOpportunityDocument(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  opportunityId: string,
  linkId: string,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyPublicOpportunity(access, "public_opportunity.manage_documents"),
  );
  const opportunity = await requireVisibleOpportunity(db, organizationId, opportunityId);
  const existing = await db.query.documentLinks.findFirst({
    where: and(
      eq(documentLinks.id, linkId),
      eq(documentLinks.organizationId, organizationId),
      eq(documentLinks.targetType, LINK_TARGET),
      eq(documentLinks.targetId, opportunity.id),
    ),
  });
  if (!existing) throw new AppError("NOT_FOUND", "Não encontramos este vínculo no seu acesso.");
  await db.transaction(async (tx) => {
    await tx.delete(documentLinks).where(eq(documentLinks.id, existing.id));
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "public_opportunity.document_unlinked",
      resourceType: "document_link",
      resourceId: existing.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      before: { opportunityId: opportunity.id, documentId: existing.documentId },
    });
  });
}

/* ─── Provedor externo (NOT_CONFIGURED) ─── */

export async function getOpportunityProviderStatus(
  account: SessionAccount,
  organizationId: string,
  provider: PublicOpportunityProvider,
) {
  authorize(account, organizationId, (access) =>
    policyPublicOpportunity(access, "public_opportunity.read"),
  );
  const health = await provider.healthCheck();
  return {
    provider: provider.id,
    status: health.status,
    health,
    /** Sem provedor configurado, o cadastro manual é a única fonte; nada é "oficial". */
    manualEntryAvailable: true,
  };
}

export async function searchOpportunityProvider(
  account: SessionAccount,
  organizationId: string,
  provider: PublicOpportunityProvider,
  query: { text?: string | undefined; stateCode?: string | undefined },
) {
  authorize(account, organizationId, (access) =>
    policyPublicOpportunity(access, "public_opportunity.read"),
  );
  const page = await provider.search({
    ...(query.text ? { text: query.text } : {}),
    ...(query.stateCode ? { stateCode: query.stateCode } : {}),
  });
  return { provider: page.provider, items: page.items, nextCursor: page.nextCursor };
}
