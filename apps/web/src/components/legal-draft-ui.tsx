import { Badge } from "@verasjuris/ui";
import {
  LEGAL_DRAFT_STATUS_LABELS,
  WORKFLOW_MILESTONE_HINTS,
  draftDocumentTypeLabel,
  draftStatusLabel,
  formatDateTime,
  type LegalDraftChecklistItem,
  type LegalDraftHistoryItem,
  type LegalDraftStatus,
  type LegalDraftSummary,
} from "../lib/legal-drafts";
import { StatePill } from "./ai-ui";
import { LayerTag } from "./legal-review-ui";

type Tone = "neutral" | "success" | "warning" | "error";

export function DraftStatusBadge({ status }: { status: string }) {
  const tone: Tone =
    status === "confirmed" || status === "approved" || status === "ready_to_file"
      ? "success"
      : status === "failed" || status === "rejected"
        ? "error"
        : status === "human_review" || status === "ai_assisted" || status === "filed"
          ? "warning"
          : "neutral";
  return (
    <Badge tone={tone}>
      {LEGAL_DRAFT_STATUS_LABELS[status as LegalDraftStatus] ?? draftStatusLabel(status)}
    </Badge>
  );
}

export function DraftWorkflowMilestones({ status }: { status: string }) {
  const order = WORKFLOW_MILESTONE_HINTS.map((item) => item.key);
  const currentIndex = order.indexOf(status as LegalDraftStatus);
  return (
    <section className="vj-card vj-stack" aria-labelledby="draft-milestones">
      <h2 id="draft-milestones" className="vj-section-title">
        Trilha de responsabilidade
      </h2>
      <p className="vj-meta">
        Deixe claro o que a IA gerou, o que o humano revisou e o que foi protocolo/confirmação
        manuais.
      </p>
      <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {WORKFLOW_MILESTONE_HINTS.map((item, index) => {
          const reached = currentIndex >= 0 && index <= currentIndex;
          const current = item.key === status;
          return (
            <li key={item.key} className="vj-inline-actions">
              <LayerTag layer={item.layer} />
              <StatePill tone={current ? "warning" : reached ? "success" : "neutral"}>
                {item.label}
                {current ? " · atual" : reached ? " · atingido" : ""}
              </StatePill>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function DraftListTable({
  items,
  caption,
}: {
  items: LegalDraftSummary[];
  caption: string;
}) {
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Minuta</th>
            <th scope="col">Tipo</th>
            <th scope="col">Situação</th>
            <th scope="col">Atualizada</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td data-label="Minuta">
                <a href={`/app/documentos-juridicos/minutas/${item.id}`}>
                  <strong>{item.title}</strong>
                </a>
                {item.aiRequestId ? (
                  <div className="vj-meta">ANÁLISE · IA gerou — exige revisão humana</div>
                ) : (
                  <div className="vj-meta">FONTE · Conteúdo humano / modelo</div>
                )}
              </td>
              <td data-label="Tipo">{draftDocumentTypeLabel(item.documentType)}</td>
              <td data-label="Situação">
                <DraftStatusBadge status={item.status} />
              </td>
              <td data-label="Atualizada">{formatDateTime(item.updatedAt ?? item.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DraftHistoryList({ items }: { items: LegalDraftHistoryItem[] }) {
  if (items.length === 0) {
    return <p className="vj-meta">Ainda não há histórico de workflow.</p>;
  }
  return (
    <ol className="vj-stack" style={{ margin: 0, paddingLeft: "1.25rem" }}>
      {items.map((item) => (
        <li key={item.id}>
          <strong>
            {item.fromStatus ? draftStatusLabel(item.fromStatus) : "—"} →{" "}
            {draftStatusLabel(item.toStatus)}
          </strong>
          <div className="vj-meta">{formatDateTime(item.createdAt)}</div>
          {item.reason ? <p className="vj-prose">{item.reason}</p> : null}
        </li>
      ))}
    </ol>
  );
}

export function ChecklistPanel({
  items,
  canUpdate,
  pending,
  onToggle,
}: {
  items: LegalDraftChecklistItem[];
  canUpdate: boolean;
  pending?: string | null;
  onToggle: (item: LegalDraftChecklistItem, status: "done" | "pending") => void;
}) {
  if (items.length === 0) {
    return <p className="vj-meta">Nenhum item de checklist nesta minuta.</p>;
  }
  return (
    <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {items.map((item) => {
        const done = item.status === "done";
        return (
          <li key={item.id} className="vj-stack">
            <label className="vj-inline-actions" style={{ alignItems: "flex-start" }}>
              <input
                type="checkbox"
                checked={done}
                disabled={!canUpdate || pending === item.id}
                onChange={() => onToggle(item, done ? "pending" : "done")}
                aria-describedby={`checklist-${item.id}-meta`}
              />
              <span>
                <strong>{item.label}</strong>
                {item.required ? <span className="vj-meta"> · obrigatório</span> : null}
                <div id={`checklist-${item.id}-meta`} className="vj-meta">
                  {item.itemKey}
                  {item.category ? ` · ${item.category}` : ""}
                  {item.notes ? ` · ${item.notes}` : ""}
                </div>
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

export function DashboardCountCard({
  title,
  count,
  href,
  layer,
}: {
  title: string;
  count: number;
  href: string;
  layer: "FONTE" | "ANÁLISE" | "AÇÃO";
}) {
  return (
    <a
      href={href}
      className="vj-card vj-stack"
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <LayerTag layer={layer} />
      <strong>{title}</strong>
      <span style={{ fontSize: "1.5rem" }} role="status">
        {count}
      </span>
      <span className="vj-meta">itens</span>
    </a>
  );
}
