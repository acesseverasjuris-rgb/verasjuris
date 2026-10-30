"use client";

import { Badge, EmptyState } from "@verasjuris/ui";
import type { ReactNode } from "react";
import {
  ANALYTICS_TAB_KEYS,
  ANALYTICS_TAB_LABELS,
  type AnalyticsMetricCard,
  type AnalyticsSeriesPoint,
  type AnalyticsTabKey,
} from "../lib/analytics";
import {
  CONTROL_APPROVAL_STATUS_LABELS,
  CONTROL_BUG_STATUS_LABELS,
  CONTROL_BUDGET_STATUS_LABELS,
  CONTROL_EMPLOYEE_STATUS_LABELS,
  CONTROL_EXPENSE_STATUS_LABELS,
  CONTROL_GOAL_STATUS_LABELS,
  CONTROL_INCIDENT_STATUS_LABELS,
  CONTROL_LEAVE_STATUS_LABELS,
  CONTROL_PROJECT_STATUS_LABELS,
  CONTROL_RELEASE_STATUS_LABELS,
  CONTROL_RISK_STATUS_LABELS,
  CONTROL_VENDOR_STATUS_LABELS,
  formatDateTime,
  formatMoneyCents,
  hasControlPermission,
  type ControlAction,
  type ControlApproval,
  type ControlBug,
  type ControlBudget,
  type ControlDashboard,
  type ControlEmployee,
  type ControlExpenseReport,
  type ControlGoal,
  type ControlLeaveRequest,
  type ControlProject,
  type ControlRelease,
  type ControlRisk,
  type ControlVendor,
} from "../lib/control";
import {
  WORKFLOW_ACTION_TYPE_LABELS,
  WORKFLOW_BUILDER_PHASES,
  WORKFLOW_RUN_STATUS_LABELS,
  WORKFLOW_STATUS_LABELS,
  WORKFLOW_TRIGGER_LABELS,
  hasWorkflowPermission,
  type WorkflowDefinition,
  type WorkflowRun,
  type WorkflowTemplate,
} from "../lib/workflows";
import { NoPermission, SectionTabs } from "./ai-ui";

export { NoPermission, SectionTabs };

export const CONTROL_HUB_CARDS = [
  {
    href: "/app/control/diretoria",
    title: "Diretoria",
    description: "Metas, KPIs e aprovações internas.",
    permission: "read" as ControlAction,
  },
  {
    href: "/app/control/rh",
    title: "RH",
    description: "Colaboradores, cargos, onboarding e férias.",
    permission: "hr.read" as ControlAction,
  },
  {
    href: "/app/control/financeiro",
    title: "Financeiro interno",
    description: "Orçamento, centros de custo e prestação de contas.",
    permission: "finance.read" as ControlAction,
  },
  {
    href: "/app/control/juridico",
    title: "Jurídico interno",
    description: "Contratos, contencioso, PI e políticas.",
    permission: "legal.read" as ControlAction,
  },
  {
    href: "/app/control/compliance",
    title: "Compliance",
    description: "Riscos, controles, incidentes e obrigações.",
    permission: "compliance.read" as ControlAction,
  },
  {
    href: "/app/control/fornecedores",
    title: "Fornecedores",
    description: "Ciclo de vida, SLA, avaliações e pagamentos.",
    permission: "vendor.read" as ControlAction,
  },
  {
    href: "/app/control/produto",
    title: "Produto e tecnologia",
    description: "Roadmap, bugs, releases e projetos.",
    permission: "product.read" as ControlAction,
  },
  {
    href: "/app/control/analytics",
    title: "Analytics",
    description: "Painéis agregados (read model).",
    permission: "read" as ControlAction,
    analytics: true,
  },
  {
    href: "/app/control/automacoes",
    title: "Automações",
    description: "Workflows WHEN/IF/THEN com aprovação.",
    permission: "read" as ControlAction,
    workflow: true,
  },
  {
    href: "/app/control/seguranca",
    title: "Segurança",
    description: "MFA, sessões, alertas e pentest.",
    platform: "security" as const,
  },
  {
    href: "/app/control/privacidade",
    title: "Privacidade",
    description: "LGPD, DSR, inventário e DPO.",
    platform: "privacy" as const,
  },
  {
    href: "/app/control/operacao",
    title: "Operação",
    description: "Health, jobs, filas e SLOs.",
    platform: "operation" as const,
  },
  {
    href: "/app/control/integracoes",
    title: "Integrações",
    description: "Providers externos (NOT_CONFIGURED honesto).",
    platform: "integrations" as const,
  },
] as const;

export const CONTROL_APP_TABS = [
  { href: "/app/control", label: "Hub", permission: "read" as ControlAction },
  { href: "/app/control/diretoria", label: "Diretoria", permission: "read" as ControlAction },
  { href: "/app/control/rh", label: "RH", permission: "hr.read" as ControlAction },
  {
    href: "/app/control/financeiro",
    label: "Financeiro",
    permission: "finance.read" as ControlAction,
  },
  { href: "/app/control/juridico", label: "Jurídico", permission: "legal.read" as ControlAction },
  {
    href: "/app/control/compliance",
    label: "Compliance",
    permission: "compliance.read" as ControlAction,
  },
  {
    href: "/app/control/fornecedores",
    label: "Fornecedores",
    permission: "vendor.read" as ControlAction,
  },
  { href: "/app/control/produto", label: "Produto", permission: "product.read" as ControlAction },
  { href: "/app/control/analytics", label: "Analytics", analytics: true as const },
  { href: "/app/control/automacoes", label: "Automações", workflow: true as const },
  { href: "/app/control/seguranca", label: "Segurança", platform: "security" as const },
  { href: "/app/control/privacidade", label: "Privacidade", platform: "privacy" as const },
  { href: "/app/control/operacao", label: "Operação", platform: "operation" as const },
  { href: "/app/control/integracoes", label: "Integrações", platform: "integrations" as const },
];

export const HR_TABS = [
  { href: "/app/control/rh", label: "Visão geral" },
  { href: "/app/control/rh/funcionarios", label: "Funcionários" },
  { href: "/app/control/rh/cargos", label: "Cargos" },
  { href: "/app/control/rh/departamentos", label: "Departamentos" },
  { href: "/app/control/rh/onboarding", label: "Onboarding" },
  { href: "/app/control/rh/avaliacoes", label: "Avaliações" },
  { href: "/app/control/rh/ferias", label: "Férias" },
  { href: "/app/control/rh/documentos", label: "Documentos" },
];

export const FINANCE_INTERNAL_TABS = [
  { href: "/app/control/financeiro", label: "Visão geral" },
  { href: "/app/control/financeiro/orcamento", label: "Orçamento" },
  { href: "/app/control/financeiro/centros-de-custo", label: "Centros de custo" },
  { href: "/app/control/financeiro/tesouraria", label: "Tesouraria" },
  { href: "/app/control/financeiro/forecast", label: "Forecast" },
  { href: "/app/control/financeiro/prestacao-de-contas", label: "Prestação de contas" },
];

export const LEGAL_INTERNAL_TABS = [
  { href: "/app/control/juridico", label: "Visão geral" },
  { href: "/app/control/juridico/contratos", label: "Contratos" },
  { href: "/app/control/juridico/contencioso", label: "Contencioso" },
  { href: "/app/control/juridico/pi", label: "PI" },
  { href: "/app/control/juridico/due-diligence", label: "Due diligence" },
  { href: "/app/control/juridico/politicas", label: "Políticas" },
];

export const COMPLIANCE_TABS = [
  { href: "/app/control/compliance", label: "Visão geral" },
  { href: "/app/control/compliance/riscos", label: "Riscos" },
  { href: "/app/control/compliance/controles", label: "Controles" },
  { href: "/app/control/compliance/incidentes", label: "Incidentes" },
  { href: "/app/control/compliance/auditorias", label: "Auditorias" },
  { href: "/app/control/compliance/obrigacoes", label: "Obrigações" },
];

export const VENDOR_TABS = [
  { href: "/app/control/fornecedores", label: "Fornecedores" },
  { href: "/app/control/fornecedores/contratos", label: "Contratos" },
  { href: "/app/control/fornecedores/sla", label: "SLA" },
  { href: "/app/control/fornecedores/avaliacoes", label: "Avaliações" },
  { href: "/app/control/fornecedores/pagamentos", label: "Pagamentos" },
];

export const PRODUCT_TABS = [
  { href: "/app/control/produto", label: "Visão geral" },
  { href: "/app/control/produto/roadmap", label: "Roadmap" },
  { href: "/app/control/produto/bugs", label: "Bugs" },
  { href: "/app/control/produto/incidentes", label: "Incidentes" },
  { href: "/app/control/produto/releases", label: "Releases" },
  { href: "/app/control/produto/features", label: "Features" },
  { href: "/app/control/produto/projetos", label: "Projetos" },
];

export const AUTOMATION_TABS = [
  { href: "/app/control/automacoes", label: "Visão geral" },
  { href: "/app/control/automacoes/workflows", label: "Workflows" },
  { href: "/app/control/automacoes/templates", label: "Templates" },
  { href: "/app/control/automacoes/runs", label: "Execuções" },
  { href: "/app/control/automacoes/falhas", label: "Falhas" },
  { href: "/app/control/automacoes/logs", label: "Logs" },
];

function hasPlatformNav(permissions: string[], platform: string): boolean {
  if (platform === "security") {
    return permissions.includes("security.read") || permissions.includes("security.admin");
  }
  if (platform === "privacy") {
    return permissions.includes("privacy.read") || permissions.includes("privacy.admin");
  }
  if (platform === "operation") {
    return (
      permissions.includes("observability.read") ||
      permissions.includes("observability.admin") ||
      permissions.includes("control.read")
    );
  }
  if (platform === "integrations") {
    return (
      permissions.includes("integration.read") ||
      permissions.includes("integration.manage") ||
      permissions.includes("integrations.admin") ||
      permissions.includes("control.read")
    );
  }
  return false;
}

export function controlTabsForPermissions(permissions: string[]) {
  return CONTROL_APP_TABS.filter((tab) => {
    if ("analytics" in tab && tab.analytics) {
      return permissions.includes("analytics.read") || permissions.includes("control.read");
    }
    if ("workflow" in tab && tab.workflow) {
      return permissions.includes("workflow.read") || permissions.includes("control.read");
    }
    if ("platform" in tab && tab.platform) {
      return hasPlatformNav(permissions, tab.platform);
    }
    if ("permission" in tab && tab.permission) {
      if (tab.permission === "read") return hasControlPermission(permissions, "read");
      return (
        hasControlPermission(permissions, tab.permission) ||
        hasControlPermission(permissions, "read")
      );
    }
    return true;
  }).map(({ href, label }) => ({ href, label }));
}

export function StatusLabel({
  status,
  labels,
}: {
  status: string;
  labels: Record<string, string>;
}) {
  return <Badge tone="neutral">{labels[status] ?? status}</Badge>;
}

export function ControlStatCards({ data }: { data: ControlDashboard }) {
  const cards = [
    { label: "Metas ativas", value: data.goalsActive },
    { label: "Aprovações pendentes", value: data.approvalsPending },
    { label: "Colaboradores ativos", value: data.employeesActive },
    { label: "Orçamentos abertos", value: data.budgetsOpen },
    { label: "Riscos abertos", value: data.risksOpen },
    { label: "Incidentes abertos", value: data.incidentsOpen },
    { label: "Fornecedores ativos", value: data.vendorsActive },
    { label: "Bugs abertos", value: data.bugsOpen },
  ];
  return (
    <div
      className="vj-grid"
      style={{
        display: "grid",
        gap: "1rem",
        gridTemplateColumns: "repeat(auto-fit, minmax(10rem, 1fr))",
      }}
    >
      {cards.map((card) => (
        <div key={card.label} className="vj-card" style={{ padding: "1rem" }}>
          <p className="vj-muted" style={{ margin: 0 }}>
            {card.label}
          </p>
          <p className="vj-title" style={{ margin: "0.25rem 0 0", fontSize: "1.5rem" }}>
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}

export function ControlHubCards({ permissions }: { permissions: string[] }) {
  const items = CONTROL_HUB_CARDS.filter((card) => {
    if ("analytics" in card && card.analytics) {
      return permissions.includes("analytics.read") || hasControlPermission(permissions, "read");
    }
    if ("workflow" in card && card.workflow) {
      return permissions.includes("workflow.read") || hasControlPermission(permissions, "read");
    }
    if ("platform" in card && card.platform) {
      return hasPlatformNav(permissions, card.platform);
    }
    if ("permission" in card && card.permission) {
      return (
        hasControlPermission(permissions, card.permission) ||
        hasControlPermission(permissions, "read")
      );
    }
    return false;
  });
  if (items.length === 0) {
    return (
      <EmptyState title="Sem áreas liberadas">
        Nenhum módulo de Control disponível para seu perfil.
      </EmptyState>
    );
  }
  return (
    <div
      className="vj-grid"
      style={{
        display: "grid",
        gap: "1rem",
        gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))",
      }}
    >
      {items.map((card) => (
        <a
          key={card.href}
          href={card.href}
          className="vj-card"
          style={{ padding: "1.25rem", textDecoration: "none", color: "inherit", display: "block" }}
        >
          <h2 className="vj-subtitle" style={{ marginTop: 0 }}>
            {card.title}
          </h2>
          <p className="vj-muted" style={{ marginBottom: 0 }}>
            {card.description}
          </p>
        </a>
      ))}
    </div>
  );
}

type Column<T> = { key: string; header: string; render: (row: T) => ReactNode };

function DataTable<T extends { id: string }>({
  columns,
  items,
  emptyTitle,
  emptyDescription,
}: {
  columns: Column<T>[];
  items: T[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (items.length === 0) {
    return <EmptyState title={emptyTitle}>{emptyDescription}</EmptyState>;
  }
  return (
    <div className="vj-table-wrap" style={{ overflowX: "auto" }}>
      <table className="vj-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} scope="col">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id}>
              {columns.map((col) => (
                <td key={col.key}>{col.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function GoalsTable({ items }: { items: ControlGoal[] }) {
  return (
    <DataTable
      items={items}
      emptyTitle="Nenhuma meta"
      emptyDescription="Ainda não há metas de diretoria nesta organização."
      columns={[
        { key: "title", header: "Meta", render: (r) => r.title },
        { key: "area", header: "Área", render: (r) => r.area ?? "—" },
        {
          key: "status",
          header: "Status",
          render: (r) => <StatusLabel status={r.status} labels={CONTROL_GOAL_STATUS_LABELS} />,
        },
        {
          key: "period",
          header: "Período",
          render: (r) => `${formatDateTime(r.periodStart)} → ${formatDateTime(r.periodEnd)}`,
        },
      ]}
    />
  );
}

export function ApprovalsTable({ items }: { items: ControlApproval[] }) {
  return (
    <DataTable
      items={items}
      emptyTitle="Nenhuma aprovação"
      emptyDescription="Não há solicitações de aprovação pendentes ou recentes."
      columns={[
        {
          key: "subject",
          header: "Assunto",
          render: (r) => `${r.subjectType} · ${r.subjectId.slice(0, 8)}`,
        },
        {
          key: "status",
          header: "Status",
          render: (r) => <StatusLabel status={r.status} labels={CONTROL_APPROVAL_STATUS_LABELS} />,
        },
        { key: "policy", header: "Política", render: (r) => r.policy },
        { key: "created", header: "Criada em", render: (r) => formatDateTime(r.createdAt) },
      ]}
    />
  );
}

export function EmployeesTable({ items }: { items: ControlEmployee[] }) {
  return (
    <DataTable
      items={items}
      emptyTitle="Nenhum colaborador"
      emptyDescription="Cadastre funcionários no RH interno da organização."
      columns={[
        { key: "name", header: "Nome", render: (r) => r.fullName },
        { key: "email", header: "E-mail", render: (r) => r.email ?? "—" },
        { key: "type", header: "Vínculo", render: (r) => r.employmentType },
        {
          key: "status",
          header: "Status",
          render: (r) => <StatusLabel status={r.status} labels={CONTROL_EMPLOYEE_STATUS_LABELS} />,
        },
      ]}
    />
  );
}

export function LeavesTable({ items }: { items: ControlLeaveRequest[] }) {
  return (
    <DataTable
      items={items}
      emptyTitle="Nenhuma solicitação de férias"
      emptyDescription="Não há pedidos de afastamento registrados."
      columns={[
        { key: "employee", header: "Colaborador", render: (r) => r.employeeId.slice(0, 8) },
        { key: "type", header: "Tipo", render: (r) => r.leaveType },
        {
          key: "status",
          header: "Status",
          render: (r) => <StatusLabel status={r.status} labels={CONTROL_LEAVE_STATUS_LABELS} />,
        },
        {
          key: "period",
          header: "Período",
          render: (r) => `${formatDateTime(r.startsAt)} → ${formatDateTime(r.endsAt)}`,
        },
      ]}
    />
  );
}

export function BudgetsTable({ items }: { items: ControlBudget[] }) {
  return (
    <DataTable
      items={items}
      emptyTitle="Nenhum orçamento"
      emptyDescription="Orçamentos internos ainda não foram cadastrados."
      columns={[
        { key: "year", header: "Ano", render: (r) => String(r.fiscalYear) },
        { key: "version", header: "Versão", render: (r) => String(r.version) },
        {
          key: "status",
          header: "Status",
          render: (r) => <StatusLabel status={r.status} labels={CONTROL_BUDGET_STATUS_LABELS} />,
        },
        {
          key: "approved",
          header: "Aprovado em",
          render: (r) => (r.approvedAt ? formatDateTime(r.approvedAt) : "—"),
        },
      ]}
    />
  );
}

export function ExpensesTable({ items }: { items: ControlExpenseReport[] }) {
  return (
    <DataTable
      items={items}
      emptyTitle="Nenhuma prestação de contas"
      emptyDescription="Não há relatórios de despesa neste período."
      columns={[
        { key: "period", header: "Período", render: (r) => r.period },
        {
          key: "total",
          header: "Total",
          render: (r) => formatMoneyCents(r.totalCents, r.currency),
        },
        {
          key: "status",
          header: "Status",
          render: (r) => <StatusLabel status={r.status} labels={CONTROL_EXPENSE_STATUS_LABELS} />,
        },
        { key: "employee", header: "Colaborador", render: (r) => r.employeeId.slice(0, 8) },
      ]}
    />
  );
}

export function RisksTable({ items }: { items: ControlRisk[] }) {
  return (
    <DataTable
      items={items}
      emptyTitle="Nenhum risco"
      emptyDescription="O registro de riscos de compliance está vazio."
      columns={[
        { key: "title", header: "Risco", render: (r) => r.title },
        { key: "category", header: "Categoria", render: (r) => r.category },
        {
          key: "status",
          header: "Status",
          render: (r) => <StatusLabel status={r.status} labels={CONTROL_RISK_STATUS_LABELS} />,
        },
        {
          key: "scores",
          header: "Inerente / residual",
          render: (r) => `${r.inherentScore ?? "—"} / ${r.residualScore ?? "—"}`,
        },
      ]}
    />
  );
}

export function VendorsTable({ items }: { items: ControlVendor[] }) {
  return (
    <DataTable
      items={items}
      emptyTitle="Nenhum fornecedor"
      emptyDescription="Cadastre fornecedores no ciclo de vida interno."
      columns={[
        {
          key: "name",
          header: "Fornecedor",
          render: (r) => <a href={`/app/control/fornecedores/${r.id}`}>{r.name}</a>,
        },
        { key: "category", header: "Categoria", render: (r) => r.category ?? "—" },
        {
          key: "status",
          header: "Status",
          render: (r) => <StatusLabel status={r.status} labels={CONTROL_VENDOR_STATUS_LABELS} />,
        },
        { key: "risk", header: "Risco", render: (r) => r.riskLevel ?? "—" },
      ]}
    />
  );
}

export function BugsTable({ items }: { items: ControlBug[] }) {
  return (
    <DataTable
      items={items}
      emptyTitle="Nenhum bug"
      emptyDescription="Não há bugs registrados no domínio interno de produto."
      columns={[
        { key: "title", header: "Bug", render: (r) => r.title },
        { key: "severity", header: "Severidade", render: (r) => r.severity },
        {
          key: "status",
          header: "Status",
          render: (r) => <StatusLabel status={r.status} labels={CONTROL_BUG_STATUS_LABELS} />,
        },
        { key: "created", header: "Criado em", render: (r) => formatDateTime(r.createdAt) },
      ]}
    />
  );
}

export function ReleasesTable({ items }: { items: ControlRelease[] }) {
  return (
    <DataTable
      items={items}
      emptyTitle="Nenhum release"
      emptyDescription="Releases de produto ainda não foram publicados."
      columns={[
        { key: "name", header: "Release", render: (r) => r.name },
        { key: "version", header: "Versão", render: (r) => r.version ?? "—" },
        {
          key: "status",
          header: "Status",
          render: (r) => <StatusLabel status={r.status} labels={CONTROL_RELEASE_STATUS_LABELS} />,
        },
        {
          key: "released",
          header: "Publicado em",
          render: (r) => (r.releasedAt ? formatDateTime(r.releasedAt) : "—"),
        },
      ]}
    />
  );
}

export function ProjectsTable({ items }: { items: ControlProject[] }) {
  return (
    <DataTable
      items={items}
      emptyTitle="Nenhum projeto"
      emptyDescription="Não há projetos internos de produto/tecnologia."
      columns={[
        { key: "name", header: "Projeto", render: (r) => r.name },
        {
          key: "status",
          header: "Status",
          render: (r) => <StatusLabel status={r.status} labels={CONTROL_PROJECT_STATUS_LABELS} />,
        },
        { key: "updated", header: "Atualizado", render: (r) => formatDateTime(r.updatedAt) },
      ]}
    />
  );
}

export function GenericRecordsTable({
  items,
  emptyTitle,
  emptyDescription,
  columns,
}: {
  items: Array<Record<string, unknown> & { id: string }>;
  emptyTitle: string;
  emptyDescription: string;
  columns: Array<{ key: string; header: string }>;
}) {
  return (
    <DataTable<Record<string, unknown> & { id: string }>
      items={items}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      columns={columns.map((col) => ({
        key: col.key,
        header: col.header,
        render: (row: Record<string, unknown> & { id: string }) => {
          const value = row[col.key];
          if (value == null) return "—";
          if (
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean"
          ) {
            return String(value);
          }
          return JSON.stringify(value);
        },
      }))}
    />
  );
}

/** Gráfico de barras CSS + tabela alternativa (acessibilidade; não só cor). */
export function ChartWithTableAlternative({
  title,
  points,
  valueLabel = "Valor",
}: {
  title: string;
  points: AnalyticsSeriesPoint[];
  valueLabel?: string;
}) {
  const max = Math.max(1, ...points.map((p) => Math.abs(p.value)));
  return (
    <section className="vj-stack" aria-labelledby={`chart-${title}`}>
      <h3 id={`chart-${title}`} className="vj-subtitle">
        {title}
      </h3>
      {points.length === 0 ? (
        <EmptyState title="Sem série">Não há pontos para exibir neste filtro.</EmptyState>
      ) : (
        <>
          <div
            role="img"
            aria-label={`Gráfico de barras: ${title}. Alternativa tabular disponível abaixo.`}
            style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem", minHeight: "10rem" }}
          >
            {points.map((point) => {
              const height = `${Math.max(4, (Math.abs(point.value) / max) * 100)}%`;
              const pattern =
                point.status === "insufficient_data"
                  ? "repeating-linear-gradient(45deg, var(--vj-border), var(--vj-border) 2px, transparent 2px, transparent 6px)"
                  : "var(--vj-accent, #1f4b3a)";
              return (
                <div
                  key={point.label}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "0.35rem",
                    minWidth: 0,
                  }}
                >
                  <span className="vj-muted" style={{ fontSize: "0.75rem" }}>
                    {point.value}
                    {point.unit ? ` ${point.unit}` : ""}
                  </span>
                  <div
                    style={{
                      width: "100%",
                      maxWidth: "2.5rem",
                      height,
                      minHeight: "0.5rem",
                      background: pattern,
                      border: "1px solid var(--vj-border, #ccc)",
                    }}
                    title={`${point.label}: ${point.value}${point.note ? ` — ${point.note}` : ""}`}
                  />
                  <span
                    style={{ fontSize: "0.75rem", textAlign: "center", wordBreak: "break-word" }}
                  >
                    {point.label}
                    {point.status === "insufficient_data" ? " (dados insuficientes)" : ""}
                  </span>
                </div>
              );
            })}
          </div>
          <details>
            <summary>Ver como tabela</summary>
            <table className="vj-table">
              <thead>
                <tr>
                  <th scope="col">Rótulo</th>
                  <th scope="col">{valueLabel}</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Nota</th>
                </tr>
              </thead>
              <tbody>
                {points.map((point) => (
                  <tr key={point.label}>
                    <td>{point.label}</td>
                    <td>
                      {point.value}
                      {point.unit ? ` ${point.unit}` : ""}
                    </td>
                    <td>
                      {point.status === "insufficient_data"
                        ? "Dados insuficientes"
                        : point.status === "error"
                          ? "Erro"
                          : "OK"}
                    </td>
                    <td>{point.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </section>
  );
}

export function AnalyticsMetricCards({ metrics }: { metrics: AnalyticsMetricCard[] }) {
  if (metrics.length === 0) {
    return (
      <EmptyState title="Sem métricas">
        Nenhuma métrica retornada para o período e filtros selecionados.
      </EmptyState>
    );
  }
  return (
    <div
      className="vj-grid"
      style={{
        display: "grid",
        gap: "1rem",
        gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))",
      }}
    >
      {metrics.map((metric) => (
        <div key={metric.key} className="vj-card" style={{ padding: "1rem" }}>
          <p className="vj-muted" style={{ margin: 0 }}>
            {metric.name}
          </p>
          <p className="vj-title" style={{ margin: "0.25rem 0 0", fontSize: "1.35rem" }}>
            {metric.status === "insufficient_data"
              ? "Dados insuficientes"
              : metric.value == null
                ? "—"
                : `${metric.value}${metric.unit ? ` ${metric.unit}` : ""}`}
          </p>
          {metric.formulaVersion ? (
            <p className="vj-muted" style={{ margin: "0.35rem 0 0", fontSize: "0.75rem" }}>
              Fórmula v{metric.formulaVersion}
            </p>
          ) : null}
          {metric.note ? (
            <p className="vj-muted" style={{ margin: "0.25rem 0 0", fontSize: "0.8rem" }}>
              {metric.note}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function AnalyticsTabNav({
  current,
  onChange,
}: {
  current: AnalyticsTabKey | string;
  onChange: (tab: AnalyticsTabKey) => void;
}) {
  return (
    <nav aria-label="Abas de analytics">
      <ul
        className="vj-inline-actions"
        style={{ listStyle: "none", margin: 0, padding: 0, flexWrap: "wrap" }}
      >
        {ANALYTICS_TAB_KEYS.map((tab) => {
          const active = tab === current;
          return (
            <li key={tab}>
              <button
                type="button"
                className={`vj-button ${active ? "vj-button-primary" : "vj-button-secondary"}`}
                aria-current={active ? "page" : undefined}
                onClick={() => onChange(tab)}
              >
                {ANALYTICS_TAB_LABELS[tab]}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function WorkflowsTable({ items }: { items: WorkflowDefinition[] }) {
  return (
    <DataTable
      items={items}
      emptyTitle="Nenhum workflow"
      emptyDescription="Crie ou publique automações no motor central."
      columns={[
        {
          key: "name",
          header: "Workflow",
          render: (r) => <a href={`/app/control/automacoes/workflows/${r.id}`}>{r.name}</a>,
        },
        { key: "key", header: "Chave", render: (r) => r.key },
        {
          key: "status",
          header: "Status",
          render: (r) => <StatusLabel status={r.status} labels={WORKFLOW_STATUS_LABELS} />,
        },
        {
          key: "trigger",
          header: "Gatilho",
          render: (r) =>
            r.trigger?.type ? (WORKFLOW_TRIGGER_LABELS[r.trigger.type] ?? r.trigger.type) : "—",
        },
      ]}
    />
  );
}

export function WorkflowRunsTable({ items }: { items: WorkflowRun[] }) {
  return (
    <DataTable
      items={items}
      emptyTitle="Nenhuma execução"
      emptyDescription="Ainda não há runs de workflow neste filtro."
      columns={[
        { key: "id", header: "Run", render: (r) => r.id.slice(0, 8) },
        {
          key: "status",
          header: "Status",
          render: (r) => <StatusLabel status={r.status} labels={WORKFLOW_RUN_STATUS_LABELS} />,
        },
        {
          key: "dry",
          header: "Modo",
          render: (r) => (r.dryRun ? "Simulação (dry-run)" : "Produção"),
        },
        {
          key: "started",
          header: "Início",
          render: (r) => (r.startedAt ? formatDateTime(r.startedAt) : "—"),
        },
      ]}
    />
  );
}

export function WorkflowTemplatesTable({ items }: { items: WorkflowTemplate[] }) {
  return (
    <DataTable
      items={items}
      emptyTitle="Nenhum template"
      emptyDescription="Templates reutilizáveis de workflow ainda não foram cadastrados."
      columns={[
        { key: "name", header: "Template", render: (r) => r.name },
        { key: "key", header: "Chave", render: (r) => r.key },
        { key: "domain", header: "Domínio", render: (r) => r.domain ?? "—" },
      ]}
    />
  );
}

export function WorkflowBuilderPanels({ workflow }: { workflow: WorkflowDefinition }) {
  const when = workflow.trigger
    ? (WORKFLOW_TRIGGER_LABELS[workflow.trigger.type] ?? workflow.trigger.type)
    : "Não definido";
  const conditions = workflow.conditions
    ? JSON.stringify(workflow.conditions, null, 2)
    : "Sem condições (sempre verdadeiro)";
  const actions = workflow.actions?.length
    ? workflow.actions
        .map(
          (a, i) =>
            `${i + 1}. ${WORKFLOW_ACTION_TYPE_LABELS[a.type] ?? a.type}${a.failurePolicy ? ` · falha: ${a.failurePolicy}` : ""}`,
        )
        .join("\n")
    : "Nenhuma ação registrada";
  const approval = workflow.actions?.some((a) => a.type === "request_approval")
    ? "Inclui etapa de aprovação registrada"
    : "Sem etapa de aprovação explícita";
  const onFailure =
    workflow.actions
      ?.map((a) => a.failurePolicy)
      .filter(Boolean)
      .join(", ") || "Política padrão do motor";

  const panels: Record<(typeof WORKFLOW_BUILDER_PHASES)[number]["key"], string> = {
    when,
    if: conditions,
    then_actions: actions,
    approval,
    on_failure: onFailure,
  };

  return (
    <div className="vj-stack">
      {WORKFLOW_BUILDER_PHASES.map((phase) => (
        <section
          key={phase.key}
          className="vj-card"
          style={{ padding: "1rem" }}
          aria-labelledby={`phase-${phase.key}`}
        >
          <h3 id={`phase-${phase.key}`} className="vj-subtitle" style={{ marginTop: 0 }}>
            {phase.label}
          </h3>
          <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit" }}>
            {panels[phase.key]}
          </pre>
        </section>
      ))}
    </div>
  );
}

export function requireControlAccess(
  permissions: string[],
  action: ControlAction,
  message: string,
): ReactNode | null {
  const ok =
    hasControlPermission(permissions, action) ||
    (action !== "read" && hasControlPermission(permissions, "read"));
  if (!ok) return <NoPermission>{message}</NoPermission>;
  return null;
}

export function requireWorkflowAccess(permissions: string[], message: string): ReactNode | null {
  if (!hasWorkflowPermission(permissions, "read")) {
    return <NoPermission>{message}</NoPermission>;
  }
  return null;
}
