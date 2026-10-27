import { CSRF_HEADER } from "@verasjuris/security/constants";
import type { AiApiFailure } from "./ai";
import { aiErrorMessage, formatDateTime, hasPermission, isApiFailure, isNotConfigured } from "./ai";
import { getActiveMembership, getActiveOrgId } from "./crm";
import { formatMoneyCents, parseMoneyToCents } from "./auctions";

export {
  getActiveMembership,
  getActiveOrgId,
  isApiFailure,
  aiErrorMessage,
  formatDateTime,
  isNotConfigured,
  formatMoneyCents,
  parseMoneyToCents,
};

/**
 * Pós-leilão — /api/v1/organizations/:orgId
 *  auction-participations | auction-bids | auction-results | auction-awards/...
 */

export type AuctionParticipation = {
  id: string;
  auctionId: string;
  lotId?: string | null;
  status: string;
  registrationStatus?: string;
  qualificationStatus?: string;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type AuctionBidRecord = {
  id: string;
  participationId: string;
  amountCents: number;
  currency?: string;
  recordedAt?: string | null;
  source: string;
  status?: string;
  providerReference?: string | null;
  notes?: string | null;
  createdAt?: string;
};

export type AuctionResult = {
  id: string;
  auctionId: string;
  lotId: string;
  status: string;
  winningBidCents?: number | null;
  winnerReference?: string | null;
  resultDate?: string | null;
  source: string;
  verificationStatus?: string;
  notes?: string | null;
  createdAt?: string;
};

export type AuctionAward = {
  id: string;
  auctionId: string;
  lotId: string;
  participationId?: string | null;
  resultId?: string | null;
  awardStatus: string;
  winningBidCents?: number;
  commissionCents?: number | null;
  feesCents?: number | null;
  totalKnownCostCents?: number;
  currency?: string;
  awardedAt?: string | null;
  verificationStatus?: string;
  source?: string;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type AuctionPayment = {
  id: string;
  awardId: string;
  paymentType: string;
  amountCents: number;
  currency?: string;
  dueAt?: string | null;
  paidAt?: string | null;
  status: string;
  paymentReference?: string | null;
  evidenceDocumentId?: string | null;
  notes?: string | null;
};

export type AuctionDelivery = {
  id: string;
  awardId: string;
  deliveryType: string;
  status: string;
  possessionStatus?: string;
  scheduledAt?: string | null;
  completedAt?: string | null;
  location?: string | null;
  notes?: string | null;
};

export type AuctionTransfer = {
  id: string;
  awardId: string;
  transferType: string;
  status: string;
  startedAt?: string | null;
  completedAt?: string | null;
  authority?: string | null;
  protocol?: string | null;
  notes?: string | null;
};

export type AuctionAwardEvent = {
  id: string;
  awardId: string;
  eventType: string;
  reason?: string | null;
  source?: string;
  relatedDocumentId?: string | null;
  createdAt?: string;
};

export type AuctionRegularizationItem = {
  id?: string;
  awardId: string;
  itemKey: string;
  label: string;
  category?: string | null;
  status: string;
  required?: boolean;
  notes?: string | null;
  sortOrder?: number;
  evidenceDocumentId?: string | null;
};

export type AuctionAwardDocument = {
  id?: string;
  awardId?: string;
  documentId: string;
  linkType: string;
  createdAt?: string;
};

export type AuctionAwardTimelineItem = {
  id?: string;
  kind?: string;
  title?: string;
  body?: string | null;
  occurredAt?: string;
  [key: string]: unknown;
};

export const MANUAL_BID_DISCLAIMER =
  "Registro manual ou externo de lance. Não é lance eletrônico perante o leiloeiro ou plataforma.";

export const MANUAL_RESULT_DISCLAIMER =
  "Resultado informado manualmente. Verifique a fonte oficial antes de agir.";

export const AUCTION_PARTICIPATION_STATUS_LABELS: Record<string, string> = {
  interested: "Interessado",
  preparing: "Preparando",
  registered_manually: "Inscrito (manual)",
  qualified_manually: "Habilitado (manual)",
  participated: "Participou",
  no_bid: "Sem lance",
  bid_placed_manually: "Lance registrado (manual)",
  result_pending: "Resultado pendente",
  won: "Arrematou",
  lost: "Não arrematou",
  cancelled: "Cancelado",
};

export const AUCTION_RESULT_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  sold: "Vendido / arrematado",
  unsold: "Não vendido",
  cancelled: "Cancelado",
  suspended: "Suspenso",
  withdrawn: "Retirado",
  failed: "Falhou",
  other: "Outro",
};

export const AUCTION_AWARD_STATUS_LABELS: Record<string, string> = {
  pending_confirmation: "Aguardando confirmação",
  confirmed: "Confirmada",
  payment_pending: "Pagamento pendente",
  paid: "Pago",
  documentation_pending: "Documentação pendente",
  delivery_pending: "Entrega / posse pendente",
  registration_pending: "Registro pendente",
  completed: "Concluída",
  cancelled: "Cancelada",
  reversed: "Revertida",
  disputed: "Em disputa",
};

export const AUCTION_PAYMENT_TYPE_LABELS: Record<string, string> = {
  bid_price: "Valor do lance",
  auctioneer_commission: "Comissão do leiloeiro",
  court_fee: "Custas",
  tax: "Tributo",
  transfer_fee: "Taxa de transferência",
  other: "Outro",
};

export const AUCTION_PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  partially_paid: "Parcialmente pago",
  paid: "Pago",
  overdue: "Em atraso",
  cancelled: "Cancelado",
  disputed: "Em disputa",
};

export const AUCTION_DELIVERY_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  scheduled: "Agendada",
  in_progress: "Em andamento",
  completed: "Concluída",
  cancelled: "Cancelada",
  failed: "Falhou",
  not_required: "Não necessária",
};

export const AUCTION_POSSESSION_STATUS_LABELS: Record<string, string> = {
  not_required: "Não necessária",
  pending: "Pendente",
  requested: "Requerida",
  ordered: "Determinada",
  scheduled: "Agendada",
  completed: "Concluída",
  disputed: "Em disputa",
};

export const AUCTION_TRANSFER_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  submitted: "Protocolado",
  completed: "Concluído",
  blocked: "Bloqueado",
  cancelled: "Cancelado",
  not_required: "Não necessário",
};

export const AUCTION_REGULARIZATION_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  done: "Concluído",
  not_applicable: "Não se aplica",
  blocked: "Bloqueado",
};

export const LIVE_BID_NOT_CONFIGURED_MESSAGE =
  "Lance eletrônico não está disponível neste ambiente. Use o registro manual de lance.";

async function request<T>(path: string, init?: RequestInit): Promise<T | AiApiFailure> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        [CSRF_HEADER]: "1",
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch {
    return {
      error: {
        code: "NETWORK_ERROR",
        message: "Não foi possível falar com o serviço VerasJuris. Nenhuma alteração foi feita.",
      },
    };
  }
  const body = (await response.json().catch(() => ({}))) as T & AiApiFailure;
  if (!response.ok) {
    return {
      httpStatus: response.status,
      error: {
        code: body.error?.code ?? (response.status === 404 ? "NOT_FOUND" : "INTERNAL_ERROR"),
        message: body.error?.message ?? "Falha na requisição.",
        details: body.error?.details,
      },
    };
  }
  return body;
}

function orgPath(orgId: string, suffix: string): string {
  return `/api/v1/organizations/${orgId}${suffix}`;
}

function qs(query: Record<string, string | number | undefined | null>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function hasAuctionPostPermission(
  permissions: readonly string[] | undefined,
  action: "read" | "manage",
): boolean {
  return hasPermission(permissions, `auction_post.${action}`);
}

export function auctionPostErrorMessage(failure: AiApiFailure, fallback: string): string {
  const code = failure.error?.code ?? "";
  if (code === "NOT_CONFIGURED" || isNotConfigured(failure)) {
    return LIVE_BID_NOT_CONFIGURED_MESSAGE;
  }
  return aiErrorMessage(failure, fallback);
}

export async function fetchParticipations(
  orgId: string,
  query: {
    auctionId?: string;
    lotId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/auction-participations${qs({ ...query })}`),
  );
  if (isApiFailure(data)) return data;
  const items = (data.items ?? data.participations ?? []) as AuctionParticipation[];
  return { items };
}

export async function createParticipation(
  orgId: string,
  body: {
    auctionId: string;
    lotId?: string;
    participantMembershipId?: string;
    status?: string;
    registrationStatus?: string;
    qualificationStatus?: string;
    notes?: string;
  },
) {
  const data = await request<Record<string, unknown>>(orgPath(orgId, "/auction-participations"), {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (isApiFailure(data)) return data;
  return { participation: (data.participation ?? data) as AuctionParticipation };
}

export async function updateParticipation(
  orgId: string,
  participationId: string,
  body: {
    status?: string;
    registrationStatus?: string;
    qualificationStatus?: string;
    notes?: string | null;
  },
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/auction-participations/${participationId}`),
    { method: "PATCH", body: JSON.stringify(body) },
  );
  if (isApiFailure(data)) return data;
  return { participation: (data.participation ?? data) as AuctionParticipation };
}

export async function fetchBidRecords(
  orgId: string,
  query: {
    auctionId?: string;
    lotId?: string;
    participationId?: string;
    limit?: number;
    offset?: number;
  } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/auction-bids${qs({ ...query })}`),
  );
  if (isApiFailure(data)) return data;
  const items = (data.items ?? data.bids ?? []) as AuctionBidRecord[];
  return { items };
}

export async function createBidRecord(
  orgId: string,
  body: {
    participationId: string;
    amountCents: number;
    currency?: string;
    recordedAt?: string;
    source?: string;
    providerReference?: string;
    notes?: string;
  },
) {
  const data = await request<Record<string, unknown>>(orgPath(orgId, "/auction-bids"), {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (isApiFailure(data)) return data;
  return { bid: (data.bid ?? data.record ?? data) as AuctionBidRecord };
}

export async function placeLiveBid(orgId: string) {
  return request<Record<string, unknown>>(orgPath(orgId, "/auction-bids/live"), {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function fetchResults(
  orgId: string,
  query: {
    auctionId?: string;
    lotId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/auction-results${qs({ ...query })}`),
  );
  if (isApiFailure(data)) return data;
  const items = (data.items ?? data.results ?? []) as AuctionResult[];
  return { items };
}

export async function createResult(
  orgId: string,
  body: {
    auctionId: string;
    lotId: string;
    status?: string;
    winningBidCents?: number;
    winnerReference?: string;
    resultDate?: string;
    source?: string;
    sourceReference?: string;
    verificationStatus?: string;
    notes?: string;
  },
) {
  const data = await request<Record<string, unknown>>(orgPath(orgId, "/auction-results"), {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (isApiFailure(data)) return data;
  return { result: (data.result ?? data) as AuctionResult };
}

export async function fetchAwards(
  orgId: string,
  query: {
    auctionId?: string;
    lotId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/auction-awards${qs({ ...query })}`),
  );
  if (isApiFailure(data)) return data;
  const items = (data.items ?? data.awards ?? []) as AuctionAward[];
  return { items };
}

export async function fetchAward(orgId: string, awardId: string) {
  const data = await request<Record<string, unknown>>(orgPath(orgId, `/auction-awards/${awardId}`));
  if (isApiFailure(data)) return data;
  return { award: (data.award ?? data) as AuctionAward };
}

export async function createAward(
  orgId: string,
  body: {
    auctionId: string;
    lotId: string;
    participationId?: string;
    resultId?: string;
    awardStatus?: string;
    winningBidCents?: number;
    commissionCents?: number;
    feesCents?: number;
    totalKnownCostCents?: number;
    currency?: string;
    awardedAt?: string;
    verificationStatus?: string;
    source?: string;
    notes?: string;
  },
) {
  const data = await request<Record<string, unknown>>(orgPath(orgId, "/auction-awards"), {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (isApiFailure(data)) return data;
  return { award: (data.award ?? data) as AuctionAward };
}

export async function updateAward(orgId: string, awardId: string, body: Record<string, unknown>) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/auction-awards/${awardId}`),
    { method: "PATCH", body: JSON.stringify(body) },
  );
  if (isApiFailure(data)) return data;
  return { award: (data.award ?? data) as AuctionAward };
}

export async function fetchPayments(orgId: string, awardId: string) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/auction-awards/${awardId}/payments`),
  );
  if (isApiFailure(data)) return data;
  return { items: (data.items ?? data.payments ?? []) as AuctionPayment[] };
}

export async function createPayment(
  orgId: string,
  awardId: string,
  body: {
    paymentType?: string;
    amountCents: number;
    currency?: string;
    dueAt?: string;
    paidAt?: string;
    status?: string;
    paymentReference?: string;
    evidenceDocumentId?: string;
    notes?: string;
  },
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/auction-awards/${awardId}/payments`),
    { method: "POST", body: JSON.stringify({ ...body, awardId }) },
  );
  if (isApiFailure(data)) return data;
  return { payment: (data.payment ?? data) as AuctionPayment };
}

export async function fetchDeliveries(orgId: string, awardId: string) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/auction-awards/${awardId}/delivery`),
  );
  if (isApiFailure(data)) return data;
  return { items: (data.items ?? data.deliveries ?? []) as AuctionDelivery[] };
}

export async function createDelivery(
  orgId: string,
  awardId: string,
  body: {
    deliveryType?: string;
    status?: string;
    possessionStatus?: string;
    scheduledAt?: string;
    completedAt?: string;
    location?: string;
    evidenceDocumentId?: string;
    notes?: string;
  },
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/auction-awards/${awardId}/delivery`),
    { method: "POST", body: JSON.stringify({ ...body, awardId }) },
  );
  if (isApiFailure(data)) return data;
  return { delivery: (data.delivery ?? data) as AuctionDelivery };
}

export async function fetchTransfers(orgId: string, awardId: string) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/auction-awards/${awardId}/transfers`),
  );
  if (isApiFailure(data)) return data;
  return { items: (data.items ?? data.transfers ?? []) as AuctionTransfer[] };
}

export async function createTransfer(
  orgId: string,
  awardId: string,
  body: {
    transferType?: string;
    status?: string;
    startedAt?: string;
    completedAt?: string;
    authority?: string;
    protocol?: string;
    evidenceDocumentId?: string;
    notes?: string;
  },
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/auction-awards/${awardId}/transfers`),
    { method: "POST", body: JSON.stringify({ ...body, awardId }) },
  );
  if (isApiFailure(data)) return data;
  return { transfer: (data.transfer ?? data) as AuctionTransfer };
}

export async function fetchAwardEvents(orgId: string, awardId: string) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/auction-awards/${awardId}/events`),
  );
  if (isApiFailure(data)) return data;
  return { items: (data.items ?? data.events ?? []) as AuctionAwardEvent[] };
}

export async function createAwardEvent(
  orgId: string,
  awardId: string,
  body: {
    eventType: string;
    reason?: string;
    source?: string;
    relatedDocumentId?: string;
    metadata?: Record<string, unknown>;
  },
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/auction-awards/${awardId}/events`),
    { method: "POST", body: JSON.stringify({ ...body, awardId }) },
  );
  if (isApiFailure(data)) return data;
  return { event: (data.event ?? data) as AuctionAwardEvent };
}

export async function fetchRegularization(orgId: string, awardId: string) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/auction-awards/${awardId}/regularization`),
  );
  if (isApiFailure(data)) return data;
  return { items: (data.items ?? data.regularization ?? []) as AuctionRegularizationItem[] };
}

export async function upsertRegularizationItem(
  orgId: string,
  awardId: string,
  body: {
    itemKey: string;
    label: string;
    category?: string;
    status?: string;
    required?: boolean;
    notes?: string;
    sortOrder?: number;
    evidenceDocumentId?: string;
  },
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/auction-awards/${awardId}/regularization`),
    { method: "PUT", body: JSON.stringify({ ...body, awardId }) },
  );
  if (isApiFailure(data)) return data;
  return { item: (data.item ?? data) as AuctionRegularizationItem };
}

export async function fetchAwardDocuments(orgId: string, awardId: string) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/auction-awards/${awardId}/documents`),
  );
  if (isApiFailure(data)) return data;
  return { items: (data.items ?? data.documents ?? []) as AuctionAwardDocument[] };
}

export async function linkAwardDocument(
  orgId: string,
  awardId: string,
  body: { documentId: string; linkType: string },
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/auction-awards/${awardId}/documents`),
    { method: "POST", body: JSON.stringify(body) },
  );
  if (isApiFailure(data)) return data;
  return {
    document: (data.document ?? data.link ?? data) as AuctionAwardDocument,
    replayed: Boolean(data.replayed),
  };
}

export async function fetchAwardTimeline(orgId: string, awardId: string) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/auction-awards/${awardId}/timeline`),
  );
  if (isApiFailure(data)) return data;
  return {
    items: (data.timeline ?? data.items ?? []) as AuctionAwardTimelineItem[],
  };
}

export async function suggestAwardTasks(
  orgId: string,
  awardId: string,
  body: { keys?: string[] } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/auction-awards/${awardId}/suggest-tasks`),
    { method: "POST", body: JSON.stringify(body) },
  );
  if (isApiFailure(data)) return data;
  return data as { tasks?: unknown[]; note?: string };
}

export async function suggestAwardDeadlines(
  orgId: string,
  awardId: string,
  body: { baseDate: string; titles?: string[] },
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/auction-awards/${awardId}/suggest-deadlines`),
    { method: "POST", body: JSON.stringify(body) },
  );
  if (isApiFailure(data)) return data;
  return data as { deadlines?: unknown[]; note?: string };
}
