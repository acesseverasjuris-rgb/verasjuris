import { recordAudit } from "@verasjuris/audit";
import {
  policyAuctionAward,
  policyAuctionDelivery,
  policyAuctionPayment,
  policyAuctionTransfer,
  type SessionAccount,
} from "@verasjuris/auth";
import {
  type AppDatabase,
  auctionAwardEvents,
  auctionAwards,
  auctionBidRecords,
  auctionDeliveryProcesses,
  auctionLots,
  auctionParticipations,
  auctionPayments,
  auctionRegularizationChecklists,
  auctionResults,
  auctions,
  auctionTransferProcesses,
  documentLinks,
  documents,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, asc, desc, eq, isNull, or, type SQL } from "drizzle-orm";
import { authorize, iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";
import { createDeadline } from "../deadlines/service.js";
import { assertCanReadDocument, requireDocumentInOrg } from "../documents/service.js";
import { createTask } from "../tasks/service.js";
import type { HolidayCalendarProvider, NotificationProvider } from "@verasjuris/notifications";

/** Link types pós-leilão (document_links) — sem storage paralelo. */
export const AUCTION_POST_LINK_TYPES = [
  "award_deed",
  "award_letter",
  "payment_receipt",
  "payment_guide",
  "auction_minutes",
  "delivery_term",
  "possession_order",
  "adjudication_letter",
  "updated_registry",
  "tax_document",
  "transfer_protocol",
  "other",
] as const;

export type AuctionPostLinkType = (typeof AUCTION_POST_LINK_TYPES)[number];

const LINK_TARGET_AWARD = "auction_award";
const MANUAL_BID_SOURCES = new Set(["manual", "external", "import"]);

const DEFAULT_REGULARIZATION: ReadonlyArray<{
  itemKey: string;
  label: string;
  category: string;
}> = [
  { itemKey: "registro", label: "Registro", category: "registro" },
  { itemKey: "impostos", label: "Impostos", category: "tributos" },
  { itemKey: "taxas", label: "Taxas", category: "tributos" },
  { itemKey: "condominio", label: "Condomínio", category: "debitos" },
  { itemKey: "documentos", label: "Documentos", category: "documentacao" },
  { itemKey: "posse", label: "Posse / entrega", category: "posse" },
  { itemKey: "licenciamento", label: "Licenciamento", category: "regularizacao" },
  { itemKey: "transferencia", label: "Transferência", category: "transferencia" },
  { itemKey: "baixa_restricoes", label: "Baixa de restrições", category: "restricoes" },
  { itemKey: "outros", label: "Outros", category: "outros" },
];

export type AuctionPostDeps = {
  db: AppDatabase;
  notifications?: NotificationProvider;
  holidays?: HolidayCalendarProvider;
};

type ParticipationRow = typeof auctionParticipations.$inferSelect;
type AwardRow = typeof auctionAwards.$inferSelect;
type PaymentRow = typeof auctionPayments.$inferSelect;

function requirePostRead(account: SessionAccount, organizationId: string) {
  return authorize(account, organizationId, (access) =>
    policyAuctionAward(access, "auction_post.read"),
  );
}

function requirePostManage(account: SessionAccount, organizationId: string) {
  return authorize(account, organizationId, (access) =>
    policyAuctionAward(access, "auction_post.manage"),
  );
}

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

async function requireParticipation(
  db: AppDatabase,
  organizationId: string,
  participationId: string,
) {
  const row = await db.query.auctionParticipations.findFirst({
    where: and(
      eq(auctionParticipations.id, participationId),
      eq(auctionParticipations.organizationId, organizationId),
    ),
  });
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos esta participação no seu acesso.");
  return row;
}

async function requireAward(db: AppDatabase, organizationId: string, awardId: string) {
  const row = await db.query.auctionAwards.findFirst({
    where: and(eq(auctionAwards.id, awardId), eq(auctionAwards.organizationId, organizationId)),
  });
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos esta arrematação no seu acesso.");
  return row;
}

/** Comissão em centavos a partir de base conhecida e basis points — sem float. */
export function calculateCommissionCents(baseAmountCents: number, basisPoints: number): number {
  if (!Number.isInteger(baseAmountCents) || !Number.isInteger(basisPoints)) {
    throw new AppError("VALIDATION_ERROR", "Valores monetários devem ser inteiros.");
  }
  if (baseAmountCents < 0 || basisPoints < 0 || basisPoints > 10_000) {
    throw new AppError("VALIDATION_ERROR", "Base ou basis points inválidos para comissão.");
  }
  return Math.floor((baseAmountCents * basisPoints) / 10_000);
}

export function computeTotalKnownCostCents(input: {
  winningBidCents: number;
  commissionCents?: number | null;
  feesCents?: number | null;
}): number {
  let total = input.winningBidCents;
  if (input.commissionCents != null) total += input.commissionCents;
  if (input.feesCents != null) total += input.feesCents;
  return total;
}

function derivePaymentStatus(row: {
  status: PaymentRow["status"];
  dueAt: Date | null;
  paidAt: Date | null;
}): PaymentRow["status"] {
  if (row.status === "paid" || row.status === "cancelled" || row.status === "disputed") {
    return row.status;
  }
  if (
    (row.status === "pending" || row.status === "partially_paid" || row.status === "overdue") &&
    row.dueAt &&
    !row.paidAt &&
    row.dueAt.getTime() < Date.now()
  ) {
    return "overdue";
  }
  return row.status;
}

function serializeParticipation(row: ParticipationRow) {
  return {
    id: row.id,
    auctionId: row.auctionId,
    lotId: row.lotId,
    participantMembershipId: row.participantMembershipId,
    status: row.status,
    registrationStatus: row.registrationStatus,
    qualificationStatus: row.qualificationStatus,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeAward(row: AwardRow) {
  return {
    id: row.id,
    auctionId: row.auctionId,
    lotId: row.lotId,
    participationId: row.participationId,
    resultId: row.resultId,
    awardStatus: row.awardStatus,
    winningBidCents: row.winningBidCents,
    commissionBasisPoints: row.commissionBasisPoints,
    commissionBaseAmountCents: row.commissionBaseAmountCents,
    calculatedCommissionCents: row.calculatedCommissionCents,
    actualCommissionCents: row.actualCommissionCents,
    commissionCents: row.commissionCents,
    feesCents: row.feesCents,
    totalKnownCostCents: row.totalKnownCostCents,
    currency: row.currency,
    awardedAt: iso(row.awardedAt),
    verificationStatus: row.verificationStatus,
    source: row.source,
    commissionSource: row.commissionSource,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializePayment(row: PaymentRow) {
  const status = derivePaymentStatus(row);
  return {
    id: row.id,
    awardId: row.awardId,
    paymentType: row.paymentType,
    amountCents: row.amountCents,
    currency: row.currency,
    dueAt: iso(row.dueAt),
    paidAt: iso(row.paidAt),
    status,
    paymentReference: row.paymentReference,
    evidenceDocumentId: row.evidenceDocumentId,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/* ─── Participações ─── */

export async function createParticipation(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    auctionId: string;
    lotId?: string;
    participantMembershipId?: string;
    status: ParticipationRow["status"];
    registrationStatus: ParticipationRow["registrationStatus"];
    qualificationStatus: ParticipationRow["qualificationStatus"];
    notes?: string;
  },
  meta: RequestMeta,
) {
  const actor = requirePostManage(account, organizationId);
  await requireVisibleAuction(db, organizationId, input.auctionId);
  if (input.lotId) await requireVisibleLot(db, organizationId, input.lotId);

  const [row] = await db
    .insert(auctionParticipations)
    .values({
      organizationId,
      auctionId: input.auctionId,
      lotId: input.lotId ?? null,
      participantMembershipId: input.participantMembershipId ?? actor.membershipId,
      status: input.status,
      registrationStatus: input.registrationStatus,
      qualificationStatus: input.qualificationStatus,
      notes: input.notes ?? null,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a participação.");

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "auction_participation.created",
    resourceType: "auction_participation",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { status: row.status },
  });
  return { participation: serializeParticipation(row) };
}

export async function listParticipations(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { auctionId?: string; lotId?: string; status?: string; limit: number; offset: number },
) {
  requirePostRead(account, organizationId);
  const conditions: SQL[] = [eq(auctionParticipations.organizationId, organizationId)];
  if (query.auctionId) conditions.push(eq(auctionParticipations.auctionId, query.auctionId));
  if (query.lotId) conditions.push(eq(auctionParticipations.lotId, query.lotId));
  if (query.status) {
    conditions.push(eq(auctionParticipations.status, query.status as ParticipationRow["status"]));
  }
  const rows = await db.query.auctionParticipations.findMany({
    where: and(...conditions),
    orderBy: [desc(auctionParticipations.createdAt)],
    limit: query.limit,
    offset: query.offset,
  });
  return { items: rows.map(serializeParticipation), limit: query.limit, offset: query.offset };
}

export async function getParticipation(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  participationId: string,
) {
  requirePostRead(account, organizationId);
  const row = await requireParticipation(db, organizationId, participationId);
  return { participation: serializeParticipation(row) };
}

export async function updateParticipation(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  participationId: string,
  input: {
    status?: ParticipationRow["status"];
    registrationStatus?: ParticipationRow["registrationStatus"];
    qualificationStatus?: ParticipationRow["qualificationStatus"];
    notes?: string | null;
  },
  meta: RequestMeta,
) {
  requirePostManage(account, organizationId);
  await requireParticipation(db, organizationId, participationId);
  const [row] = await db
    .update(auctionParticipations)
    .set({
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.registrationStatus !== undefined
        ? { registrationStatus: input.registrationStatus }
        : {}),
      ...(input.qualificationStatus !== undefined
        ? { qualificationStatus: input.qualificationStatus }
        : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(auctionParticipations.id, participationId),
        eq(auctionParticipations.organizationId, organizationId),
      ),
    )
    .returning();
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos esta participação no seu acesso.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "auction_participation.updated",
    resourceType: "auction_participation",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { status: row.status },
  });
  return { participation: serializeParticipation(row) };
}

/* ─── Lances manuais (nunca provider live) ─── */

export async function createBidRecord(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    participationId: string;
    amountCents: number;
    currency: string;
    recordedAt?: string;
    source: string;
    providerReference?: string;
    notes?: string;
  },
  meta: RequestMeta,
) {
  const actor = requirePostManage(account, organizationId);
  if (input.source === "provider") {
    throw new AppError(
      "AUCTION_BID_PROVIDER_NOT_CONFIGURED",
      "Lance ao vivo via provedor não está configurado. Registre apenas lances manuais ou externos.",
    );
  }
  if (!MANUAL_BID_SOURCES.has(input.source)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Fonte de lance inválida. Use manual, external ou import.",
    );
  }
  if (!Number.isInteger(input.amountCents) || input.amountCents < 0) {
    throw new AppError("VALIDATION_ERROR", "amountCents deve ser inteiro não negativo.");
  }

  const participation = await requireParticipation(db, organizationId, input.participationId);
  const [row] = await db
    .insert(auctionBidRecords)
    .values({
      organizationId,
      participationId: participation.id,
      amountCents: input.amountCents,
      currency: input.currency,
      recordedAt: input.recordedAt ? new Date(input.recordedAt) : new Date(),
      source: input.source as typeof auctionBidRecords.$inferInsert.source,
      providerReference: input.providerReference ?? null,
      notes: input.notes ?? null,
      recordedByMembershipId: actor.membershipId,
      status: "recorded",
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar o lance.");

  await db
    .update(auctionParticipations)
    .set({ status: "bid_placed_manually", updatedAt: new Date() })
    .where(eq(auctionParticipations.id, participation.id));

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "auction_bid_record.created",
    resourceType: "auction_bid_record",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { amountCents: row.amountCents, source: row.source },
  });

  return {
    bid: {
      id: row.id,
      participationId: row.participationId,
      amountCents: row.amountCents,
      currency: row.currency,
      recordedAt: row.recordedAt.toISOString(),
      source: row.source,
      status: row.status,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
    },
  };
}

export async function listBidRecords(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { participationId?: string; limit: number; offset: number },
) {
  requirePostRead(account, organizationId);
  const conditions: SQL[] = [eq(auctionBidRecords.organizationId, organizationId)];
  if (query.participationId) {
    conditions.push(eq(auctionBidRecords.participationId, query.participationId));
  }
  const rows = await db.query.auctionBidRecords.findMany({
    where: and(...conditions),
    orderBy: [desc(auctionBidRecords.recordedAt)],
    limit: query.limit,
    offset: query.offset,
  });
  return {
    items: rows.map((row) => ({
      id: row.id,
      participationId: row.participationId,
      amountCents: row.amountCents,
      currency: row.currency,
      recordedAt: row.recordedAt.toISOString(),
      source: row.source,
      status: row.status,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
    })),
    limit: query.limit,
    offset: query.offset,
  };
}

/** Stub explícito: nunca chama AuctionBidProvider para lance ao vivo. */
export async function placeLiveBidNotConfigured(
  _db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  requirePostManage(account, organizationId);
  throw new AppError(
    "AUCTION_BID_PROVIDER_NOT_CONFIGURED",
    "Lance ao vivo via provedor não está configurado. Nenhum lance foi enviado a portal externo.",
  );
}

/* ─── Resultados ─── */

export async function createResult(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    auctionId: string;
    lotId: string;
    status: typeof auctionResults.$inferInsert.status;
    winningBidCents?: number;
    winnerReference?: string;
    resultDate?: string;
    source: typeof auctionResults.$inferInsert.source;
    sourceReference?: string;
    verificationStatus: typeof auctionResults.$inferInsert.verificationStatus;
    notes?: string;
  },
  meta: RequestMeta,
) {
  const actor = requirePostManage(account, organizationId);
  await requireVisibleAuction(db, organizationId, input.auctionId);
  const lot = await requireVisibleLot(db, organizationId, input.lotId);
  if (lot.auctionId !== input.auctionId) {
    throw new AppError("VALIDATION_ERROR", "O lote não pertence ao leilão informado.");
  }
  if (input.winningBidCents != null && !Number.isInteger(input.winningBidCents)) {
    throw new AppError("VALIDATION_ERROR", "winningBidCents deve ser inteiro.");
  }

  const [row] = await db
    .insert(auctionResults)
    .values({
      organizationId,
      auctionId: input.auctionId,
      lotId: input.lotId,
      status: input.status,
      winningBidCents: input.winningBidCents ?? null,
      winnerReference: input.winnerReference ?? null,
      resultDate: input.resultDate ? new Date(input.resultDate) : null,
      source: input.source,
      sourceReference: input.sourceReference ?? null,
      verificationStatus: input.verificationStatus,
      notes: input.notes ?? null,
      createdByMembershipId: actor.membershipId,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar o resultado.");

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "auction_result.created",
    resourceType: "auction_result",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return {
    result: {
      id: row.id,
      auctionId: row.auctionId,
      lotId: row.lotId,
      status: row.status,
      winningBidCents: row.winningBidCents,
      winnerReference: row.winnerReference,
      resultDate: iso(row.resultDate),
      source: row.source,
      verificationStatus: row.verificationStatus,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    },
  };
}

export async function listResults(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { auctionId?: string; lotId?: string; limit: number; offset: number },
) {
  requirePostRead(account, organizationId);
  const conditions: SQL[] = [eq(auctionResults.organizationId, organizationId)];
  if (query.auctionId) conditions.push(eq(auctionResults.auctionId, query.auctionId));
  if (query.lotId) conditions.push(eq(auctionResults.lotId, query.lotId));
  const rows = await db.query.auctionResults.findMany({
    where: and(...conditions),
    orderBy: [desc(auctionResults.createdAt)],
    limit: query.limit,
    offset: query.offset,
  });
  return {
    items: rows.map((row) => ({
      id: row.id,
      auctionId: row.auctionId,
      lotId: row.lotId,
      status: row.status,
      winningBidCents: row.winningBidCents,
      source: row.source,
      verificationStatus: row.verificationStatus,
      createdAt: row.createdAt.toISOString(),
    })),
    limit: query.limit,
    offset: query.offset,
  };
}

/* ─── Arrematações / comissão ─── */

function resolveCommissionFields(input: {
  winningBidCents: number;
  commissionBasisPoints?: number;
  commissionBaseAmountCents?: number;
  calculatedCommissionCents?: number;
  actualCommissionCents?: number;
  commissionCents?: number;
  feesCents?: number;
  totalKnownCostCents?: number;
}) {
  const base =
    input.commissionBaseAmountCents ??
    (input.commissionBasisPoints != null ? input.winningBidCents : undefined);
  let calculated = input.calculatedCommissionCents;
  if (calculated == null && base != null && input.commissionBasisPoints != null) {
    calculated = calculateCommissionCents(base, input.commissionBasisPoints);
  }
  const commission = input.commissionCents ?? input.actualCommissionCents ?? calculated ?? null;
  const computedTotal = computeTotalKnownCostCents({
    winningBidCents: input.winningBidCents,
    commissionCents: commission,
    feesCents: input.feesCents ?? null,
  });
  // Schema defaulta totalKnownCostCents=0; só respeita valor explícito > 0.
  const total =
    input.totalKnownCostCents != null && input.totalKnownCostCents > 0
      ? input.totalKnownCostCents
      : computedTotal;
  return {
    commissionBaseAmountCents: base ?? null,
    calculatedCommissionCents: calculated ?? null,
    commissionCents: commission,
    totalKnownCostCents: total,
  };
}

export async function createAward(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    auctionId: string;
    lotId: string;
    participationId?: string;
    resultId?: string;
    awardStatus: AwardRow["awardStatus"];
    winningBidCents: number;
    commissionBasisPoints?: number;
    commissionBaseAmountCents?: number;
    calculatedCommissionCents?: number;
    actualCommissionCents?: number;
    commissionCents?: number;
    feesCents?: number;
    totalKnownCostCents?: number;
    currency: string;
    awardedAt?: string;
    verificationStatus: AwardRow["verificationStatus"];
    source: AwardRow["source"];
    commissionSource?: string;
    notes?: string;
  },
  meta: RequestMeta,
) {
  const actor = requirePostManage(account, organizationId);
  await requireVisibleAuction(db, organizationId, input.auctionId);
  await requireVisibleLot(db, organizationId, input.lotId);
  if (input.participationId) {
    await requireParticipation(db, organizationId, input.participationId);
  }
  if (!Number.isInteger(input.winningBidCents) || input.winningBidCents < 0) {
    throw new AppError("VALIDATION_ERROR", "winningBidCents deve ser inteiro não negativo.");
  }

  const money = resolveCommissionFields(input);
  const [row] = await db
    .insert(auctionAwards)
    .values({
      organizationId,
      auctionId: input.auctionId,
      lotId: input.lotId,
      participationId: input.participationId ?? null,
      resultId: input.resultId ?? null,
      awardStatus: input.awardStatus,
      winningBidCents: input.winningBidCents,
      commissionBasisPoints: input.commissionBasisPoints ?? null,
      commissionBaseAmountCents: money.commissionBaseAmountCents,
      calculatedCommissionCents: money.calculatedCommissionCents,
      actualCommissionCents: input.actualCommissionCents ?? null,
      commissionCents: money.commissionCents,
      feesCents: input.feesCents ?? null,
      totalKnownCostCents: money.totalKnownCostCents,
      currency: input.currency,
      awardedAt: input.awardedAt ? new Date(input.awardedAt) : new Date(),
      verificationStatus: input.verificationStatus,
      source: input.source,
      commissionSource: input.commissionSource ?? null,
      notes: input.notes ?? null,
      createdByMembershipId: actor.membershipId,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a arrematação.");

  await db.insert(auctionRegularizationChecklists).values(
    DEFAULT_REGULARIZATION.map((item, index) => ({
      organizationId,
      awardId: row.id,
      itemKey: item.itemKey,
      label: item.label,
      category: item.category,
      status: "pending" as const,
      required: true,
      sortOrder: index,
    })),
  );

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "auction_award.created",
    resourceType: "auction_award",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: {
      winningBidCents: row.winningBidCents,
      calculatedCommissionCents: row.calculatedCommissionCents,
      totalKnownCostCents: row.totalKnownCostCents,
    },
  });
  return { award: serializeAward(row) };
}

export async function listAwards(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { auctionId?: string; lotId?: string; status?: string; limit: number; offset: number },
) {
  requirePostRead(account, organizationId);
  const conditions: SQL[] = [eq(auctionAwards.organizationId, organizationId)];
  if (query.auctionId) conditions.push(eq(auctionAwards.auctionId, query.auctionId));
  if (query.lotId) conditions.push(eq(auctionAwards.lotId, query.lotId));
  if (query.status) {
    conditions.push(eq(auctionAwards.awardStatus, query.status as AwardRow["awardStatus"]));
  }
  const rows = await db.query.auctionAwards.findMany({
    where: and(...conditions),
    orderBy: [desc(auctionAwards.createdAt)],
    limit: query.limit,
    offset: query.offset,
  });
  return { items: rows.map(serializeAward), limit: query.limit, offset: query.offset };
}

export async function getAward(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  awardId: string,
) {
  requirePostRead(account, organizationId);
  const row = await requireAward(db, organizationId, awardId);
  return { award: serializeAward(row) };
}

export async function updateAward(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  awardId: string,
  input: Partial<{
    participationId: string | null;
    resultId: string | null;
    awardStatus: AwardRow["awardStatus"];
    winningBidCents: number;
    commissionBasisPoints: number;
    commissionBaseAmountCents: number;
    calculatedCommissionCents: number;
    actualCommissionCents: number;
    commissionCents: number;
    feesCents: number;
    totalKnownCostCents: number;
    currency: string;
    awardedAt: string;
    verificationStatus: AwardRow["verificationStatus"];
    source: AwardRow["source"];
    commissionSource: string;
    notes: string | null;
  }>,
  meta: RequestMeta,
) {
  requirePostManage(account, organizationId);
  const existing = await requireAward(db, organizationId, awardId);
  const winningBidCents = input.winningBidCents ?? existing.winningBidCents;
  const money = resolveCommissionFields({
    winningBidCents,
    commissionBasisPoints:
      input.commissionBasisPoints ?? existing.commissionBasisPoints ?? undefined,
    commissionBaseAmountCents:
      input.commissionBaseAmountCents ?? existing.commissionBaseAmountCents ?? undefined,
    calculatedCommissionCents:
      input.calculatedCommissionCents ?? existing.calculatedCommissionCents ?? undefined,
    actualCommissionCents:
      input.actualCommissionCents ?? existing.actualCommissionCents ?? undefined,
    commissionCents: input.commissionCents ?? existing.commissionCents ?? undefined,
    feesCents: input.feesCents ?? existing.feesCents ?? undefined,
    totalKnownCostCents: input.totalKnownCostCents,
  });
  const [row] = await db
    .update(auctionAwards)
    .set({
      ...(input.awardStatus !== undefined ? { awardStatus: input.awardStatus } : {}),
      winningBidCents,
      commissionBasisPoints:
        input.commissionBasisPoints !== undefined
          ? input.commissionBasisPoints
          : existing.commissionBasisPoints,
      commissionBaseAmountCents: money.commissionBaseAmountCents,
      calculatedCommissionCents: money.calculatedCommissionCents,
      actualCommissionCents:
        input.actualCommissionCents !== undefined
          ? input.actualCommissionCents
          : existing.actualCommissionCents,
      commissionCents: money.commissionCents,
      feesCents: input.feesCents !== undefined ? input.feesCents : existing.feesCents,
      totalKnownCostCents: money.totalKnownCostCents,
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(auctionAwards.id, awardId), eq(auctionAwards.organizationId, organizationId)))
    .returning();
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos esta arrematação no seu acesso.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "auction_award.updated",
    resourceType: "auction_award",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return { award: serializeAward(row) };
}

/* ─── Pagamentos ─── */

export async function createPayment(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  awardId: string,
  input: {
    paymentType: PaymentRow["paymentType"];
    amountCents: number;
    currency: string;
    dueAt?: string;
    paidAt?: string;
    status: PaymentRow["status"];
    paymentReference?: string;
    evidenceDocumentId?: string;
    notes?: string;
  },
  meta: RequestMeta,
) {
  const actor = authorize(account, organizationId, (access) =>
    policyAuctionPayment(access, "auction_payment.manage"),
  );
  await requireAward(db, organizationId, awardId);
  if (!Number.isInteger(input.amountCents) || input.amountCents < 0) {
    throw new AppError("VALIDATION_ERROR", "amountCents deve ser inteiro não negativo.");
  }
  if (input.evidenceDocumentId) {
    const doc = await requireDocumentInOrg(db, organizationId, input.evidenceDocumentId);
    await assertCanReadDocument(db, account, organizationId, doc);
  }

  const draft = {
    status: input.status,
    dueAt: input.dueAt ? new Date(input.dueAt) : null,
    paidAt: input.paidAt ? new Date(input.paidAt) : null,
  };
  const status = derivePaymentStatus(draft);

  const [row] = await db
    .insert(auctionPayments)
    .values({
      organizationId,
      awardId,
      paymentType: input.paymentType,
      amountCents: input.amountCents,
      currency: input.currency,
      dueAt: draft.dueAt,
      paidAt: draft.paidAt,
      status,
      paymentReference: input.paymentReference ?? null,
      evidenceDocumentId: input.evidenceDocumentId ?? null,
      notes: input.notes ?? null,
      createdByMembershipId: actor.membershipId,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar o pagamento.");

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "auction_payment.created",
    resourceType: "auction_payment",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { amountCents: row.amountCents, status: row.status },
  });
  return { payment: serializePayment(row) };
}

export async function listPayments(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  awardId: string,
) {
  authorize(account, organizationId, (access) => policyAuctionPayment(access, "auction_post.read"));
  await requireAward(db, organizationId, awardId);
  const rows = await db.query.auctionPayments.findMany({
    where: and(
      eq(auctionPayments.awardId, awardId),
      eq(auctionPayments.organizationId, organizationId),
    ),
    orderBy: [asc(auctionPayments.createdAt)],
  });
  return { items: rows.map(serializePayment) };
}

export async function updatePayment(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  awardId: string,
  paymentId: string,
  input: Partial<{
    paymentType: PaymentRow["paymentType"];
    amountCents: number;
    currency: string;
    dueAt: string | null;
    paidAt: string | null;
    status: PaymentRow["status"];
    paymentReference: string | null;
    evidenceDocumentId: string | null;
    notes: string | null;
  }>,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyAuctionPayment(access, "auction_payment.manage"),
  );
  await requireAward(db, organizationId, awardId);
  const existing = await db.query.auctionPayments.findFirst({
    where: and(
      eq(auctionPayments.id, paymentId),
      eq(auctionPayments.awardId, awardId),
      eq(auctionPayments.organizationId, organizationId),
    ),
  });
  if (!existing) throw new AppError("NOT_FOUND", "Não encontramos este pagamento no seu acesso.");

  const dueAt =
    input.dueAt === undefined ? existing.dueAt : input.dueAt ? new Date(input.dueAt) : null;
  const paidAt =
    input.paidAt === undefined ? existing.paidAt : input.paidAt ? new Date(input.paidAt) : null;
  const status = derivePaymentStatus({
    status: input.status ?? existing.status,
    dueAt,
    paidAt,
  });

  const [row] = await db
    .update(auctionPayments)
    .set({
      ...(input.paymentType !== undefined ? { paymentType: input.paymentType } : {}),
      ...(input.amountCents !== undefined ? { amountCents: input.amountCents } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
      dueAt,
      paidAt,
      status,
      ...(input.paymentReference !== undefined ? { paymentReference: input.paymentReference } : {}),
      ...(input.evidenceDocumentId !== undefined
        ? { evidenceDocumentId: input.evidenceDocumentId }
        : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      updatedAt: new Date(),
    })
    .where(eq(auctionPayments.id, paymentId))
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível atualizar o pagamento.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "auction_payment.updated",
    resourceType: "auction_payment",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return { payment: serializePayment(row) };
}

/* ─── Entrega / posse ─── */

export async function createDelivery(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  awardId: string,
  input: {
    deliveryType: typeof auctionDeliveryProcesses.$inferInsert.deliveryType;
    status: typeof auctionDeliveryProcesses.$inferInsert.status;
    possessionStatus: typeof auctionDeliveryProcesses.$inferInsert.possessionStatus;
    scheduledAt?: string;
    completedAt?: string;
    location?: string;
    responsibleMembershipId?: string;
    evidenceDocumentId?: string;
    notes?: string;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyAuctionDelivery(access, "auction_delivery.manage"),
  );
  await requireAward(db, organizationId, awardId);
  const [row] = await db
    .insert(auctionDeliveryProcesses)
    .values({
      organizationId,
      awardId,
      deliveryType: input.deliveryType,
      status: input.status,
      possessionStatus: input.possessionStatus,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      completedAt: input.completedAt ? new Date(input.completedAt) : null,
      location: input.location ?? null,
      responsibleMembershipId: input.responsibleMembershipId ?? null,
      evidenceDocumentId: input.evidenceDocumentId ?? null,
      notes: input.notes ?? null,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o processo de entrega.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "auction_delivery.created",
    resourceType: "auction_delivery_process",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return {
    delivery: {
      id: row.id,
      awardId: row.awardId,
      deliveryType: row.deliveryType,
      status: row.status,
      possessionStatus: row.possessionStatus,
      scheduledAt: iso(row.scheduledAt),
      completedAt: iso(row.completedAt),
      location: row.location,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    },
  };
}

export async function listDeliveries(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  awardId: string,
) {
  authorize(account, organizationId, (access) =>
    policyAuctionDelivery(access, "auction_post.read"),
  );
  await requireAward(db, organizationId, awardId);
  const rows = await db.query.auctionDeliveryProcesses.findMany({
    where: and(
      eq(auctionDeliveryProcesses.awardId, awardId),
      eq(auctionDeliveryProcesses.organizationId, organizationId),
    ),
    orderBy: [asc(auctionDeliveryProcesses.createdAt)],
  });
  return {
    items: rows.map((row) => ({
      id: row.id,
      awardId: row.awardId,
      deliveryType: row.deliveryType,
      status: row.status,
      possessionStatus: row.possessionStatus,
      scheduledAt: iso(row.scheduledAt),
      completedAt: iso(row.completedAt),
      location: row.location,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
  };
}

export async function updateDelivery(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  awardId: string,
  deliveryId: string,
  input: Partial<{
    deliveryType: typeof auctionDeliveryProcesses.$inferInsert.deliveryType;
    status: typeof auctionDeliveryProcesses.$inferInsert.status;
    possessionStatus: typeof auctionDeliveryProcesses.$inferInsert.possessionStatus;
    scheduledAt: string | null;
    completedAt: string | null;
    location: string | null;
    responsibleMembershipId: string | null;
    evidenceDocumentId: string | null;
    notes: string | null;
  }>,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyAuctionDelivery(access, "auction_delivery.manage"),
  );
  await requireAward(db, organizationId, awardId);
  const [row] = await db
    .update(auctionDeliveryProcesses)
    .set({
      ...(input.deliveryType !== undefined ? { deliveryType: input.deliveryType } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.possessionStatus !== undefined ? { possessionStatus: input.possessionStatus } : {}),
      ...(input.scheduledAt !== undefined
        ? { scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null }
        : {}),
      ...(input.completedAt !== undefined
        ? { completedAt: input.completedAt ? new Date(input.completedAt) : null }
        : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(auctionDeliveryProcesses.id, deliveryId),
        eq(auctionDeliveryProcesses.awardId, awardId),
        eq(auctionDeliveryProcesses.organizationId, organizationId),
      ),
    )
    .returning();
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos este processo de entrega.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "auction_delivery.updated",
    resourceType: "auction_delivery_process",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return {
    delivery: {
      id: row.id,
      awardId: row.awardId,
      deliveryType: row.deliveryType,
      status: row.status,
      possessionStatus: row.possessionStatus,
      scheduledAt: iso(row.scheduledAt),
      completedAt: iso(row.completedAt),
      location: row.location,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    },
  };
}

/* ─── Transferência ─── */

export async function createTransfer(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  awardId: string,
  input: {
    transferType: typeof auctionTransferProcesses.$inferInsert.transferType;
    status: typeof auctionTransferProcesses.$inferInsert.status;
    startedAt?: string;
    completedAt?: string;
    authority?: string;
    protocol?: string;
    evidenceDocumentId?: string;
    notes?: string;
  },
  meta: RequestMeta,
) {
  const actor = authorize(account, organizationId, (access) =>
    policyAuctionTransfer(access, "auction_transfer.manage"),
  );
  await requireAward(db, organizationId, awardId);
  const [row] = await db
    .insert(auctionTransferProcesses)
    .values({
      organizationId,
      awardId,
      transferType: input.transferType,
      status: input.status,
      startedAt: input.startedAt ? new Date(input.startedAt) : null,
      completedAt: input.completedAt ? new Date(input.completedAt) : null,
      authority: input.authority ?? null,
      protocol: input.protocol ?? null,
      evidenceDocumentId: input.evidenceDocumentId ?? null,
      notes: input.notes ?? null,
      createdByMembershipId: actor.membershipId,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a transferência.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "auction_transfer.created",
    resourceType: "auction_transfer_process",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return {
    transfer: {
      id: row.id,
      awardId: row.awardId,
      transferType: row.transferType,
      status: row.status,
      startedAt: iso(row.startedAt),
      completedAt: iso(row.completedAt),
      authority: row.authority,
      protocol: row.protocol,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    },
  };
}

export async function listTransfers(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  awardId: string,
) {
  authorize(account, organizationId, (access) =>
    policyAuctionTransfer(access, "auction_post.read"),
  );
  await requireAward(db, organizationId, awardId);
  const rows = await db.query.auctionTransferProcesses.findMany({
    where: and(
      eq(auctionTransferProcesses.awardId, awardId),
      eq(auctionTransferProcesses.organizationId, organizationId),
    ),
    orderBy: [asc(auctionTransferProcesses.createdAt)],
  });
  return {
    items: rows.map((row) => ({
      id: row.id,
      awardId: row.awardId,
      transferType: row.transferType,
      status: row.status,
      startedAt: iso(row.startedAt),
      completedAt: iso(row.completedAt),
      authority: row.authority,
      protocol: row.protocol,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
  };
}

/* ─── Eventos (cancel/reverse/annul/dispute) ─── */

const EVENT_STATUS_MAP: Partial<
  Record<typeof auctionAwardEvents.$inferInsert.eventType, AwardRow["awardStatus"]>
> = {
  cancelled: "cancelled",
  reversed: "reversed",
  annulled: "cancelled",
  disputed: "disputed",
};

export async function createAwardEvent(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  awardId: string,
  input: {
    eventType: typeof auctionAwardEvents.$inferInsert.eventType;
    reason?: string;
    source: string;
    relatedDocumentId?: string;
    metadata?: Record<string, unknown>;
  },
  meta: RequestMeta,
) {
  const actor = requirePostManage(account, organizationId);
  const award = await requireAward(db, organizationId, awardId);
  const [event] = await db
    .insert(auctionAwardEvents)
    .values({
      organizationId,
      awardId,
      eventType: input.eventType,
      reason: input.reason ?? null,
      source: input.source,
      actorMembershipId: actor.membershipId,
      relatedDocumentId: input.relatedDocumentId ?? null,
      metadata: input.metadata ?? null,
    })
    .returning();
  if (!event) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar o evento.");

  const nextStatus = EVENT_STATUS_MAP[input.eventType];
  if (nextStatus) {
    await db
      .update(auctionAwards)
      .set({ awardStatus: nextStatus, updatedAt: new Date() })
      .where(eq(auctionAwards.id, award.id));
  }

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "auction_award_event.created",
    resourceType: "auction_award_event",
    resourceId: event.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { eventType: event.eventType },
  });
  return {
    event: {
      id: event.id,
      awardId: event.awardId,
      eventType: event.eventType,
      reason: event.reason,
      source: event.source,
      createdAt: event.createdAt.toISOString(),
    },
  };
}

export async function listAwardEvents(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  awardId: string,
) {
  requirePostRead(account, organizationId);
  await requireAward(db, organizationId, awardId);
  const rows = await db.query.auctionAwardEvents.findMany({
    where: and(
      eq(auctionAwardEvents.awardId, awardId),
      eq(auctionAwardEvents.organizationId, organizationId),
    ),
    orderBy: [desc(auctionAwardEvents.createdAt)],
  });
  return {
    items: rows.map((row) => ({
      id: row.id,
      awardId: row.awardId,
      eventType: row.eventType,
      reason: row.reason,
      source: row.source,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

/* ─── Regularização ─── */

export async function listRegularization(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  awardId: string,
) {
  requirePostRead(account, organizationId);
  await requireAward(db, organizationId, awardId);
  const rows = await db.query.auctionRegularizationChecklists.findMany({
    where: and(
      eq(auctionRegularizationChecklists.awardId, awardId),
      eq(auctionRegularizationChecklists.organizationId, organizationId),
    ),
    orderBy: [asc(auctionRegularizationChecklists.sortOrder)],
  });
  return {
    items: rows.map((row) => ({
      id: row.id,
      itemKey: row.itemKey,
      label: row.label,
      category: row.category,
      status: row.status,
      required: row.required,
      notes: row.notes,
      sortOrder: row.sortOrder,
      completedAt: iso(row.completedAt),
      evidenceDocumentId: row.evidenceDocumentId,
    })),
  };
}

export async function upsertRegularizationItem(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  awardId: string,
  input: {
    itemKey: string;
    label: string;
    category?: string;
    status: typeof auctionRegularizationChecklists.$inferInsert.status;
    required: boolean;
    notes?: string;
    sortOrder: number;
    evidenceDocumentId?: string;
  },
  meta: RequestMeta,
) {
  const actor = requirePostManage(account, organizationId);
  await requireAward(db, organizationId, awardId);
  const existing = await db.query.auctionRegularizationChecklists.findFirst({
    where: and(
      eq(auctionRegularizationChecklists.awardId, awardId),
      eq(auctionRegularizationChecklists.itemKey, input.itemKey),
      eq(auctionRegularizationChecklists.organizationId, organizationId),
    ),
  });
  const done = input.status === "done";
  if (existing) {
    const [row] = await db
      .update(auctionRegularizationChecklists)
      .set({
        label: input.label,
        category: input.category ?? existing.category,
        status: input.status,
        required: input.required,
        notes: input.notes ?? existing.notes,
        sortOrder: input.sortOrder,
        evidenceDocumentId: input.evidenceDocumentId ?? existing.evidenceDocumentId,
        completedAt: done ? new Date() : null,
        completedByMembershipId: done ? actor.membershipId : null,
        updatedAt: new Date(),
      })
      .where(eq(auctionRegularizationChecklists.id, existing.id))
      .returning();
    return { item: row };
  }
  const [row] = await db
    .insert(auctionRegularizationChecklists)
    .values({
      organizationId,
      awardId,
      itemKey: input.itemKey,
      label: input.label,
      category: input.category ?? null,
      status: input.status,
      required: input.required,
      notes: input.notes ?? null,
      sortOrder: input.sortOrder,
      evidenceDocumentId: input.evidenceDocumentId ?? null,
      completedAt: done ? new Date() : null,
      completedByMembershipId: done ? actor.membershipId : null,
    })
    .returning();
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "auction_regularization.upserted",
    resourceType: "auction_regularization_item",
    resourceId: row?.id ?? null,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return { item: row };
}

/* ─── Documentos ─── */

export async function linkAwardDocument(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  awardId: string,
  input: { documentId: string; linkType: string },
  meta: RequestMeta,
) {
  requirePostManage(account, organizationId);
  await requireAward(db, organizationId, awardId);
  if (!(AUCTION_POST_LINK_TYPES as readonly string[]).includes(input.linkType)) {
    throw new AppError("VALIDATION_ERROR", "Tipo de vínculo documental inválido para pós-leilão.");
  }
  const doc = await requireDocumentInOrg(db, organizationId, input.documentId);
  await assertCanReadDocument(db, account, organizationId, doc);

  const existing = await db.query.documentLinks.findFirst({
    where: and(
      eq(documentLinks.organizationId, organizationId),
      eq(documentLinks.documentId, doc.id),
      eq(documentLinks.targetType, LINK_TARGET_AWARD),
      eq(documentLinks.targetId, awardId),
      eq(documentLinks.linkType, input.linkType),
    ),
  });
  if (existing) {
    return {
      link: {
        id: existing.id,
        documentId: existing.documentId,
        linkType: existing.linkType,
        targetType: existing.targetType,
        targetId: existing.targetId,
      },
      replayed: true,
    };
  }

  const [link] = await db
    .insert(documentLinks)
    .values({
      organizationId,
      documentId: doc.id,
      targetType: LINK_TARGET_AWARD,
      targetId: awardId,
      linkType: input.linkType,
    })
    .returning();
  if (!link) throw new AppError("INTERNAL_ERROR", "Não foi possível vincular o documento.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "auction_award.document_linked",
    resourceType: "document_link",
    resourceId: link.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return {
    link: {
      id: link.id,
      documentId: link.documentId,
      linkType: link.linkType,
      targetType: link.targetType,
      targetId: link.targetId,
    },
    replayed: false,
  };
}

export async function listAwardDocuments(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  awardId: string,
) {
  requirePostRead(account, organizationId);
  await requireAward(db, organizationId, awardId);
  const rows = await db
    .select({ link: documentLinks, doc: documents })
    .from(documentLinks)
    .innerJoin(documents, eq(documents.id, documentLinks.documentId))
    .where(
      and(
        eq(documentLinks.organizationId, organizationId),
        eq(documentLinks.targetType, LINK_TARGET_AWARD),
        eq(documentLinks.targetId, awardId),
      ),
    )
    .orderBy(desc(documentLinks.createdAt));
  return {
    items: rows.map(({ link, doc }) => ({
      id: link.id,
      linkType: link.linkType,
      documentId: doc.id,
      title: doc.title,
      createdAt: link.createdAt.toISOString(),
    })),
  };
}

/* ─── Timeline ─── */

export async function getAwardTimeline(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  awardId: string,
) {
  requirePostRead(account, organizationId);
  const award = await requireAward(db, organizationId, awardId);
  const [payments, deliveries, transfers, events, docs] = await Promise.all([
    db.query.auctionPayments.findMany({
      where: and(
        eq(auctionPayments.awardId, awardId),
        eq(auctionPayments.organizationId, organizationId),
      ),
    }),
    db.query.auctionDeliveryProcesses.findMany({
      where: and(
        eq(auctionDeliveryProcesses.awardId, awardId),
        eq(auctionDeliveryProcesses.organizationId, organizationId),
      ),
    }),
    db.query.auctionTransferProcesses.findMany({
      where: and(
        eq(auctionTransferProcesses.awardId, awardId),
        eq(auctionTransferProcesses.organizationId, organizationId),
      ),
    }),
    db.query.auctionAwardEvents.findMany({
      where: and(
        eq(auctionAwardEvents.awardId, awardId),
        eq(auctionAwardEvents.organizationId, organizationId),
      ),
    }),
    listAwardDocuments(db, account, organizationId, awardId),
  ]);

  type TimelineItem = { at: string; kind: string; title: string; resourceId: string };
  const items: TimelineItem[] = [
    {
      at: award.createdAt.toISOString(),
      kind: "award",
      title: "Arrematação registrada",
      resourceId: award.id,
    },
  ];
  for (const payment of payments) {
    items.push({
      at: payment.createdAt.toISOString(),
      kind: "payment",
      title: `Pagamento ${payment.paymentType} (${payment.amountCents} centavos)`,
      resourceId: payment.id,
    });
  }
  for (const delivery of deliveries) {
    items.push({
      at: delivery.createdAt.toISOString(),
      kind: "delivery",
      title: `Entrega/posse: ${delivery.deliveryType}`,
      resourceId: delivery.id,
    });
  }
  for (const transfer of transfers) {
    items.push({
      at: transfer.createdAt.toISOString(),
      kind: "transfer",
      title: `Transferência: ${transfer.transferType}`,
      resourceId: transfer.id,
    });
  }
  for (const event of events) {
    items.push({
      at: event.createdAt.toISOString(),
      kind: "event",
      title: `Evento: ${event.eventType}`,
      resourceId: event.id,
    });
  }
  for (const doc of docs.items) {
    items.push({
      at: doc.createdAt,
      kind: "document",
      title: `Documento: ${doc.linkType}`,
      resourceId: doc.id,
    });
  }
  items.sort((a, b) => a.at.localeCompare(b.at));
  return { timeline: items, items };
}

/* ─── Sugestões humanas de Task / Deadline ─── */

const SUGGESTED_TASKS = [
  { key: "pay_bid", title: "Pagar lance" },
  { key: "pay_commission", title: "Pagar comissão" },
  { key: "request_document", title: "Solicitar documento" },
  { key: "obtain_letter", title: "Obter carta de arrematação" },
  { key: "pickup_asset", title: "Retirar bem" },
  { key: "register_property", title: "Registrar imóvel" },
  { key: "transfer_vehicle", title: "Transferir veículo" },
  { key: "regularize_asset", title: "Regularizar ativo" },
] as const;

export async function suggestAwardTasks(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  awardId: string,
  input: { keys?: string[] },
  meta: RequestMeta,
) {
  requirePostManage(account, organizationId);
  await requireAward(db, organizationId, awardId);
  const selected = SUGGESTED_TASKS.filter((task) => !input.keys || input.keys.includes(task.key));
  const created = [];
  for (const task of selected) {
    const result = await createTask(
      db,
      account,
      organizationId,
      {
        title: `${task.title} (arrematação)`,
        description: `Sugestão pós-leilão para award ${awardId}. Confirme antes de executar.`,
        status: "todo",
        priority: "normal",
      },
      meta,
    );
    created.push(result);
  }
  return {
    tasks: created,
    note: "Sugestões criadas sob demanda humana — sem automação de workflow.",
  };
}

export async function suggestAwardDeadlines(
  deps: AuctionPostDeps,
  account: SessionAccount,
  organizationId: string,
  awardId: string,
  input: { baseDate: string; titles?: string[] },
  meta: RequestMeta,
) {
  requirePostManage(account, organizationId);
  await requireAward(deps.db, organizationId, awardId);
  if (!deps.notifications || !deps.holidays) {
    throw new AppError(
      "INTERNAL_ERROR",
      "Dependências de prazo (notifications/holidays) não disponíveis.",
    );
  }
  const titles = input.titles?.length
    ? input.titles
    : ["Pagamento do lance", "Comissão", "Retirada", "Registro"];
  const created = [];
  for (const title of titles) {
    const result = await createDeadline(
      deps.db,
      account,
      organizationId,
      {
        title: `${title} (pós-leilão)`,
        baseDate: input.baseDate,
        baseDateLabel: "Data sugerida — confirmar humanamente",
        ruleType: "manual_date",
        manualDueAt: input.baseDate,
        sourceType: "other",
        sourceId: awardId,
        status: "suggested",
        calculate: false,
      },
      { notifications: deps.notifications, holidays: deps.holidays },
      meta,
    );
    created.push(result);
  }
  return {
    deadlines: created,
    note: "Prazos SUGGESTED até confirmação humana.",
  };
}
