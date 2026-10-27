import { Badge, Button } from "@verasjuris/ui";
import { CheckCircle2, CircleSlash, PencilLine, ShieldQuestion } from "lucide-react";
import type { ReactNode } from "react";
import {
  LEGAL_COMPARISON_ITEM_STATUS_LABELS,
  LEGAL_COMPARISON_STATUS_LABELS,
  LEGAL_COMPARISON_TYPE_LABELS,
  comparisonRoleLabel,
  comparisonStatusLabel,
  comparisonTypeLabel,
  formatDateTime,
  type LegalComparisonDetail,
  type LegalComparisonItem,
  type LegalComparisonItemReviewStatus,
  type LegalComparisonSource,
  type LegalComparisonStatus,
  type LegalComparisonSummary,
  type LegalComparisonType,
} from "../lib/legal-comparisons";
import { StatePill } from "./ai-ui";
import { LayerTag } from "./legal-review-ui";

type Tone = "neutral" | "success" | "warning" | "error";

export const COMPARADOR_TABS = [
  { href: "/app/comparador", label: "Comparações" },
  { href: "/app/comparador/novo", label: "Nova comparação" },
];

export function ComparisonTypeBadge({ type }: { type: string }) {
  return (
    <Badge tone="neutral">
      {LEGAL_COMPARISON_TYPE_LABELS[type as LegalComparisonType] ?? comparisonTypeLabel(type)}
    </Badge>
  );
}

export function ComparisonStatusBadge({ status }: { status: string }) {
  const tone: Tone =
    status === "reviewed" || status === "closed"
      ? "success"
      : status === "failed" || status === "not_configured"
        ? "warning"
        : status === "human_review" || status === "generated"
          ? "warning"
          : "neutral";
  return (
    <Badge tone={tone}>
      {LEGAL_COMPARISON_STATUS_LABELS[status as LegalComparisonStatus] ??
        comparisonStatusLabel(status)}
    </Badge>
  );
}

const itemVisual: Record<LegalComparisonItemReviewStatus, { tone: Tone; icon: ReactNode }> = {
  unreviewed: { tone: "warning", icon: <ShieldQuestion size={14} aria-hidden="true" /> },
  confirmed: { tone: "success", icon: <CheckCircle2 size={14} aria-hidden="true" /> },
  rejected: { tone: "error", icon: <CircleSlash size={14} aria-hidden="true" /> },
  corrected: { tone: "neutral", icon: <PencilLine size={14} aria-hidden="true" /> },
};

export function ComparisonItemReviewBadge({ status }: { status: string | null | undefined }) {
  const key = (status ?? "unreviewed") as LegalComparisonItemReviewStatus;
  const visual = itemVisual[key] ?? itemVisual.unreviewed;
  return (
    <StatePill tone={visual.tone} icon={visual.icon}>
      {LEGAL_COMPARISON_ITEM_STATUS_LABELS[key] ?? status ?? "IA · Não revisado"}
    </StatePill>
  );
}

export function ComparisonListTable({
  items,
  caption,
}: {
  items: LegalComparisonSummary[];
  caption: string;
}) {
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Comparação</th>
            <th scope="col">Tipo</th>
            <th scope="col">Situação</th>
            <th scope="col">Criada em</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td data-label="Comparação">
                <a href={`/app/comparador/${item.id}`}>
                  <strong>
                    {item.title ||
                      item.summary?.slice(0, 80) ||
                      `Comparação ${item.id.slice(0, 8)}`}
                  </strong>
                </a>
                <div className="vj-meta">ANÁLISE · Apoio assistivo — exige revisão humana</div>
              </td>
              <td data-label="Tipo">
                <ComparisonTypeBadge type={item.comparisonType} />
              </td>
              <td data-label="Situação">
                <ComparisonStatusBadge status={item.status} />
              </td>
              <td data-label="Criada em">{formatDateTime(item.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SourceColumn({ title, sources }: { title: string; sources: LegalComparisonSource[] }) {
  return (
    <section className="vj-card vj-stack" aria-label={title}>
      <h3 className="vj-section-title">{title}</h3>
      <LayerTag layer="FONTE" />
      {sources.length === 0 ? (
        <p className="vj-meta">Nenhuma fonte neste lado.</p>
      ) : (
        <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {sources.map((source) => (
            <li
              key={`${source.documentId}-${source.roleInComparison}-${source.documentVersionId ?? "v"}`}
            >
              <strong>{comparisonRoleLabel(source.roleInComparison)}</strong>
              <div className="vj-meta">
                Documento <span className="vj-technical">{source.documentId.slice(0, 8)}</span>
                {source.documentTitle ? ` · ${source.documentTitle}` : ""}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ComparisonLayout({
  comparison,
  canReview,
  pendingItemId,
  onItemAction,
}: {
  comparison: LegalComparisonDetail;
  canReview: boolean;
  pendingItemId?: string | null;
  onItemAction: (item: LegalComparisonItem, action: LegalComparisonItemReviewStatus) => void;
}) {
  const sources = comparison.sources ?? [];
  const sideA = sources.filter((source) => {
    const role = source.roleInComparison;
    return role === "side_a" || role === "petition" || role === "claim" || role === "judgment";
  });
  const sideB = sources.filter((source) => {
    const role = source.roleInComparison;
    return role === "side_b" || role === "defense" || role === "decision" || role === "appeal";
  });
  const leftovers = sources.filter((source) => !sideA.includes(source) && !sideB.includes(source));
  const items = comparison.items ?? [];

  return (
    <div
      className="vj-comparison-layout"
      style={{
        display: "grid",
        gap: "1rem",
        gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))",
        alignItems: "start",
      }}
    >
      <SourceColumn title="Lado A" sources={sideA.length ? sideA : leftovers.slice(0, 1)} />

      <section className="vj-card vj-stack" aria-labelledby="comparison-findings">
        <h2 id="comparison-findings" className="vj-section-title">
          Achados
        </h2>
        <LayerTag layer="ANÁLISE" />
        {comparison.summary ? <p className="vj-prose">{comparison.summary}</p> : null}
        {items.length === 0 ? (
          <p className="vj-meta">Nenhum achado gerado ainda.</p>
        ) : (
          <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {items.map((item) => (
              <li key={item.id} className="vj-stack">
                <div className="vj-inline-actions">
                  <ComparisonItemReviewBadge status={item.reviewStatus} />
                  {item.severity ? <Badge tone="neutral">{item.severity}</Badge> : null}
                  {item.unsupported ? <Badge tone="warning">Sem proveniência clara</Badge> : null}
                </div>
                <p className="vj-prose">{item.finding}</p>
                {(item.sourceA || item.sourceB) && (
                  <p className="vj-meta">
                    {item.sourceA ? `A: ${item.sourceA}` : ""}
                    {item.sourceA && item.sourceB ? " · " : ""}
                    {item.sourceB ? `B: ${item.sourceB}` : ""}
                  </p>
                )}
                {canReview && item.reviewStatus === "unreviewed" ? (
                  <div className="vj-inline-actions">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={pendingItemId === item.id}
                      onClick={() => onItemAction(item, "confirmed")}
                    >
                      Confirmar
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={pendingItemId === item.id}
                      onClick={() => onItemAction(item, "rejected")}
                    >
                      Rejeitar
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <SourceColumn
        title="Lado B"
        sources={sideB.length ? sideB : leftovers.slice(sideA.length ? 0 : 1)}
      />
    </div>
  );
}
