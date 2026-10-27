import { Alert, Badge } from "@verasjuris/ui";
import {
  CALCULATION_REVIEW_DISCLAIMER,
  CONTRACT_STATUS_LABELS,
  FGTS_ESTIMATE_DISCLAIMER,
  LABOR_CALCULATION_STATUS_LABELS,
  LABOR_CALCULATION_TYPE_LABELS,
  LABOR_CASE_STATUS_LABELS,
  LABOR_CLIENT_ROLE_LABELS,
  formatDateTime,
  formatMoneyCents,
  type EmploymentContract,
  type FgtsRecord,
  type LaborCalculation,
  type LaborCase,
  type LaborClaimItem,
} from "../lib/labor";
import {
  CalculationMemoryViewer,
  CalculationReviewNotice,
  CalculationStatusBadge,
  CalculationWarningsBanner,
  CalcLayerPipeline,
  CalcLayerTag,
} from "./previdentiary-ui";

export {
  CalculationMemoryViewer,
  CalculationReviewNotice,
  CalculationWarningsBanner,
  CalcLayerPipeline,
  CalcLayerTag,
};

export const TRABALHISTA_TABS = [
  { href: "/app/trabalhista", label: "Visão geral" },
  { href: "/app/trabalhista/casos", label: "Casos" },
  { href: "/app/trabalhista/calculos", label: "Cálculos" },
];

export const LABOR_CASE_SECTIONS = [
  { id: "resumo", label: "Resumo" },
  { id: "contrato", label: "Contrato" },
  { id: "jornada", label: "Jornada" },
  { id: "remuneracao", label: "Remuneração" },
  { id: "ferias", label: "Férias" },
  { id: "fgts", label: "FGTS" },
  { id: "rescisao", label: "Rescisão" },
  { id: "pedidos", label: "Pedidos" },
  { id: "calculos", label: "Cálculos" },
  { id: "liquidacao", label: "Liquidação" },
  { id: "documentos", label: "Documentos" },
  { id: "audiencias", label: "Audiências" },
  { id: "processo", label: "Processo" },
  { id: "prazos", label: "Prazos" },
  { id: "tarefas", label: "Tarefas" },
  { id: "historico", label: "Histórico" },
] as const;

type Tone = "neutral" | "success" | "warning" | "error";

function statusTone(status: string): Tone {
  if (status === "approved" || status === "reviewed" || status === "active") return "success";
  if (status === "review_required" || status === "draft" || status === "not_configured") {
    return "warning";
  }
  if (status === "cancelled" || status === "terminated" || status === "rejected") return "error";
  return "neutral";
}

export function LaborCaseSectionNav({ current }: { current?: string }) {
  return (
    <nav aria-label="Seções do caso trabalhista">
      <ul
        className="vj-inline-actions"
        style={{ listStyle: "none", margin: 0, padding: 0, flexWrap: "wrap" }}
      >
        {LABOR_CASE_SECTIONS.map((section) => (
          <li key={section.id}>
            <a
              className={`vj-button ${current === section.id ? "vj-button-primary" : "vj-button-secondary"}`}
              href={`#${section.id}`}
            >
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function LaborCaseStatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone(status)}>{LABOR_CASE_STATUS_LABELS[status] ?? status}</Badge>;
}

export function ContractStatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone(status)}>{CONTRACT_STATUS_LABELS[status] ?? status}</Badge>;
}

export function LaborCalculationStatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={statusTone(status)}>{LABOR_CALCULATION_STATUS_LABELS[status] ?? status}</Badge>
  );
}

export function FgtsEstimateNotice() {
  return (
    <Alert tone="info" title="FGTS estimado">
      {FGTS_ESTIMATE_DISCLAIMER}
    </Alert>
  );
}

export function LaborCalculationReviewNotice() {
  return (
    <Alert tone="warning" title="REVISÃO · Humana">
      {CALCULATION_REVIEW_DISCLAIMER}
    </Alert>
  );
}

export function LaborCasesTable({ items, caption }: { items: LaborCase[]; caption: string }) {
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Caso</th>
            <th scope="col">Papel</th>
            <th scope="col">Situação</th>
            <th scope="col">Atualizado</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <a href={`/app/trabalhista/casos/${item.id}`}>{item.id.slice(0, 8)}…</a>
                <div className="vj-meta">Cliente {item.clientId.slice(0, 8)}…</div>
              </td>
              <td>{LABOR_CLIENT_ROLE_LABELS[item.clientRole] ?? item.clientRole}</td>
              <td>
                <LaborCaseStatusBadge status={item.status} />
              </td>
              <td>{formatDateTime(item.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ContractsList({ items }: { items: EmploymentContract[] }) {
  if (items.length === 0) return <p className="vj-meta">Nenhum contrato cadastrado.</p>;
  return (
    <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {items.map((item) => (
        <li key={item.id} className="vj-card vj-stack">
          <div className="vj-inline-actions">
            <ContractStatusBadge status={item.status} />
            <strong>{item.employerName}</strong>
          </div>
          <div className="vj-meta">
            {item.jobTitle || "Cargo não informado"} · {formatMoneyCents(item.salaryCents)}
          </div>
          <div className="vj-meta">
            Admissão {formatDateTime(item.admissionDate)}
            {item.source ? ` · Fonte: ${item.source}` : ""}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function FgtsList({ items }: { items: FgtsRecord[] }) {
  if (items.length === 0) return <p className="vj-meta">Nenhum registro de FGTS.</p>;
  return (
    <div className="vj-stack">
      <FgtsEstimateNotice />
      <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {items.map((item) => (
          <li key={item.id}>
            <strong>
              {item.competence || "Competência —"}: {formatMoneyCents(item.depositCents)}
            </strong>
            <div className="vj-meta">
              Saldo informado: {formatMoneyCents(item.balanceCents)} · Fonte:{" "}
              {item.source ?? "manual"}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ClaimsList({ items }: { items: LaborClaimItem[] }) {
  if (items.length === 0) return <p className="vj-meta">Nenhum pedido cadastrado.</p>;
  return (
    <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {items.map((item) => (
        <li key={item.id}>
          <strong>{item.title || item.claimKey || item.id.slice(0, 8)}</strong>
          <div className="vj-meta">
            {item.status || "draft"}
            {item.estimatedCents != null ? ` · ${formatMoneyCents(item.estimatedCents)}` : ""}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function LaborCalculationsTable({
  items,
  caption,
}: {
  items: LaborCalculation[];
  caption: string;
}) {
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Cálculo</th>
            <th scope="col">Tipo</th>
            <th scope="col">Situação</th>
            <th scope="col">Referência</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <a href={`/app/trabalhista/calculos/${item.id}`}>{item.id.slice(0, 8)}…</a>
              </td>
              <td>{LABOR_CALCULATION_TYPE_LABELS[item.calculationType] ?? item.calculationType}</td>
              <td>
                <LaborCalculationStatusBadge status={item.status} />
              </td>
              <td>{formatDateTime(item.referenceDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Re-export CalculationStatusBadge for pages that already import from previdentiary-ui naming. */
export { CalculationStatusBadge };
