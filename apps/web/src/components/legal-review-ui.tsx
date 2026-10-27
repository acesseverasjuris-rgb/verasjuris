import { Badge, Button } from "@verasjuris/ui";
import { AlertTriangle, CheckCircle2, CircleSlash, PencilLine, ShieldQuestion } from "lucide-react";
import type { ReactNode } from "react";
import {
  LEGAL_REVIEW_ITEM_STATUS_LABELS,
  LEGAL_REVIEW_STATUS_LABELS,
  LEGAL_REVIEW_TYPE_LABELS,
  reviewStatusLabel,
  reviewTypeLabel,
  type LegalReviewItemStatus,
  type LegalReviewStatus,
  type LegalReviewSummary,
  type ReviewItemBase,
} from "../lib/legal-review";
import { formatDateTime } from "../lib/ai";
import { StatePill } from "./ai-ui";

type Tone = "neutral" | "success" | "warning" | "error";

export function ReviewTypeBadge({ type }: { type: string }) {
  return (
    <Badge tone="neutral">
      {LEGAL_REVIEW_TYPE_LABELS[type as keyof typeof LEGAL_REVIEW_TYPE_LABELS] ??
        reviewTypeLabel(type)}
    </Badge>
  );
}

export function ReviewStatusBadge({ status }: { status: string }) {
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
      {LEGAL_REVIEW_STATUS_LABELS[status as LegalReviewStatus] ?? reviewStatusLabel(status)}
    </Badge>
  );
}

const itemVisual: Record<LegalReviewItemStatus, { tone: Tone; icon: ReactNode }> = {
  unreviewed: { tone: "warning", icon: <ShieldQuestion size={14} aria-hidden="true" /> },
  confirmed: { tone: "success", icon: <CheckCircle2 size={14} aria-hidden="true" /> },
  rejected: { tone: "error", icon: <CircleSlash size={14} aria-hidden="true" /> },
  corrected: { tone: "neutral", icon: <PencilLine size={14} aria-hidden="true" /> },
};

export function ItemReviewBadge({ status }: { status: string | null | undefined }) {
  const key = (status ?? "unreviewed") as LegalReviewItemStatus;
  const visual = itemVisual[key] ?? itemVisual.unreviewed;
  return (
    <StatePill tone={visual.tone} icon={visual.icon}>
      {LEGAL_REVIEW_ITEM_STATUS_LABELS[key] ?? status ?? "IA · Não revisado"}
    </StatePill>
  );
}

export function LayerTag({ layer }: { layer: "FONTE" | "ANÁLISE" | "AÇÃO" }) {
  return <span className="vj-meta">{layer}</span>;
}

export function ReviewListTable({
  items,
  caption,
}: {
  items: LegalReviewSummary[];
  caption: string;
}) {
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Revisão</th>
            <th scope="col">Tipo</th>
            <th scope="col">Situação</th>
            <th scope="col">Criada em</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td data-label="Revisão">
                <a href={`/app/ia/revisao/${item.id}`}>
                  <strong>{item.summary?.slice(0, 80) || `Revisão ${item.id.slice(0, 8)}`}</strong>
                </a>
                <div className="vj-meta">ANÁLISE · Apoio assistivo — exige revisão humana</div>
              </td>
              <td data-label="Tipo">
                <ReviewTypeBadge type={item.reviewType} />
              </td>
              <td data-label="Situação">
                <ReviewStatusBadge status={item.status} />
              </td>
              <td data-label="Criada em">{formatDateTime(item.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReviewItemCard({
  title,
  children,
  item,
  unsupportedHint,
  canReview,
  onAction,
  pending,
}: {
  title: string;
  children: ReactNode;
  item: ReviewItemBase;
  unsupportedHint?: string;
  canReview: boolean;
  onAction: (action: "confirm" | "reject") => void;
  pending?: boolean;
}) {
  return (
    <article className="vj-card vj-stack" aria-label={title}>
      <div className="vj-header-actions">
        <h3 className="vj-section-title">{title}</h3>
        <ItemReviewBadge status={item.reviewStatus} />
      </div>
      {children}
      {item.unsupported ? (
        <p className="vj-meta">
          <AlertTriangle size={14} aria-hidden="true" />{" "}
          {unsupportedHint ?? "Não localizado nos documentos analisados"}
        </p>
      ) : null}
      {item.sourceLabel || item.pageNumber != null ? (
        <p className="vj-meta">
          FONTE: {item.sourceLabel ?? "documento"}
          {item.pageNumber != null ? `, p. ${item.pageNumber}` : ""}
        </p>
      ) : null}
      {canReview && item.reviewStatus === "unreviewed" ? (
        <div className="vj-inline-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => onAction("confirm")}
          >
            Confirmar
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => onAction("reject")}
          >
            Rejeitar
          </Button>
        </div>
      ) : null}
    </article>
  );
}
