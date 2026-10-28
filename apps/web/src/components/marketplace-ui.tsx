import { Alert, Badge } from "@verasjuris/ui";
import {
  MARKETPLACE_ENGAGEMENT_STATUS_LABELS,
  MARKETPLACE_PROPOSAL_STATUS_LABELS,
  MARKETPLACE_REQUEST_STATUS_LABELS,
  formatDateTime,
  formatMoneyCents,
  type MarketplaceEngagement,
  type MarketplaceProfessional,
  type MarketplaceProposal,
  type MarketplaceRequest,
} from "../lib/marketplace";

export const MARKETPLACE_PUBLIC_TABS = [
  { href: "/marketplace", label: "Visão geral" },
  { href: "/marketplace/servicos", label: "Serviços" },
  { href: "/marketplace/profissionais", label: "Profissionais" },
  { href: "/marketplace/solicitacoes", label: "Solicitações" },
  { href: "/marketplace/propostas", label: "Propostas" },
];

export const MARKETPLACE_APP_TABS = [
  { href: "/app/marketplace", label: "Visão geral" },
  { href: "/app/marketplace/perfil", label: "Perfil" },
  { href: "/app/marketplace/servicos", label: "Meus serviços" },
  { href: "/app/marketplace/oportunidades", label: "Oportunidades" },
  { href: "/app/marketplace/propostas", label: "Propostas" },
  { href: "/app/marketplace/contratacoes", label: "Contratações" },
  { href: "/app/marketplace/avaliacoes", label: "Avaliações" },
];

function tone(status: string): "neutral" | "success" | "warning" | "error" {
  if (status === "completed" || status === "accepted" || status === "active") return "success";
  if (status === "draft" || status === "submitted" || status === "receiving_proposals") {
    return "warning";
  }
  if (status === "cancelled" || status === "rejected" || status === "disputed") return "error";
  return "neutral";
}

export function MarketplacePaymentBanner({ status }: { status: string | null }) {
  if (!status || status === "ok") return null;
  return (
    <Alert tone="warning" title="Pagamento online">
      Provedor de pagamento não configurado (NOT_CONFIGURED). Use registro manual com comprovante
      quando aplicável.
    </Alert>
  );
}

export function MarketplaceRequestsTable({
  items,
  baseHref = "/marketplace/solicitacoes",
}: {
  items: MarketplaceRequest[];
  baseHref?: string;
}) {
  if (items.length === 0) {
    return <p className="vj-meta">Nenhuma solicitação encontrada.</p>;
  }
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">Solicitações do marketplace</caption>
        <thead>
          <tr>
            <th scope="col">Título</th>
            <th scope="col">UF</th>
            <th scope="col">Situação</th>
            <th scope="col">Criada</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <a href={`${baseHref}/${item.id}`}>{item.title}</a>
              </td>
              <td>{item.locationState ?? "—"}</td>
              <td>
                <Badge tone={tone(item.status)}>
                  {MARKETPLACE_REQUEST_STATUS_LABELS[item.status] ?? item.status}
                </Badge>
              </td>
              <td>{formatDateTime(item.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MarketplaceProposalsTable({ items }: { items: MarketplaceProposal[] }) {
  if (items.length === 0) return <p className="vj-meta">Nenhuma proposta.</p>;
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <thead>
          <tr>
            <th scope="col">Valor</th>
            <th scope="col">Versão</th>
            <th scope="col">Situação</th>
            <th scope="col">Enviada</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{formatMoneyCents(item.amountCents)}</td>
              <td>{item.version}</td>
              <td>
                <Badge tone={tone(item.status)}>
                  {MARKETPLACE_PROPOSAL_STATUS_LABELS[item.status] ?? item.status}
                </Badge>
              </td>
              <td>{formatDateTime(item.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MarketplaceEngagementsTable({
  items,
  baseHref = "/marketplace/contratacoes",
}: {
  items: MarketplaceEngagement[];
  baseHref?: string;
}) {
  if (items.length === 0) return <p className="vj-meta">Nenhuma contratação.</p>;
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <thead>
          <tr>
            <th scope="col">ID</th>
            <th scope="col">Situação</th>
            <th scope="col">Revisões</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <a href={`${baseHref}/${item.id}`}>{item.id.slice(0, 8)}…</a>
              </td>
              <td>
                <Badge tone={tone(item.status)}>
                  {MARKETPLACE_ENGAGEMENT_STATUS_LABELS[item.status] ?? item.status}
                </Badge>
              </td>
              <td>
                {item.revisionCount}/{item.revisionLimit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MarketplaceProfessionalsGrid({ items }: { items: MarketplaceProfessional[] }) {
  if (items.length === 0) return <p className="vj-meta">Nenhum profissional encontrado.</p>;
  return (
    <ul className="vj-card-grid">
      {items.map((p) => (
        <li key={p.userId} className="vj-card">
          <h3 className="vj-card-title">
            <a href={`/marketplace/profissionais/${p.userId}`}>
              {p.professionalName ?? "Profissional"}
            </a>
          </h3>
          <p className="vj-meta">{p.marketplaceHeadline ?? "—"}</p>
          <p className="vj-meta">
            {p.oabUf ? `OAB/${p.oabUf}` : ""}{" "}
            {p.ranking ? `· score ${p.ranking.totalScore}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}
