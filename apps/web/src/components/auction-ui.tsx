import { Badge } from "@verasjuris/ui";
import { CircleDashed, Database, Gavel, Link2, PenLine, ShieldAlert } from "lucide-react";
import {
  AUCTION_ASSET_TYPE_LABELS,
  AUCTION_INTEREST_LABELS,
  AUCTION_SOURCE_LABELS,
  AUCTION_STATUS_LABELS,
  AUCTION_TYPE_LABELS,
  auctionStatusTone,
  encumbranceStatusLabel,
  encumbranceVerificationLabel,
  formatMoneyCents,
  occupancyLabel,
  type AuctionEncumbrance,
  type AuctionInterestStatus,
  type AuctionLotSummary,
  type AuctionSource,
  type AuctionSummary,
} from "../lib/auctions";
import { formatDateTime } from "../lib/ai";
import { StatePill } from "./ai-ui";

export const AUCTION_TABS = [
  { href: "/app/leiloes", label: "Leilões" },
  { href: "/app/leiloes/salvos", label: "Salvos" },
  { href: "/app/leiloes/alertas", label: "Alertas" },
  { href: "/app/leiloes/due-diligence", label: "Due diligence" },
  { href: "/app/leiloes/novo", label: "Cadastro manual" },
];

export function AuctionSourceBadge({
  source,
}: {
  source:
    | AuctionSource
    | string
    | { provider?: string; badge?: { label: string; official?: boolean } };
}) {
  const provider =
    typeof source === "string" ? source : (source.provider ?? source.badge?.label ?? "manual");
  const label =
    typeof source === "object" && source.badge?.label
      ? source.badge.label.toUpperCase()
      : (AUCTION_SOURCE_LABELS[provider as AuctionSource] ?? String(provider).toUpperCase());
  const official = typeof source === "object" ? Boolean(source.badge?.official) : false;
  const icon =
    provider === "manual" ? (
      <PenLine size={14} aria-hidden="true" />
    ) : provider === "import" ? (
      <Database size={14} aria-hidden="true" />
    ) : provider === "not_configured" ? (
      <CircleDashed size={14} aria-hidden="true" />
    ) : (
      <Link2 size={14} aria-hidden="true" />
    );
  return <StatePill icon={icon}>{official ? `FONTE · ${label}` : `FONTE · ${label}`}</StatePill>;
}

export function AuctionStatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={auctionStatusTone(status)}>
      {AUCTION_STATUS_LABELS[status as keyof typeof AUCTION_STATUS_LABELS] ?? status}
    </Badge>
  );
}

export function InterestStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  return (
    <Badge tone="neutral">
      {AUCTION_INTEREST_LABELS[status as AuctionInterestStatus] ?? status}
    </Badge>
  );
}

export function OccupancyBadge({ status }: { status: string | null | undefined }) {
  return (
    <StatePill icon={<ShieldAlert size={14} aria-hidden="true" />}>
      {occupancyLabel(status)}
    </StatePill>
  );
}

export function EncumbranceBadge({ item }: { item: AuctionEncumbrance }) {
  return (
    <div className="vj-inline-actions">
      <Badge tone="neutral">{encumbranceStatusLabel(item)}</Badge>
      <span className="vj-meta">{encumbranceVerificationLabel(item)}</span>
    </div>
  );
}

export function AuctionCard({ auction }: { auction: AuctionSummary }) {
  return (
    <article className="vj-card vj-stack" aria-labelledby={`auction-${auction.id}`}>
      <div className="vj-header-actions">
        <h3 id={`auction-${auction.id}`} className="vj-section-title">
          <a href={`/app/leiloes/${auction.id}`}>{auction.title}</a>
        </h3>
        <AuctionStatusBadge status={auction.status} />
      </div>
      <div className="vj-inline-actions">
        <Badge tone="neutral">
          <Gavel size={14} aria-hidden="true" />{" "}
          {AUCTION_TYPE_LABELS[auction.auctionType as keyof typeof AUCTION_TYPE_LABELS] ??
            auction.auctionType}
        </Badge>
        <AuctionSourceBadge source={auction.source} />
        {auction.interest ? <InterestStatusBadge status={auction.interest.status} /> : null}
      </div>
      <dl className="vj-meta" style={{ display: "grid", gap: "0.25rem", margin: 0 }}>
        <div>
          <dt style={{ display: "inline" }}>Vendedor: </dt>
          <dd style={{ display: "inline", margin: 0 }}>{auction.sellerName ?? "Não informado"}</dd>
        </div>
        <div>
          <dt style={{ display: "inline" }}>Primeiro evento: </dt>
          <dd style={{ display: "inline", margin: 0 }}>{formatDateTime(auction.firstEventAt)}</dd>
        </div>
      </dl>
    </article>
  );
}

export function AuctionTable({ items, caption }: { items: AuctionSummary[]; caption: string }) {
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Leilão</th>
            <th scope="col">Tipo</th>
            <th scope="col">Situação</th>
            <th scope="col">Evento</th>
            <th scope="col">Origem</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td data-label="Leilão">
                <a href={`/app/leiloes/${item.id}`}>
                  <strong>{item.title}</strong>
                </a>
                <div className="vj-meta">{item.sellerName ?? "Vendedor não informado"}</div>
                {item.interest ? <InterestStatusBadge status={item.interest.status} /> : null}
              </td>
              <td data-label="Tipo">
                {AUCTION_TYPE_LABELS[item.auctionType as keyof typeof AUCTION_TYPE_LABELS] ??
                  item.auctionType}
              </td>
              <td data-label="Situação">
                <AuctionStatusBadge status={item.status} />
              </td>
              <td data-label="Evento">{formatDateTime(item.firstEventAt)}</td>
              <td data-label="Origem">
                <AuctionSourceBadge source={item.source} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LotSummaryRow({ lot, auctionId }: { lot: AuctionLotSummary; auctionId: string }) {
  return (
    <tr>
      <td data-label="Lote">
        <a href={`/app/leiloes/${auctionId}/lotes/${lot.id}`}>
          <strong>
            Lote {lot.lotNumber} — {lot.title}
          </strong>
        </a>
        <div className="vj-meta">
          {lot.municipality ?? "Município não informado"}
          {lot.stateCode ? ` / ${lot.stateCode}` : ""}
        </div>
      </td>
      <td data-label="Bem">
        {AUCTION_ASSET_TYPE_LABELS[lot.assetType as keyof typeof AUCTION_ASSET_TYPE_LABELS] ??
          lot.assetType}
      </td>
      <td data-label="Avaliação">{formatMoneyCents(lot.appraisalValueCents, lot.currency)}</td>
      <td data-label="Lance mínimo">{formatMoneyCents(lot.firstMinimumBidCents, lot.currency)}</td>
      <td data-label="Ocupação">
        <OccupancyBadge status={lot.occupancyStatus} />
      </td>
    </tr>
  );
}
