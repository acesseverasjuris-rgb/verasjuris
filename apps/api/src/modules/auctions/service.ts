import {
  AUCTION_COST_ESTIMATE_LABEL,
  AUCTION_FEATURE_INSTRUCTIONS,
  auctionAnalysisOutputSchema,
  estimateAuctionCost,
  type AIGateway,
  type AuctionBidProvider,
  type AuctionProvider,
} from "@verasjuris/ai";
import { recordAudit } from "@verasjuris/audit";
import {
  policyAuction,
  policyAuctionAlert,
  policyAuctionDueDiligence,
  policyAuctionInterest,
  policyAuctionLot,
  policyAuctionMutation,
  type SessionAccount,
} from "@verasjuris/auth";
import {
  administrativeBodies,
  auctionAlertRules,
  auctionBidRules,
  auctionDueDiligence,
  auctionEncumbrances,
  auctioneers,
  auctionEvents,
  auctionInterests,
  auctionLots,
  auctionRealEstateDetails,
  auctions,
  auctionSyncRuns,
  auctionVehicleDetails,
  type AppDatabase,
  documentLinks,
  documents,
  isUniqueViolation,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { authorize, escapeLike, iso, accessOf } from "../ai/shared.js";
import { recordAiNotConfigured, runStructuredAi, type AiRunContext } from "../ai/runner.js";
import type { RequestMeta } from "../auth/service.js";
import { assertCanReadDocument, requireDocumentInOrg } from "../documents/service.js";

const LINK_TARGET_AUCTION = "auction";
const LINK_TARGET_LOT = "auction_lot";
const RESTRICTED_STATUSES = new Set(["closed", "cancelled", "archived"]);

const COST_DISCLAIMER =
  "Estimativa com base nos valores informados. Não é custo final garantido nem recomendação de compra.";

const DUE_DILIGENCE_DEFAULTS: ReadonlyArray<{
  itemKey: string;
  label: string;
  category: string;
}> = [
  { itemKey: "edital", label: "Edital / aviso", category: "documentacao" },
  { itemKey: "matricula", label: "Matrícula", category: "registro" },
  { itemKey: "onus", label: "Ônus", category: "onus" },
  { itemKey: "ocupacao", label: "Ocupação / posse", category: "ocupacao" },
  { itemKey: "avaliacao", label: "Avaliação", category: "valores" },
  { itemKey: "divida", label: "Dívidas informadas", category: "debitos" },
  { itemKey: "localizacao", label: "Localização", category: "localizacao" },
  { itemKey: "visitacao", label: "Visitação / vistoria", category: "ocupacao" },
  { itemKey: "comissao", label: "Comissão", category: "pagamento" },
  { itemKey: "pagamento", label: "Condições de pagamento", category: "pagamento" },
  { itemKey: "prazo", label: "Prazos", category: "prazos" },
  { itemKey: "debitos", label: "Débitos (IPTU/condomínio/outros)", category: "debitos" },
  { itemKey: "processo", label: "Processo / origem", category: "juridico" },
  { itemKey: "decisao", label: "Decisão / autorização", category: "juridico" },
  { itemKey: "restricoes", label: "Restrições", category: "restricoes" },
];

type AuctionRow = typeof auctions.$inferSelect;
type LotRow = typeof auctionLots.$inferSelect;

export type AuctionModuleDeps = {
  auctionProvider: AuctionProvider;
  auctionBidProvider: AuctionBidProvider;
  aiGateway?: AIGateway | undefined;
};

/* ─── Serialização ─── */

/**
 * Selo de origem. Cadastro manual NUNCA é "oficial"; `official` só com provedor público configurado.
 */
function sourceBadge(row: AuctionRow) {
  if (row.sourceProvider === "public_provider") {
    return { kind: "public_provider", label: "Provedor público", official: true };
  }
  if (row.sourceProvider === "import") {
    return { kind: "import", label: "Importação", official: false };
  }
  if (row.sourceProvider === "not_configured") {
    return { kind: "not_configured", label: "Fonte não configurada", official: false };
  }
  return { kind: "manual", label: "Cadastro manual", official: false };
}

function serializeAuction(row: AuctionRow, organizationId: string) {
  return {
    id: row.id,
    scope: row.organizationId === null ? ("global" as const) : ("organization" as const),
    editable: row.organizationId === organizationId,
    source: {
      provider: row.sourceProvider,
      reference: row.sourceReference,
      url: row.sourceUrl,
      badge: sourceBadge(row),
    },
    auctionType: row.auctionType,
    title: row.title,
    description: row.description,
    sellerType: row.sellerType,
    sellerName: row.sellerName,
    publicBodyId: row.publicBodyId,
    courtId: row.courtId,
    judicialProcessId: row.judicialProcessId,
    auctioneerId: row.auctioneerId,
    status: row.status,
    timezone: row.timezone,
    publicationDate: iso(row.publicationDate),
    registrationDeadline: iso(row.registrationDeadline),
    inspectionStartAt: iso(row.inspectionStartAt),
    inspectionEndAt: iso(row.inspectionEndAt),
    firstEventAt: iso(row.firstEventAt),
    secondEventAt: iso(row.secondEventAt),
    closingAt: iso(row.closingAt),
    contentFormat: "plain_text" as const,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeLot(row: LotRow) {
  return {
    id: row.id,
    auctionId: row.auctionId,
    lotNumber: row.lotNumber,
    title: row.title,
    description: row.description,
    assetType: row.assetType,
    status: row.status,
    appraisalValueCents: row.appraisalValueCents,
    firstMinimumBidCents: row.firstMinimumBidCents,
    secondMinimumBidCents: row.secondMinimumBidCents,
    currentReferenceValueCents: row.currentReferenceValueCents,
    currency: row.currency,
    incrementCents: row.incrementCents,
    commissionBasisPoints: row.commissionBasisPoints,
    buyerFeeCents: row.buyerFeeCents,
    depositRequiredCents: row.depositRequiredCents,
    location: row.location,
    stateCode: row.stateCode,
    municipality: row.municipality,
    latitude: row.latitude,
    longitude: row.longitude,
    occupancyStatus: row.occupancyStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeEvent(row: typeof auctionEvents.$inferSelect) {
  return {
    id: row.id,
    auctionId: row.auctionId,
    eventType: row.eventType,
    startsAt: row.startsAt.toISOString(),
    endsAt: iso(row.endsAt),
    timezone: row.timezone,
    minimumRule: row.minimumRule,
    status: row.status,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeAuctioneer(row: typeof auctioneers.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    registrationNumber: row.registrationNumber,
    stateCode: row.stateCode,
    entityName: row.entityName,
    website: row.website,
    verificationStatus: row.verificationStatus,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeEncumbrance(row: typeof auctionEncumbrances.$inferSelect) {
  const verified = row.verifiedAt != null;
  return {
    id: row.id,
    lotId: row.lotId,
    type: row.type,
    description: row.description,
    source: row.source,
    responsibility: row.responsibility,
    status: row.status,
    amountCents: row.amountCents,
    verifiedAt: iso(row.verifiedAt),
    /** Rótulos honestos: ônus informado ≠ verificado. */
    label: verified ? "Verificado" : "Ônus informado",
    verificationLabel: verified ? "Verificado" : "Não verificado",
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeBidRules(row: typeof auctionBidRules.$inferSelect) {
  return {
    id: row.id,
    auctionId: row.auctionId,
    lotId: row.lotId,
    minimumBidCents: row.minimumBidCents,
    incrementCents: row.incrementCents,
    paymentTerms: row.paymentTerms,
    commissionBasisPoints: row.commissionBasisPoints,
    depositRequired: row.depositRequired,
    depositRequiredCents: row.depositRequiredCents,
    registrationRequired: row.registrationRequired,
    eligibilityDescription: row.eligibilityDescription,
    notes: row.notes,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeInterest(row: typeof auctionInterests.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    auctionId: row.auctionId,
    lotId: row.lotId,
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeAlert(row: typeof auctionAlertRules.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    active: row.active,
    auctionTypes: row.auctionTypes,
    assetTypes: row.assetTypes,
    stateCodes: row.stateCodes,
    municipalities: row.municipalities,
    minValueCents: row.minValueCents,
    maxValueCents: row.maxValueCents,
    occupancyStatuses: row.occupancyStatuses,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeDueDiligence(row: typeof auctionDueDiligence.$inferSelect) {
  return {
    id: row.id,
    auctionId: row.auctionId,
    lotId: row.lotId,
    itemKey: row.itemKey,
    label: row.label,
    category: row.category,
    status: row.status,
    notes: row.notes,
    reviewedAt: iso(row.reviewedAt),
    /** Checklist assistivo — não constitui parecer jurídico. */
    assistive: true as const,
    notLegalOpinion: true as const,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeRealEstate(row: typeof auctionRealEstateDetails.$inferSelect) {
  return {
    id: row.id,
    lotId: row.lotId,
    propertyType: row.propertyType,
    registryNumber: row.registryNumber,
    registryOffice: row.registryOffice,
    area: row.area,
    builtArea: row.builtArea,
    occupancyStatus: row.occupancyStatus,
    possessionStatus: row.possessionStatus,
    address: row.address,
    propertyTaxReference: row.propertyTaxReference,
    condominiumInfo: row.condominiumInfo,
    liensSummary: row.liensSummary,
  };
}

function serializeVehicle(row: typeof auctionVehicleDetails.$inferSelect) {
  return {
    id: row.id,
    lotId: row.lotId,
    make: row.make,
    model: row.model,
    year: row.year,
    modelYear: row.modelYear,
    plateMasked: row.plateMasked,
    renavamMasked: row.renavamMasked,
    mileage: row.mileage,
    condition: row.condition,
    documentationStatus: row.documentationStatus,
  };
}

function discountBasisPoints(
  appraisalCents: number | null,
  bidCents: number | null,
): number | null {
  if (appraisalCents == null || bidCents == null || appraisalCents <= 0) return null;
  return Math.floor(((appraisalCents - bidCents) * 10_000) / appraisalCents);
}

/* ─── Acesso ─── */

async function requireVisibleAuction(db: AppDatabase, organizationId: string, id: string) {
  const row = await db.query.auctions.findFirst({
    where: and(
      eq(auctions.id, id),
      or(eq(auctions.organizationId, organizationId), isNull(auctions.organizationId)),
    ),
  });
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos este leilão no seu acesso.");
  return row;
}

async function requireVisibleLot(db: AppDatabase, organizationId: string, lotId: string) {
  const lot = await db.query.auctionLots.findFirst({ where: eq(auctionLots.id, lotId) });
  if (!lot) throw new AppError("NOT_FOUND", "Não encontramos este lote no seu acesso.");
  await requireVisibleAuction(db, organizationId, lot.auctionId);
  return lot;
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

async function assertAuctioneer(db: AppDatabase, auctioneerId: string | null | undefined) {
  if (!auctioneerId) return;
  const row = await db.query.auctioneers.findFirst({
    where: eq(auctioneers.id, auctioneerId),
    columns: { id: true },
  });
  if (!row) {
    throw new AppError("VALIDATION_ERROR", "Leiloeiro inválido.", [
      { path: "auctioneerId", message: "Selecione um leiloeiro válido." },
    ]);
  }
}

function authorizeMutation(
  account: SessionAccount,
  organizationId: string,
  auctionOrganizationId: string | null,
  required: "auction.update" | "auction.manage" = "auction.update",
) {
  const decision = policyAuctionMutation(
    accessOf(account, organizationId),
    required,
    auctionOrganizationId,
    organizationId,
  );
  if (!decision.ok) throw new AppError(decision.code, decision.message);
}

/* ─── CRUD leilão ─── */

export async function listAuctions(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: {
    q?: string | undefined;
    auctionType?: string | undefined;
    assetType?: string | undefined;
    status?: string | undefined;
    stateCode?: string | undefined;
    municipality?: string | undefined;
    auctioneerId?: string | undefined;
    courtId?: string | undefined;
    publicBodyId?: string | undefined;
    minValueCents?: number | undefined;
    maxValueCents?: number | undefined;
    eventFrom?: string | undefined;
    eventTo?: string | undefined;
    occupancyStatus?: string | undefined;
    interestStatus?: string | undefined;
    onlySaved?: boolean | undefined;
    source?: string | undefined;
    limit: number;
    offset: number;
  },
) {
  authorize(account, organizationId, (access) => policyAuction(access, "auction.read"));
  const a = auctions;
  const interest = auctionInterests;
  const lot = auctionLots;
  const filters: SQL[] = [
    or(eq(a.organizationId, organizationId), isNull(a.organizationId)) as SQL,
  ];
  if (query.status) {
    filters.push(eq(a.status, query.status as AuctionRow["status"]));
  } else {
    filters.push(ne(a.status, "archived"));
  }
  if (query.auctionType) {
    filters.push(eq(a.auctionType, query.auctionType as AuctionRow["auctionType"]));
  }
  if (query.source) {
    filters.push(eq(a.sourceProvider, query.source as AuctionRow["sourceProvider"]));
  }
  if (query.auctioneerId) filters.push(eq(a.auctioneerId, query.auctioneerId));
  if (query.courtId) filters.push(eq(a.courtId, query.courtId));
  if (query.publicBodyId) filters.push(eq(a.publicBodyId, query.publicBodyId));
  if (query.eventFrom) filters.push(gte(a.firstEventAt, new Date(query.eventFrom)));
  if (query.eventTo) filters.push(lte(a.firstEventAt, new Date(query.eventTo)));
  if (query.q) {
    const pattern = `%${escapeLike(query.q)}%`;
    filters.push(
      or(
        ilike(a.title, pattern),
        ilike(a.description, pattern),
        ilike(a.sellerName, pattern),
      ) as SQL,
    );
  }
  if (query.interestStatus) {
    filters.push(
      eq(interest.status, query.interestStatus as (typeof interest.$inferSelect)["status"]),
    );
  } else if (query.onlySaved) {
    filters.push(sql`${interest.id} is not null`);
  }

  const needsLotFilter =
    query.assetType != null ||
    query.stateCode != null ||
    query.municipality != null ||
    query.minValueCents != null ||
    query.maxValueCents != null ||
    query.occupancyStatus != null;

  if (needsLotFilter) {
    const lotFilters: SQL[] = [];
    if (query.assetType) {
      lotFilters.push(eq(lot.assetType, query.assetType as LotRow["assetType"]));
    }
    if (query.stateCode) lotFilters.push(eq(lot.stateCode, query.stateCode));
    if (query.municipality) {
      lotFilters.push(ilike(lot.municipality, `%${escapeLike(query.municipality)}%`));
    }
    if (query.occupancyStatus) {
      lotFilters.push(eq(lot.occupancyStatus, query.occupancyStatus as LotRow["occupancyStatus"]));
    }
    if (query.minValueCents != null) {
      lotFilters.push(
        sql`coalesce(${lot.appraisalValueCents}, ${lot.firstMinimumBidCents}, 0) >= ${query.minValueCents}`,
      );
    }
    if (query.maxValueCents != null) {
      lotFilters.push(
        sql`coalesce(${lot.appraisalValueCents}, ${lot.firstMinimumBidCents}, 0) <= ${query.maxValueCents}`,
      );
    }
    const matching = await db
      .selectDistinct({ auctionId: lot.auctionId })
      .from(lot)
      .where(and(...lotFilters));
    const ids = matching.map((row) => row.auctionId);
    if (ids.length === 0) {
      return { items: [], total: 0, limit: query.limit, offset: query.offset };
    }
    filters.push(inArray(a.id, ids));
  }

  const where = and(...filters);
  const join = and(eq(interest.auctionId, a.id), eq(interest.organizationId, organizationId));

  const [totalRow] = await db
    .select({ value: count() })
    .from(a)
    .leftJoin(interest, join)
    .where(where);
  const rows = await db
    .select({ auction: a, interest })
    .from(a)
    .leftJoin(interest, join)
    .where(where)
    .orderBy(sql`${a.firstEventAt} asc nulls last`, desc(a.createdAt))
    .limit(query.limit)
    .offset(query.offset);

  return {
    items: rows.map((row) => ({
      ...serializeAuction(row.auction, organizationId),
      interest: row.interest ? serializeInterest(row.interest) : null,
    })),
    total: totalRow?.value ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function createAuction(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    auctionType: AuctionRow["auctionType"];
    title: string;
    description?: string | undefined;
    sellerType?: string | undefined;
    sellerName?: string | undefined;
    publicBodyId?: string | undefined;
    courtId?: string | undefined;
    judicialProcessId?: string | undefined;
    auctioneerId?: string | undefined;
    status: AuctionRow["status"];
    publicationDate?: string | undefined;
    registrationDeadline?: string | undefined;
    inspectionStartAt?: string | undefined;
    inspectionEndAt?: string | undefined;
    firstEventAt?: string | undefined;
    secondEventAt?: string | undefined;
    closingAt?: string | undefined;
    sourceUrl?: string | undefined;
    sourceReference?: string | undefined;
  },
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyAuction(access, "auction.create"),
  );
  if (RESTRICTED_STATUSES.has(input.status)) {
    authorize(account, organizationId, (access) => policyAuction(access, "auction.manage"));
  }
  await assertPublicBody(db, input.publicBodyId);
  await assertAuctioneer(db, input.auctioneerId);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(auctions)
      .values({
        organizationId,
        sourceProvider: "manual",
        sourceReference: input.sourceReference ?? null,
        sourceUrl: input.sourceUrl ?? null,
        auctionType: input.auctionType,
        title: input.title,
        description: input.description ?? null,
        sellerType: input.sellerType ?? null,
        sellerName: input.sellerName ?? null,
        publicBodyId: input.publicBodyId ?? null,
        courtId: input.courtId ?? null,
        judicialProcessId: input.judicialProcessId ?? null,
        auctioneerId: input.auctioneerId ?? null,
        status: input.status,
        publicationDate: input.publicationDate ? new Date(input.publicationDate) : null,
        registrationDeadline: input.registrationDeadline
          ? new Date(input.registrationDeadline)
          : null,
        inspectionStartAt: input.inspectionStartAt ? new Date(input.inspectionStartAt) : null,
        inspectionEndAt: input.inspectionEndAt ? new Date(input.inspectionEndAt) : null,
        firstEventAt: input.firstEventAt ? new Date(input.firstEventAt) : null,
        secondEventAt: input.secondEventAt ? new Date(input.secondEventAt) : null,
        closingAt: input.closingAt ? new Date(input.closingAt) : null,
        createdByMembershipId: membership.membershipId,
      })
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível cadastrar o leilão.");
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "auction.created",
      resourceType: "auction",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: {
        auctionType: row.auctionType,
        status: row.status,
        sourceProvider: row.sourceProvider,
      },
    });
    return { auction: serializeAuction(row, organizationId) };
  });
}

export async function getAuction(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  auctionId: string,
) {
  authorize(account, organizationId, (access) => policyAuction(access, "auction.read"));
  const row = await requireVisibleAuction(db, organizationId, auctionId);
  const [events, lots, bidRules, interest, auctioneer, links] = await Promise.all([
    db.query.auctionEvents.findMany({
      where: eq(auctionEvents.auctionId, row.id),
      orderBy: [asc(auctionEvents.startsAt)],
    }),
    db.query.auctionLots.findMany({
      where: eq(auctionLots.auctionId, row.id),
      orderBy: [asc(auctionLots.lotNumber)],
    }),
    db.query.auctionBidRules.findMany({
      where: and(eq(auctionBidRules.auctionId, row.id), isNull(auctionBidRules.lotId)),
    }),
    db.query.auctionInterests.findFirst({
      where: and(
        eq(auctionInterests.auctionId, row.id),
        eq(auctionInterests.organizationId, organizationId),
        isNull(auctionInterests.lotId),
      ),
    }),
    row.auctioneerId
      ? db.query.auctioneers.findFirst({ where: eq(auctioneers.id, row.auctioneerId) })
      : Promise.resolve(undefined),
    db.query.documentLinks.findMany({
      where: and(
        eq(documentLinks.organizationId, organizationId),
        eq(documentLinks.targetType, LINK_TARGET_AUCTION),
        eq(documentLinks.targetId, row.id),
      ),
    }),
  ]);
  return {
    auction: {
      ...serializeAuction(row, organizationId),
      interest: interest ? serializeInterest(interest) : null,
      auctioneer: auctioneer ? serializeAuctioneer(auctioneer) : null,
      events: events.map(serializeEvent),
      lots: lots.map(serializeLot),
      bidRules: bidRules.map(serializeBidRules),
      documentLinkCount: links.length,
      /** API nunca afirma que o usuário está dando lance. */
      bidding: { available: false, status: "not_configured" as const },
    },
  };
}

export async function updateAuction(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  auctionId: string,
  input: Partial<{
    auctionType: AuctionRow["auctionType"];
    title: string;
    description: string | null;
    sellerType: string | null;
    sellerName: string | null;
    publicBodyId: string | null;
    courtId: string | null;
    judicialProcessId: string | null;
    auctioneerId: string | null;
    status: AuctionRow["status"];
    publicationDate: string | null;
    registrationDeadline: string | null;
    inspectionStartAt: string | null;
    inspectionEndAt: string | null;
    firstEventAt: string | null;
    secondEventAt: string | null;
    closingAt: string | null;
    sourceUrl: string | null;
    sourceReference: string | null;
  }>,
  meta: RequestMeta,
) {
  const row = await requireVisibleAuction(db, organizationId, auctionId);
  authorizeMutation(account, organizationId, row.organizationId, "auction.update");
  const touchesRestricted =
    (input.status !== undefined && RESTRICTED_STATUSES.has(input.status)) ||
    row.status === "archived";
  if (touchesRestricted) {
    authorizeMutation(account, organizationId, row.organizationId, "auction.manage");
  }
  await assertPublicBody(db, input.publicBodyId);
  await assertAuctioneer(db, input.auctioneerId);

  const values: Partial<typeof auctions.$inferInsert> = { updatedAt: new Date() };
  const assign = <K extends keyof typeof input>(
    key: K,
    map?: (value: NonNullable<(typeof input)[K]>) => unknown,
  ) => {
    if (input[key] === undefined) return;
    const value = input[key];
    (values as Record<string, unknown>)[key as string] =
      value === null || !map ? value : map(value as NonNullable<(typeof input)[K]>);
  };
  assign("auctionType");
  assign("title");
  assign("description");
  assign("sellerType");
  assign("sellerName");
  assign("publicBodyId");
  assign("courtId");
  assign("judicialProcessId");
  assign("auctioneerId");
  assign("status");
  assign("publicationDate", (v) => new Date(v as string));
  assign("registrationDeadline", (v) => new Date(v as string));
  assign("inspectionStartAt", (v) => new Date(v as string));
  assign("inspectionEndAt", (v) => new Date(v as string));
  assign("firstEventAt", (v) => new Date(v as string));
  assign("secondEventAt", (v) => new Date(v as string));
  assign("closingAt", (v) => new Date(v as string));
  assign("sourceUrl");
  assign("sourceReference");

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(auctions)
      .set(values)
      .where(and(eq(auctions.id, row.id), eq(auctions.organizationId, organizationId)))
      .returning();
    if (!updated) throw new AppError("NOT_FOUND", "Não encontramos este leilão no seu acesso.");
    const statusChanged = input.status !== undefined && input.status !== row.status;
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: statusChanged ? "auction.status_changed" : "auction.updated",
      resourceType: "auction",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      before: { status: row.status },
      after: { status: updated.status },
      metadata: { fields: Object.keys(input) },
    });
    return { auction: serializeAuction(updated, organizationId) };
  });
}

/* ─── Eventos ─── */

export async function createEvent(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  auctionId: string,
  input: {
    eventType: (typeof auctionEvents.$inferSelect)["eventType"];
    startsAt: string;
    endsAt?: string | undefined;
    timezone: string;
    minimumRule?: string | undefined;
    status: (typeof auctionEvents.$inferSelect)["status"];
  },
  meta: RequestMeta,
) {
  const auction = await requireVisibleAuction(db, organizationId, auctionId);
  authorizeMutation(account, organizationId, auction.organizationId, "auction.update");
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(auctionEvents)
      .values({
        auctionId: auction.id,
        eventType: input.eventType,
        startsAt: new Date(input.startsAt),
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        timezone: input.timezone,
        minimumRule: input.minimumRule ?? null,
        status: input.status,
        source: "manual",
      })
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar o evento.");
    const patch: Partial<typeof auctions.$inferInsert> = { updatedAt: new Date() };
    if (input.eventType === "first_session") patch.firstEventAt = row.startsAt;
    if (input.eventType === "second_session") patch.secondEventAt = row.startsAt;
    if (input.eventType === "closing") patch.closingAt = row.startsAt;
    await tx
      .update(auctions)
      .set(patch)
      .where(and(eq(auctions.id, auction.id), eq(auctions.organizationId, organizationId)));
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "auction.updated",
      resourceType: "auction_event",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { auctionId: auction.id, eventType: row.eventType },
    });
    return { event: serializeEvent(row) };
  });
}

/* ─── Leiloeiro ─── */

export async function createAuctioneer(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    name: string;
    registrationNumber?: string | undefined;
    stateCode?: string | undefined;
    entityName?: string | undefined;
    website?: string | undefined;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) => policyAuction(access, "auction.create"));
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(auctioneers)
      .values({
        name: input.name,
        registrationNumber: input.registrationNumber ?? null,
        stateCode: input.stateCode ?? null,
        entityName: input.entityName ?? null,
        website: input.website ?? null,
        verificationStatus: "unverified",
        source: "manual",
      })
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível cadastrar o leiloeiro.");
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "auction.created",
      resourceType: "auctioneer",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { verificationStatus: row.verificationStatus },
    });
    return { auctioneer: serializeAuctioneer(row) };
  });
}

/* ─── Lotes ─── */

async function upsertLotDetails(
  tx: AppDatabase,
  lotId: string,
  realEstate?: Record<string, unknown> | undefined,
  vehicle?: Record<string, unknown> | undefined,
) {
  if (realEstate) {
    const existing = await tx.query.auctionRealEstateDetails.findFirst({
      where: eq(auctionRealEstateDetails.lotId, lotId),
    });
    const values = {
      propertyType: (realEstate.propertyType as string | undefined) ?? null,
      registryNumber: (realEstate.registryNumber as string | undefined) ?? null,
      registryOffice: (realEstate.registryOffice as string | undefined) ?? null,
      area: (realEstate.area as string | undefined) ?? null,
      builtArea: (realEstate.builtArea as string | undefined) ?? null,
      occupancyStatus:
        (realEstate.occupancyStatus as LotRow["occupancyStatus"] | undefined) ?? "unknown",
      possessionStatus: (realEstate.possessionStatus as string | undefined) ?? null,
      address: (realEstate.address as string | undefined) ?? null,
      propertyTaxReference: (realEstate.propertyTaxReference as string | undefined) ?? null,
      condominiumInfo: (realEstate.condominiumInfo as string | undefined) ?? null,
      liensSummary: (realEstate.liensSummary as string | undefined) ?? null,
      updatedAt: new Date(),
    };
    if (existing) {
      await tx
        .update(auctionRealEstateDetails)
        .set(values)
        .where(eq(auctionRealEstateDetails.id, existing.id));
    } else {
      await tx.insert(auctionRealEstateDetails).values({ lotId, ...values });
    }
  }
  if (vehicle) {
    const existing = await tx.query.auctionVehicleDetails.findFirst({
      where: eq(auctionVehicleDetails.lotId, lotId),
    });
    const values = {
      make: (vehicle.make as string | undefined) ?? null,
      model: (vehicle.model as string | undefined) ?? null,
      year: (vehicle.year as number | undefined) ?? null,
      modelYear: (vehicle.modelYear as number | undefined) ?? null,
      plateMasked: (vehicle.plateMasked as string | undefined) ?? null,
      renavamMasked: (vehicle.renavamMasked as string | undefined) ?? null,
      mileage: (vehicle.mileage as number | undefined) ?? null,
      condition: (vehicle.condition as string | undefined) ?? null,
      documentationStatus: (vehicle.documentationStatus as string | undefined) ?? null,
      updatedAt: new Date(),
    };
    if (existing) {
      await tx
        .update(auctionVehicleDetails)
        .set(values)
        .where(eq(auctionVehicleDetails.id, existing.id));
    } else {
      await tx.insert(auctionVehicleDetails).values({ lotId, ...values });
    }
  }
}

export async function createLot(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  auctionId: string,
  input: {
    lotNumber: string;
    title: string;
    description?: string | undefined;
    assetType: LotRow["assetType"];
    appraisalValueCents?: number | undefined;
    firstMinimumBidCents?: number | undefined;
    secondMinimumBidCents?: number | undefined;
    currentReferenceValueCents?: number | undefined;
    currency: string;
    incrementCents?: number | undefined;
    commissionBasisPoints?: number | undefined;
    buyerFeeCents?: number | undefined;
    depositRequiredCents?: number | undefined;
    location?: string | undefined;
    stateCode?: string | undefined;
    municipality?: string | undefined;
    latitude?: string | undefined;
    longitude?: string | undefined;
    occupancyStatus: LotRow["occupancyStatus"];
    realEstate?: Record<string, unknown> | undefined;
    vehicle?: Record<string, unknown> | undefined;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) => policyAuctionLot(access, "auction.create"));
  const auction = await requireVisibleAuction(db, organizationId, auctionId);
  authorizeMutation(account, organizationId, auction.organizationId, "auction.update");
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(auctionLots)
        .values({
          auctionId: auction.id,
          lotNumber: input.lotNumber,
          title: input.title,
          description: input.description ?? null,
          assetType: input.assetType,
          appraisalValueCents: input.appraisalValueCents ?? null,
          firstMinimumBidCents: input.firstMinimumBidCents ?? null,
          secondMinimumBidCents: input.secondMinimumBidCents ?? null,
          currentReferenceValueCents: input.currentReferenceValueCents ?? null,
          currency: input.currency.toUpperCase(),
          incrementCents: input.incrementCents ?? null,
          commissionBasisPoints: input.commissionBasisPoints ?? null,
          buyerFeeCents: input.buyerFeeCents ?? null,
          depositRequiredCents: input.depositRequiredCents ?? null,
          location: input.location ?? null,
          stateCode: input.stateCode ?? null,
          municipality: input.municipality ?? null,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          occupancyStatus: input.occupancyStatus,
        })
        .returning();
      if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível cadastrar o lote.");
      await upsertLotDetails(tx, row.id, input.realEstate, input.vehicle);
      await recordAudit(tx, {
        actorUserId: account.user.id,
        organizationId,
        action: "auction.updated",
        resourceType: "auction_lot",
        resourceId: row.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        after: {
          auctionId: auction.id,
          lotNumber: row.lotNumber,
          appraisalValueCents: row.appraisalValueCents,
          firstMinimumBidCents: row.firstMinimumBidCents,
          commissionBasisPoints: row.commissionBasisPoints,
        },
      });
      return { lot: serializeLot(row) };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("CONFLICT", "Já existe um lote com este número neste leilão.");
    }
    throw error;
  }
}

export async function updateLot(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  lotId: string,
  input: Partial<{
    lotNumber: string;
    title: string;
    description: string | null;
    assetType: LotRow["assetType"];
    appraisalValueCents: number | null;
    firstMinimumBidCents: number | null;
    secondMinimumBidCents: number | null;
    currentReferenceValueCents: number | null;
    currency: string;
    incrementCents: number | null;
    commissionBasisPoints: number | null;
    buyerFeeCents: number | null;
    depositRequiredCents: number | null;
    location: string | null;
    stateCode: string | null;
    municipality: string | null;
    latitude: string | null;
    longitude: string | null;
    occupancyStatus: LotRow["occupancyStatus"];
    status: LotRow["status"];
    realEstate: Record<string, unknown>;
    vehicle: Record<string, unknown>;
  }>,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) => policyAuctionLot(access, "auction.update"));
  const lot = await requireVisibleLot(db, organizationId, lotId);
  const auction = await requireVisibleAuction(db, organizationId, lot.auctionId);
  authorizeMutation(account, organizationId, auction.organizationId, "auction.update");

  const { realEstate, vehicle, ...lotInput } = input;
  const values: Partial<typeof auctionLots.$inferInsert> = { updatedAt: new Date() };
  for (const [key, value] of Object.entries(lotInput)) {
    if (value === undefined) continue;
    if (key === "currency" && typeof value === "string") {
      values.currency = value.toUpperCase();
    } else {
      (values as Record<string, unknown>)[key] = value;
    }
  }

  try {
    return await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(auctionLots)
        .set(values)
        .where(eq(auctionLots.id, lot.id))
        .returning();
      if (!updated) throw new AppError("NOT_FOUND", "Não encontramos este lote no seu acesso.");
      await upsertLotDetails(tx, lot.id, realEstate, vehicle);
      await recordAudit(tx, {
        actorUserId: account.user.id,
        organizationId,
        action: "auction.updated",
        resourceType: "auction_lot",
        resourceId: lot.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        metadata: { fields: Object.keys(input) },
      });
      return { lot: serializeLot(updated) };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("CONFLICT", "Já existe um lote com este número neste leilão.");
    }
    throw error;
  }
}

export async function getLot(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  lotId: string,
) {
  authorize(account, organizationId, (access) => policyAuctionLot(access, "auction.read"));
  const lot = await requireVisibleLot(db, organizationId, lotId);
  const [realEstate, vehicle, encumbrances, bidRules, interest] = await Promise.all([
    db.query.auctionRealEstateDetails.findFirst({
      where: eq(auctionRealEstateDetails.lotId, lot.id),
    }),
    db.query.auctionVehicleDetails.findFirst({
      where: eq(auctionVehicleDetails.lotId, lot.id),
    }),
    db.query.auctionEncumbrances.findMany({
      where: eq(auctionEncumbrances.lotId, lot.id),
      orderBy: [asc(auctionEncumbrances.createdAt)],
    }),
    db.query.auctionBidRules.findMany({ where: eq(auctionBidRules.lotId, lot.id) }),
    db.query.auctionInterests.findFirst({
      where: and(
        eq(auctionInterests.organizationId, organizationId),
        eq(auctionInterests.lotId, lot.id),
      ),
    }),
  ]);
  return {
    lot: {
      ...serializeLot(lot),
      realEstate: realEstate ? serializeRealEstate(realEstate) : null,
      vehicle: vehicle ? serializeVehicle(vehicle) : null,
      encumbrances: encumbrances.map(serializeEncumbrance),
      bidRules: bidRules.map(serializeBidRules),
      interest: interest ? serializeInterest(interest) : null,
      discountVsAppraisalBp: discountBasisPoints(lot.appraisalValueCents, lot.firstMinimumBidCents),
      bidding: { available: false, status: "not_configured" as const },
    },
  };
}

export async function listLots(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  auctionId: string,
) {
  authorize(account, organizationId, (access) => policyAuctionLot(access, "auction.read"));
  const auction = await requireVisibleAuction(db, organizationId, auctionId);
  const rows = await db.query.auctionLots.findMany({
    where: eq(auctionLots.auctionId, auction.id),
    orderBy: [asc(auctionLots.lotNumber)],
  });
  return { items: rows.map(serializeLot) };
}

/* ─── Ônus ─── */

export async function createEncumbrance(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  lotId: string,
  input: {
    type: string;
    description: string;
    source?: string | undefined;
    responsibility?: string | undefined;
    amountCents?: number | undefined;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) => policyAuctionLot(access, "auction.update"));
  const lot = await requireVisibleLot(db, organizationId, lotId);
  const auction = await requireVisibleAuction(db, organizationId, lot.auctionId);
  authorizeMutation(account, organizationId, auction.organizationId, "auction.update");
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(auctionEncumbrances)
      .values({
        lotId: lot.id,
        type: input.type,
        description: input.description,
        source: input.source ?? null,
        responsibility: input.responsibility ?? null,
        amountCents: input.amountCents ?? null,
        status: "informed",
      })
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar o ônus.");
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "auction.updated",
      resourceType: "auction_encumbrance",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { lotId: lot.id, status: row.status },
    });
    return { encumbrance: serializeEncumbrance(row) };
  });
}

export async function listEncumbrances(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  lotId: string,
) {
  authorize(account, organizationId, (access) => policyAuctionLot(access, "auction.read"));
  await requireVisibleLot(db, organizationId, lotId);
  const rows = await db.query.auctionEncumbrances.findMany({
    where: eq(auctionEncumbrances.lotId, lotId),
    orderBy: [asc(auctionEncumbrances.createdAt)],
  });
  return { items: rows.map(serializeEncumbrance) };
}

/* ─── Regras de lance (informativas; sem lance real) ─── */

export async function createBidRules(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  auctionId: string,
  input: {
    lotId?: string | undefined;
    minimumBidCents?: number | undefined;
    incrementCents?: number | undefined;
    paymentTerms?: string | undefined;
    commissionBasisPoints?: number | undefined;
    depositRequired: boolean;
    depositRequiredCents?: number | undefined;
    registrationRequired: boolean;
    eligibilityDescription?: string | undefined;
    notes?: string | undefined;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) => policyAuctionLot(access, "auction.update"));
  const auction = await requireVisibleAuction(db, organizationId, auctionId);
  authorizeMutation(account, organizationId, auction.organizationId, "auction.update");
  if (input.lotId) {
    const lot = await requireVisibleLot(db, organizationId, input.lotId);
    if (lot.auctionId !== auction.id) {
      throw new AppError("VALIDATION_ERROR", "O lote não pertence a este leilão.");
    }
  }
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(auctionBidRules)
      .values({
        auctionId: auction.id,
        lotId: input.lotId ?? null,
        minimumBidCents: input.minimumBidCents ?? null,
        incrementCents: input.incrementCents ?? null,
        paymentTerms: input.paymentTerms ?? null,
        commissionBasisPoints: input.commissionBasisPoints ?? null,
        depositRequired: input.depositRequired,
        depositRequiredCents: input.depositRequiredCents ?? null,
        registrationRequired: input.registrationRequired,
        eligibilityDescription: input.eligibilityDescription ?? null,
        notes: input.notes ?? null,
        source: "manual",
      })
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar as regras.");
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "auction.updated",
      resourceType: "auction_bid_rules",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: {
        auctionId: auction.id,
        lotId: row.lotId,
        /** Informativo — não implica capacidade de lance. */
        informativeOnly: true,
      },
    });
    return { bidRules: serializeBidRules(row) };
  });
}

/* ─── Interesse ─── */

export async function upsertInterest(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  auctionId: string,
  input: {
    lotId?: string | undefined;
    status: (typeof auctionInterests.$inferSelect)["status"];
    notes?: string | null | undefined;
    confirmOutcome?: boolean | undefined;
  },
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyAuctionInterest(access, "auction.save"),
  );
  if ((input.status === "won" || input.status === "lost") && input.confirmOutcome !== true) {
    throw new AppError("VALIDATION_ERROR", "Confirme o resultado (won/lost).", [
      { path: "confirmOutcome", message: "Informe confirmOutcome=true." },
    ]);
  }
  const auction = await requireVisibleAuction(db, organizationId, auctionId);
  if (input.lotId) {
    const lot = await requireVisibleLot(db, organizationId, input.lotId);
    if (lot.auctionId !== auction.id) {
      throw new AppError("VALIDATION_ERROR", "O lote não pertence a este leilão.");
    }
  }
  const lotFilter = input.lotId
    ? eq(auctionInterests.lotId, input.lotId)
    : isNull(auctionInterests.lotId);
  try {
    return await db.transaction(async (tx) => {
      const existing = await tx.query.auctionInterests.findFirst({
        where: and(
          eq(auctionInterests.organizationId, organizationId),
          eq(auctionInterests.auctionId, auction.id),
          lotFilter,
        ),
      });
      const [row] = existing
        ? await tx
            .update(auctionInterests)
            .set({
              status: input.status,
              ...(input.notes !== undefined ? { notes: input.notes } : {}),
              updatedAt: new Date(),
            })
            .where(eq(auctionInterests.id, existing.id))
            .returning()
        : await tx
            .insert(auctionInterests)
            .values({
              organizationId,
              auctionId: auction.id,
              lotId: input.lotId ?? null,
              status: input.status,
              notes: input.notes ?? null,
              createdByMembershipId: membership.membershipId,
            })
            .returning();
      if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível salvar o interesse.");
      await recordAudit(tx, {
        actorUserId: account.user.id,
        organizationId,
        action: "auction.saved",
        resourceType: "auction_interest",
        resourceId: row.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        before: existing ? { status: existing.status } : null,
        after: { auctionId: auction.id, lotId: row.lotId, status: row.status },
      });
      return { interest: serializeInterest(row) };
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError("CONFLICT", "Interesse já registrado.");
    throw error;
  }
}

export async function removeInterest(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  interestId: string,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) => policyAuctionInterest(access, "auction.save"));
  const existing = await db.query.auctionInterests.findFirst({
    where: and(
      eq(auctionInterests.id, interestId),
      eq(auctionInterests.organizationId, organizationId),
    ),
  });
  if (!existing) throw new AppError("NOT_FOUND", "Não encontramos este interesse no seu acesso.");
  await db.transaction(async (tx) => {
    await tx.delete(auctionInterests).where(eq(auctionInterests.id, existing.id));
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "auction.saved",
      resourceType: "auction_interest",
      resourceId: existing.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      before: { auctionId: existing.auctionId, status: existing.status },
    });
  });
}

export async function listInterests(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: {
    status?: string | undefined;
    auctionId?: string | undefined;
    lotId?: string | undefined;
    limit: number;
    offset: number;
  },
) {
  authorize(account, organizationId, (access) => policyAuctionInterest(access, "auction.read"));
  const interest = auctionInterests;
  const filters = [eq(interest.organizationId, organizationId)];
  if (query.status) {
    filters.push(eq(interest.status, query.status as (typeof interest.$inferSelect)["status"]));
  }
  if (query.auctionId) filters.push(eq(interest.auctionId, query.auctionId));
  if (query.lotId) filters.push(eq(interest.lotId, query.lotId));
  const where = and(...filters);
  const [totalRow] = await db.select({ value: count() }).from(interest).where(where);
  const rows = await db
    .select({ interest, auction: auctions })
    .from(interest)
    .innerJoin(auctions, eq(auctions.id, interest.auctionId))
    .where(where)
    .orderBy(desc(interest.updatedAt))
    .limit(query.limit)
    .offset(query.offset);
  return {
    items: rows.map((row) => ({
      ...serializeInterest(row.interest),
      auction: serializeAuction(row.auction, organizationId),
    })),
    total: totalRow?.value ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

/* ─── Alertas ─── */

export async function createAlertRule(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    name: string;
    active: boolean;
    auctionTypes?: string[] | undefined;
    assetTypes?: string[] | undefined;
    stateCodes?: string[] | undefined;
    municipalities?: string[] | undefined;
    minValueCents?: number | undefined;
    maxValueCents?: number | undefined;
    occupancyStatuses?: string[] | undefined;
  },
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyAuctionAlert(access, "auction.alert.manage"),
  );
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(auctionAlertRules)
      .values({
        organizationId,
        name: input.name,
        active: input.active,
        auctionTypes: input.auctionTypes ?? null,
        assetTypes: input.assetTypes ?? null,
        stateCodes: input.stateCodes ?? null,
        municipalities: input.municipalities ?? null,
        minValueCents: input.minValueCents ?? null,
        maxValueCents: input.maxValueCents ?? null,
        occupancyStatuses: input.occupancyStatuses ?? null,
        createdByMembershipId: membership.membershipId,
      })
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o alerta.");
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "auction.alert_created",
      resourceType: "auction_alert_rule",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { name: row.name, active: row.active },
    });
    return { alert: serializeAlert(row) };
  });
}

export async function listAlerts(db: AppDatabase, account: SessionAccount, organizationId: string) {
  authorize(account, organizationId, (access) => policyAuctionAlert(access, "auction.read"));
  const rows = await db.query.auctionAlertRules.findMany({
    where: eq(auctionAlertRules.organizationId, organizationId),
    orderBy: [desc(auctionAlertRules.createdAt)],
  });
  return { items: rows.map(serializeAlert) };
}

export async function deleteAlert(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  alertId: string,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyAuctionAlert(access, "auction.alert.manage"),
  );
  const existing = await db.query.auctionAlertRules.findFirst({
    where: and(
      eq(auctionAlertRules.id, alertId),
      eq(auctionAlertRules.organizationId, organizationId),
    ),
  });
  if (!existing) throw new AppError("NOT_FOUND", "Não encontramos este alerta no seu acesso.");
  await db.transaction(async (tx) => {
    await tx.delete(auctionAlertRules).where(eq(auctionAlertRules.id, existing.id));
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "auction.alert_created",
      resourceType: "auction_alert_rule",
      resourceId: existing.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      before: { name: existing.name },
    });
  });
}

/* ─── Due diligence (assistiva) ─── */

export async function getOrCreateDueDiligence(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: { auctionId: string; lotId?: string | undefined },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyAuctionDueDiligence(access, "auction.due_diligence.read"),
  );
  const auction = await requireVisibleAuction(db, organizationId, input.auctionId);
  if (input.lotId) {
    const lot = await requireVisibleLot(db, organizationId, input.lotId);
    if (lot.auctionId !== auction.id) {
      throw new AppError("VALIDATION_ERROR", "O lote não pertence a este leilão.");
    }
  }
  const lotFilter = input.lotId
    ? eq(auctionDueDiligence.lotId, input.lotId)
    : isNull(auctionDueDiligence.lotId);
  let rows = await db.query.auctionDueDiligence.findMany({
    where: and(
      eq(auctionDueDiligence.organizationId, organizationId),
      eq(auctionDueDiligence.auctionId, auction.id),
      lotFilter,
    ),
    orderBy: [asc(auctionDueDiligence.itemKey)],
  });
  if (rows.length === 0) {
    authorize(account, organizationId, (access) =>
      policyAuctionDueDiligence(access, "auction.due_diligence.manage"),
    );
    rows = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(auctionDueDiligence)
        .values(
          DUE_DILIGENCE_DEFAULTS.map((item) => ({
            organizationId,
            auctionId: auction.id,
            lotId: input.lotId ?? null,
            itemKey: item.itemKey,
            label: item.label,
            category: item.category,
            status: "pending" as const,
          })),
        )
        .returning();
      await recordAudit(tx, {
        actorUserId: account.user.id,
        organizationId,
        action: "auction.due_diligence_updated",
        resourceType: "auction_due_diligence",
        resourceId: auction.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        after: { created: inserted.length, assistive: true },
      });
      return inserted;
    });
  }
  return {
    items: rows.map(serializeDueDiligence),
    disclaimer:
      "Checklist assistivo para organização da verificação. Não constitui parecer jurídico nem recomendação de compra.",
  };
}

export async function updateDueDiligence(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  itemId: string,
  input: {
    status?: (typeof auctionDueDiligence.$inferSelect)["status"] | undefined;
    notes?: string | null | undefined;
    label?: string | undefined;
    category?: string | null | undefined;
  },
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyAuctionDueDiligence(access, "auction.due_diligence.manage"),
  );
  const existing = await db.query.auctionDueDiligence.findFirst({
    where: and(
      eq(auctionDueDiligence.id, itemId),
      eq(auctionDueDiligence.organizationId, organizationId),
    ),
  });
  if (!existing) {
    throw new AppError("NOT_FOUND", "Não encontramos este item de due diligence no seu acesso.");
  }
  const statusChanged = input.status !== undefined && input.status !== existing.status;
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(auctionDueDiligence)
      .set({
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(statusChanged
          ? { reviewedByMembershipId: membership.membershipId, reviewedAt: new Date() }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(auctionDueDiligence.id, existing.id))
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível atualizar o item.");
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "auction.due_diligence_updated",
      resourceType: "auction_due_diligence",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      before: { status: existing.status },
      after: { status: row.status, assistive: true },
    });
    return { item: serializeDueDiligence(row) };
  });
}

/* ─── Documentos ─── */

export async function linkDocument(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  auctionId: string,
  input: { documentId: string; linkType: string; lotId?: string | undefined },
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyAuction(access, "auction.documents.manage"),
  );
  const auction = await requireVisibleAuction(db, organizationId, auctionId);
  let targetType = LINK_TARGET_AUCTION;
  let targetId = auction.id;
  if (input.lotId) {
    const lot = await requireVisibleLot(db, organizationId, input.lotId);
    if (lot.auctionId !== auction.id) {
      throw new AppError("VALIDATION_ERROR", "O lote não pertence a este leilão.");
    }
    targetType = LINK_TARGET_LOT;
    targetId = lot.id;
  }
  const doc = await requireDocumentInOrg(db, organizationId, input.documentId);
  await assertCanReadDocument(db, account, organizationId, doc);
  const existing = await db.query.documentLinks.findFirst({
    where: and(
      eq(documentLinks.organizationId, organizationId),
      eq(documentLinks.documentId, doc.id),
      eq(documentLinks.targetType, targetType),
      eq(documentLinks.targetId, targetId),
      eq(documentLinks.linkType, input.linkType),
    ),
  });
  if (existing) throw new AppError("CONFLICT", "Este documento já está vinculado.");
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(documentLinks)
      .values({
        organizationId,
        documentId: doc.id,
        linkType: input.linkType,
        targetType,
        targetId,
        createdByMembershipId: membership.membershipId,
      })
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível vincular o documento.");
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "auction.document_linked",
      resourceType: "document_link",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: {
        auctionId: auction.id,
        lotId: input.lotId ?? null,
        documentId: doc.id,
        linkType: row.linkType,
        targetType,
      },
    });
    return {
      link: {
        id: row.id,
        documentId: row.documentId,
        linkType: row.linkType,
        targetType: row.targetType,
        targetId: row.targetId,
        createdAt: row.createdAt.toISOString(),
      },
    };
  });
}

export async function listDocuments(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  auctionId: string,
  lotId?: string | undefined,
) {
  authorize(account, organizationId, (access) => policyAuction(access, "auction.read"));
  const auction = await requireVisibleAuction(db, organizationId, auctionId);
  let targetType = LINK_TARGET_AUCTION;
  let targetId = auction.id;
  if (lotId) {
    const lot = await requireVisibleLot(db, organizationId, lotId);
    if (lot.auctionId !== auction.id) {
      throw new AppError("VALIDATION_ERROR", "O lote não pertence a este leilão.");
    }
    targetType = LINK_TARGET_LOT;
    targetId = lot.id;
  }
  const rows = await db
    .select({ link: documentLinks, doc: documents })
    .from(documentLinks)
    .innerJoin(documents, eq(documents.id, documentLinks.documentId))
    .where(
      and(
        eq(documentLinks.organizationId, organizationId),
        eq(documentLinks.targetType, targetType),
        eq(documentLinks.targetId, targetId),
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
      targetType: row.link.targetType,
      documentId: row.doc.id,
      title: row.doc.title,
      status: row.doc.status,
      documentKind: row.doc.documentKind,
      createdAt: row.link.createdAt.toISOString(),
    });
  }
  return { items };
}

/* ─── Estimativa de custo / comparação ─── */

export async function estimateCost(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    lotId?: string | undefined;
    bidCents?: number | undefined;
    commissionBasisPoints?: number | undefined;
    knownFeesCents: number;
    otherCostsCents: number;
  },
) {
  authorize(account, organizationId, (access) => policyAuction(access, "auction.read"));
  let bidCents = input.bidCents;
  let commissionBasisPoints = input.commissionBasisPoints ?? 0;
  let knownFeesCents = input.knownFeesCents;
  if (input.lotId) {
    const lot = await requireVisibleLot(db, organizationId, input.lotId);
    bidCents = bidCents ?? lot.firstMinimumBidCents ?? lot.appraisalValueCents ?? undefined;
    if (input.commissionBasisPoints === undefined && lot.commissionBasisPoints != null) {
      commissionBasisPoints = lot.commissionBasisPoints;
    }
    if (input.knownFeesCents === 0 && lot.buyerFeeCents != null) {
      knownFeesCents = lot.buyerFeeCents;
    }
  }
  if (bidCents == null) {
    throw new AppError("VALIDATION_ERROR", "Informe bidCents ou um lote com valor de referência.", [
      { path: "bidCents", message: "Valor do lance em centavos é obrigatório." },
    ]);
  }
  const estimate = estimateAuctionCost({
    bidCents,
    commissionBasisPoints,
    knownFeesCents,
    informedCostsCents: input.otherCostsCents,
  });
  return {
    estimate: {
      ...estimate,
      label: AUCTION_COST_ESTIMATE_LABEL,
      disclaimer: COST_DISCLAIMER,
    },
  };
}

export async function compareLots(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  lotIds: string[],
) {
  authorize(account, organizationId, (access) => policyAuction(access, "auction.read"));
  const uniqueIds = [...new Set(lotIds)];
  const items = [];
  for (const lotId of uniqueIds) {
    const lot = await requireVisibleLot(db, organizationId, lotId);
    items.push({
      lotId: lot.id,
      auctionId: lot.auctionId,
      title: lot.title,
      assetType: lot.assetType,
      status: lot.status,
      appraisalValueCents: lot.appraisalValueCents,
      firstMinimumBidCents: lot.firstMinimumBidCents,
      secondMinimumBidCents: lot.secondMinimumBidCents,
      commissionBasisPoints: lot.commissionBasisPoints,
      location: lot.location,
      stateCode: lot.stateCode,
      municipality: lot.municipality,
      occupancyStatus: lot.occupancyStatus,
      discountVsAppraisalBp: discountBasisPoints(lot.appraisalValueCents, lot.firstMinimumBidCents),
    });
  }
  return {
    items,
    /** Comparação factual — sem recomendação de compra. */
    recommendation: null,
    disclaimer:
      "Comparação informativa entre lotes. Não constitui recomendação de compra nem garantia de lucro.",
  };
}

/* ─── Provider / sync / IA ─── */

export async function getAuctionProviderStatus(
  account: SessionAccount,
  organizationId: string,
  deps: AuctionModuleDeps,
) {
  authorize(account, organizationId, (access) => policyAuction(access, "auction.read"));
  const [health, bidHealth] = await Promise.all([
    deps.auctionProvider.healthCheck(),
    deps.auctionBidProvider.healthCheck(),
  ]);
  return {
    provider: deps.auctionProvider.id,
    status: health.status,
    health,
    bidProvider: {
      provider: deps.auctionBidProvider.id,
      status: bidHealth.status,
      health: bidHealth,
      /** Lance eletrônico nunca está disponível nesta etapa. */
      placeBidAvailable: false,
    },
    manualEntryAvailable: true,
  };
}

export async function syncAuctions(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  deps: AuctionModuleDeps,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) => policyAuction(access, "auction.manage"));
  const health = await deps.auctionProvider.healthCheck();
  const notConfigured =
    health.status === "not_configured" || deps.auctionProvider.id === "not_configured";
  return db.transaction(async (tx) => {
    const [run] = await tx
      .insert(auctionSyncRuns)
      .values({
        organizationId,
        provider: deps.auctionProvider.id,
        status: notConfigured ? "not_configured" : "pending",
        startedAt: new Date(),
        finishedAt: notConfigured ? new Date() : null,
        recordsFetched: 0,
        recordsUpserted: 0,
        lastErrorCode: notConfigured ? "AUCTION_PROVIDER_NOT_CONFIGURED" : null,
        lastErrorSafeMessage: notConfigured
          ? "Nenhum provedor de leilões está configurado. Nenhum leilão foi sincronizado nem inventado."
          : null,
        metadata: { inventAuctions: false },
      })
      .returning();
    if (!run) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar a sincronização.");
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "auction.updated",
      resourceType: "auction_sync_run",
      resourceId: run.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { status: run.status, provider: run.provider },
    });
    if (notConfigured) {
      return {
        syncRun: {
          id: run.id,
          status: run.status,
          provider: run.provider,
          recordsFetched: 0,
          recordsUpserted: 0,
        },
        status: "not_configured" as const,
        message:
          "Nenhum provedor de leilões está configurado. Nenhum leilão foi sincronizado nem inventado.",
      };
    }
    throw new AppError(
      "AUCTION_PROVIDER_NOT_CONFIGURED",
      "Nenhum provedor de leilões está configurado. Nenhum leilão foi sincronizado nem inventado.",
    );
  });
}

/**
 * Análise assistiva do edital via AIGateway. Sem gateway configurado → NOT_CONFIGURED (nada inventado).
 */
export async function analyzeAuctionNotice(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: { auctionId: string; documentId?: string | undefined; text?: string | undefined },
  deps: AuctionModuleDeps,
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyAuction(access, "auction.ai.analyze"),
  );
  const auction = await requireVisibleAuction(db, organizationId, input.auctionId);
  if (!deps.aiGateway) {
    throw new AppError(
      "AI_PROVIDER_NOT_CONFIGURED",
      "Nenhum provedor de IA está configurado. Nenhum texto foi gerado.",
    );
  }
  const ctx: AiRunContext = {
    db,
    gateway: deps.aiGateway,
    account,
    organizationId,
    membershipId: membership.membershipId,
    meta,
  };
  const description = deps.aiGateway.describe();
  if (description.status === "not_configured") {
    return recordAiNotConfigured(ctx, {
      feature: "auction.notice_analysis",
      inputReference: `auction:${auction.id}`,
    });
  }
  const text =
    input.text ??
    [
      auction.title,
      auction.description ?? "",
      `Tipo: ${auction.auctionType}`,
      `Status: ${auction.status}`,
    ].join("\n");
  const outcome = await runStructuredAi(ctx, {
    feature: "auction.notice_analysis",
    promptKey: "auction.notice_analysis",
    defaultInstructions: AUCTION_FEATURE_INSTRUCTIONS["auction.notice_analysis"],
    input: text.slice(0, 100_000),
    inputLabel: `leilao:${auction.id}`,
    inputReference: `auction:${auction.id}`,
    schema: auctionAnalysisOutputSchema,
    schemaName: "AuctionNoticeAnalysis",
  });
  return {
    analysis: outcome.data,
    assistive: true,
    requiresReview: true,
    aiRequestId: outcome.requestId,
    disclaimer:
      "Análise assistiva do edital. Exige revisão humana. Não constitui parecer jurídico nem recomendação de compra.",
  };
}

/** Stub explícito: lance nunca é aceito pela API nesta etapa. */
export async function placeBidStub(
  account: SessionAccount,
  organizationId: string,
  deps: AuctionModuleDeps,
): Promise<never> {
  authorize(account, organizationId, (access) => policyAuction(access, "auction.read"));
  await deps.auctionBidProvider.placeBid({
    auctionExternalId: "n/a",
    lotExternalId: "n/a",
    bidCents: 0,
  });
  throw new AppError(
    "AUCTION_BID_PROVIDER_NOT_CONFIGURED",
    "Lance eletrônico não está disponível. O VerasJuris não realiza lances reais nesta etapa.",
  );
}
