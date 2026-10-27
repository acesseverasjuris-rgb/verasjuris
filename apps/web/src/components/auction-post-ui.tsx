import { Badge } from "@verasjuris/ui";
import {
  AUCTION_AWARD_STATUS_LABELS,
  AUCTION_DELIVERY_STATUS_LABELS,
  AUCTION_PARTICIPATION_STATUS_LABELS,
  AUCTION_PAYMENT_STATUS_LABELS,
  AUCTION_PAYMENT_TYPE_LABELS,
  AUCTION_POSSESSION_STATUS_LABELS,
  AUCTION_REGULARIZATION_STATUS_LABELS,
  AUCTION_RESULT_STATUS_LABELS,
  AUCTION_TRANSFER_STATUS_LABELS,
  MANUAL_BID_DISCLAIMER,
  MANUAL_RESULT_DISCLAIMER,
  formatDateTime,
  formatMoneyCents,
  type AuctionAward,
  type AuctionAwardEvent,
  type AuctionAwardTimelineItem,
  type AuctionBidRecord,
  type AuctionDelivery,
  type AuctionPayment,
  type AuctionRegularizationItem,
  type AuctionResult,
  type AuctionTransfer,
} from "../lib/auction-post";
import { LayerTag } from "./legal-review-ui";

export const POST_AUCTION_SECTIONS = [
  { id: "resumo", label: "Resumo" },
  { id: "resultado", label: "Resultado" },
  { id: "arrematacao", label: "Arrematação" },
  { id: "pagamentos", label: "Pagamentos" },
  { id: "documentos", label: "Documentos" },
  { id: "posse", label: "Posse" },
  { id: "transferencia", label: "Transferência" },
  { id: "regularizacao", label: "Regularização" },
  { id: "tarefas", label: "Tarefas" },
  { id: "prazos", label: "Prazos" },
  { id: "historico", label: "Histórico" },
] as const;

export function PostSectionNav({ current }: { current?: string }) {
  return (
    <nav aria-label="Seções pós-leilão">
      <ul
        className="vj-inline-actions"
        style={{ listStyle: "none", margin: 0, padding: 0, flexWrap: "wrap" }}
      >
        {POST_AUCTION_SECTIONS.map((section) => (
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

export function ManualDisclaimer({ kind }: { kind: "bid" | "result" }) {
  return (
    <p className="vj-meta">
      <LayerTag layer="FONTE" /> {kind === "bid" ? MANUAL_BID_DISCLAIMER : MANUAL_RESULT_DISCLAIMER}
    </p>
  );
}

export function AwardStatusBadge({ status }: { status: string }) {
  return <Badge tone="neutral">{AUCTION_AWARD_STATUS_LABELS[status] ?? status}</Badge>;
}

export function ResultStatusBadge({ status }: { status: string }) {
  return <Badge tone="neutral">{AUCTION_RESULT_STATUS_LABELS[status] ?? status}</Badge>;
}

export function ParticipationStatusBadge({ status }: { status: string }) {
  return <Badge tone="neutral">{AUCTION_PARTICIPATION_STATUS_LABELS[status] ?? status}</Badge>;
}

export function ResultsList({ items }: { items: AuctionResult[] }) {
  if (items.length === 0) return <p className="vj-meta">Nenhum resultado registrado.</p>;
  return (
    <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {items.map((item) => (
        <li key={item.id}>
          <div className="vj-inline-actions">
            <ResultStatusBadge status={item.status} />
            <span className="vj-meta">{formatMoneyCents(item.winningBidCents)}</span>
          </div>
          <div className="vj-meta">
            Fonte: {item.source}
            {item.resultDate ? ` · ${formatDateTime(item.resultDate)}` : ""}
          </div>
          {item.notes ? <p className="vj-prose">{item.notes}</p> : null}
        </li>
      ))}
    </ul>
  );
}

export function AwardsList({ items }: { items: AuctionAward[] }) {
  if (items.length === 0) return <p className="vj-meta">Nenhuma arrematação registrada.</p>;
  return (
    <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {items.map((item) => (
        <li key={item.id}>
          <div className="vj-inline-actions">
            <AwardStatusBadge status={item.awardStatus} />
            <strong>{formatMoneyCents(item.winningBidCents, item.currency)}</strong>
          </div>
          <div className="vj-meta">
            Total conhecido: {formatMoneyCents(item.totalKnownCostCents, item.currency)}
            {item.awardedAt ? ` · ${formatDateTime(item.awardedAt)}` : ""}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function BidsList({ items }: { items: AuctionBidRecord[] }) {
  if (items.length === 0) return <p className="vj-meta">Nenhum lance registrado.</p>;
  return (
    <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {items.map((item) => (
        <li key={item.id}>
          <strong>{formatMoneyCents(item.amountCents, item.currency)}</strong>
          <div className="vj-meta">
            Fonte: {item.source}
            {item.recordedAt ? ` · ${formatDateTime(item.recordedAt)}` : ""}
          </div>
          {item.notes ? <p className="vj-prose">{item.notes}</p> : null}
        </li>
      ))}
    </ul>
  );
}

export function PaymentsList({ items }: { items: AuctionPayment[] }) {
  if (items.length === 0) return <p className="vj-meta">Nenhum pagamento registrado.</p>;
  return (
    <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {items.map((item) => (
        <li key={item.id}>
          <strong>
            {AUCTION_PAYMENT_TYPE_LABELS[item.paymentType] ?? item.paymentType}:{" "}
            {formatMoneyCents(item.amountCents, item.currency)}
          </strong>
          <div className="vj-meta">
            {AUCTION_PAYMENT_STATUS_LABELS[item.status] ?? item.status}
            {item.dueAt ? ` · venc. ${formatDateTime(item.dueAt)}` : ""}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DeliveriesList({ items }: { items: AuctionDelivery[] }) {
  if (items.length === 0) return <p className="vj-meta">Nenhum registro de posse/entrega.</p>;
  return (
    <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {items.map((item) => (
        <li key={item.id}>
          <strong>{AUCTION_DELIVERY_STATUS_LABELS[item.status] ?? item.status}</strong>
          <div className="vj-meta">
            Posse:{" "}
            {AUCTION_POSSESSION_STATUS_LABELS[item.possessionStatus ?? ""] ??
              item.possessionStatus ??
              "—"}
            {item.location ? ` · ${item.location}` : ""}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function TransfersList({ items }: { items: AuctionTransfer[] }) {
  if (items.length === 0) return <p className="vj-meta">Nenhuma transferência registrada.</p>;
  return (
    <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {items.map((item) => (
        <li key={item.id}>
          <strong>{AUCTION_TRANSFER_STATUS_LABELS[item.status] ?? item.status}</strong>
          <div className="vj-meta">
            {item.authority ?? "Autoridade não informada"}
            {item.protocol ? ` · protocolo ${item.protocol}` : ""}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function RegularizationList({ items }: { items: AuctionRegularizationItem[] }) {
  if (items.length === 0) return <p className="vj-meta">Nenhum item de regularização.</p>;
  return (
    <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {items.map((item) => (
        <li key={item.id ?? item.itemKey}>
          <strong>{item.label}</strong>
          <div className="vj-meta">
            {AUCTION_REGULARIZATION_STATUS_LABELS[item.status] ?? item.status}
            {item.required ? " · obrigatório" : ""}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function TimelineList({
  items,
  events,
}: {
  items: AuctionAwardTimelineItem[];
  events: AuctionAwardEvent[];
}) {
  const combined =
    items.length > 0
      ? items
      : events.map((event) => ({
          id: event.id,
          title: event.eventType,
          body: event.reason,
          occurredAt: event.createdAt,
        }));
  if (combined.length === 0) return <p className="vj-meta">Sem histórico ainda.</p>;
  return (
    <ol className="vj-stack" style={{ margin: 0, paddingLeft: "1.25rem" }}>
      {combined.map((item, index) => (
        <li key={String(item.id ?? index)}>
          <strong>
            {String(item.title ?? ("kind" in item ? item.kind : undefined) ?? "Evento")}
          </strong>
          <div className="vj-meta">
            {item.occurredAt ? formatDateTime(String(item.occurredAt)) : "—"}
          </div>
          {item.body ? <p className="vj-prose">{String(item.body)}</p> : null}
        </li>
      ))}
    </ol>
  );
}
