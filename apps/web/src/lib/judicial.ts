import { CSRF_HEADER } from "@verasjuris/security/constants";
import type { ApiFailure } from "./types";
import { apiErrorMessage, getActiveMembership, getActiveOrgId, isApiFailure } from "./crm";

export { apiErrorMessage, getActiveMembership, getActiveOrgId, isApiFailure };

export type JudicialProcessStatus = "active" | "suspended" | "closed" | "archived";

export type JudicialConfidentiality = "public" | "restricted" | "secret";

export type JudicialDataSource = "manual" | "document" | "court_provider" | "import";

export type JudicialPartyRole =
  | "author"
  | "defendant"
  | "appellant"
  | "appellee"
  | "exequente"
  | "executado"
  | "impetrante"
  | "coatora"
  | "third_party"
  | "interested"
  | "other";

export type JudicialPartySide = "active" | "passive" | "neutral" | "other";

export type JudicialLawyerRepresentation =
  | "counsel"
  | "correspondent"
  | "public_defender"
  | "prosecutor"
  | "other";

export type JudicialHearingType = "conciliation" | "instruction" | "judgment" | "una" | "other";

export type JudicialHearingStatus =
  | "scheduled"
  | "confirmed"
  | "rescheduled"
  | "held"
  | "cancelled";

export type JudicialHearingLocation = "in_person" | "remote" | "hybrid" | "undetermined";

export type JudicialDecisionType = "interlocutory" | "sentence" | "acordao" | "despacho" | "other";

export type JudicialAppealStatus =
  | "draft"
  | "planned"
  | "filed"
  | "pending"
  | "decided"
  | "withdrawn"
  | "not_filed";

export type JudicialEnforcementType = "compliance" | "execution" | "provisional" | "other";

export type JudicialEnforcementStatus = "planned" | "active" | "suspended" | "ended";

export type Court = {
  id: string;
  code: string;
  name: string;
  acronym: string;
  branch?: string;
  jurisdictionLevel?: string;
  stateCode?: string | null;
  active?: boolean;
};

export type CourtUnit = {
  id: string;
  tribunalId: string;
  code?: string | null;
  name: string;
  unitType?: string;
  districtId?: string | null;
  active?: boolean;
};

export type JudicialDistrict = {
  id: string;
  name: string;
  stateCode: string;
  tribunalId?: string | null;
  active?: boolean;
};

export type ProceduralClass = {
  id: string;
  code?: string | null;
  name: string;
  active?: boolean;
};

export type ProceduralSubject = {
  id: string;
  code?: string | null;
  name: string;
  parentId?: string | null;
  active?: boolean;
};

export type JudicialPhase = {
  id: string;
  slug: string;
  name: string;
  sortOrder?: number;
  active?: boolean;
};

export type CatalogRef = { id: string; name: string; acronym?: string; code?: string | null };

export type JudicialProcessParty = {
  id: string;
  displayName: string;
  documentNormalized?: string | null;
  proceduralRole: JudicialPartyRole;
  side: JudicialPartySide;
  isPrimary: boolean;
  active?: boolean;
  clientId?: string | null;
  contactId?: string | null;
};

export type JudicialProcessLawyer = {
  id: string;
  displayName: string;
  oabNumber?: string | null;
  oabState?: string | null;
  oabVerificationStatus: string;
  representationType: JudicialLawyerRepresentation;
  active?: boolean;
  source?: JudicialDataSource;
  partyId?: string | null;
};

export type JudicialMovement = {
  id: string;
  occurredAt: string;
  sequence?: number | null;
  title: string;
  description?: string | null;
  movementCode?: string | null;
  source: JudicialDataSource;
  sourceReference?: string | null;
  capturedAt?: string | null;
};

export type JudicialHearing = {
  id: string;
  type: JudicialHearingType;
  scheduledAt: string;
  timezone?: string;
  locationType: JudicialHearingLocation;
  locationText?: string | null;
  meetingUrl?: string | null;
  status: JudicialHearingStatus;
  notes?: string | null;
  resultSummary?: string | null;
  source: JudicialDataSource;
};

export type JudicialDecision = {
  id: string;
  decisionType: JudicialDecisionType;
  decidedAt?: string | null;
  publishedAt?: string | null;
  title: string;
  summary?: string | null;
  outcome?: string | null;
  source: JudicialDataSource;
  sourceReference?: string | null;
};

export type JudicialAppeal = {
  id: string;
  appealType: string;
  status: JudicialAppealStatus;
  filedAt?: string | null;
  protocolReference?: string | null;
  source: JudicialDataSource;
  appellantPartyId?: string | null;
  appelleePartyId?: string | null;
  parentDecisionId?: string | null;
};

export type JudicialEnforcement = {
  id: string;
  type: JudicialEnforcementType;
  status: JudicialEnforcementStatus;
  startedAt: string;
  endedAt?: string | null;
  summary?: string | null;
  source: JudicialDataSource;
};

export type JudicialTimelineItem = {
  id: string;
  eventType: string;
  title: string;
  body?: string | null;
  occurredAt: string;
  recordedAt?: string;
  source: JudicialDataSource;
};

export type JudicialProcessSubject = {
  id: string;
  subjectId: string;
  isPrimary: boolean;
  subject?: CatalogRef | null;
};

export type JudicialProcessSummary = {
  id: string;
  legalMatterId: string;
  cnjNumber: string;
  cnjNumberNormalized: string;
  tribunalId: string;
  tribunal?: CatalogRef | null;
  courtUnitId?: string | null;
  courtUnit?: CatalogRef | null;
  courtUnitText?: string | null;
  districtId?: string | null;
  district?: CatalogRef | null;
  districtText?: string | null;
  proceduralClassId?: string | null;
  proceduralClass?: CatalogRef | null;
  status: JudicialProcessStatus;
  currentPhaseId?: string | null;
  currentPhase?: CatalogRef | null;
  confidentialityLevel: JudicialConfidentiality;
  source: JudicialDataSource;
  sourceReference?: string | null;
  sourceUpdatedAt?: string | null;
  lastMovementAt?: string | null;
  filingDate?: string | null;
  distributionDate?: string | null;
  closedAt?: string | null;
  updatedAt: string;
  createdAt: string;
};

export type JudicialProcessDetail = JudicialProcessSummary & {
  primarySubjectId?: string | null;
  primarySubject?: CatalogRef | null;
  subjects?: JudicialProcessSubject[];
  parties?: JudicialProcessParty[];
  lawyers?: JudicialProcessLawyer[];
  movements?: JudicialMovement[];
  hearings?: JudicialHearing[];
  decisions?: JudicialDecision[];
  appeals?: JudicialAppeal[];
  enforcements?: JudicialEnforcement[];
  timeline?: JudicialTimelineItem[];
  closureReason?: string | null;
  closureSource?: JudicialDataSource | null;
  closureNotes?: string | null;
};

export type JudicialProcessListResult = {
  items: JudicialProcessSummary[];
  total: number;
  limit: number;
  offset: number;
};

export type JudicialProcessListQuery = {
  q?: string;
  status?: JudicialProcessStatus;
  limit?: number;
  offset?: number;
};

export type CreateJudicialProcessInput = {
  cnjNumber: string;
  tribunalId: string;
  courtUnitId?: string;
  courtUnitText?: string;
  districtId?: string;
  districtText?: string;
  proceduralClassId?: string;
  primarySubjectId?: string;
  subjectIds?: string[];
  confidentialityLevel?: JudicialConfidentiality;
  filingDate?: string;
  distributionDate?: string;
  currentPhaseId?: string;
};

export const JUDICIAL_STATUS_LABELS: Record<JudicialProcessStatus, string> = {
  active: "Ativo",
  suspended: "Suspenso",
  closed: "Baixado",
  archived: "Arquivado",
};

export const CONFIDENTIALITY_LABELS: Record<JudicialConfidentiality, string> = {
  public: "Público",
  restricted: "Restrito",
  secret: "Segredo de justiça",
};

export const DATA_SOURCE_LABELS: Record<JudicialDataSource, string> = {
  manual: "Cadastro manual",
  document: "Documento",
  court_provider: "Provedor judicial",
  import: "Importação",
};

export const PARTY_ROLE_LABELS: Record<JudicialPartyRole, string> = {
  author: "Autor(a)",
  defendant: "Réu/Ré",
  appellant: "Recorrente",
  appellee: "Recorrido(a)",
  exequente: "Exequente",
  executado: "Executado(a)",
  impetrante: "Impetrante",
  coatora: "Autoridade coatora",
  third_party: "Terceiro",
  interested: "Interessado(a)",
  other: "Outro",
};

export const PARTY_SIDE_LABELS: Record<JudicialPartySide, string> = {
  active: "Polo ativo",
  passive: "Polo passivo",
  neutral: "Neutro",
  other: "Outro",
};

export const LAWYER_REPRESENTATION_LABELS: Record<JudicialLawyerRepresentation, string> = {
  counsel: "Advogado(a) constituído(a)",
  correspondent: "Correspondente",
  public_defender: "Defensoria",
  prosecutor: "Ministério Público",
  other: "Outro",
};

export const HEARING_TYPE_LABELS: Record<JudicialHearingType, string> = {
  conciliation: "Conciliação",
  instruction: "Instrução",
  judgment: "Julgamento",
  una: "Una",
  other: "Outra",
};

export const HEARING_STATUS_LABELS: Record<JudicialHearingStatus, string> = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  rescheduled: "Remarcada",
  held: "Realizada",
  cancelled: "Cancelada",
};

export const HEARING_LOCATION_LABELS: Record<JudicialHearingLocation, string> = {
  in_person: "Presencial",
  remote: "Remota",
  hybrid: "Híbrida",
  undetermined: "Não informada",
};

export const DECISION_TYPE_LABELS: Record<JudicialDecisionType, string> = {
  interlocutory: "Interlocutória",
  sentence: "Sentença",
  acordao: "Acórdão",
  despacho: "Despacho",
  other: "Outra",
};

export const APPEAL_STATUS_LABELS: Record<JudicialAppealStatus, string> = {
  draft: "Rascunho",
  planned: "Planejado",
  filed: "Protocolado",
  pending: "Em tramitação",
  decided: "Julgado",
  withdrawn: "Desistido",
  not_filed: "Não interposto",
};

export const ENFORCEMENT_TYPE_LABELS: Record<JudicialEnforcementType, string> = {
  compliance: "Cumprimento de sentença",
  execution: "Execução",
  provisional: "Provisório",
  other: "Outro",
};

export const ENFORCEMENT_STATUS_LABELS: Record<JudicialEnforcementStatus, string> = {
  planned: "Planejado",
  active: "Em andamento",
  suspended: "Suspenso",
  ended: "Encerrado",
};

function jsonHeaders(): HeadersInit {
  return { "content-type": "application/json", [CSRF_HEADER]: "1" };
}

function orgPath(orgId: string, suffix: string): string {
  return `/api/v1/organizations/${orgId}${suffix}`;
}

function processPath(orgId: string, matterId: string, suffix = ""): string {
  return orgPath(orgId, `/matters/${matterId}/judicial-processes${suffix}`);
}

function buildQuery(query: Record<string, string | number | boolean | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

function asList<T>(body: { items?: T[]; [key: string]: unknown }, keys: string[]): T[] {
  for (const key of keys) {
    const value = body[key];
    if (Array.isArray(value)) return value as T[];
  }
  return body.items ?? [];
}

export function hasJudicialPermission(
  permissions: readonly string[] | undefined,
  action:
    | "read"
    | "create"
    | "update"
    | "manage_parties"
    | "manage_lawyers"
    | "manage_phase"
    | "manage_movements"
    | "manage_hearings"
    | "manage_decisions"
    | "manage_appeals"
    | "manage_enforcement"
    | "close"
    | "reopen",
): boolean {
  if (!permissions) return false;
  return permissions.includes(`judicial_process.${action}`);
}

export function judicialStatusTone(
  status: JudicialProcessStatus,
): "neutral" | "success" | "warning" | "error" {
  if (status === "active") return "success";
  if (status === "suspended") return "warning";
  return "neutral";
}

export function dataSourceLabel(source: JudicialDataSource | string | null | undefined): string {
  if (!source) return "—";
  return DATA_SOURCE_LABELS[source as JudicialDataSource] ?? source;
}

export function oabStatusLabel(status: string | null | undefined): string {
  if (!status || status === "unverified") return "OAB não verificada";
  if (status === "verified") return "OAB verificada";
  if (status === "pending") return "OAB em verificação";
  if (status === "rejected") return "OAB rejeitada";
  return status;
}

export function courtUnitLabel(process: JudicialProcessSummary): string {
  return process.courtUnit?.name ?? process.courtUnitText ?? "—";
}

export function districtLabel(process: JudicialProcessSummary): string {
  return process.district?.name ?? process.districtText ?? "—";
}

/** Digits-only CNJ (20 chars). Client-side structural validation (Res. CNJ 65/2008). */
export function normalizeCnjNumber(input: string): string {
  return input.replace(/\D/g, "");
}

export function formatCnjNumber(normalized: string): string {
  const digits = normalizeCnjNumber(normalized);
  if (digits.length !== 20) return inputOrDigits(normalized);
  return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
}

function inputOrDigits(value: string): string {
  return value;
}

function computeCnjCheckDigits(
  sequential: string,
  year: string,
  segment: string,
  court: string,
  origin: string,
): string {
  const base = `${sequential}${year}${segment}${court}${origin}00`;
  const remainder = Number(BigInt(base) % 97n);
  const dv = 98 - remainder;
  return String(dv).padStart(2, "0");
}

export type CnjValidationResult =
  | {
      ok: true;
      normalized: string;
      formatted: string;
      message: "Número CNJ válido em formato";
    }
  | { ok: false; message: string };

export function validateCnjNumber(input: string): CnjValidationResult {
  const normalized = normalizeCnjNumber(input);
  if (!/^\d{20}$/.test(normalized)) {
    return {
      ok: false,
      message: "Informe um número CNJ com 20 dígitos (formato NNNNNNN-DD.AAAA.J.TR.OOOO).",
    };
  }

  const sequential = normalized.slice(0, 7);
  const checkDigits = normalized.slice(7, 9);
  const year = normalized.slice(9, 13);
  const segment = normalized.slice(13, 14);
  const court = normalized.slice(14, 16);
  const origin = normalized.slice(16, 20);

  const yearNum = Number(year);
  if (yearNum < 1900 || yearNum > 2100) {
    return { ok: false, message: "Ano do número CNJ inválido." };
  }

  const expected = computeCnjCheckDigits(sequential, year, segment, court, origin);
  if (checkDigits !== expected) {
    return { ok: false, message: "Dígito verificador do número CNJ inválido." };
  }

  return {
    ok: true,
    normalized,
    formatted: formatCnjNumber(normalized),
    message: "Número CNJ válido em formato",
  };
}

export async function fetchCourts(orgId: string): Promise<{ courts: Court[] } | ApiFailure> {
  const response = await fetch(orgPath(orgId, "/courts"), { cache: "no-store" });
  const body = (await response.json()) as { courts?: Court[]; items?: Court[] } | ApiFailure;
  if (isApiFailure(body)) return body;
  return { courts: body.courts ?? body.items ?? [] };
}

export async function fetchCourtUnits(
  orgId: string,
  query: { tribunalId?: string; q?: string } = {},
): Promise<{ courtUnits: CourtUnit[] } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/court-units${buildQuery(query)}`), {
    cache: "no-store",
  });
  const body = (await response.json()) as
    | { courtUnits?: CourtUnit[]; units?: CourtUnit[]; items?: CourtUnit[] }
    | ApiFailure;
  if (isApiFailure(body)) return body;
  return { courtUnits: body.courtUnits ?? body.units ?? body.items ?? [] };
}

export async function fetchJudicialDistricts(
  orgId: string,
  query: { tribunalId?: string; q?: string; stateCode?: string } = {},
): Promise<{ districts: JudicialDistrict[] } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/judicial-districts${buildQuery(query)}`), {
    cache: "no-store",
  });
  const body = (await response.json()) as
    | {
        districts?: JudicialDistrict[];
        judicialDistricts?: JudicialDistrict[];
        items?: JudicialDistrict[];
      }
    | ApiFailure;
  if (isApiFailure(body)) return body;
  return { districts: body.districts ?? body.judicialDistricts ?? body.items ?? [] };
}

export async function fetchProceduralClasses(
  orgId: string,
  query: { q?: string } = {},
): Promise<{ proceduralClasses: ProceduralClass[] } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/procedural-classes${buildQuery(query)}`), {
    cache: "no-store",
  });
  const body = (await response.json()) as
    | { proceduralClasses?: ProceduralClass[]; items?: ProceduralClass[] }
    | ApiFailure;
  if (isApiFailure(body)) return body;
  return { proceduralClasses: body.proceduralClasses ?? body.items ?? [] };
}

export async function fetchProceduralSubjects(
  orgId: string,
  query: { q?: string } = {},
): Promise<{ proceduralSubjects: ProceduralSubject[] } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/procedural-subjects${buildQuery(query)}`), {
    cache: "no-store",
  });
  const body = (await response.json()) as
    | {
        proceduralSubjects?: ProceduralSubject[];
        subjects?: ProceduralSubject[];
        items?: ProceduralSubject[];
      }
    | ApiFailure;
  if (isApiFailure(body)) return body;
  return {
    proceduralSubjects: body.proceduralSubjects ?? body.subjects ?? body.items ?? [],
  };
}

export async function fetchJudicialPhases(
  orgId: string,
): Promise<{ phases: JudicialPhase[] } | ApiFailure> {
  const response = await fetch(orgPath(orgId, "/judicial-phases"), { cache: "no-store" });
  const body = (await response.json()) as
    | { phases?: JudicialPhase[]; judicialPhases?: JudicialPhase[]; items?: JudicialPhase[] }
    | ApiFailure;
  if (isApiFailure(body)) return body;
  return { phases: body.phases ?? body.judicialPhases ?? body.items ?? [] };
}

export async function fetchJudicialProcesses(
  orgId: string,
  matterId: string,
  query: JudicialProcessListQuery = {},
): Promise<JudicialProcessListResult | ApiFailure> {
  const response = await fetch(processPath(orgId, matterId, buildQuery(query)), {
    cache: "no-store",
  });
  const body = (await response.json()) as
    | {
        items?: JudicialProcessSummary[];
        judicialProcesses?: JudicialProcessSummary[];
        processes?: JudicialProcessSummary[];
        total?: number;
        limit?: number;
        offset?: number;
      }
    | ApiFailure;
  if (isApiFailure(body)) return body;
  const items = body.items ?? body.judicialProcesses ?? body.processes ?? [];
  return {
    items,
    total: body.total ?? items.length,
    limit: body.limit ?? 20,
    offset: body.offset ?? 0,
  };
}

function normalizeProcessDetail(raw: JudicialProcessDetail): JudicialProcessDetail {
  return {
    ...raw,
    subjects: raw.subjects ?? [],
    parties: raw.parties ?? [],
    lawyers: raw.lawyers ?? [],
    movements: raw.movements ?? [],
    hearings: raw.hearings ?? [],
    decisions: raw.decisions ?? [],
    appeals: raw.appeals ?? [],
    enforcements: raw.enforcements ?? [],
    timeline: raw.timeline ?? [],
  };
}

export async function fetchJudicialProcess(
  orgId: string,
  matterId: string,
  processId: string,
): Promise<{ process: JudicialProcessDetail } | ApiFailure> {
  const response = await fetch(processPath(orgId, matterId, `/${processId}`), {
    cache: "no-store",
  });
  const body = (await response.json()) as
    | {
        process?: JudicialProcessDetail;
        judicialProcess?: JudicialProcessDetail;
      }
    | JudicialProcessDetail
    | ApiFailure;
  if (isApiFailure(body)) return body;
  if ("judicialProcess" in body && body.judicialProcess) {
    return { process: normalizeProcessDetail(body.judicialProcess) };
  }
  if ("process" in body && body.process) {
    return { process: normalizeProcessDetail(body.process) };
  }
  if ("id" in body && typeof body.id === "string") {
    return { process: normalizeProcessDetail(body as JudicialProcessDetail) };
  }
  return { error: { code: "NOT_FOUND", message: "Processo judicial não encontrado." } };
}

export async function createJudicialProcess(
  orgId: string,
  matterId: string,
  input: CreateJudicialProcessInput,
): Promise<{ process: { id: string } & Partial<JudicialProcessDetail> } | ApiFailure> {
  const response = await fetch(processPath(orgId, matterId), {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(input),
  });
  const body = (await response.json()) as
    | { process?: { id: string }; judicialProcess?: { id: string } }
    | ApiFailure;
  if (isApiFailure(body)) return body;
  if (body.judicialProcess) return { process: body.judicialProcess };
  if (body.process) return { process: body.process };
  return {
    error: { code: "INTERNAL_ERROR", message: "Resposta inválida ao cadastrar o processo." },
  };
}

async function fetchSubresource<T>(
  orgId: string,
  matterId: string,
  processId: string,
  suffix: string,
  keys: string[],
): Promise<{ items: T[] } | ApiFailure> {
  const response = await fetch(processPath(orgId, matterId, `/${processId}${suffix}`), {
    cache: "no-store",
  });
  const body = (await response.json()) as ({ items?: T[] } & Record<string, unknown>) | ApiFailure;
  if (isApiFailure(body)) return body;
  return { items: asList<T>(body, keys) };
}

export async function fetchJudicialParties(
  orgId: string,
  matterId: string,
  processId: string,
): Promise<{ parties: JudicialProcessParty[] } | ApiFailure> {
  const result = await fetchSubresource<JudicialProcessParty>(
    orgId,
    matterId,
    processId,
    "/parties",
    ["parties"],
  );
  if (isApiFailure(result)) return result;
  return { parties: result.items };
}

export async function fetchJudicialLawyers(
  orgId: string,
  matterId: string,
  processId: string,
): Promise<{ lawyers: JudicialProcessLawyer[] } | ApiFailure> {
  const result = await fetchSubresource<JudicialProcessLawyer>(
    orgId,
    matterId,
    processId,
    "/lawyers",
    ["lawyers"],
  );
  if (isApiFailure(result)) return result;
  return { lawyers: result.items };
}

export async function fetchJudicialMovements(
  orgId: string,
  matterId: string,
  processId: string,
): Promise<{ movements: JudicialMovement[] } | ApiFailure> {
  const result = await fetchSubresource<JudicialMovement>(
    orgId,
    matterId,
    processId,
    "/movements",
    ["movements"],
  );
  if (isApiFailure(result)) return result;
  return { movements: result.items };
}

export async function fetchJudicialHearings(
  orgId: string,
  matterId: string,
  processId: string,
): Promise<{ hearings: JudicialHearing[] } | ApiFailure> {
  const result = await fetchSubresource<JudicialHearing>(orgId, matterId, processId, "/hearings", [
    "hearings",
  ]);
  if (isApiFailure(result)) return result;
  return { hearings: result.items };
}

export async function fetchJudicialDecisions(
  orgId: string,
  matterId: string,
  processId: string,
): Promise<{ decisions: JudicialDecision[] } | ApiFailure> {
  const result = await fetchSubresource<JudicialDecision>(
    orgId,
    matterId,
    processId,
    "/decisions",
    ["decisions"],
  );
  if (isApiFailure(result)) return result;
  return { decisions: result.items };
}

export async function fetchJudicialAppeals(
  orgId: string,
  matterId: string,
  processId: string,
): Promise<{ appeals: JudicialAppeal[] } | ApiFailure> {
  const result = await fetchSubresource<JudicialAppeal>(orgId, matterId, processId, "/appeals", [
    "appeals",
  ]);
  if (isApiFailure(result)) return result;
  return { appeals: result.items };
}

export async function fetchJudicialEnforcements(
  orgId: string,
  matterId: string,
  processId: string,
): Promise<{ enforcements: JudicialEnforcement[] } | ApiFailure> {
  const result = await fetchSubresource<JudicialEnforcement>(
    orgId,
    matterId,
    processId,
    "/enforcement",
    ["enforcements", "enforcement"],
  );
  if (isApiFailure(result)) return result;
  return { enforcements: result.items };
}

export async function fetchJudicialTimeline(
  orgId: string,
  matterId: string,
  processId: string,
): Promise<{ items: JudicialTimelineItem[] } | ApiFailure> {
  const result = await fetchSubresource<JudicialTimelineItem>(
    orgId,
    matterId,
    processId,
    "/timeline",
    ["events", "timeline"],
  );
  if (isApiFailure(result)) return result;
  return { items: result.items };
}
