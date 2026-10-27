import { CSRF_HEADER } from "@verasjuris/security/constants";
import type { AiApiFailure } from "./ai";
import { aiErrorMessage, formatDateTime, hasPermission, isApiFailure, isNotConfigured } from "./ai";
import { formatMoneyCents, parseMoneyToCents } from "./auctions";
import { getActiveMembership, getActiveOrgId } from "./crm";

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
 * Previdenciário — /api/v1/organizations/:orgId
 *  previdentiary-cases | previdentiary-benefits | previdentiary-requests |
 *  previdentiary-calculations | cnis-imports | previdentiary/providers/health
 */

export type ProviderHealthStatus = "ok" | "degraded" | "unavailable" | "not_configured";

export type PrevidentiaryProviderHealth = {
  socialSecurityProvider: { id: string; status: ProviderHealthStatus; [key: string]: unknown };
  cnisProvider: { id: string; status: ProviderHealthStatus; [key: string]: unknown };
};

export type PrevidentiaryCase = {
  id: string;
  organizationId: string;
  clientId: string;
  legalMatterId: string;
  responsibleMembershipId?: string | null;
  regime: string;
  insuredCategory?: string | null;
  currentSituation?: string | null;
  notes?: string | null;
  createdByMembershipId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PrevidentiaryClientProfile = {
  id: string;
  organizationId: string;
  clientId: string;
  nitMasked?: string | null;
  pisMasked?: string | null;
  category?: string | null;
  occupation?: string | null;
  ruralWorker?: boolean;
  specialExposure?: boolean;
  disability?: boolean;
  publicServiceHistory?: boolean;
  benefitHistoryNotes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SocialSecurityBenefit = {
  id: string;
  organizationId: string;
  previdentiaryCaseId: string;
  clientId: string;
  benefitTypeId: string;
  nb?: string | null;
  normalizedNb?: string | null;
  der?: string | null;
  dib?: string | null;
  dcb?: string | null;
  dip?: string | null;
  cessacaoAt?: string | null;
  status: string;
  administrativeProcessId?: string | null;
  judicialProcessId?: string | null;
  source?: string;
  sourceReference?: string | null;
  officialInssClaim?: false;
  createdAt: string;
  updatedAt: string;
};

export type PrevidentiaryRequest = {
  id: string;
  organizationId: string;
  previdentiaryCaseId: string;
  administrativeProcessId?: string | null;
  benefitTypeId?: string | null;
  requestType: string;
  der?: string | null;
  protocolNumber?: string | null;
  protocolDate?: string | null;
  protocolSource?: string | null;
  protocolVerificationStatus?: string | null;
  protocolLabel?: string | null;
  status: string;
  source?: string;
  justificationSummary?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CalculationMemoryStep = {
  key: string;
  description: string;
  detail?: Record<string, unknown>;
};

export type CalculationResultSnapshot = {
  result?: unknown;
  memory?: CalculationMemoryStep[];
  warnings?: string[];
  missingData?: string[];
  ruleSetVersion?: string;
  engineStatus?: string;
  reviewHint?: string;
  [key: string]: unknown;
};

export type PrevidentiaryCalculation = {
  id: string;
  organizationId: string;
  previdentiaryCaseId: string;
  calculationType: string;
  ruleSetId?: string | null;
  ruleSetVersion: string;
  referenceDate: string;
  inputSnapshot: Record<string, unknown>;
  resultSnapshot?: CalculationResultSnapshot | null;
  status: string;
  createdByMembershipId?: string | null;
  reviewedByMembershipId?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CnisImport = {
  id: string;
  organizationId: string;
  previdentiaryCaseId: string;
  clientId: string;
  sourceDocumentId?: string | null;
  importFormat?: string;
  status: string;
  source?: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CnisEntry = {
  id: string;
  importId: string;
  competence: string;
  relationshipType?: string | null;
  employer?: string | null;
  employerDocument?: string | null;
  remunerationCents?: number | null;
  contributionCents?: number | null;
  indicators?: Record<string, unknown>;
  source?: string;
  reviewStatus?: string;
  createdAt: string;
  updatedAt: string;
};

export type SocialSecurityPeriod = {
  id: string;
  previdentiaryCaseId?: string;
  startDate?: string | null;
  endDate?: string | null;
  kind?: string | null;
  source?: string;
  [key: string]: unknown;
};

export type SocialSecurityContribution = {
  id: string;
  previdentiaryCaseId?: string;
  competence?: string;
  remunerationCents?: number | null;
  contributionCents?: number | null;
  source?: string;
  [key: string]: unknown;
};

export type PrevidentiaryDocumentLink = {
  id?: string;
  documentId: string;
  linkType?: string;
  createdAt?: string;
  [key: string]: unknown;
};

export type PrevidentiaryMedicalExam = {
  id: string;
  requestId: string;
  examType?: string;
  scheduledAt?: string | null;
  status: string;
  resultSummary?: string | null;
  source?: string;
  [key: string]: unknown;
};

export const MANUAL_PROTOCOL_DISCLAIMER =
  "Protocolo registrado manualmente. Não confirma integração nem protocolo oficial no INSS.";

export const CALCULATION_REVIEW_DISCLAIMER =
  "Cálculo aguarda revisão humana. Use como apoio — a decisão é sempre de uma pessoa habilitada.";

export const HIGHEST_SCENARIO_DISCLAIMER =
  "Cenário mais vantajoso = maior valor estimado entre os cenários simulados. Não é recomendação automática.";

export const CNIS_NOT_OFFICIAL_DISCLAIMER =
  "Dados de CNIS importados ou manuais. Não constituem extrato oficial do INSS.";

export const PREVIDENTIARY_PROVIDER_NOT_CONFIGURED_MESSAGE =
  "Provedor previdenciário/CNIS não está configurado neste ambiente. Cadastro e cálculo manuais continuam disponíveis.";

export const PREVIDENTIARY_REGIME_LABELS: Record<string, string> = {
  rgps: "RGPS",
  rpps: "RPPS",
  military: "Militar",
  other: "Outro",
};

export const PREVIDENTIARY_CASE_SITUATION_HINT = "Situação atual do segurado (texto livre)";

export const BENEFIT_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  requested: "Requerido",
  under_analysis: "Em análise",
  granted: "Concedido",
  active: "Ativo",
  suspended: "Suspenso",
  ceased: "Cessado",
  denied: "Indeferido",
  cancelled: "Cancelado",
  under_appeal: "Em recurso",
  judicialized: "Judicializado",
  archived: "Arquivado",
};

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  ready: "Pronto",
  submitted: "Enviado",
  under_analysis: "Em análise",
  requirement_open: "Exigência aberta",
  decided: "Decidido",
  appeal: "Recurso",
  closed: "Encerrado",
  cancelled: "Cancelado",
  archived: "Arquivado",
};

export const REQUEST_TYPE_LABELS: Record<string, string> = {
  initial_request: "Pedido inicial",
  extension: "Prorrogação",
  reconsideration: "Reconsideração",
  revision: "Revisão",
  restoration: "Restabelecimento",
  appeal: "Recurso",
  compliance: "Cumprimento",
  other: "Outro",
};

export const CALCULATION_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  calculated: "Calculado",
  review_required: "Aguarda revisão",
  reviewed: "Revisado",
  approved: "Aprovado",
  superseded: "Substituído",
};

export const CALCULATION_TYPE_LABELS: Record<string, string> = {
  tempo: "Tempo de contribuição",
  carencia: "Carência",
  salario_beneficio: "Salário de benefício",
  rmi: "RMI",
  atrasados: "Atrasados",
  scenarios: "Cenários",
  insured_status: "Qualidade de segurado",
};

export const CNIS_IMPORT_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  pending_review: "Aguarda revisão",
  reviewed: "Revisado",
  rejected: "Rejeitado",
  failed: "Falhou",
  not_configured: "Não configurado",
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

export type PrevidentiaryAction =
  | "read"
  | "create"
  | "update"
  | "manage_benefits"
  | "manage_requests"
  | "manage_cnis"
  | "calculate"
  | "review_calculation"
  | "manage_medical_exam";

export function hasPrevidentiaryPermission(
  permissions: readonly string[] | undefined,
  action: PrevidentiaryAction,
): boolean {
  return hasPermission(permissions, `previdentiary.${action}`);
}

export function previdentiaryErrorMessage(failure: AiApiFailure, fallback: string): string {
  const code = failure.error?.code ?? "";
  if (
    code === "NOT_CONFIGURED" ||
    code === "CNIS_PROVIDER_NOT_CONFIGURED" ||
    code === "SOCIAL_SECURITY_PROVIDER_NOT_CONFIGURED" ||
    isNotConfigured(failure)
  ) {
    return PREVIDENTIARY_PROVIDER_NOT_CONFIGURED_MESSAGE;
  }
  return aiErrorMessage(failure, fallback);
}

export function isProviderNotConfigured(status: string | undefined | null): boolean {
  return status === "not_configured" || status === "unavailable";
}

/** Mascara NIT/PIS para listagens (mantém últimos 2 dígitos se houver conteúdo). */
export function maskNit(value: string | null | undefined): string {
  if (!value) return "—";
  if (value === "***") return "***";
  const digits = value.replace(/\D/g, "");
  if (digits.length < 3) return "***";
  return `${"*".repeat(Math.max(digits.length - 2, 3))}${digits.slice(-2)}`;
}

export function parseCalculationSnapshot(snapshot: CalculationResultSnapshot | null | undefined): {
  memory: CalculationMemoryStep[];
  warnings: string[];
  missingData: string[];
  result: unknown;
  ruleSetVersion?: string;
  reviewHint?: string;
} {
  if (!snapshot || typeof snapshot !== "object") {
    return { memory: [], warnings: [], missingData: [], result: null };
  }
  return {
    memory: Array.isArray(snapshot.memory) ? snapshot.memory : [],
    warnings: Array.isArray(snapshot.warnings) ? snapshot.warnings.map(String) : [],
    missingData: Array.isArray(snapshot.missingData) ? snapshot.missingData.map(String) : [],
    result: snapshot.result ?? null,
    ruleSetVersion:
      typeof snapshot.ruleSetVersion === "string" ? snapshot.ruleSetVersion : undefined,
    reviewHint: typeof snapshot.reviewHint === "string" ? snapshot.reviewHint : undefined,
  };
}

export async function fetchPrevidentiaryProviderHealth(orgId: string) {
  return request<PrevidentiaryProviderHealth>(orgPath(orgId, "/previdentiary/providers/health"));
}

export async function fetchPrevidentiaryCases(
  orgId: string,
  query: {
    q?: string;
    clientId?: string;
    regime?: string;
    limit?: number;
    offset?: number;
    maskSensitive?: boolean;
  } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/previdentiary-cases${qs({ ...query })}`),
  );
  if (isApiFailure(data)) return data;
  const items = (data.items ?? data.cases ?? []) as PrevidentiaryCase[];
  return { items, total: Number(data.total ?? items.length) };
}

export async function fetchPrevidentiaryCase(orgId: string, caseId: string) {
  const data = await request<{ case: PrevidentiaryCase }>(
    orgPath(orgId, `/previdentiary-cases/${caseId}`),
  );
  if (isApiFailure(data)) return data;
  return { case: data.case };
}

export async function createPrevidentiaryCase(
  orgId: string,
  body: {
    clientId: string;
    legalMatterId: string;
    responsibleMembershipId?: string;
    regime?: string;
    insuredCategory?: string;
    currentSituation?: string;
    notes?: string;
  },
) {
  return request<{ case: PrevidentiaryCase }>(orgPath(orgId, "/previdentiary-cases"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchCaseBenefits(orgId: string, caseId: string) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/previdentiary-cases/${caseId}/benefits`),
  );
  if (isApiFailure(data)) return data;
  return { items: (data.items ?? []) as SocialSecurityBenefit[] };
}

export async function fetchCasePeriods(orgId: string, caseId: string) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/previdentiary-cases/${caseId}/periods`),
  );
  if (isApiFailure(data)) return data;
  return { items: (data.items ?? data.periods ?? []) as SocialSecurityPeriod[] };
}

export async function fetchCaseContributions(orgId: string, caseId: string) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/previdentiary-cases/${caseId}/contributions`),
  );
  if (isApiFailure(data)) return data;
  return { items: (data.items ?? data.contributions ?? []) as SocialSecurityContribution[] };
}

export async function fetchCaseDocuments(orgId: string, caseId: string) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/previdentiary-cases/${caseId}/documents`),
  );
  if (isApiFailure(data)) return data;
  return { items: (data.items ?? data.documents ?? []) as PrevidentiaryDocumentLink[] };
}

export async function fetchBenefit(orgId: string, benefitId: string) {
  const data = await request<{ benefit: SocialSecurityBenefit }>(
    orgPath(orgId, `/previdentiary-benefits/${benefitId}`),
  );
  if (isApiFailure(data)) return data;
  return { benefit: data.benefit };
}

export async function fetchPrevidentiaryRequests(
  orgId: string,
  query: { previdentiaryCaseId?: string; status?: string; limit?: number; offset?: number } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/previdentiary-requests${qs({ ...query })}`),
  );
  if (isApiFailure(data)) return data;
  return {
    items: (data.items ?? []) as PrevidentiaryRequest[],
    total: Number(data.total ?? 0),
  };
}

export async function fetchPrevidentiaryCalculations(
  orgId: string,
  query: {
    previdentiaryCaseId?: string;
    status?: string;
    calculationType?: string;
    limit?: number;
    offset?: number;
  } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/previdentiary-calculations${qs({ ...query })}`),
  );
  if (isApiFailure(data)) return data;
  return {
    items: (data.items ?? []) as PrevidentiaryCalculation[],
    total: Number(data.total ?? 0),
  };
}

export async function fetchPrevidentiaryCalculation(orgId: string, calculationId: string) {
  const data = await request<{ calculation: PrevidentiaryCalculation }>(
    orgPath(orgId, `/previdentiary-calculations/${calculationId}`),
  );
  if (isApiFailure(data)) return data;
  return { calculation: data.calculation };
}

export async function createPrevidentiaryCalculation(
  orgId: string,
  body: {
    previdentiaryCaseId: string;
    calculationType: string;
    ruleSetVersion: string;
    referenceDate: string;
    ruleSetId?: string;
    inputSnapshot?: Record<string, unknown>;
  },
) {
  return request<{ calculation: PrevidentiaryCalculation }>(
    orgPath(orgId, "/previdentiary-calculations"),
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function runPrevidentiaryCalculation(
  orgId: string,
  calculationId: string,
  body: { inputSnapshot?: Record<string, unknown> } = {},
) {
  return request<{ calculation: PrevidentiaryCalculation }>(
    orgPath(orgId, `/previdentiary-calculations/${calculationId}/run`),
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function reviewPrevidentiaryCalculation(
  orgId: string,
  calculationId: string,
  body: { decision: "reviewed" | "approved"; notes?: string },
) {
  return request<{ calculation: PrevidentiaryCalculation }>(
    orgPath(orgId, `/previdentiary-calculations/${calculationId}/review`),
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function fetchCnisImports(
  orgId: string,
  query: { previdentiaryCaseId?: string; clientId?: string; limit?: number; offset?: number } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/cnis-imports${qs({ ...query })}`),
  );
  if (isApiFailure(data)) return data;
  return {
    items: (data.items ?? []) as CnisImport[],
    total: Number(data.total ?? 0),
  };
}

export async function fetchCnisImport(orgId: string, importId: string) {
  const data = await request<{
    import: CnisImport;
    entries?: CnisEntry[];
    warnings?: Array<{ id?: string; message?: string; code?: string }>;
  }>(orgPath(orgId, `/cnis-imports/${importId}`));
  if (isApiFailure(data)) return data;
  return data;
}

export async function fetchClientProfile(
  orgId: string,
  clientId: string,
  options: { maskSensitive?: boolean } = { maskSensitive: true },
) {
  const data = await request<{ profile: PrevidentiaryClientProfile | null }>(
    orgPath(
      orgId,
      `/previdentiary-client-profiles/${clientId}${qs({
        maskSensitive: options.maskSensitive ?? true,
      })}`,
    ),
  );
  if (isApiFailure(data)) return data;
  return { profile: data.profile };
}
