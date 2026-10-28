import { CSRF_HEADER } from "@verasjuris/security/constants";
import type { AiApiFailure } from "./ai";
import { aiErrorMessage, formatDateTime, hasPermission, isApiFailure, isNotConfigured } from "./ai";
import { formatMoneyCents } from "./auctions";
import { getActiveMembership, getActiveOrgId } from "./crm";

export {
  getActiveMembership,
  getActiveOrgId,
  isApiFailure,
  aiErrorMessage,
  formatDateTime,
  isNotConfigured,
  formatMoneyCents,
};

/**
 * Contratos — /api/v1/organizations/:orgId
 * contracts | signature-providers/status | contract-templates | contract-clauses | …
 */

export type ProviderHealthStatus = "ok" | "degraded" | "unavailable" | "not_configured";

export type SignatureProvidersStatus = {
  signature: {
    status: ProviderHealthStatus;
    providerKey?: string;
    detail?: string;
    checkedAt?: string;
  };
  contractManagement: {
    status: ProviderHealthStatus;
    providerKey?: string;
    detail?: string;
    checkedAt?: string;
  };
};

export type Contract = {
  id: string;
  organizationId: string;
  legalMatterId?: string | null;
  clientId?: string | null;
  contractTemplateId?: string | null;
  currentVersionId?: string | null;
  title: string;
  contractType: string;
  status: string;
  effectiveDate?: string | null;
  expirationDate?: string | null;
  indefiniteTerm?: boolean;
  renewalType?: string;
  totalValueCents?: number | null;
  createdAt: string;
  updatedAt: string;
};

export type ContractVersion = {
  id: string;
  contractId: string;
  version: number;
  status: string;
  documentId?: string | null;
  immutable?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ContractParty = {
  id: string;
  contractId: string;
  role: string;
  displayName: string;
  clientId?: string | null;
  documentNumber?: string | null;
  email?: string | null;
  createdAt: string;
};

export type ContractClauseInstance = {
  id: string;
  contractId: string;
  title?: string | null;
  clauseKey?: string | null;
  sortOrder?: number | null;
  status?: string;
  createdAt: string;
};

export type ContractApproval = {
  id: string;
  contractId: string;
  approvalType?: string;
  status: string;
  requestedAt?: string | null;
  decidedAt?: string | null;
  notes?: string | null;
  createdAt: string;
};

export type SignatureRequest = {
  id: string;
  contractId: string;
  contractVersionId?: string | null;
  status: string;
  providerKey?: string | null;
  externalEnvelopeId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ContractObligation = {
  id: string;
  contractId: string;
  title: string;
  dueDate?: string | null;
  status: string;
  createdAt: string;
};

export type ContractRenewal = {
  id: string;
  contractId: string;
  renewalType?: string;
  status: string;
  proposedNewExpiration?: string | null;
  createdAt: string;
};

export type ContractTermination = {
  id: string;
  contractId: string;
  status: string;
  effectiveDate?: string | null;
  createdAt: string;
};

export type ContractTemplate = {
  id: string;
  title: string;
  contractType?: string | null;
  active?: boolean;
  isSystem?: boolean;
  createdAt: string;
};

export type ContractClauseLibrary = {
  id: string;
  title: string;
  clauseKey?: string | null;
  category?: string | null;
  active?: boolean;
  createdAt: string;
};

export type ContractTimelineItem = {
  id: string;
  eventType?: string;
  summary?: string;
  occurredAt?: string;
  [key: string]: unknown;
};

export const SIGNATURE_PROVIDER_NOT_CONFIGURED_MESSAGE =
  "Provedor de assinatura eletrônica não está configurado (NOT_CONFIGURED). Registre assinaturas manuais com documento de evidência.";

export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  internal_review: "Revisão interna",
  pending_approval: "Aguardando aprovação",
  approved: "Aprovado",
  pending_signature: "Aguardando assinatura",
  partially_signed: "Parcialmente assinado",
  signed: "Assinado",
  active: "Vigente",
  expiring: "A vencer",
  expired: "Vencido",
  terminated: "Rescindido",
  cancelled: "Cancelado",
  archived: "Arquivado",
};

export const CONTRACT_PARTY_ROLE_LABELS: Record<string, string> = {
  contractor: "Contratante",
  contractee: "Contratado",
  buyer: "Comprador",
  seller: "Vendedor",
  lessor: "Locador",
  lessee: "Locatário",
  provider: "Fornecedor",
  customer: "Cliente",
  partner: "Parceiro",
  guarantor: "Fiador",
  witness: "Testemunha",
  other: "Outro",
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

export type ContractAction =
  | "read"
  | "create"
  | "update"
  | "manage_parties"
  | "manage_clauses"
  | "review"
  | "approve"
  | "request_signature"
  | "record_signature"
  | "manage_renewal"
  | "terminate"
  | "manage_obligations"
  | "archive";

export function hasContractPermission(
  permissions: readonly string[] | undefined,
  action: ContractAction,
): boolean {
  return hasPermission(permissions, `contract.${action}`);
}

export function contractErrorMessage(failure: AiApiFailure, fallback: string): string {
  const code = failure.error?.code ?? "";
  if (
    code === "NOT_CONFIGURED" ||
    code === "SIGNATURE_PROVIDER_NOT_CONFIGURED" ||
    isNotConfigured(failure)
  ) {
    return SIGNATURE_PROVIDER_NOT_CONFIGURED_MESSAGE;
  }
  return aiErrorMessage(failure, fallback);
}

export function isSignatureProviderNotConfigured(
  status: SignatureProvidersStatus | AiApiFailure,
): boolean {
  if (isApiFailure(status)) return isNotConfigured(status);
  return (
    status.signature?.status === "not_configured" || status.signature?.status === "unavailable"
  );
}

export async function fetchSignatureProvidersStatus(orgId: string) {
  return request<SignatureProvidersStatus>(orgPath(orgId, "/signature-providers/status"));
}

export async function fetchContracts(
  orgId: string,
  query: {
    q?: string;
    clientId?: string;
    legalMatterId?: string;
    status?: string;
    contractType?: string;
    limit?: number;
    offset?: number;
  } = {},
) {
  const data = await request<Record<string, unknown>>(orgPath(orgId, `/contracts${qs(query)}`));
  if (isApiFailure(data)) return data;
  const items = (data.items ?? []) as Contract[];
  return { items, total: Number(data.total ?? items.length) };
}

export async function fetchContract(orgId: string, contractId: string) {
  const data = await request<{ contract: Contract }>(orgPath(orgId, `/contracts/${contractId}`));
  if (isApiFailure(data)) return data;
  return { contract: data.contract };
}

export async function createContract(
  orgId: string,
  body: {
    title: string;
    legalMatterId?: string;
    clientId?: string;
    contractTemplateId?: string;
    contractType?: string;
    status?: string;
    currency?: string;
    totalValueCents?: number;
  },
) {
  return request<{ contract: Contract }>(orgPath(orgId, "/contracts"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchContractTimeline(orgId: string, contractId: string) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/contracts/${contractId}/timeline`),
  );
  if (isApiFailure(data)) return data;
  return { items: (data.items ?? data.timeline ?? []) as ContractTimelineItem[] };
}

export async function fetchContractVersions(
  orgId: string,
  contractId: string,
  query: { limit?: number } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/contracts/${contractId}/versions${qs(query)}`),
  );
  if (isApiFailure(data)) return data;
  const items = (data.items ?? []) as ContractVersion[];
  return { items, total: Number(data.total ?? items.length) };
}

export async function fetchContractParties(
  orgId: string,
  contractId: string,
  query: { limit?: number } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/contracts/${contractId}/parties${qs(query)}`),
  );
  if (isApiFailure(data)) return data;
  const items = (data.items ?? []) as ContractParty[];
  return { items, total: Number(data.total ?? items.length) };
}

export async function fetchContractClauses(orgId: string, contractId: string) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/contracts/${contractId}/clauses`),
  );
  if (isApiFailure(data)) return data;
  const items = (data.items ?? []) as ContractClauseInstance[];
  return { items, total: items.length };
}

export async function fetchContractApprovals(
  orgId: string,
  contractId: string,
  query: { limit?: number } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/contracts/${contractId}/approvals${qs(query)}`),
  );
  if (isApiFailure(data)) return data;
  const items = (data.items ?? []) as ContractApproval[];
  return { items, total: Number(data.total ?? items.length) };
}

export async function fetchSignatureRequests(
  orgId: string,
  contractId: string,
  query: { limit?: number } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/contracts/${contractId}/signature-requests${qs(query)}`),
  );
  if (isApiFailure(data)) return data;
  const items = (data.items ?? []) as SignatureRequest[];
  return { items, total: Number(data.total ?? items.length) };
}

export async function recordManualSignature(
  orgId: string,
  contractId: string,
  body: {
    contractVersionId: string;
    signedAt: string;
    evidenceDocumentId: string;
    contractPartyId?: string;
    notes?: string;
  },
) {
  return request<Record<string, unknown>>(
    orgPath(orgId, `/contracts/${contractId}/manual-signatures`),
    {
      method: "POST",
      body: JSON.stringify({ ...body, contractId }),
    },
  );
}

export async function fetchContractObligations(
  orgId: string,
  contractId: string,
  query: { limit?: number } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/contracts/${contractId}/obligations${qs(query)}`),
  );
  if (isApiFailure(data)) return data;
  const items = (data.items ?? []) as ContractObligation[];
  return { items, total: Number(data.total ?? items.length) };
}

export async function fetchContractRenewals(
  orgId: string,
  contractId: string,
  query: { limit?: number } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/contracts/${contractId}/renewals${qs(query)}`),
  );
  if (isApiFailure(data)) return data;
  const items = (data.items ?? []) as ContractRenewal[];
  return { items, total: Number(data.total ?? items.length) };
}

export async function fetchContractTerminations(
  orgId: string,
  contractId: string,
  query: { limit?: number } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/contracts/${contractId}/terminations${qs(query)}`),
  );
  if (isApiFailure(data)) return data;
  const items = (data.items ?? []) as ContractTermination[];
  return { items, total: Number(data.total ?? items.length) };
}

export async function fetchContractTemplates(
  orgId: string,
  query: { limit?: number; q?: string } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/contract-templates${qs(query)}`),
  );
  if (isApiFailure(data)) return data;
  const items = (data.items ?? []) as ContractTemplate[];
  return { items, total: Number(data.total ?? items.length) };
}

export async function fetchContractClausesLibrary(
  orgId: string,
  query: { limit?: number; q?: string } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/contract-clauses${qs(query)}`),
  );
  if (isApiFailure(data)) return data;
  const items = (data.items ?? []) as ContractClauseLibrary[];
  return { items, total: Number(data.total ?? items.length) };
}
