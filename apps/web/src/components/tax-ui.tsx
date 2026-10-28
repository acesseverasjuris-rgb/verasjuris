import { Alert, Badge } from "@verasjuris/ui";
import {
  CALCULATION_REVIEW_DISCLAIMER,
  TAX_CALCULATION_STATUS_LABELS,
  TAX_CASE_STATUS_LABELS,
  TAX_JURISDICTION_SCOPE_LABELS,
  TAX_PROVIDER_NOT_CONFIGURED_MESSAGE,
  TAX_TAXPAYER_TYPE_LABELS,
  formatDateTime,
  formatMoneyCents,
  type TaxAssessment,
  type TaxCalculation,
  type TaxCase,
  type TaxCompensation,
  type TaxCredit,
  type TaxObligation,
  type TaxRefund,
} from "../lib/tax";
import {
  CalculationMemoryViewer,
  CalculationReviewNotice,
  CalculationStatusBadge,
  CalculationWarningsBanner,
} from "./previdentiary-ui";

export {
  CalculationMemoryViewer,
  CalculationReviewNotice,
  CalculationWarningsBanner,
  CalculationStatusBadge,
};

export const TRIBUTARIO_TABS = [
  { href: "/app/tributario", label: "Visão geral" },
  { href: "/app/tributario/casos", label: "Casos" },
  { href: "/app/tributario/calculos", label: "Cálculos" },
  { href: "/app/tributario/teses", label: "Teses" },
];

export const TAX_CASE_SECTIONS = [
  { id: "resumo", label: "Resumo" },
  { id: "tributos", label: "Tributos" },
  { id: "obrigacoes", label: "Obrigações" },
  { id: "creditos", label: "Créditos" },
  { id: "restituicoes", label: "Restituições" },
  { id: "compensacoes", label: "Compensações" },
  { id: "autos", label: "Autos" },
  { id: "administrativo", label: "Administrativo" },
  { id: "execucao", label: "Execução fiscal" },
  { id: "teses", label: "Teses" },
  { id: "calculos", label: "Cálculos" },
  { id: "documentos", label: "Documentos" },
  { id: "prazos", label: "Prazos" },
  { id: "tarefas", label: "Tarefas" },
  { id: "historico", label: "Histórico" },
] as const;

type Tone = "neutral" | "success" | "warning" | "error";

function statusTone(status: string): Tone {
  if (
    status === "approved" ||
    status === "reviewed" ||
    status === "active" ||
    status === "fulfilled"
  ) {
    return "success";
  }
  if (
    status === "review_required" ||
    status === "draft" ||
    status === "open" ||
    status === "pending" ||
    status === "overdue"
  ) {
    return "warning";
  }
  if (status === "cancelled" || status === "denied" || status === "closed") return "error";
  return "neutral";
}

export function TaxProviderBanner({ notConfigured }: { notConfigured: boolean }) {
  if (!notConfigured) return null;
  return (
    <Alert tone="warning" title="Provedor tributário">
      {TAX_PROVIDER_NOT_CONFIGURED_MESSAGE}
    </Alert>
  );
}

export function TaxCaseSectionNav({ current }: { current?: string }) {
  return (
    <nav aria-label="Seções do caso tributário">
      <ul
        className="vj-inline-actions"
        style={{ listStyle: "none", margin: 0, padding: 0, flexWrap: "wrap" }}
      >
        {TAX_CASE_SECTIONS.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className={current === section.id ? "vj-button vj-button-secondary" : "vj-link"}
              aria-current={current === section.id ? "true" : undefined}
            >
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function TaxCaseStatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone(status)}>{TAX_CASE_STATUS_LABELS[status] ?? status}</Badge>;
}

export function TaxCasesTable({ items, caption }: { items: TaxCase[]; caption: string }) {
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Situação</th>
            <th scope="col">Contribuinte</th>
            <th scope="col">Esfera</th>
            <th scope="col">Atualizado</th>
            <th scope="col">Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <TaxCaseStatusBadge status={item.status} />
              </td>
              <td>{TAX_TAXPAYER_TYPE_LABELS[item.taxpayerType] ?? item.taxpayerType}</td>
              <td>
                {TAX_JURISDICTION_SCOPE_LABELS[item.jurisdictionScope] ?? item.jurisdictionScope}
              </td>
              <td>{formatDateTime(item.updatedAt)}</td>
              <td>
                <a href={`/app/tributario/casos/${item.id}`}>Abrir</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TaxDashboardWidgets({
  metrics,
}: {
  metrics: {
    cases: number;
    obligationsDue: number;
    assessments: number;
    credits: number;
    refunds: number;
    compensations: number;
    enforcements: number;
    calculationsReview: number;
    deadlinesLinked: number;
  };
}) {
  const cards = [
    {
      href: "/app/tributario/casos",
      title: "Casos",
      value: metrics.cases,
      meta: "Casos tributários",
    },
    {
      href: "/app/tributario/casos",
      title: "Obrigações próximas",
      value: metrics.obligationsDue,
      meta: "Abertas ou vencidas",
    },
    {
      href: "/app/tributario/casos",
      title: "Autos de infração",
      value: metrics.assessments,
      meta: "Lançamentos registrados",
    },
    {
      href: "/app/tributario/casos",
      title: "Créditos",
      value: metrics.credits,
      meta: "Identificados no período",
    },
    {
      href: "/app/tributario/casos",
      title: "Restituições",
      value: metrics.refunds,
      meta: "Pedidos em andamento",
    },
    {
      href: "/app/tributario/casos",
      title: "Compensações",
      value: metrics.compensations,
      meta: "Registros recentes",
    },
    {
      href: "/app/tributario/casos",
      title: "Execuções fiscais",
      value: metrics.enforcements,
      meta: "Acompanhamento",
    },
    {
      href: "/app/tributario/calculos",
      title: "Cálculos pendentes",
      value: metrics.calculationsReview,
      meta: "Aguardam revisão",
    },
    {
      href: "/app/prazos",
      title: "Prazos vinculados",
      value: metrics.deadlinesLinked,
      meta: "Ver agenda de prazos",
    },
  ];
  return (
    <div
      className="vj-split"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 16rem), 1fr))" }}
    >
      {cards.map((card) => (
        <a key={card.title} className="vj-card vj-stack" href={card.href}>
          <h2 className="vj-section-title">{card.title}</h2>
          <p className="vj-title">{card.value}</p>
          <p className="vj-meta">{card.meta}</p>
        </a>
      ))}
    </div>
  );
}

export function TaxObligationsTable({ items }: { items: TaxObligation[] }) {
  if (items.length === 0) return null;
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">Obrigações tributárias</caption>
        <thead>
          <tr>
            <th scope="col">Competência</th>
            <th scope="col">Vencimento</th>
            <th scope="col">Valor</th>
            <th scope="col">Situação</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id}>
              <td>{row.competence ?? "—"}</td>
              <td>{row.dueDate ? formatDateTime(row.dueDate) : "—"}</td>
              <td>{row.amountCents != null ? formatMoneyCents(row.amountCents) : "—"}</td>
              <td>
                <Badge tone={statusTone(row.status)}>{row.status}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TaxCreditsTable({ items }: { items: TaxCredit[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="vj-stack">
      {items.map((row) => (
        <li key={row.id} className="vj-card">
          <Badge tone={statusTone(row.status)}>{row.status}</Badge>
          <span className="vj-meta">
            {row.totalCents != null ? formatMoneyCents(row.totalCents) : "Valor não informado"}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function TaxRefundsTable({ items }: { items: TaxRefund[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="vj-stack">
      {items.map((row) => (
        <li key={row.id} className="vj-card">
          <Badge tone={statusTone(row.status)}>{row.status}</Badge>
          <span className="vj-meta">{row.protocolNumber ?? "Sem protocolo"}</span>
        </li>
      ))}
    </ul>
  );
}

export function TaxCompensationsTable({ items }: { items: TaxCompensation[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="vj-stack">
      {items.map((row) => (
        <li key={row.id} className="vj-card">
          <Badge tone={statusTone(row.status)}>{row.status}</Badge>
          <span className="vj-meta">{row.protocol ?? "—"}</span>
        </li>
      ))}
    </ul>
  );
}

export function TaxAssessmentsTable({ items }: { items: TaxAssessment[] }) {
  if (items.length === 0) return null;
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">Autos de infração</caption>
        <thead>
          <tr>
            <th scope="col">Número</th>
            <th scope="col">Autoridade</th>
            <th scope="col">Total</th>
            <th scope="col">Situação</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id}>
              <td>{row.assessmentNumber ?? "—"}</td>
              <td>{row.authority ?? "—"}</td>
              <td>{row.totalCents != null ? formatMoneyCents(row.totalCents) : "—"}</td>
              <td>
                <Badge tone={statusTone(row.status)}>{row.status}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TaxCalculationsTable({ items }: { items: TaxCalculation[] }) {
  if (items.length === 0) return null;
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">Cálculos tributários</caption>
        <thead>
          <tr>
            <th scope="col">Tipo</th>
            <th scope="col">Referência</th>
            <th scope="col">Situação</th>
            <th scope="col">Caso</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id}>
              <td>{row.calculationType}</td>
              <td>{formatDateTime(row.referenceDate)}</td>
              <td>
                <Badge tone={statusTone(row.status)}>
                  {TAX_CALCULATION_STATUS_LABELS[row.status] ?? row.status}
                </Badge>
              </td>
              <td>
                <a
                  href={`/app/tributario/casos/${row.taxCaseId}#calculos`}
                  className="vj-technical"
                >
                  {row.taxCaseId.slice(0, 8)}…
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TaxCalculationReviewBanner() {
  return (
    <Alert tone="info" title="Revisão obrigatória">
      {CALCULATION_REVIEW_DISCLAIMER}
    </Alert>
  );
}
