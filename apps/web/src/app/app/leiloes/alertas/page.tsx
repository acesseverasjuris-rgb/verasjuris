"use client";

import {
  Alert,
  Breadcrumb,
  Button,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  PageHeader,
  Select,
} from "@verasjuris/ui";
import { useCallback, useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import { AUCTION_TABS } from "../../../../components/auction-ui";
import {
  AUCTION_ASSET_TYPE_LABELS,
  AUCTION_TYPE_LABELS,
  auctionErrorMessage,
  BR_STATES,
  createAuctionAlert,
  deleteAuctionAlert,
  fetchAuctionAlerts,
  formatMoneyCents,
  hasAuctionPermission,
  isApiFailure,
  parseMoneyToCents,
  type AuctionAlert,
  type AuctionAssetType,
  type AuctionType,
} from "../../../../lib/auctions";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function LeiloesAlertasPage() {
  const org = useOrgContext();
  const canRead = hasAuctionPermission(org.permissions, "read");
  const canAlerts = hasAuctionPermission(org.permissions, "alerts");

  const [items, setItems] = useState<AuctionAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [auctionType, setAuctionType] = useState("");
  const [assetType, setAssetType] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [maxValue, setMaxValue] = useState("");
  const [pending, setPending] = useState(false);

  const load = useCallback(async (orgId: string) => {
    setLoading(true);
    setError(null);
    const data = await fetchAuctionAlerts(orgId);
    if (isApiFailure(data)) {
      setError(auctionErrorMessage(data, "Não foi possível listar os alertas."));
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
    void load(org.orgId);
  }, [org.ready, org.orgId, canRead, load]);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Leilões", href: "/app/leiloes" },
    { label: "Alertas" },
  ];

  async function onCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!org.orgId || !canAlerts) return;
    if (name.trim().length < 2) {
      setMsg("Informe um nome para o alerta.");
      return;
    }
    let maxValueCents: number | undefined;
    if (maxValue.trim()) {
      const parsed = parseMoneyToCents(maxValue);
      if (parsed === null) {
        setMsg("Valor máximo inválido.");
        return;
      }
      maxValueCents = parsed;
    }
    setPending(true);
    setMsg(null);
    const data = await createAuctionAlert(org.orgId, {
      name: name.trim(),
      auctionTypes: auctionType ? [auctionType as AuctionType] : undefined,
      assetTypes: assetType ? [assetType as AuctionAssetType] : undefined,
      stateCodes: stateCode ? [stateCode] : undefined,
      maxValueCents,
    });
    if (isApiFailure(data)) {
      setMsg(auctionErrorMessage(data, "Não foi possível criar o alerta."));
    } else {
      setName("");
      setAuctionType("");
      setAssetType("");
      setStateCode("");
      setMaxValue("");
      setMsg("Alerta criado.");
      await load(org.orgId);
    }
    setPending(false);
  }

  async function onDelete(alertId: string) {
    if (!org.orgId || !canAlerts) return;
    setMsg(null);
    const data = await deleteAuctionAlert(org.orgId, alertId);
    if (isApiFailure(data)) {
      setMsg(auctionErrorMessage(data, "Não foi possível remover o alerta."));
    } else {
      setMsg("Alerta removido.");
      await load(org.orgId);
    }
  }

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar alertas de leilão.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Alertas de leilão"
        description="Regras de acompanhamento por critérios objetivos. Não enviam lances nem afirmam oportunidades imperdíveis."
      />
      <SectionTabs label="Seções de leilões" items={AUCTION_TABS} current="/app/leiloes/alertas" />

      {msg ? (
        <Alert tone="info" title="Atualização">
          {msg}
        </Alert>
      ) : null}

      {canAlerts ? (
        <form className="vj-card vj-stack" onSubmit={(event) => void onCreate(event)}>
          <h2 className="vj-section-title">AÇÃO · Novo alerta</h2>
          <FormField id="alerta-nome" label="Nome">
            <Input
              id="alerta-nome"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              autoComplete="off"
            />
          </FormField>
          <div className="vj-split">
            <FormField id="alerta-tipo" label="Tipo de leilão">
              <Select
                id="alerta-tipo"
                value={auctionType}
                onChange={(event) => setAuctionType(event.target.value)}
              >
                <option value="">Qualquer</option>
                {Object.entries(AUCTION_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField id="alerta-bem" label="Tipo de bem">
              <Select
                id="alerta-bem"
                value={assetType}
                onChange={(event) => setAssetType(event.target.value)}
              >
                <option value="">Qualquer</option>
                {Object.entries(AUCTION_ASSET_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <div className="vj-split">
            <FormField id="alerta-uf" label="UF">
              <Select
                id="alerta-uf"
                value={stateCode}
                onChange={(event) => setStateCode(event.target.value)}
              >
                <option value="">Qualquer</option>
                {BR_STATES.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField id="alerta-max" label="Valor máximo (R$)">
              <Input
                id="alerta-max"
                value={maxValue}
                onChange={(event) => setMaxValue(event.target.value)}
                inputMode="decimal"
                autoComplete="off"
              />
            </FormField>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Criar alerta"}
          </Button>
        </form>
      ) : (
        <Alert tone="info" title="Somente leitura">
          Você pode ver alertas existentes, mas não criar ou remover regras.
        </Alert>
      )}

      {loading || !org.ready ? <LoadingState label="Carregando alertas" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}

      {!loading && !error && items.length === 0 ? (
        <EmptyState title="Nenhum alerta configurado">
          Crie regras com critérios objetivos. Nenhum alerta de demonstração é criado
          automaticamente.
        </EmptyState>
      ) : null}

      {!loading && items.length > 0 ? (
        <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {items.map((item) => (
            <li key={item.id} className="vj-card vj-stack">
              <div className="vj-header-actions">
                <strong>{item.name}</strong>
                <span className="vj-meta">{item.active ? "Ativo" : "Inativo"}</span>
              </div>
              <p className="vj-meta">
                Tipos: {(item.auctionTypes ?? []).join(", ") || "qualquer"} · Bens:{" "}
                {(item.assetTypes ?? []).join(", ") || "qualquer"} · UF:{" "}
                {(item.stateCodes ?? []).join(", ") || "qualquer"}
              </p>
              {item.maxValueCents != null ? (
                <p className="vj-meta">Máximo: {formatMoneyCents(item.maxValueCents)}</p>
              ) : null}
              {canAlerts ? (
                <Button type="button" variant="ghost" onClick={() => void onDelete(item.id)}>
                  Remover alerta
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
