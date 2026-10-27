"use client";

import {
  Alert,
  Breadcrumb,
  Button,
  EmptyState,
  ErrorState,
  FormField,
  LoadingState,
  PageHeader,
  Select,
} from "@verasjuris/ui";
import { useCallback, useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import { AUCTION_TABS, InterestStatusBadge } from "../../../../components/auction-ui";
import {
  AUCTION_INTEREST_LABELS,
  auctionErrorMessage,
  fetchAuctionInterests,
  formatDateTime,
  hasAuctionPermission,
  isApiFailure,
  removeAuctionInterest,
  type AuctionInterest,
} from "../../../../lib/auctions";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function LeiloesSalvosPage() {
  const org = useOrgContext();
  const canRead = hasAuctionPermission(org.permissions, "read");
  const canSave = hasAuctionPermission(org.permissions, "save");

  const [status, setStatus] = useState("");
  const [items, setItems] = useState<AuctionInterest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async (orgId: string, filterStatus: string) => {
    setLoading(true);
    setError(null);
    const data = await fetchAuctionInterests(orgId, {
      status: filterStatus || undefined,
      limit: 50,
    });
    if (isApiFailure(data)) {
      setError(auctionErrorMessage(data, "Não foi possível listar os interesses."));
      setItems([]);
    } else {
      setItems(data.items);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!org.ready) return;
    if (!org.orgId || !canRead) {
      setLoading(false);
      return;
    }
    void load(org.orgId, "");
  }, [org.ready, org.orgId, canRead, load]);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Leilões", href: "/app/leiloes" },
    { label: "Salvos" },
  ];

  async function onRemove(interestId: string) {
    if (!org.orgId || !canSave) return;
    setMsg(null);
    const data = await removeAuctionInterest(org.orgId, interestId);
    if (isApiFailure(data)) {
      setMsg(auctionErrorMessage(data, "Não foi possível remover o interesse."));
    } else {
      setMsg("Interesse removido.");
      void load(org.orgId, status);
    }
  }

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar leilões salvos.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Leilões salvos"
        description="Lista de acompanhamento da organização. Não indica participação automática em leilão."
      />
      <SectionTabs label="Seções de leilões" items={AUCTION_TABS} current="/app/leiloes/salvos" />

      <form
        className="vj-card vj-stack"
        aria-label="Filtro de interesses"
        onSubmit={(event) => {
          event.preventDefault();
          if (org.orgId) void load(org.orgId, status);
        }}
      >
        <FormField id="salvos-status" label="Situação do interesse">
          <Select
            id="salvos-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">Todas</option>
            {Object.entries(AUCTION_INTEREST_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>

      {msg ? (
        <Alert tone="info" title="Atualização">
          {msg}
        </Alert>
      ) : null}
      {loading || !org.ready ? <LoadingState label="Carregando salvos" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}

      {!loading && !error && items.length === 0 ? (
        <EmptyState title="Nenhum interesse salvo">
          Salve leilões a partir da página de detalhe. A lista não inclui exemplos fictícios.
        </EmptyState>
      ) : null}

      {!loading && items.length > 0 ? (
        <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {items.map((item) => (
            <li key={item.id} className="vj-card vj-stack">
              <div className="vj-header-actions">
                <a href={`/app/leiloes/${item.auctionId}`}>
                  <strong>{item.auction?.title ?? `Leilão ${item.auctionId.slice(0, 8)}`}</strong>
                </a>
                <InterestStatusBadge status={item.status} />
              </div>
              {item.lotId ? (
                <p className="vj-meta">
                  Lote: <a href={`/app/leiloes/${item.auctionId}/lotes/${item.lotId}`}>ver lote</a>
                </p>
              ) : null}
              {item.notes ? <p className="vj-prose">{item.notes}</p> : null}
              <p className="vj-meta">Atualizado em {formatDateTime(item.updatedAt)}</p>
              {canSave ? (
                <Button type="button" variant="ghost" onClick={() => void onRemove(item.id)}>
                  Remover da lista
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
