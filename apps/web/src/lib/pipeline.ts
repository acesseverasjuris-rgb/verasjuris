import { CSRF_HEADER } from "@verasjuris/security/constants";
import type { ApiFailure } from "./types";
import {
  apiErrorMessage,
  getActiveMembership,
  getActiveOrgId,
  isApiFailure,
  type CrmLeadSummary,
} from "./crm";
import { fetchLegalAreas, type LegalArea } from "./intake";

export {
  apiErrorMessage,
  getActiveMembership,
  getActiveOrgId,
  isApiFailure,
  fetchLegalAreas,
  type LegalArea,
};

export type OpportunityStage =
  | "lead"
  | "intake"
  | "triage"
  | "analysis"
  | "proposal"
  | "contracting"
  | "client"
  | "case"
  | "lost"
  | "archived";

export type OpportunityStatus = "active" | "won" | "lost" | "archived";

export type AnalysisStatus = "draft" | "in_review" | "completed";

export type ProposalStatus =
  | "draft"
  | "internal_review"
  | "approved"
  | "sent"
  | "accepted"
  | "rejected"
  | "expired"
  | "cancelled";

export type EngagementStatus = "pending" | "ready" | "active" | "cancelled" | "declined";

export type NextActionHint =
  | "start_intake"
  | "complete_triage"
  | "complete_analysis"
  | "create_proposal"
  | "send_proposal"
  | "accept_proposal"
  | "activate_engagement"
  | "open_case"
  | "none";

export type OrgMember = {
  membershipId: string;
  displayName: string;
  email: string;
};

export type LossReason = {
  id: string;
  slug: string;
  name: string;
  active: boolean;
};

export type OpportunityPersonRef = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

export type OpportunitySummary = {
  id: string;
  title: string;
  stage: OpportunityStage;
  status: OpportunityStatus;
  estimatedValueCents: number | null;
  currency: string;
  responsibleMembershipId: string | null;
  responsible: { membershipId: string; displayName: string } | null;
  legalArea: Pick<LegalArea, "id" | "name"> | null;
  lead: OpportunityPersonRef | null;
  nextAction: NextActionHint;
  updatedAt: string;
};

export type PipelineAnalysis = {
  id: string;
  summary: string | null;
  feasibilityNotes: string | null;
  riskNotes: string | null;
  missingInformation: string | null;
  recommendedNextStep: string | null;
  status: AnalysisStatus;
  reviewedAt: string | null;
  updatedAt: string;
};

export type PipelineProposal = {
  id: string;
  version: number;
  title: string;
  scope: string | null;
  exclusions: string | null;
  priceCents: number;
  currency: string;
  paymentTerms: string | null;
  validityUntil: string | null;
  status: ProposalStatus;
  sentAt: string | null;
  acceptedAt: string | null;
  updatedAt: string;
};

export type PipelineEngagement = {
  id: string;
  status: EngagementStatus;
  contractReference: string | null;
  acceptedAt: string | null;
  effectiveAt: string | null;
  updatedAt: string;
};

export type OpportunityIntakeBlock = {
  id: string;
  title: string;
  status: string;
  summary: string | null;
};

export type OpportunityTriageBlock = {
  id: string;
  status: string;
  summary: string | null;
  nextAction: string | null;
};

export type OpportunityClientBlock = {
  id: string;
  displayName: string;
  status: string;
};

export type OpportunityCaseBlock = {
  id: string;
  title: string;
  status: string;
};

export type OpportunityDetail = OpportunitySummary & {
  leadId: string | null;
  intakeId: string | null;
  triageId: string | null;
  clientId: string | null;
  caseId: string | null;
  createdAt: string;
  wonAt: string | null;
  lostAt: string | null;
  archivedAt: string | null;
  lossReason: Pick<LossReason, "id" | "name"> | null;
  lossNotes: string | null;
  archiveReason: string | null;
  intake: OpportunityIntakeBlock | null;
  triage: OpportunityTriageBlock | null;
  analysis: PipelineAnalysis | null;
  proposal: PipelineProposal | null;
  engagement: PipelineEngagement | null;
  client: OpportunityClientBlock | null;
  legalCase: OpportunityCaseBlock | null;
};

export type PipelineListResult = {
  items: OpportunitySummary[];
  total: number;
  limit: number;
  offset: number;
};

export type PipelineBoardColumn = {
  stage: OpportunityStage;
  opportunities: OpportunitySummary[];
};

export type PipelineListQuery = {
  q?: string;
  stage?: OpportunityStage;
  status?: OpportunityStatus;
  responsibleMembershipId?: string;
  legalAreaId?: string;
  includeTerminal?: boolean;
  limit?: number;
  offset?: number;
  sort?: "createdAt" | "updatedAt" | "title";
  order?: "asc" | "desc";
};

export const OPPORTUNITY_STAGES: readonly OpportunityStage[] = [
  "lead",
  "intake",
  "triage",
  "analysis",
  "proposal",
  "contracting",
  "client",
  "case",
  "lost",
  "archived",
] as const;

export const MAIN_BOARD_STAGES: readonly OpportunityStage[] = [
  "lead",
  "intake",
  "triage",
  "analysis",
  "proposal",
  "contracting",
  "client",
  "case",
] as const;

export const STAGE_LABELS: Record<OpportunityStage, string> = {
  lead: "Lead",
  intake: "Atendimento",
  triage: "Triagem",
  analysis: "Análise",
  proposal: "Proposta",
  contracting: "Contratação",
  client: "Cliente",
  case: "Caso",
  lost: "Perdido",
  archived: "Arquivado",
};

export const STATUS_LABELS: Record<OpportunityStatus, string> = {
  active: "Ativa",
  won: "Concluída",
  lost: "Perdida",
  archived: "Arquivada",
};

export const ANALYSIS_STATUS_LABELS: Record<AnalysisStatus, string> = {
  draft: "Rascunho",
  in_review: "Em revisão",
  completed: "Concluída",
};

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  draft: "Rascunho",
  internal_review: "Revisão interna",
  approved: "Aprovada",
  sent: "Enviada",
  accepted: "Aceita",
  rejected: "Rejeitada",
  expired: "Expirada",
  cancelled: "Cancelada",
};

export const ENGAGEMENT_STATUS_LABELS: Record<EngagementStatus, string> = {
  pending: "Pendente",
  ready: "Pronta",
  active: "Ativa",
  cancelled: "Cancelada",
  declined: "Recusada",
};

export const NEXT_ACTION_LABELS: Record<NextActionHint, string> = {
  start_intake: "Iniciar atendimento",
  complete_triage: "Concluir triagem",
  complete_analysis: "Concluir análise",
  create_proposal: "Elaborar proposta",
  send_proposal: "Enviar proposta",
  accept_proposal: "Registrar aceite da proposta",
  activate_engagement: "Ativar contratação",
  open_case: "Abrir caso",
  none: "Nenhuma ação pendente",
};

function jsonHeaders(): HeadersInit {
  return { "content-type": "application/json", [CSRF_HEADER]: "1" };
}

function orgPath(orgId: string, suffix: string): string {
  return `/api/v1/organizations/${orgId}${suffix}`;
}

function buildQuery(query: PipelineListQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

export function formatMoneyFromCents(cents: number | null | undefined, currency = "BRL"): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
}

export function stageBadgeTone(
  stage: OpportunityStage,
): "neutral" | "success" | "warning" | "error" {
  if (stage === "case" || stage === "client") return "success";
  if (stage === "lost") return "error";
  if (stage === "archived") return "warning";
  return "neutral";
}

export async function fetchOrganizationMembers(
  orgId: string,
): Promise<{ members: OrgMember[] } | ApiFailure> {
  const response = await fetch(`/api/v1/organizations/${orgId}/members`, { cache: "no-store" });
  return (await response.json()) as { members: OrgMember[] } | ApiFailure;
}

export async function fetchLossReasons(
  orgId: string,
): Promise<{ lossReasons: LossReason[] } | ApiFailure> {
  const response = await fetch(orgPath(orgId, "/loss-reasons"), { cache: "no-store" });
  const body = (await response.json()) as
    | { lossReasons?: LossReason[]; items?: LossReason[] }
    | ApiFailure;
  if (isApiFailure(body)) return body;
  if ("lossReasons" in body && body.lossReasons) return { lossReasons: body.lossReasons };
  if ("items" in body && body.items) return { lossReasons: body.items };
  return { lossReasons: [] };
}

export async function fetchOpportunities(
  orgId: string,
  query: PipelineListQuery = {},
): Promise<PipelineListResult | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/opportunities${buildQuery(query)}`), {
    cache: "no-store",
  });
  return (await response.json()) as PipelineListResult | ApiFailure;
}

export async function fetchPipelineBoard(
  orgId: string,
  query: Omit<PipelineListQuery, "limit" | "offset" | "sort" | "order"> = {},
): Promise<{ columns: PipelineBoardColumn[] } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/opportunities/board${buildQuery(query)}`), {
    cache: "no-store",
  });
  return (await response.json()) as { columns: PipelineBoardColumn[] } | ApiFailure;
}

export async function fetchOpportunity(
  orgId: string,
  opportunityId: string,
): Promise<{ opportunity: OpportunityDetail } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/opportunities/${opportunityId}`), {
    cache: "no-store",
  });
  return (await response.json()) as { opportunity: OpportunityDetail } | ApiFailure;
}

export async function createOpportunity(
  orgId: string,
  input: {
    title: string;
    leadId?: string;
    intakeId?: string;
    legalAreaId?: string;
    responsibleMembershipId?: string;
    estimatedValueCents?: number;
  },
): Promise<{ opportunity: { id: string } } | ApiFailure> {
  const response = await fetch(orgPath(orgId, "/opportunities"), {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(input),
  });
  return (await response.json()) as { opportunity: { id: string } } | ApiFailure;
}

export async function moveOpportunity(
  orgId: string,
  opportunityId: string,
  input: { stage: OpportunityStage; reason?: string },
): Promise<{ opportunity: OpportunitySummary } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/opportunities/${opportunityId}/move`), {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(input),
  });
  return (await response.json()) as { opportunity: OpportunitySummary } | ApiFailure;
}

export async function loseOpportunity(
  orgId: string,
  opportunityId: string,
  input: { lossReasonId: string; lossNotes?: string },
): Promise<{ opportunity: OpportunitySummary } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/opportunities/${opportunityId}/lose`), {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(input),
  });
  return (await response.json()) as { opportunity: OpportunitySummary } | ApiFailure;
}

export async function archiveOpportunity(
  orgId: string,
  opportunityId: string,
  input: { archiveReason?: string },
): Promise<{ opportunity: OpportunitySummary } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/opportunities/${opportunityId}/archive`), {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(input),
  });
  return (await response.json()) as { opportunity: OpportunitySummary } | ApiFailure;
}

export async function fetchOpportunityAnalysis(
  orgId: string,
  opportunityId: string,
): Promise<{ analysis: PipelineAnalysis | null } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/opportunities/${opportunityId}/analysis`), {
    cache: "no-store",
  });
  return (await response.json()) as { analysis: PipelineAnalysis | null } | ApiFailure;
}

export async function upsertOpportunityAnalysis(
  orgId: string,
  opportunityId: string,
  input: {
    summary?: string;
    feasibilityNotes?: string;
    riskNotes?: string;
    missingInformation?: string;
    recommendedNextStep?: string;
    status?: AnalysisStatus;
  },
): Promise<{ analysis: PipelineAnalysis } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/opportunities/${opportunityId}/analysis`), {
    method: "PUT",
    headers: jsonHeaders(),
    body: JSON.stringify(input),
  });
  return (await response.json()) as { analysis: PipelineAnalysis } | ApiFailure;
}

export async function fetchOpportunityProposals(
  orgId: string,
  opportunityId: string,
): Promise<{ proposals: PipelineProposal[] } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/opportunities/${opportunityId}/proposals`), {
    cache: "no-store",
  });
  const body = (await response.json()) as
    | { proposals?: PipelineProposal[]; items?: PipelineProposal[] }
    | ApiFailure;
  if (isApiFailure(body)) return body;
  if ("proposals" in body && body.proposals) return { proposals: body.proposals };
  if ("items" in body && body.items) return { proposals: body.items };
  return { proposals: [] };
}

export async function createProposal(
  orgId: string,
  opportunityId: string,
  input: {
    title: string;
    scope?: string;
    exclusions?: string;
    priceCents: number;
    paymentTerms?: string;
    validityUntil?: string;
  },
): Promise<{ proposal: PipelineProposal } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/opportunities/${opportunityId}/proposals`), {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(input),
  });
  return (await response.json()) as { proposal: PipelineProposal } | ApiFailure;
}

export async function approveProposal(
  orgId: string,
  proposalId: string,
): Promise<{ proposal: PipelineProposal } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/proposals/${proposalId}/approve`), {
    method: "POST",
    headers: jsonHeaders(),
  });
  return (await response.json()) as { proposal: PipelineProposal } | ApiFailure;
}

export async function sendProposal(
  orgId: string,
  proposalId: string,
): Promise<{ proposal: PipelineProposal } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/proposals/${proposalId}/send`), {
    method: "POST",
    headers: jsonHeaders(),
  });
  return (await response.json()) as { proposal: PipelineProposal } | ApiFailure;
}

export async function acceptProposal(
  orgId: string,
  proposalId: string,
): Promise<{ proposal: PipelineProposal } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/proposals/${proposalId}/accept`), {
    method: "POST",
    headers: jsonHeaders(),
  });
  return (await response.json()) as { proposal: PipelineProposal } | ApiFailure;
}

export async function fetchOpportunityEngagement(
  orgId: string,
  opportunityId: string,
): Promise<{ engagement: PipelineEngagement | null } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/opportunities/${opportunityId}/engagement`), {
    cache: "no-store",
  });
  return (await response.json()) as { engagement: PipelineEngagement | null } | ApiFailure;
}

export async function activateEngagement(
  orgId: string,
  opportunityId: string,
  input: { contractReference?: string } = {},
): Promise<{ engagement: PipelineEngagement } | ApiFailure> {
  const response = await fetch(
    orgPath(orgId, `/opportunities/${opportunityId}/engagement/activate`),
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(input),
    },
  );
  return (await response.json()) as { engagement: PipelineEngagement } | ApiFailure;
}

export async function openCaseFromOpportunity(
  orgId: string,
  opportunityId: string,
  input: {
    title?: string;
    summary?: string;
    legalAreaId?: string;
    responsibleMembershipId?: string;
  } = {},
): Promise<{ case: OpportunityCaseBlock; matter?: OpportunityCaseBlock } | ApiFailure> {
  const response = await fetch(orgPath(orgId, `/opportunities/${opportunityId}/case`), {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(input),
  });
  const body = (await response.json()) as
    | { case?: OpportunityCaseBlock; matter?: OpportunityCaseBlock }
    | ApiFailure;
  if (isApiFailure(body)) return body;
  const legalMatter = body.matter ?? body.case;
  if (!legalMatter) {
    return { error: { code: "INTERNAL_ERROR", message: "Resposta inválida ao abrir o caso." } };
  }
  return { case: legalMatter, matter: body.matter ?? legalMatter };
}

export async function searchLeadsForOpportunity(
  orgId: string,
  q: string,
): Promise<{ items: CrmLeadSummary[] } | ApiFailure> {
  const response = await fetch(
    `/api/v1/organizations/${orgId}/crm/leads?q=${encodeURIComponent(q)}&limit=10&status=qualified`,
    { cache: "no-store" },
  );
  const body = (await response.json()) as { items?: CrmLeadSummary[] } | ApiFailure;
  if (isApiFailure(body)) return body;
  return { items: body.items ?? [] };
}
