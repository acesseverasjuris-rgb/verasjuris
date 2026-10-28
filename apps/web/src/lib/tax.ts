import { CSRF_HEADER } from "@verasjuris/security/constants";
import type { AiApiFailure } from "./ai";
import { aiErrorMessage, formatDateTime, hasPermission, isApiFailure, isNotConfigured } from "./ai";
import { formatMoneyCents } from "./auctions";
import { getActiveMembership, getActiveOrgId } from "./crm";
import type { CalculationMemoryStep, CalculationResultSnapshot } from "./previdentiary";
import { parseCalculationSnapshot } from "./previdentiary";

export {
  getActiveMembership,
  getActiveOrgId,
  isApiFailure,
  aiErrorMessage,
  formatDateTime,
  isNotConfigured,
  formatMoneyCents,
  parseCalculationSnapshot,
};

export type { CalculationMemoryStep, CalculationResultSnapshot };

/**
 * Tributário — /api/v1/organizations/:orgId
 * tax-cases | tax-providers/status | tax-theses | tax-calculations | …
 */

export type ProviderHealthStatus = "ok" | "degraded" | "unavailable" | "not_configured";

export type TaxProvidersStatus = {
  federal: { provider: string; status: ProviderHealthStatus; [key: string]: unknown };
  state: { provider: string; status: ProviderHealthStatus; [key: string]: unknown };
  municipal: { provider: string; status: ProviderHealthStatus; [key: string]: unknown };
  taxDebt: { provider: string; status: ProviderHealthStatus; [key: string]: unknown };
  taxFiling: { provider: string; status: ProviderHealthStatus; [key: string]: unknown };
  manualEntryAvailable?: boolean;
};

export type TaxCase = {
  id: string;
  organizationId: string;
  clientId: string;
  legalMatterId: string;
  responsibleMembershipId?: string | null;
  taxpayerType: string;
  jurisdictionScope: string;
  status: string;
  notes?: string | null;
  createdByMembershipId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaxObligation = {
  id: string;
  taxCaseId: string;
  taxTypeId?: string | null;
  obligationType?: string;
  competence?: string | null;
  dueDate?: string | null;
  amountCents?: number | null;
  status: string;
  source?: string;
  evidenceDocumentId?: string | null;
  deadlineId?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaxCredit = {
  id: string;
  taxCaseId: string;
  taxTypeId?: string | null;
  origin?: string;
  totalCents?: number | null;
  status: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaxRefund = {
  id: string;
  taxCaseId: string;
  requestDate?: string;
  protocolNumber?: string | null;
  amountRequestedCents?: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type TaxCompensation = {
  id: string;
  taxCaseId: string;
  requestedAmountCents?: number | null;
  acceptedAmountCents?: number | null;
  status: string;
  protocol?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaxAssessment = {
  id: string;
  taxCaseId: string;
  authority?: string | null;
  assessmentNumber?: string | null;
  assessmentDate?: string;
  totalCents?: number | null;
  status: string;
  documentId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaxAdministrativeCase = {
  id: string;
  taxCaseId: string;
  administrativeProcessId?: string | null;
  status?: string;
  [key: string]: unknown;
};

export type TaxEnforcement = {
  id: string;
  taxCaseId: string;
  judicialProcessId?: string | null;
  status?: string;
  [key: string]: unknown;
};

export type TaxLegalThesis = {
  id: string;
  title: string;
  summary?: string | null;
  status?: string;
  jurisdictionScope?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaxCaseThesisLink = {
  id: string;
  taxCaseId: string;
  taxLegalThesisId: string;
  notes?: string | null;
  createdAt: string;
};

export type TaxCalculation = {
  id: string;
  organizationId: string;
  taxCaseId: string;
  calculationType: string;
  ruleSetVersion: string;
  referenceDate: string;
  inputSnapshot: Record<string, unknown>;
  resultSnapshot?: CalculationResultSnapshot | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type TaxTimelineItem = {
  id: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  occurredAt?: string;
  after?: unknown;
};

export const TAX_PROVIDER_NOT_CONFIGURED_MESSAGE =
  "Provedor tributário (federal/estadual/municipal/dívida ativa/declarações) não está configurado neste ambiente. Cadastro e cálculos manuais continuam disponíveis.";

export const CALCULATION_REVIEW_DISCLAIMER =
  "Cálculo aguarda revisão humana. Use como apoio — a decisão é sempre de uma pessoa habilitada.";

export const TAX_CASE_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativo",
  suspended: "Suspenso",
  closed: "Encerrado",
  archived: "Arquivado",
};

export const TAX_TAXPAYER_TYPE_LABELS: Record<string, string> = {
  individual: "Pessoa física",
  company: "Pessoa jurídica",
  mei: "MEI",
  public_body: "Ente público",
  other: "Outro",
};

export const TAX_JURISDICTION_SCOPE_LABELS: Record<string, string> = {
  federal: "Federal",
  state: "Estadual",
  municipal: "Municipal",
  mixed: "Misto",
  other: "Outro",
};

export const TAX_CALCULATION_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  calculated: "Calculado",
  review_required: "Aguarda revisão",
  reviewed: "Revisado",
  approved: "Aprovado",
  superseded: "Substituído",
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

function listTotal(data: Record<string, unknown>, items: unknown[]): number {
  const pagination = data.pagination as { total?: number } | undefined;
  return Number(pagination?.total ?? data.total ?? items.length);
}

export type TaxAction =
  | "read"
  | "create"
  | "update"
  | "manage_obligations"
  | "manage_credits"
  | "manage_refunds"
  | "manage_compensations"
  | "manage_assessments"
  | "manage_enforcement"
  | "manage_theses"
  | "calculate"
  | "review_calculation";

export function hasTaxPermission(
  permissions: readonly string[] | undefined,
  action: TaxAction,
): boolean {
  return hasPermission(permissions, `tax.${action}`);
}

export function taxErrorMessage(failure: AiApiFailure, fallback: string): string {
  const code = failure.error?.code ?? "";
  if (
    code === "NOT_CONFIGURED" ||
    code.endsWith("_PROVIDER_NOT_CONFIGURED") ||
    isNotConfigured(failure)
  ) {
    return TAX_PROVIDER_NOT_CONFIGURED_MESSAGE;
  }
  return aiErrorMessage(failure, fallback);
}

export function isProviderNotConfigured(status: string | undefined | null): boolean {
  return status === "not_configured" || status === "unavailable";
}

export function taxProvidersNotConfigured(status: TaxProvidersStatus): boolean {
  return (
    isProviderNotConfigured(status.federal?.status) ||
    isProviderNotConfigured(status.state?.status) ||
    isProviderNotConfigured(status.municipal?.status) ||
    isProviderNotConfigured(status.taxDebt?.status) ||
    isProviderNotConfigured(status.taxFiling?.status)
  );
}

export async function fetchTaxProvidersStatus(orgId: string) {
  return request<TaxProvidersStatus>(orgPath(orgId, "/tax-providers/status"));
}

export async function fetchTaxCases(
  orgId: string,
  query: {
    q?: string;
    clientId?: string;
    status?: string;
    jurisdictionScope?: string;
    limit?: number;
    offset?: number;
  } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/tax-cases${qs({ ...query })}`),
  );
  if (isApiFailure(data)) return data;
  const items = (data.items ?? []) as TaxCase[];
  return { items, total: listTotal(data, items) };
}

export async function fetchTaxCase(orgId: string, taxCaseId: string) {
  const data = await request<{ case: TaxCase }>(orgPath(orgId, `/tax-cases/${taxCaseId}`));
  if (isApiFailure(data)) return data;
  return { case: data.case };
}

export async function createTaxCase(
  orgId: string,
  body: {
    clientId: string;
    legalMatterId: string;
    responsibleMembershipId?: string;
    taxpayerType?: string;
    jurisdictionScope?: string;
    status?: string;
    notes?: string;
  },
) {
  return request<{ case: TaxCase }>(orgPath(orgId, "/tax-cases"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchTaxCaseTimeline(orgId: string, taxCaseId: string) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/tax-cases/${taxCaseId}/timeline`),
  );
  if (isApiFailure(data)) return data;
  return { items: (data.items ?? []) as TaxTimelineItem[] };
}

export async function fetchTaxObligations(
  orgId: string,
  taxCaseId: string,
  query: { status?: string; limit?: number; offset?: number } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/tax-cases/${taxCaseId}/obligations${qs({ ...query, taxCaseId })}`),
  );
  if (isApiFailure(data)) return data;
  const items = (data.items ?? []) as TaxObligation[];
  return { items, total: listTotal(data, items) };
}

export async function fetchTaxCredits(
  orgId: string,
  taxCaseId: string,
  query: { limit?: number } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/tax-cases/${taxCaseId}/credits${qs({ ...query, taxCaseId })}`),
  );
  if (isApiFailure(data)) return data;
  const items = (data.items ?? []) as TaxCredit[];
  return { items, total: listTotal(data, items) };
}

export async function fetchTaxRefunds(
  orgId: string,
  taxCaseId: string,
  query: { limit?: number } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/tax-cases/${taxCaseId}/refunds${qs({ ...query, taxCaseId })}`),
  );
  if (isApiFailure(data)) return data;
  const items = (data.items ?? []) as TaxRefund[];
  return { items, total: listTotal(data, items) };
}

export async function fetchTaxCompensations(
  orgId: string,
  taxCaseId: string,
  query: { limit?: number } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/tax-cases/${taxCaseId}/compensations${qs({ ...query, taxCaseId })}`),
  );
  if (isApiFailure(data)) return data;
  const items = (data.items ?? []) as TaxCompensation[];
  return { items, total: listTotal(data, items) };
}

export async function fetchTaxAssessments(
  orgId: string,
  taxCaseId: string,
  query: { limit?: number } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/tax-cases/${taxCaseId}/assessments${qs({ ...query, taxCaseId })}`),
  );
  if (isApiFailure(data)) return data;
  const items = (data.items ?? []) as TaxAssessment[];
  return { items, total: listTotal(data, items) };
}

export async function fetchTaxAdministrativeCases(orgId: string, taxCaseId: string) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/tax-cases/${taxCaseId}/administrative-cases`),
  );
  if (isApiFailure(data)) return data;
  const items = (data.items ?? []) as TaxAdministrativeCase[];
  return { items, total: items.length };
}

export async function fetchTaxEnforcements(orgId: string, taxCaseId: string) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/tax-cases/${taxCaseId}/enforcements`),
  );
  if (isApiFailure(data)) return data;
  const items = (data.items ?? []) as TaxEnforcement[];
  return { items, total: items.length };
}

export async function fetchTaxTheses(
  orgId: string,
  query: { q?: string; limit?: number; offset?: number } = {},
) {
  const data = await request<Record<string, unknown>>(orgPath(orgId, `/tax-theses${qs(query)}`));
  if (isApiFailure(data)) return data;
  const items = (data.items ?? []) as TaxLegalThesis[];
  return { items, total: listTotal(data, items) };
}

export async function fetchTaxCaseThesisLinks(orgId: string, taxCaseId: string) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/tax-cases/${taxCaseId}/thesis-links`),
  );
  if (isApiFailure(data)) return data;
  const items = (data.items ?? []) as TaxCaseThesisLink[];
  return { items, total: items.length };
}

export async function fetchTaxCalculations(
  orgId: string,
  query: {
    taxCaseId: string;
    status?: string;
    calculationType?: string;
    limit?: number;
    offset?: number;
  },
) {
  const { taxCaseId, ...rest } = query;
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/tax-cases/${taxCaseId}/calculations${qs({ ...rest, taxCaseId })}`),
  );
  if (isApiFailure(data)) return data;
  const items = (data.items ?? []) as TaxCalculation[];
  return { items, total: listTotal(data, items) };
}

/** Agrega cálculos tributários de vários casos (API não expõe listagem global). */
export async function fetchTaxCalculationsAcrossCases(
  orgId: string,
  taxCaseIds: readonly string[],
  query: { status?: string; limitPerCase?: number } = {},
) {
  const limitPerCase = query.limitPerCase ?? 20;
  const results = await Promise.all(
    taxCaseIds.map((taxCaseId) =>
      fetchTaxCalculations(orgId, {
        taxCaseId,
        status: query.status,
        limit: limitPerCase,
      }),
    ),
  );
  const items: TaxCalculation[] = [];
  for (const result of results) {
    if (!isApiFailure(result)) items.push(...result.items);
  }
  return { items, total: items.length };
}
