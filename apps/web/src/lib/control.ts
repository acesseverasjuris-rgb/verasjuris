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

export type ControlAction =
  | "read"
  | "director.manage"
  | "approval.manage"
  | "hr.read"
  | "hr.manage"
  | "hr.review"
  | "hr.leave.approve"
  | "finance.read"
  | "finance.manage"
  | "finance.approve"
  | "legal.read"
  | "legal.manage"
  | "compliance.read"
  | "compliance.manage"
  | "compliance.audit"
  | "vendor.read"
  | "vendor.manage"
  | "product.read"
  | "product.manage";

const PERM: Record<ControlAction, string> = {
  read: "control.read",
  "director.manage": "control.director.manage",
  "approval.manage": "control.approval.manage",
  "hr.read": "control.hr.read",
  "hr.manage": "control.hr.manage",
  "hr.review": "control.hr.review",
  "hr.leave.approve": "control.hr.leave.approve",
  "finance.read": "control.finance.read",
  "finance.manage": "control.finance.manage",
  "finance.approve": "control.finance.approve",
  "legal.read": "control.legal.read",
  "legal.manage": "control.legal.manage",
  "compliance.read": "control.compliance.read",
  "compliance.manage": "control.compliance.manage",
  "compliance.audit": "control.compliance.audit",
  "vendor.read": "control.vendor.read",
  "vendor.manage": "control.vendor.manage",
  "product.read": "control.product.read",
  "product.manage": "control.product.manage",
};

export function hasControlPermission(permissions: string[], action: ControlAction): boolean {
  return hasPermission(permissions, PERM[action]);
}

export function canAccessControlNav(permissions: string[]): boolean {
  return (
    hasControlPermission(permissions, "read") ||
    hasPermission(permissions, "analytics.read") ||
    hasPermission(permissions, "workflow.read") ||
    hasControlPermission(permissions, "hr.read") ||
    hasControlPermission(permissions, "finance.read") ||
    hasControlPermission(permissions, "legal.read") ||
    hasControlPermission(permissions, "compliance.read") ||
    hasControlPermission(permissions, "vendor.read") ||
    hasControlPermission(permissions, "product.read")
  );
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

export function controlErrorMessage(failure: AiApiFailure): string {
  return aiErrorMessage(failure, "Falha no VerasJuris Control.");
}

export type ControlListQuery = Record<string, string | number | boolean | undefined | null>;

export type ControlGoal = {
  id: string;
  organizationId: string;
  title: string;
  description?: string | null;
  area?: string | null;
  status: string;
  periodStart: string;
  periodEnd: string;
  targetType?: string | null;
  targetValue?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ControlKpi = {
  id: string;
  organizationId: string;
  key: string;
  name: string;
  direction: string;
  sourceType: string;
  unit?: string | null;
  targetValue?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ControlApproval = {
  id: string;
  organizationId: string;
  subjectType: string;
  subjectId: string;
  status: string;
  policy: string;
  requestedByMembershipId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ControlDepartment = {
  id: string;
  organizationId: string;
  name: string;
  code?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ControlPosition = {
  id: string;
  organizationId: string;
  title: string;
  departmentId?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ControlEmployee = {
  id: string;
  organizationId: string;
  userId?: string | null;
  membershipId?: string | null;
  fullName: string;
  email?: string | null;
  status: string;
  employmentType: string;
  departmentId?: string | null;
  positionId?: string | null;
  hiredAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ControlOnboardingPlan = {
  id: string;
  organizationId: string;
  employeeId: string;
  status: string;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ControlPerformanceReview = {
  id: string;
  organizationId: string;
  employeeId: string;
  periodLabel?: string | null;
  status: string;
  score?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ControlLeaveRequest = {
  id: string;
  organizationId: string;
  employeeId: string;
  leaveType: string;
  status: string;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ControlCostCenter = {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  departmentId?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ControlBudget = {
  id: string;
  organizationId: string;
  fiscalYear: number;
  version: number;
  status: string;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ControlExpenseReport = {
  id: string;
  organizationId: string;
  employeeId: string;
  costCenterId?: string | null;
  period: string;
  totalCents: number;
  currency: string;
  status: string;
  submittedAt?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ControlIpAsset = {
  id: string;
  organizationId: string;
  name: string;
  ipType: string;
  status: string;
  registrationNumber?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ControlDueDiligence = {
  id: string;
  organizationId: string;
  title: string;
  caseType: string;
  status: string;
  startedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ControlPolicy = {
  id: string;
  organizationId: string;
  title: string;
  status: string;
  version?: number | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ControlRisk = {
  id: string;
  organizationId: string;
  title: string;
  category: string;
  status: string;
  inherentScore?: number | null;
  residualScore?: number | null;
  createdAt: string;
  updatedAt: string;
};

export type ControlComplianceControl = {
  id: string;
  organizationId: string;
  name: string;
  controlType: string;
  status: string;
  frequency?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ControlIncident = {
  id: string;
  organizationId: string;
  title: string;
  incidentType: string;
  severity: string;
  status: string;
  openedAt?: string | null;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ControlAudit = {
  id: string;
  organizationId: string;
  title: string;
  auditType: string;
  status: string;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ControlObligation = {
  id: string;
  organizationId: string;
  title: string;
  status: string;
  dueAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ControlVendor = {
  id: string;
  organizationId: string;
  name: string;
  status: string;
  riskLevel?: string | null;
  category?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ControlVendorSla = {
  id: string;
  organizationId: string;
  vendorId: string;
  name: string;
  status: string;
  targetValue?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ControlVendorReview = {
  id: string;
  organizationId: string;
  vendorId: string;
  score?: number | null;
  status?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ControlRoadmapItem = {
  id: string;
  organizationId: string;
  title: string;
  itemType: string;
  status: string;
  priority?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ControlBug = {
  id: string;
  organizationId: string;
  title: string;
  severity: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type ControlTechIncident = {
  id: string;
  organizationId: string;
  title: string;
  severity: string;
  status: string;
  openedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ControlRelease = {
  id: string;
  organizationId: string;
  name: string;
  version?: string | null;
  status: string;
  releasedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ControlFeature = {
  id: string;
  organizationId: string;
  name: string;
  status: string;
  key?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ControlProject = {
  id: string;
  organizationId: string;
  name: string;
  status: string;
  ownerMembershipId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ControlDashboard = {
  goalsActive: number;
  approvalsPending: number;
  employeesActive: number;
  budgetsOpen: number;
  risksOpen: number;
  incidentsOpen: number;
  vendorsActive: number;
  bugsOpen: number;
};

export const CONTROL_GOAL_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativa",
  at_risk: "Em risco",
  achieved: "Atingida",
  missed: "Não atingida",
  cancelled: "Cancelada",
  archived: "Arquivada",
};

export const CONTROL_EMPLOYEE_STATUS_LABELS: Record<string, string> = {
  preboarding: "Pré-admissão",
  active: "Ativo",
  on_leave: "Afastado",
  suspended: "Suspenso",
  terminated: "Desligado",
  archived: "Arquivado",
};

export const CONTROL_VENDOR_STATUS_LABELS: Record<string, string> = {
  prospect: "Prospecto",
  under_review: "Em análise",
  approved: "Aprovado",
  active: "Ativo",
  suspended: "Suspenso",
  terminated: "Encerrado",
  archived: "Arquivado",
};

export const CONTROL_RISK_STATUS_LABELS: Record<string, string> = {
  identified: "Identificado",
  assessing: "Em avaliação",
  treating: "Em tratamento",
  accepted: "Aceito",
  closed: "Encerrado",
  monitoring: "Monitorando",
};

export const CONTROL_INCIDENT_STATUS_LABELS: Record<string, string> = {
  open: "Aberto",
  triaged: "Triado",
  investigating: "Investigando",
  contained: "Contido",
  remediating: "Remediando",
  monitoring: "Monitorando",
  closed: "Encerrado",
};

export const CONTROL_BUG_STATUS_LABELS: Record<string, string> = {
  open: "Aberto",
  triaged: "Triado",
  in_progress: "Em progresso",
  blocked: "Bloqueado",
  fixed: "Corrigido",
  verified: "Verificado",
  closed: "Encerrado",
  wont_fix: "Não corrigir",
};

export const CONTROL_APPROVAL_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  partially_approved: "Parcialmente aprovado",
  approved: "Aprovado",
  rejected: "Rejeitado",
  cancelled: "Cancelado",
  expired: "Expirado",
};

export const CONTROL_BUDGET_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  under_review: "Em revisão",
  approved: "Aprovado",
  revised: "Revisado",
  closed: "Encerrado",
};

export const CONTROL_EXPENSE_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  submitted: "Enviado",
  under_review: "Em revisão",
  approved: "Aprovado",
  rejected: "Rejeitado",
  reimbursed: "Reembolsado",
};

export const CONTROL_LEAVE_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  requested: "Solicitado",
  approved: "Aprovado",
  rejected: "Rejeitado",
  cancelled: "Cancelado",
  taken: "Gozado",
};

export const CONTROL_PROJECT_STATUS_LABELS: Record<string, string> = {
  proposed: "Proposto",
  approved: "Aprovado",
  active: "Ativo",
  at_risk: "Em risco",
  blocked: "Bloqueado",
  completed: "Concluído",
  cancelled: "Cancelado",
};

export const CONTROL_RELEASE_STATUS_LABELS: Record<string, string> = {
  planned: "Planejado",
  ready: "Pronto",
  deploying: "Publicando",
  released: "Publicado",
  failed: "Falhou",
  rolled_back: "Revertido",
  cancelled: "Cancelado",
};

/* ─── Director ─── */

export async function fetchControlDashboard(orgId: string) {
  return request<ControlDashboard>(orgPath(orgId, "/control/dashboard"));
}

export async function fetchControlGoals(orgId: string, query: ControlListQuery = {}) {
  return request<{ items: ControlGoal[]; total?: number }>(
    orgPath(orgId, `/control/goals${qs(query)}`),
  );
}

export async function fetchControlKpis(orgId: string, query: ControlListQuery = {}) {
  return request<{ items: ControlKpi[]; total?: number }>(
    orgPath(orgId, `/control/kpis${qs(query)}`),
  );
}

export async function fetchControlApprovals(orgId: string, query: ControlListQuery = {}) {
  return request<{ items: ControlApproval[]; total?: number }>(
    orgPath(orgId, `/control/approvals${qs(query)}`),
  );
}

/* ─── HR ─── */

export async function fetchControlEmployees(orgId: string, query: ControlListQuery = {}) {
  return request<{ items: ControlEmployee[]; total?: number }>(
    orgPath(orgId, `/control/hr/employees${qs(query)}`),
  );
}

export async function fetchControlPositions(orgId: string, query: ControlListQuery = {}) {
  return request<{ items: ControlPosition[]; total?: number }>(
    orgPath(orgId, `/control/hr/positions${qs(query)}`),
  );
}

export async function fetchControlDepartments(orgId: string, query: ControlListQuery = {}) {
  return request<{ items: ControlDepartment[]; total?: number }>(
    orgPath(orgId, `/control/hr/departments${qs(query)}`),
  );
}

export async function fetchControlOnboarding(orgId: string, query: ControlListQuery = {}) {
  return request<{ items: ControlOnboardingPlan[]; total?: number }>(
    orgPath(orgId, `/control/hr/onboarding${qs(query)}`),
  );
}

export async function fetchControlReviews(orgId: string, query: ControlListQuery = {}) {
  return request<{ items: ControlPerformanceReview[]; total?: number }>(
    orgPath(orgId, `/control/hr/reviews${qs(query)}`),
  );
}

export async function fetchControlLeaves(orgId: string, query: ControlListQuery = {}) {
  return request<{ items: ControlLeaveRequest[]; total?: number }>(
    orgPath(orgId, `/control/hr/leaves${qs(query)}`),
  );
}

export async function fetchControlHrDocuments(orgId: string, query: ControlListQuery = {}) {
  return request<{ items: Array<Record<string, unknown>>; total?: number }>(
    orgPath(orgId, `/control/hr/documents${qs(query)}`),
  );
}

/* ─── Internal finance ─── */

export async function fetchControlBudgets(orgId: string, query: ControlListQuery = {}) {
  return request<{ items: ControlBudget[]; total?: number }>(
    orgPath(orgId, `/control/finance/budgets${qs(query)}`),
  );
}

export async function fetchControlCostCenters(orgId: string, query: ControlListQuery = {}) {
  return request<{ items: ControlCostCenter[]; total?: number }>(
    orgPath(orgId, `/control/finance/cost-centers${qs(query)}`),
  );
}

export async function fetchControlInternalTreasury(orgId: string, query: ControlListQuery = {}) {
  return request<Record<string, unknown>>(orgPath(orgId, `/control/finance/treasury${qs(query)}`));
}

export async function fetchControlInternalForecast(orgId: string, query: ControlListQuery = {}) {
  return request<{ items: Array<Record<string, unknown>>; total?: number }>(
    orgPath(orgId, `/control/finance/forecast${qs(query)}`),
  );
}

export async function fetchControlExpenseReports(orgId: string, query: ControlListQuery = {}) {
  return request<{ items: ControlExpenseReport[]; total?: number }>(
    orgPath(orgId, `/control/finance/expense-reports${qs(query)}`),
  );
}

/* ─── Internal legal ─── */

export async function fetchControlLegalContracts(orgId: string, query: ControlListQuery = {}) {
  return request<{ items: Array<Record<string, unknown>>; total?: number }>(
    orgPath(orgId, `/control/legal/contracts${qs(query)}`),
  );
}

export async function fetchControlLitigation(orgId: string, query: ControlListQuery = {}) {
  return request<{ items: Array<Record<string, unknown>>; total?: number }>(
    orgPath(orgId, `/control/legal/litigation${qs(query)}`),
  );
}

export async function fetchControlIpAssets(orgId: string, query: ControlListQuery = {}) {
  return request<{ items: ControlIpAsset[]; total?: number }>(
    orgPath(orgId, `/control/legal/ip${qs(query)}`),
  );
}

export async function fetchControlDueDiligence(orgId: string, query: ControlListQuery = {}) {
  return request<{ items: ControlDueDiligence[]; total?: number }>(
    orgPath(orgId, `/control/legal/due-diligence${qs(query)}`),
  );
}

export async function fetchControlPolicies(orgId: string, query: ControlListQuery = {}) {
  return request<{ items: ControlPolicy[]; total?: number }>(
    orgPath(orgId, `/control/legal/policies${qs(query)}`),
  );
}

/* ─── Compliance ─── */

export async function fetchControlRisks(orgId: string, query: ControlListQuery = {}) {
  return request<{ items: ControlRisk[]; total?: number }>(
    orgPath(orgId, `/control/compliance/risks${qs(query)}`),
  );
}

export async function fetchControlComplianceControls(orgId: string, query: ControlListQuery = {}) {
  return request<{ items: ControlComplianceControl[]; total?: number }>(
    orgPath(orgId, `/control/compliance/controls${qs(query)}`),
  );
}

export async function fetchControlComplianceIncidents(orgId: string, query: ControlListQuery = {}) {
  return request<{ items: ControlIncident[]; total?: number }>(
    orgPath(orgId, `/control/compliance/incidents${qs(query)}`),
  );
}

export async function fetchControlAudits(orgId: string, query: ControlListQuery = {}) {
  return request<{ items: ControlAudit[]; total?: number }>(
    orgPath(orgId, `/control/compliance/audits${qs(query)}`),
  );
}

export async function fetchControlObligations(orgId: string, query: ControlListQuery = {}) {
  return request<{ items: ControlObligation[]; total?: number }>(
    orgPath(orgId, `/control/compliance/obligations${qs(query)}`),
  );
}

/* ─── Vendors ─── */

export async function fetchControlVendors(orgId: string, query: ControlListQuery = {}) {
  return request<{ items: ControlVendor[]; total?: number }>(
    orgPath(orgId, `/control/vendors${qs(query)}`),
  );
}

export async function fetchControlVendor(orgId: string, vendorId: string) {
  return request<{ vendor: ControlVendor }>(orgPath(orgId, `/control/vendors/${vendorId}`));
}

export async function fetchControlVendorContracts(orgId: string, query: ControlListQuery = {}) {
  return request<{ items: Array<Record<string, unknown>>; total?: number }>(
    orgPath(orgId, `/control/vendors/contracts${qs(query)}`),
  );
}

export async function fetchControlVendorSlas(orgId: string, query: ControlListQuery = {}) {
  return request<{ items: ControlVendorSla[]; total?: number }>(
    orgPath(orgId, `/control/vendors/slas${qs(query)}`),
  );
}

export async function fetchControlVendorReviews(orgId: string, query: ControlListQuery = {}) {
  return request<{ items: ControlVendorReview[]; total?: number }>(
    orgPath(orgId, `/control/vendors/reviews${qs(query)}`),
  );
}

export async function fetchControlVendorPayments(orgId: string, query: ControlListQuery = {}) {
  return request<{ items: Array<Record<string, unknown>>; total?: number }>(
    orgPath(orgId, `/control/vendors/payments${qs(query)}`),
  );
}

/* ─── Product / tech ─── */

export async function fetchControlRoadmap(orgId: string, query: ControlListQuery = {}) {
  return request<{ items: ControlRoadmapItem[]; total?: number }>(
    orgPath(orgId, `/control/product/roadmap${qs(query)}`),
  );
}

export async function fetchControlBugs(orgId: string, query: ControlListQuery = {}) {
  return request<{ items: ControlBug[]; total?: number }>(
    orgPath(orgId, `/control/product/bugs${qs(query)}`),
  );
}

export async function fetchControlTechIncidents(orgId: string, query: ControlListQuery = {}) {
  return request<{ items: ControlTechIncident[]; total?: number }>(
    orgPath(orgId, `/control/product/incidents${qs(query)}`),
  );
}

export async function fetchControlReleases(orgId: string, query: ControlListQuery = {}) {
  return request<{ items: ControlRelease[]; total?: number }>(
    orgPath(orgId, `/control/product/releases${qs(query)}`),
  );
}

export async function fetchControlFeatures(orgId: string, query: ControlListQuery = {}) {
  return request<{ items: ControlFeature[]; total?: number }>(
    orgPath(orgId, `/control/product/features${qs(query)}`),
  );
}

export async function fetchControlProjects(orgId: string, query: ControlListQuery = {}) {
  return request<{ items: ControlProject[]; total?: number }>(
    orgPath(orgId, `/control/product/projects${qs(query)}`),
  );
}
