import { CSRF_HEADER } from "@verasjuris/security/constants";
import type { AiApiFailure } from "./ai";
import {
  aiErrorMessage,
  formatDateTime,
  hasPermission,
  isApiFailure,
  isNotConfigured,
  NOT_CONFIGURED_CODES,
} from "./ai";
import { getActiveMembership, getActiveOrgId } from "./crm";
import { BR_STATES, parseMoneyToCents } from "./public-opportunities";

export {
  getActiveMembership,
  getActiveOrgId,
  isApiFailure,
  aiErrorMessage,
  formatDateTime,
  isNotConfigured,
  BR_STATES,
  parseMoneyToCents,
};

/**
 * Leilões — /api/v1/organizations/:orgId
 *  - GET  /auction-provider/status
 *  - POST /auction-provider/sync
 *  - GET/POST /auctions
 *  - GET/PATCH /auctions/:auctionId
 *  - GET/POST /auctions/:auctionId/lots
 *  - GET/PATCH /auction-lots/:lotId
 *  - GET/POST /auction-lots/:lotId/encumbrances
 *  - PUT  /auctions/:auctionId/interest
 *  - GET/DELETE /auction-interests
 *  - GET/POST/DELETE /auction-alerts
 *  - POST /auction-due-diligence | PATCH /auction-due-diligence/:itemId
 *  - POST /auctions/estimate-cost | compare | analyze-notice
 *  - POST /auctions/:auctionId/bid  → NOT_CONFIGURED
 */

export type AuctionType =
  | "judicial"
  | "extrajudicial"
  | "administrative"
  | "public_asset"
  | "seized_asset"
  | "tax"
  | "bank"
  | "insolvency"
  | "bankruptcy"
  | "other";

export type AuctionAssetType =
  | "real_estate"
  | "vehicle"
  | "machinery"
  | "equipment"
  | "vessel"
  | "aircraft"
  | "business_asset"
  | "right"
  | "shares"
  | "movable_goods"
  | "scrap"
  | "material"
  | "other";

export type AuctionStatus =
  | "draft"
  | "published"
  | "open"
  | "closed"
  | "cancelled"
  | "archived"
  | "not_configured";

export type AuctionInterestStatus =
  | "saved"
  | "watching"
  | "reviewing"
  | "visit_planned"
  | "intends_to_bid"
  | "participated"
  | "won"
  | "lost"
  | "archived";

export type AuctionOccupancyStatus =
  | "unknown"
  | "vacant"
  | "occupied"
  | "possession_disputed"
  | "other";

export type AuctionDueDiligenceStatus =
  | "pending"
  | "in_progress"
  | "done"
  | "not_applicable"
  | "blocked"
  | "unknown";

export type AuctionSource = "manual" | "public_provider" | "import" | "not_configured";

export const AUCTION_TYPE_LABELS: Record<AuctionType, string> = {
  judicial: "Judicial",
  extrajudicial: "Extrajudicial",
  administrative: "Administrativo",
  public_asset: "Bem público",
  seized_asset: "Bem apreendido",
  tax: "Fiscal",
  bank: "Bancário",
  insolvency: "Insolvência",
  bankruptcy: "Falência",
  other: "Outro",
};

export const AUCTION_ASSET_TYPE_LABELS: Record<AuctionAssetType, string> = {
  real_estate: "Imóvel",
  vehicle: "Veículo",
  machinery: "Máquina",
  equipment: "Equipamento",
  vessel: "Embarcação",
  aircraft: "Aeronave",
  business_asset: "Ativo empresarial",
  right: "Direito",
  shares: "Cotas / ações",
  movable_goods: "Bens móveis",
  scrap: "Sucata",
  material: "Material",
  other: "Outro",
};

export const AUCTION_STATUS_LABELS: Record<AuctionStatus, string> = {
  draft: "Rascunho",
  published: "Publicado",
  open: "Aberto",
  closed: "Encerrado",
  cancelled: "Cancelado",
  archived: "Arquivado",
  not_configured: "Não configurado",
};

export const AUCTION_INTEREST_LABELS: Record<AuctionInterestStatus, string> = {
  saved: "Salvo",
  watching: "Acompanhando",
  reviewing: "Em análise",
  visit_planned: "Visita planejada",
  intends_to_bid: "Intenção de participar",
  participated: "Participou",
  won: "Arrematado",
  lost: "Não arrematado",
  archived: "Arquivado",
};

export const AUCTION_OCCUPANCY_LABELS: Record<AuctionOccupancyStatus, string> = {
  unknown: "Ocupação não verificada",
  vacant: "Desocupado (informado)",
  occupied: "Ocupado (informado)",
  possession_disputed: "Posse controversa (informado)",
  other: "Outra situação (informada)",
};

export const AUCTION_DUE_DILIGENCE_LABELS: Record<AuctionDueDiligenceStatus, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  done: "Concluído",
  not_applicable: "Não se aplica",
  blocked: "Bloqueado",
  unknown: "Não verificado",
};

export const AUCTION_SOURCE_LABELS: Record<AuctionSource, string> = {
  manual: "CADASTRO MANUAL",
  public_provider: "PROVEDOR PÚBLICO",
  import: "IMPORTAÇÃO",
  not_configured: "FONTE NÃO CONFIGURADA",
};

export const AUCTION_PROVIDER_NOT_CONFIGURED_MESSAGE =
  "Não há provedor externo de leilões configurado neste ambiente. O cadastro manual continua disponível.";

export const BID_NOT_CONFIGURED_MESSAGE =
  "Lance eletrônico não está disponível neste ambiente. Nenhuma operação de lance foi iniciada.";

export const COST_ESTIMATE_DISCLAIMER = "Estimativa com base nos valores informados.";

export type AuctionSourceInfo = {
  provider: AuctionSource | string;
  reference?: string | null;
  url?: string | null;
  badge?: { kind: string; label: string; official: boolean };
};

export type AuctionInterest = {
  id: string;
  organizationId?: string;
  auctionId: string;
  lotId?: string | null;
  status: AuctionInterestStatus | string;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  auction?: AuctionSummary;
};

export type AuctionLotSummary = {
  id: string;
  auctionId: string;
  lotNumber: string;
  title: string;
  description?: string | null;
  assetType: AuctionAssetType | string;
  status?: string;
  appraisalValueCents?: number | null;
  firstMinimumBidCents?: number | null;
  secondMinimumBidCents?: number | null;
  currentReferenceValueCents?: number | null;
  currency?: string;
  incrementCents?: number | null;
  commissionBasisPoints?: number | null;
  buyerFeeCents?: number | null;
  depositRequiredCents?: number | null;
  location?: string | null;
  stateCode?: string | null;
  municipality?: string | null;
  occupancyStatus?: AuctionOccupancyStatus | string;
  createdAt?: string;
  updatedAt?: string;
};

export type AuctionSummary = {
  id: string;
  scope?: string;
  editable?: boolean;
  source: AuctionSourceInfo;
  auctionType: AuctionType | string;
  title: string;
  description?: string | null;
  sellerType?: string | null;
  sellerName?: string | null;
  status: AuctionStatus | string;
  publicationDate?: string | null;
  registrationDeadline?: string | null;
  firstEventAt?: string | null;
  secondEventAt?: string | null;
  closingAt?: string | null;
  interest?: AuctionInterest | null;
  createdAt: string;
  updatedAt?: string;
};

export type AuctionEvent = {
  id: string;
  eventType: string;
  startsAt: string;
  endsAt?: string | null;
  timezone?: string;
  minimumRule?: string | null;
  status: string;
};

export type AuctionEncumbrance = {
  id: string;
  lotId: string;
  type: string;
  description: string;
  source?: string | null;
  responsibility?: string | null;
  status?: string;
  amountCents?: number | null;
  verifiedAt?: string | null;
  label?: string;
  verificationLabel?: string;
};

export type AuctionLotDetail = AuctionLotSummary & {
  realEstate?: Record<string, unknown> | null;
  vehicle?: Record<string, unknown> | null;
  encumbrances?: AuctionEncumbrance[];
  bidRules?: Array<Record<string, unknown>>;
  interest?: AuctionInterest | null;
  discountVsAppraisalBp?: number | null;
  bidding?: { available: boolean; status: string };
};

export type AuctionDetail = AuctionSummary & {
  auctioneer?: { id: string; name: string; registrationNumber?: string | null } | null;
  events?: AuctionEvent[];
  lots?: AuctionLotSummary[];
  bidRules?: Array<Record<string, unknown>>;
  documentLinkCount?: number;
  bidding?: { available: boolean; status: string };
};

export type AuctionAlert = {
  id: string;
  name: string;
  active: boolean;
  auctionTypes?: string[] | null;
  assetTypes?: string[] | null;
  stateCodes?: string[] | null;
  municipalities?: string[] | null;
  minValueCents?: number | null;
  maxValueCents?: number | null;
  occupancyStatuses?: string[] | null;
  createdAt: string;
};

export type DueDiligenceItem = {
  id: string;
  auctionId: string;
  lotId?: string | null;
  itemKey: string;
  label: string;
  category?: string | null;
  status: AuctionDueDiligenceStatus | string;
  notes?: string | null;
  assistive?: boolean;
  notLegalOpinion?: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type CostEstimate = {
  bidCents: number;
  commissionCents: number;
  knownFeesCents: number;
  otherCostsCents?: number;
  informedCostsCents?: number;
  totalCents: number;
  label?: string;
  disclaimer?: string;
};

export type AuctionProviderStatus = {
  provider: string;
  status: string;
  health?: { status?: string; message?: string | null };
  bidProvider?: {
    provider: string;
    status: string;
    placeBidAvailable?: boolean;
  };
  manualEntryAvailable?: boolean;
};

export type AuctionListQuery = {
  q?: string;
  auctionType?: string;
  assetType?: string;
  status?: string;
  source?: string;
  stateCode?: string;
  municipality?: string;
  minValueCents?: number;
  maxValueCents?: number;
  eventFrom?: string;
  eventTo?: string;
  occupancyStatus?: string;
  interestStatus?: string;
  onlySaved?: boolean;
  limit?: number;
  offset?: number;
};

export type CreateAuctionInput = {
  auctionType: AuctionType;
  title: string;
  description?: string;
  sellerType?: string;
  sellerName?: string;
  status?: AuctionStatus;
  publicationDate?: string;
  registrationDeadline?: string;
  firstEventAt?: string;
  secondEventAt?: string;
  closingAt?: string;
  sourceUrl?: string;
  sourceReference?: string;
};

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
  if (response.status === 204) return {} as T;
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

function qs(query: Record<string, string | number | boolean | undefined | null>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function hasAuctionPermission(
  permissions: readonly string[] | undefined,
  action:
    | "read"
    | "create"
    | "update"
    | "manage"
    | "save"
    | "alerts"
    | "due_diligence.read"
    | "due_diligence.manage",
): boolean {
  if (action === "alerts") return hasPermission(permissions, "auction.alert.manage");
  if (action === "due_diligence.read") {
    return hasPermission(permissions, "auction.due_diligence.read");
  }
  if (action === "due_diligence.manage") {
    return hasPermission(permissions, "auction.due_diligence.manage");
  }
  return hasPermission(permissions, `auction.${action}`);
}

export function formatMoneyCents(cents: number | null | undefined, currency = "BRL"): string {
  if (cents == null) return "Não informado";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency });
}

/** Basis points (100 = 1%) → percentual legível. */
export function formatBasisPoints(bp: number | null | undefined): string {
  if (bp == null || Number.isNaN(bp)) return "Não informado";
  return `${(bp / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

export function auctionStatusTone(status: string): "neutral" | "success" | "warning" | "error" {
  if (status === "open" || status === "published") return "success";
  if (status === "draft") return "warning";
  if (status === "cancelled") return "error";
  return "neutral";
}

export function auctionErrorMessage(failure: AiApiFailure, fallback: string): string {
  const code = failure.error?.code ?? "";
  if (
    code === "AUCTION_PROVIDER_NOT_CONFIGURED" ||
    code === "AUCTION_BID_PROVIDER_NOT_CONFIGURED" ||
    (NOT_CONFIGURED_CODES as readonly string[]).includes(code)
  ) {
    if (code.includes("BID") || failure.error?.message?.toLowerCase().includes("lance")) {
      return BID_NOT_CONFIGURED_MESSAGE;
    }
    return AUCTION_PROVIDER_NOT_CONFIGURED_MESSAGE;
  }
  return aiErrorMessage(failure, fallback);
}

export function occupancyLabel(status: string | null | undefined): string {
  if (!status) return AUCTION_OCCUPANCY_LABELS.unknown;
  return AUCTION_OCCUPANCY_LABELS[status as AuctionOccupancyStatus] ?? status.replaceAll("_", " ");
}

export function encumbranceVerificationLabel(item: AuctionEncumbrance): string {
  return item.verificationLabel ?? (item.verifiedAt ? "Verificado" : "Não verificado");
}

export function encumbranceStatusLabel(item: AuctionEncumbrance): string {
  return item.label ?? (item.verifiedAt ? "Verificado" : "Ônus informado");
}

export async function fetchAuctionProviderStatus(orgId: string) {
  return request<AuctionProviderStatus>(orgPath(orgId, "/auction-provider/status"));
}

export async function syncAuctions(orgId: string) {
  return request<Record<string, unknown>>(orgPath(orgId, "/auction-provider/sync"), {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function fetchAuctions(orgId: string, query: AuctionListQuery = {}) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/auctions${qs({ ...query })}`),
  );
  if (isApiFailure(data)) return data;
  const items = (data.items ?? data.auctions ?? []) as AuctionSummary[];
  return { items, total: typeof data.total === "number" ? data.total : items.length };
}

export async function fetchAuction(orgId: string, auctionId: string) {
  const data = await request<Record<string, unknown>>(orgPath(orgId, `/auctions/${auctionId}`));
  if (isApiFailure(data)) return data;
  return { auction: (data.auction ?? data) as AuctionDetail };
}

export async function createAuction(orgId: string, body: CreateAuctionInput) {
  const data = await request<Record<string, unknown>>(orgPath(orgId, "/auctions"), {
    method: "POST",
    body: JSON.stringify({ status: "draft", ...body }),
  });
  if (isApiFailure(data)) return data;
  return { auction: (data.auction ?? data) as AuctionSummary };
}

export async function fetchLot(orgId: string, lotId: string) {
  const data = await request<Record<string, unknown>>(orgPath(orgId, `/auction-lots/${lotId}`));
  if (isApiFailure(data)) return data;
  return { lot: (data.lot ?? data) as AuctionLotDetail };
}

export async function fetchLotEncumbrances(orgId: string, lotId: string) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/auction-lots/${lotId}/encumbrances`),
  );
  if (isApiFailure(data)) return data;
  return { items: (data.items ?? []) as AuctionEncumbrance[] };
}

export async function upsertAuctionInterest(
  orgId: string,
  auctionId: string,
  body: {
    lotId?: string;
    status: AuctionInterestStatus;
    notes?: string | null;
    confirmOutcome?: boolean;
  },
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/auctions/${auctionId}/interest`),
    { method: "PUT", body: JSON.stringify(body) },
  );
  if (isApiFailure(data)) return data;
  return { interest: (data.interest ?? data) as AuctionInterest };
}

export async function fetchAuctionInterests(
  orgId: string,
  query: {
    status?: string;
    auctionId?: string;
    lotId?: string;
    limit?: number;
    offset?: number;
  } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/auction-interests${qs({ ...query })}`),
  );
  if (isApiFailure(data)) return data;
  const items = (data.items ?? data.interests ?? []) as AuctionInterest[];
  return { items, total: typeof data.total === "number" ? data.total : items.length };
}

export async function removeAuctionInterest(orgId: string, interestId: string) {
  return request<Record<string, unknown>>(orgPath(orgId, `/auction-interests/${interestId}`), {
    method: "DELETE",
  });
}

export async function fetchAuctionAlerts(orgId: string) {
  const data = await request<Record<string, unknown>>(orgPath(orgId, "/auction-alerts"));
  if (isApiFailure(data)) return data;
  const items = (data.items ?? data.alerts ?? []) as AuctionAlert[];
  return { items };
}

export async function createAuctionAlert(
  orgId: string,
  body: {
    name: string;
    active?: boolean;
    auctionTypes?: AuctionType[];
    assetTypes?: AuctionAssetType[];
    stateCodes?: string[];
    municipalities?: string[];
    minValueCents?: number;
    maxValueCents?: number;
    occupancyStatuses?: AuctionOccupancyStatus[];
  },
) {
  const data = await request<Record<string, unknown>>(orgPath(orgId, "/auction-alerts"), {
    method: "POST",
    body: JSON.stringify({ active: true, ...body }),
  });
  if (isApiFailure(data)) return data;
  return { alert: (data.alert ?? data) as AuctionAlert };
}

export async function deleteAuctionAlert(orgId: string, alertId: string) {
  return request<Record<string, unknown>>(orgPath(orgId, `/auction-alerts/${alertId}`), {
    method: "DELETE",
  });
}

export async function getOrCreateDueDiligence(
  orgId: string,
  body: { auctionId: string; lotId?: string },
) {
  const data = await request<Record<string, unknown>>(orgPath(orgId, "/auction-due-diligence"), {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (isApiFailure(data)) return data;
  return {
    items: (data.items ?? []) as DueDiligenceItem[],
    disclaimer:
      (data.disclaimer as string | undefined) ??
      "Checklist assistivo para organização da verificação. Não constitui parecer jurídico nem recomendação de compra.",
  };
}

export async function updateDueDiligence(
  orgId: string,
  itemId: string,
  body: {
    status?: AuctionDueDiligenceStatus;
    notes?: string | null;
    label?: string;
    category?: string | null;
  },
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/auction-due-diligence/${itemId}`),
    { method: "PATCH", body: JSON.stringify(body) },
  );
  if (isApiFailure(data)) return data;
  return { item: (data.item ?? data) as DueDiligenceItem };
}

export async function estimateAuctionCost(
  orgId: string,
  body: {
    lotId?: string;
    bidCents?: number;
    commissionBasisPoints?: number;
    knownFeesCents?: number;
    otherCostsCents?: number;
  },
) {
  const data = await request<Record<string, unknown>>(orgPath(orgId, "/auctions/estimate-cost"), {
    method: "POST",
    body: JSON.stringify({
      knownFeesCents: 0,
      otherCostsCents: 0,
      ...body,
    }),
  });
  if (isApiFailure(data)) return data;
  return { estimate: (data.estimate ?? data) as CostEstimate };
}

export async function placeAuctionBidStub(orgId: string, auctionId: string) {
  return request<Record<string, unknown>>(orgPath(orgId, `/auctions/${auctionId}/bid`), {
    method: "POST",
    body: JSON.stringify({}),
  });
}
