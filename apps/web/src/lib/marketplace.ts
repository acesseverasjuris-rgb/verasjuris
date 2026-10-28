import { CSRF_HEADER } from "@verasjuris/security/constants";
import type { AiApiFailure } from "./ai";
import { aiErrorMessage, formatDateTime, hasPermission, isApiFailure } from "./ai";
import { formatMoneyCents } from "./auctions";
import { getActiveMembership, getActiveOrgId } from "./crm";

export {
  getActiveMembership,
  getActiveOrgId,
  isApiFailure,
  aiErrorMessage,
  formatDateTime,
  formatMoneyCents,
};

export type MarketplaceCategory = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
};

export type MarketplaceService = {
  id: string;
  title: string;
  description?: string | null;
  categoryId: string;
  deliveryMode: string;
  pricingModel: string;
  basePriceCents?: number | null;
  active: boolean;
};

export type MarketplaceProfessional = {
  userId: string;
  professionalName?: string | null;
  marketplaceHeadline?: string | null;
  marketplaceDescription?: string | null;
  oabUf?: string | null;
  oabVerificationStatus?: string;
  serviceStates?: string | null;
  serviceCities?: string | null;
  remoteAvailable?: boolean;
  basePriceMinCents?: number | null;
  basePriceMaxCents?: number | null;
  availabilityStatus?: string;
  ranking?: { totalScore: number; scoreBreakdown?: Record<string, number> };
};

export type MarketplaceRequest = {
  id: string;
  title: string;
  description?: string;
  categoryId: string;
  status: string;
  urgency: string;
  locationState?: string | null;
  locationCity?: string | null;
  remoteAllowed: boolean;
  budgetMinCents?: number | null;
  budgetMaxCents?: number | null;
  deadlineAt?: string | null;
  createdAt: string;
};

export type MarketplaceProposal = {
  id: string;
  requestId: string;
  professionalProfileId: string;
  amountCents: number;
  message?: string | null;
  status: string;
  version: number;
  createdAt: string;
};

export type MarketplaceEngagement = {
  id: string;
  requestId: string;
  proposalId: string;
  professionalProfileId: string;
  status: string;
  revisionLimit: number;
  revisionCount: number;
  paymentRecordId?: string | null;
};

export type MarketplaceDelivery = {
  id: string;
  status: string;
  description: string;
  deliveredAt?: string | null;
};

export type MarketplaceDispute = {
  id: string;
  engagementId: string;
  status: string;
  reasonCode: string;
  description: string;
  resolution?: string | null;
};

export const MARKETPLACE_REQUEST_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  open: "Aberta",
  receiving_proposals: "Recebendo propostas",
  proposal_selected: "Proposta escolhida",
  contracting: "Contratando",
  in_progress: "Em andamento",
  delivered: "Entregue",
  completed: "Concluída",
  cancelled: "Cancelada",
  disputed: "Em disputa",
  expired: "Expirada",
};

export const MARKETPLACE_PROPOSAL_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  submitted: "Enviada",
  viewed: "Visualizada",
  accepted: "Aceita",
  declined: "Recusada",
  withdrawn: "Retirada",
  expired: "Expirada",
};

export const MARKETPLACE_ENGAGEMENT_STATUS_LABELS: Record<string, string> = {
  pending_contract: "Aguardando contrato",
  pending_payment: "Aguardando pagamento",
  active: "Ativa",
  waiting_client: "Aguardando cliente",
  waiting_provider: "Aguardando profissional",
  delivered: "Entregue",
  completed: "Concluída",
  cancelled: "Cancelada",
  disputed: "Em disputa",
};

export type MarketplaceAction =
  | "read"
  | "request.create"
  | "request.manage"
  | "service.manage"
  | "proposal.create"
  | "proposal.manage"
  | "engagement.manage"
  | "delivery.manage"
  | "dispute.open"
  | "review.create";

const PERM: Record<MarketplaceAction, string> = {
  read: "marketplace.read",
  "request.create": "marketplace.request.create",
  "request.manage": "marketplace.request.manage",
  "service.manage": "marketplace.service.manage",
  "proposal.create": "marketplace.proposal.create",
  "proposal.manage": "marketplace.proposal.manage",
  "engagement.manage": "marketplace.engagement.manage",
  "delivery.manage": "marketplace.delivery.manage",
  "dispute.open": "marketplace.dispute.open",
  "review.create": "marketplace.review.create",
};

export function hasMarketplacePermission(
  permissions: string[],
  action: MarketplaceAction,
): boolean {
  return hasPermission(permissions, PERM[action]);
}

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

function qs(query: Record<string, string | number | boolean | undefined | null>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function marketplaceErrorMessage(failure: AiApiFailure): string {
  return aiErrorMessage(failure, "Falha no marketplace.");
}

export async function fetchMarketplaceCategories(orgId?: string) {
  const path = orgId ? orgPath(orgId, "/marketplace/categories") : "/api/v1/marketplace/categories";
  return request<{ items: MarketplaceCategory[] }>(path);
}

export async function fetchMarketplaceProfessionals(
  query: Record<string, string | number | boolean | undefined> = {},
  orgId?: string,
) {
  const path = orgId
    ? orgPath(orgId, `/marketplace/professionals${qs(query)}`)
    : `/api/v1/marketplace/professionals${qs(query)}`;
  return request<{ items: MarketplaceProfessional[] }>(path);
}

export async function fetchMarketplaceProfessional(professionalUserId: string) {
  return request<{ profile: MarketplaceProfessional; services: MarketplaceService[] }>(
    `/api/v1/marketplace/professionals/${professionalUserId}`,
  );
}

export async function fetchMarketplaceRequests(
  orgId: string,
  query?: { status?: string; limit?: number },
) {
  return request<{ items: MarketplaceRequest[] }>(
    orgPath(orgId, `/marketplace/requests${qs(query ?? {})}`),
  );
}

export async function fetchMarketplaceRequest(orgId: string, requestId: string) {
  return request<{ request: MarketplaceRequest }>(
    orgPath(orgId, `/marketplace/requests/${requestId}`),
  );
}

export async function fetchMarketplaceOpportunities(orgId: string) {
  return request<{ items: MarketplaceRequest[] }>(
    orgPath(orgId, "/marketplace/requests/opportunities"),
  );
}

export async function fetchMyMarketplaceProposals(orgId: string) {
  return request<{ items: MarketplaceProposal[] }>(orgPath(orgId, "/marketplace/proposals/mine"));
}

export async function fetchMarketplaceEngagements(orgId: string) {
  return request<{ items: MarketplaceEngagement[] }>(orgPath(orgId, "/marketplace/engagements"));
}

export async function fetchMarketplaceEngagement(orgId: string, engagementId: string) {
  return request<{
    engagement: MarketplaceEngagement;
    deliveries: MarketplaceDelivery[];
    disputes: MarketplaceDispute[];
  }>(orgPath(orgId, `/marketplace/engagements/${engagementId}`));
}

export async function fetchMarketplaceDispute(orgId: string, disputeId: string) {
  return request<{ dispute: MarketplaceDispute }>(
    orgPath(orgId, `/marketplace/disputes/${disputeId}`),
  );
}

export async function fetchMarketplacePaymentStatus(orgId: string) {
  return request<{ payment: { status: string } }>(orgPath(orgId, "/marketplace/providers/status"));
}

export async function createMarketplaceRequest(orgId: string, body: Record<string, unknown>) {
  return request<{ request: MarketplaceRequest }>(orgPath(orgId, "/marketplace/requests"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function publishMarketplaceRequest(orgId: string, requestId: string) {
  return request(orgPath(orgId, `/marketplace/requests/${requestId}/publish`), { method: "POST" });
}

export async function submitMarketplaceProposal(
  orgId: string,
  requestId: string,
  body: Record<string, unknown>,
) {
  return request(orgPath(orgId, `/marketplace/requests/${requestId}/proposals`), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function patchMarketplaceProfile(orgId: string, body: Record<string, unknown>) {
  return request(orgPath(orgId, "/marketplace/profile"), {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
