"use client";

import {
  Alert,
  Breadcrumb,
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  PageHeader,
  Select,
} from "@verasjuris/ui";
import { useCallback, useEffect, useState } from "react";
import { NoPermission, NotConfiguredNotice, SectionTabs } from "../../../components/ai-ui";
import { AuctionTable, AUCTION_TABS } from "../../../components/auction-ui";
import {
  AUCTION_ASSET_TYPE_LABELS,
  AUCTION_PROVIDER_NOT_CONFIGURED_MESSAGE,
  AUCTION_SOURCE_LABELS,
  AUCTION_STATUS_LABELS,
  AUCTION_TYPE_LABELS,
  auctionErrorMessage,
  BR_STATES,
  fetchAuctionProviderStatus,
  fetchAuctions,
  hasAuctionPermission,
  isApiFailure,
  isNotConfigured,
  syncAuctions,
  type AuctionProviderStatus,
  type AuctionSummary,
} from "../../../lib/auctions";
import { useOrgContext } from "../../../lib/use-org-context";

type Filters = {
  q: string;
  auctionType: string;
  assetType: string;
  status: string;
  stateCode: string;
  source: string;
};

const EMPTY: Filters = {
  q: "",
  auctionType: "",
  assetType: "",
  status: "",
  stateCode: "",
  source: "",
};

export default function LeiloesPage() {
  const org = useOrgContext();
  const canRead = hasAuctionPermission(org.permissions, "read");
  const canCreate = hasAuctionPermission(org.permissions, "create");
  const canManage = hasAuctionPermission(org.permissions, "manage");

  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [items, setItems] = useState<AuctionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [provider, setProvider] = useState<AuctionProviderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async (orgId: string, f: Filters) => {
    setLoading(true);
    setError(null);
    const [listData, statusData] = await Promise.all([
      fetchAuctions(orgId, {
        q: f.q.trim() || undefined,
        auctionType: f.auctionType || undefined,
        assetType: f.assetType || undefined,
        status: f.status || undefined,
        stateCode: f.stateCode || undefined,
        source: f.source || undefined,
        limit: 50,
      }),
      fetchAuctionProviderStatus(orgId),
    ]);
    if (isApiFailure(listData)) {
      setError(auctionErrorMessage(listData, "Não foi possível listar os leilões."));
      setItems([]);
    } else {
      setItems(listData.items);
      setTotal(listData.total);
    }
    if (!isApiFailure(statusData)) setProvider(statusData);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!org.ready) return;
    if (!org.orgId || !canRead) {
      setLoading(false);
      return;
    }
    void load(org.orgId, EMPTY);
  }, [org.ready, org.orgId, canRead, load]);

  const breadcrumb = [{ label: "Painel", href: "/app" }, { label: "Leilões" }];

  async function onSync() {
    if (!org.orgId) return;
    setSyncing(true);
    setSyncMsg(null);
    const data = await syncAuctions(org.orgId);
    if (isApiFailure(data) || isNotConfigured(data)) {
      setSyncMsg(
        isApiFailure(data)
          ? auctionErrorMessage(data, AUCTION_PROVIDER_NOT_CONFIGURED_MESSAGE)
          : AUCTION_PROVIDER_NOT_CONFIGURED_MESSAGE,
      );
    } else {
      setSyncMsg("Sincronização solicitada. Confira a lista após a conclusão.");
      void load(org.orgId, filters);
    }
    setSyncing(false);
  }

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar leilões.</NoPermission>
      </div>
    );
  }

  const providerOk =
    provider?.status === "configured" ||
    provider?.status === "ok" ||
    provider?.status === "healthy";

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Leilões"
        description="Acompanhamento profissional de leilões e lotes de interesse da organização. Cadastro manual disponível; sincronização externa depende de provedor configurado."
        actions={
          <div className="vj-inline-actions">
            {canManage ? (
              <Button
                type="button"
                variant="secondary"
                disabled={syncing}
                onClick={() => void onSync()}
              >
                {syncing ? "Sincronizando…" : "Sincronizar fontes"}
              </Button>
            ) : null}
            {canCreate ? <ButtonLink href="/app/leiloes/novo">Cadastrar leilão</ButtonLink> : null}
          </div>
        }
      />
      <SectionTabs label="Seções de leilões" items={AUCTION_TABS} current="/app/leiloes" />

      {!providerOk && provider ? (
        <NotConfiguredNotice message={AUCTION_PROVIDER_NOT_CONFIGURED_MESSAGE}>
          O cadastro manual permanece disponível. Nenhum leilão fictício é exibido.
        </NotConfiguredNotice>
      ) : null}

      {syncMsg ? (
        <Alert tone="info" title="Sincronização">
          {syncMsg}
        </Alert>
      ) : null}

      <form
        className="vj-card vj-stack"
        aria-label="Filtros de leilões"
        onSubmit={(event) => {
          event.preventDefault();
          if (org.orgId) void load(org.orgId, filters);
        }}
      >
        <FormField id="lei-q" label="Busca">
          <Input
            id="lei-q"
            value={filters.q}
            onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
            placeholder="Título, descrição ou vendedor"
            autoComplete="off"
          />
        </FormField>
        <div className="vj-split">
          <FormField id="lei-type" label="Tipo">
            <Select
              id="lei-type"
              value={filters.auctionType}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, auctionType: event.target.value }))
              }
            >
              <option value="">Todos</option>
              {Object.entries(AUCTION_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="lei-asset" label="Tipo de bem">
            <Select
              id="lei-asset"
              value={filters.assetType}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, assetType: event.target.value }))
              }
            >
              <option value="">Todos</option>
              {Object.entries(AUCTION_ASSET_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <div className="vj-split">
          <FormField id="lei-status" label="Situação">
            <Select
              id="lei-status"
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            >
              <option value="">Todas</option>
              {Object.entries(AUCTION_STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="lei-uf" label="UF">
            <Select
              id="lei-uf"
              value={filters.stateCode}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, stateCode: event.target.value }))
              }
            >
              <option value="">Todas</option>
              {BR_STATES.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <FormField id="lei-source" label="Origem do cadastro">
          <Select
            id="lei-source"
            value={filters.source}
            onChange={(event) => setFilters((prev) => ({ ...prev, source: event.target.value }))}
          >
            <option value="">Todas</option>
            {Object.entries(AUCTION_SOURCE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>
        <Button type="submit" variant="secondary">
          Aplicar filtros
        </Button>
      </form>

      {loading || !org.ready ? <LoadingState label="Carregando leilões" /> : null}
      {error ? <ErrorState title="Erro ao listar">{error}</ErrorState> : null}

      {!loading && !error && items.length === 0 ? (
        <EmptyState title="Nenhum leilão encontrado">
          Cadastre manualmente ou configure um provedor. A lista não exibe dados de demonstração.
        </EmptyState>
      ) : null}

      {!loading && items.length > 0 ? (
        <>
          <p className="vj-meta">
            {total} leilão(ões) — visão de mercado, sem linguagem promocional.
          </p>
          <AuctionTable items={items} caption="Lista de leilões" />
        </>
      ) : null}
    </div>
  );
}
