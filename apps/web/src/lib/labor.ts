import { CSRF_HEADER } from "@verasjuris/security/constants";
import type { AiApiFailure } from "./ai";
import { aiErrorMessage, formatDateTime, hasPermission, isApiFailure, isNotConfigured } from "./ai";
import { formatMoneyCents, parseMoneyToCents } from "./auctions";
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
  parseMoneyToCents,
  parseCalculationSnapshot,
};

export type { CalculationMemoryStep, CalculationResultSnapshot };

/**
 * Trabalhista — /api/v1/organizations/:orgId
 *  labor-cases | employment-contracts | work-schedules | labor-remuneration |
 *  fgts | labor-calculations | labor-liquidations | labor-providers/status
 */

export type ProviderHealthStatus = "ok" | "degraded" | "unavailable" | "not_configured";

export type LaborProvidersStatus = {
  eSocial: { provider: string; status: ProviderHealthStatus; health?: unknown };
  fgts: {
    provider: string;
    status: ProviderHealthStatus;
    officialBalanceAvailable?: boolean;
    disclaimer?: string;
    health?: unknown;
  };
  laborCourt: { provider: string; status: ProviderHealthStatus; health?: unknown };
  timeTrackingImport: {
    provider: string;
    status: ProviderHealthStatus;
    manualEntryAvailable?: boolean;
    health?: unknown;
  };
  manualEntryAvailable?: boolean;
};

export type LaborCase = {
  id: string;
  organizationId: string;
  clientId: string;
  legalMatterId: string;
  judicialProcessId?: string | null;
  responsibleMembershipId?: string | null;
  clientRole: string;
  status: string;
  notes?: string | null;
  createdByMembershipId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EmploymentContract = {
  id: string;
  organizationId: string;
  laborCaseId: string;
  employeeClientId?: string | null;
  employerName: string;
  employerDocument?: string | null;
  admissionDate: string;
  terminationDate?: string | null;
  contractType?: string | null;
  jobTitle?: string | null;
  workplace?: string | null;
  salaryCents: number;
  weeklyHours?: number | null;
  status: string;
  source?: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkSchedule = {
  id: string;
  laborCaseId: string;
  name: string;
  weeklyHours?: number | null;
  includesNightShift?: boolean;
  includesOvertimeBank?: boolean;
  notes?: string | null;
  createdAt: string;
  [key: string]: unknown;
};

export type WorkTimeRecord = {
  id: string;
  laborCaseId: string;
  workedDate?: string | null;
  kind?: string;
  startMinute?: number;
  endMinute?: number;
  source?: string;
  [key: string]: unknown;
};

export type LaborRemunerationItem = {
  id: string;
  laborCaseId: string;
  itemType?: string;
  label?: string;
  amountCents?: number;
  competence?: string;
  source?: string;
  [key: string]: unknown;
};

export type VacationPeriod = {
  id: string;
  laborCaseId: string;
  startDate?: string | null;
  endDate?: string | null;
  days?: number | null;
  status?: string;
  [key: string]: unknown;
};

export type FgtsRecord = {
  id: string;
  laborCaseId: string;
  competence?: string;
  depositCents?: number | null;
  balanceCents?: number | null;
  source?: string;
  notes?: string | null;
  [key: string]: unknown;
};

export type EmploymentTermination = {
  id: string;
  laborCaseId: string;
  terminationDate?: string | null;
  verb?: string | null;
  reason?: string | null;
  source?: string;
  [key: string]: unknown;
};

export type LaborClaimItem = {
  id: string;
  laborCaseId: string;
  claimKey?: string;
  title?: string;
  status?: string;
  estimatedCents?: number | null;
  facts?: string | null;
  [key: string]: unknown;
};

export type LaborCalculation = {
  id: string;
  organizationId: string;
  laborCaseId: string;
  calculationType: string;
  referenceDate: string;
  ruleSetId?: string | null;
  ruleSetVersion: string;
  inputSnapshot: Record<string, unknown>;
  resultSnapshot?: CalculationResultSnapshot | null;
  status: string;
  createdByMembershipId?: string | null;
  reviewedByMembershipId?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LaborLiquidation = {
  id: string;
  laborCaseId: string;
  calculationId?: string | null;
  referenceDate: string;
  totalCents?: number;
  status: string;
  notes?: string | null;
  createdAt: string;
  [key: string]: unknown;
};

export type LaborDocumentLink = {
  id?: string;
  documentId: string;
  linkType?: string;
  createdAt?: string;
  [key: string]: unknown;
};

export type LaborTimelineItem = {
  id?: string;
  kind?: string;
  title?: string;
  body?: string | null;
  occurredAt?: string;
  [key: string]: unknown;
};

export const FGTS_ESTIMATE_DISCLAIMER =
  "Estimativa de FGTS com base nos valores informados (não é saldo oficial).";

export const CALCULATION_REVIEW_DISCLAIMER =
  "Cálculo aguarda revisão humana. Use como apoio — a decisão é sempre de uma pessoa habilitada.";

export const LABOR_PROVIDER_NOT_CONFIGURED_MESSAGE =
  "Provedor trabalhista (eSocial/FGTS/tribunal/ponto) não está configurado neste ambiente. Cadastro e cálculo manuais continuam disponíveis.";

export const LABOR_CASE_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativo",
  suspended: "Suspenso",
  closed: "Encerrado",
  archived: "Arquivado",
};

export const LABOR_CLIENT_ROLE_LABELS: Record<string, string> = {
  employee: "Empregado",
  employer: "Empregador",
  other: "Outro",
};

export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativo",
  suspended: "Suspenso",
  terminated: "Rescindido",
  cancelled: "Cancelado",
  archived: "Arquivado",
};

export const LABOR_CALCULATION_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  calculated: "Calculado",
  review_required: "Aguarda revisão",
  reviewed: "Revisado",
  approved: "Aprovado",
  superseded: "Substituído",
};

export const LABOR_CALCULATION_TYPE_LABELS: Record<string, string> = {
  jornada: "Jornada",
  remuneracao: "Remuneração",
  ferias: "Férias",
  fgts: "FGTS",
  rescisao: "Rescisão",
  liquidacao: "Liquidação",
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

export type LaborAction =
  | "read"
  | "create"
  | "update"
  | "manage_contract"
  | "manage_schedule"
  | "manage_remuneration"
  | "manage_fgts"
  | "manage_termination"
  | "manage_claims"
  | "calculate"
  | "review_calculation"
  | "liquidate";

export function hasLaborPermission(
  permissions: readonly string[] | undefined,
  action: LaborAction,
): boolean {
  return hasPermission(permissions, `labor.${action}`);
}

export function laborErrorMessage(failure: AiApiFailure, fallback: string): string {
  const code = failure.error?.code ?? "";
  if (
    code === "NOT_CONFIGURED" ||
    code === "ESOCIAL_PROVIDER_NOT_CONFIGURED" ||
    code === "FGTS_PROVIDER_NOT_CONFIGURED" ||
    code === "LABOR_COURT_PROVIDER_NOT_CONFIGURED" ||
    code === "TIME_TRACKING_IMPORT_PROVIDER_NOT_CONFIGURED" ||
    isNotConfigured(failure)
  ) {
    return LABOR_PROVIDER_NOT_CONFIGURED_MESSAGE;
  }
  return aiErrorMessage(failure, fallback);
}

export function isProviderNotConfigured(status: string | undefined | null): boolean {
  return status === "not_configured" || status === "unavailable";
}

export async function fetchLaborProvidersStatus(orgId: string) {
  return request<LaborProvidersStatus>(orgPath(orgId, "/labor-providers/status"));
}

export async function fetchLaborCases(
  orgId: string,
  query: {
    q?: string;
    clientId?: string;
    clientRole?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/labor-cases${qs({ ...query })}`),
  );
  if (isApiFailure(data)) return data;
  const items = (data.items ?? data.cases ?? []) as LaborCase[];
  return { items, total: Number(data.total ?? items.length) };
}

export async function fetchLaborCase(orgId: string, laborCaseId: string) {
  const data = await request<{ laborCase: LaborCase }>(
    orgPath(orgId, `/labor-cases/${laborCaseId}`),
  );
  if (isApiFailure(data)) return data;
  return { laborCase: data.laborCase };
}

export async function createLaborCase(
  orgId: string,
  body: {
    clientId: string;
    legalMatterId: string;
    judicialProcessId?: string;
    responsibleMembershipId?: string;
    clientRole?: string;
    status?: string;
    notes?: string;
  },
) {
  return request<{ laborCase: LaborCase }>(orgPath(orgId, "/labor-cases"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchLaborCaseTimeline(orgId: string, laborCaseId: string) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/labor-cases/${laborCaseId}/timeline`),
  );
  if (isApiFailure(data)) return data;
  return { items: (data.items ?? data.timeline ?? []) as LaborTimelineItem[] };
}

export async function fetchLaborCaseDocuments(orgId: string, laborCaseId: string) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/labor-cases/${laborCaseId}/documents`),
  );
  if (isApiFailure(data)) return data;
  return { items: (data.items ?? data.documents ?? []) as LaborDocumentLink[] };
}

async function scopedList<T>(
  orgId: string,
  suffix: string,
  query: { laborCaseId?: string; limit?: number; offset?: number } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `${suffix}${qs({ ...query })}`),
  );
  if (isApiFailure(data)) return data;
  return { items: (data.items ?? []) as T[], total: Number(data.total ?? 0) };
}

export function fetchEmploymentContracts(
  orgId: string,
  query: { laborCaseId?: string; limit?: number; offset?: number } = {},
) {
  return scopedList<EmploymentContract>(orgId, "/employment-contracts", query);
}

export function fetchWorkSchedules(
  orgId: string,
  query: { laborCaseId?: string; limit?: number; offset?: number } = {},
) {
  return scopedList<WorkSchedule>(orgId, "/work-schedules", query);
}

export function fetchWorkTimeRecords(
  orgId: string,
  query: { laborCaseId?: string; limit?: number; offset?: number } = {},
) {
  return scopedList<WorkTimeRecord>(orgId, "/work-time-records", query);
}

export function fetchLaborRemuneration(
  orgId: string,
  query: { laborCaseId?: string; limit?: number; offset?: number } = {},
) {
  return scopedList<LaborRemunerationItem>(orgId, "/labor-remuneration", query);
}

export function fetchVacations(
  orgId: string,
  query: { laborCaseId?: string; limit?: number; offset?: number } = {},
) {
  return scopedList<VacationPeriod>(orgId, "/vacations", query);
}

export function fetchFgtsRecords(
  orgId: string,
  query: { laborCaseId?: string; limit?: number; offset?: number } = {},
) {
  return scopedList<FgtsRecord>(orgId, "/fgts", query);
}

export function fetchEmploymentTerminations(
  orgId: string,
  query: { laborCaseId?: string; limit?: number; offset?: number } = {},
) {
  return scopedList<EmploymentTermination>(orgId, "/employment-terminations", query);
}

export function fetchLaborClaims(
  orgId: string,
  query: { laborCaseId?: string; limit?: number; offset?: number } = {},
) {
  return scopedList<LaborClaimItem>(orgId, "/labor-claims", query);
}

export function fetchLaborCalculations(
  orgId: string,
  query: { laborCaseId?: string; limit?: number; offset?: number } = {},
) {
  return scopedList<LaborCalculation>(orgId, "/labor-calculations", query);
}

export function fetchLaborLiquidations(
  orgId: string,
  query: { laborCaseId?: string; limit?: number; offset?: number } = {},
) {
  return scopedList<LaborLiquidation>(orgId, "/labor-liquidations", query);
}

export async function fetchLaborCalculation(orgId: string, calculationId: string) {
  const data = await request<{ calculation: LaborCalculation }>(
    orgPath(orgId, `/labor-calculations/${calculationId}`),
  );
  if (isApiFailure(data)) return data;
  return { calculation: data.calculation };
}

export async function createLaborCalculation(
  orgId: string,
  body: {
    laborCaseId: string;
    calculationType: string;
    referenceDate: string;
    ruleSetVersion: string;
    ruleSetId?: string;
    inputSnapshot?: Record<string, unknown>;
  },
) {
  return request<{ calculation: LaborCalculation }>(orgPath(orgId, "/labor-calculations"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function runLaborCalculation(orgId: string, calculationId: string) {
  return request<{ calculation: LaborCalculation }>(
    orgPath(orgId, `/labor-calculations/${calculationId}/run`),
    { method: "POST", body: JSON.stringify({}) },
  );
}

export async function reviewLaborCalculation(
  orgId: string,
  calculationId: string,
  body: { status: "reviewed" | "approved"; notes?: string },
) {
  return request<{ calculation: LaborCalculation }>(
    orgPath(orgId, `/labor-calculations/${calculationId}/review`),
    { method: "POST", body: JSON.stringify(body) },
  );
}
