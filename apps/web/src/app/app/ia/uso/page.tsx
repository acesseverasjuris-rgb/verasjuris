"use client";

import {
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
import {
  IA_TABS,
  NoPermission,
  NotConfiguredNotice,
  SectionTabs,
} from "../../../../components/ai-ui";
import {
  AI_FEATURE_LABELS,
  aiErrorMessage,
  featureLabel,
  fetchAiModels,
  fetchAiUsage,
  formatDateTime,
  formatDuration,
  formatMicros,
  formatNumber,
  hasPermission,
  isApiFailure,
  isNotConfigured,
  type AiModel,
  type AiUsageItem,
  type AiUsageTotals,
} from "../../../../lib/ai";
import { useOrgContext } from "../../../../lib/use-org-context";

type Period = "7" | "30" | "90" | "custom";

type Filters = { period: Period; from: string; to: string; feature: string; model: string };

const DEFAULT_FILTERS: Filters = { period: "30", from: "", to: "", feature: "", model: "" };

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

export default function IaUsoPage() {
  const org = useOrgContext();
  const canRead = hasPermission(org.permissions, "ai.usage.read");

  const [period, setPeriod] = useState<Period>("30");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [feature, setFeature] = useState("");
  const [model, setModel] = useState("");
  const [models, setModels] = useState<AiModel[]>([]);

  const [items, setItems] = useState<AiUsageItem[]>([]);
  const [totals, setTotals] = useState<AiUsageTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const load = useCallback(async (orgId: string, f: Filters) => {
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    const range =
      f.period === "custom"
        ? {
            from: f.from ? new Date(`${f.from}T00:00:00`).toISOString() : undefined,
            to: f.to ? new Date(`${f.to}T23:59:59`).toISOString() : undefined,
          }
        : { from: isoDaysAgo(Number(f.period)), to: undefined };
    const data = await fetchAiUsage(orgId, {
      ...range,
      feature: f.feature || undefined,
      model: f.model || undefined,
      limit: 100,
    });
    if (isApiFailure(data)) {
      if (isNotConfigured(data)) setNotConfigured(true);
      else setError(aiErrorMessage(data, "Não foi possível carregar o uso de IA."));
      setItems([]);
      setTotals(null);
    } else {
      setItems(data.items);
      setTotals(data.totals);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!org.ready) return;
    if (!org.orgId || !canRead) {
      setLoading(false);
      return;
    }
    const orgId = org.orgId;
    void (async () => {
      const modelData = await fetchAiModels(orgId);
      if (!isApiFailure(modelData)) setModels(modelData.models);
      await load(orgId, DEFAULT_FILTERS);
    })();
  }, [org.ready, org.orgId, canRead, load]);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "IA", href: "/app/ia" },
    { label: "Uso" },
  ];

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar o uso de IA.</NoPermission>
      </div>
    );
  }

  const currency = totals?.currency ?? "BRL";

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Uso de IA"
        description="Consumo estimado de tokens e custo por funcionalidade e modelo. Valores de custo são estimativas locais e podem diferir da cobrança do provedor."
      />
      <SectionTabs label="Seções de IA" items={IA_TABS} current="/app/ia/uso" />

      <form
        className="vj-card vj-stack"
        aria-label="Filtros de uso"
        onSubmit={(event) => {
          event.preventDefault();
          if (org.orgId) void load(org.orgId, { period, from, to, feature, model });
        }}
      >
        <div className="vj-split">
          <FormField id="uso-period" label="Período">
            <Select
              id="uso-period"
              value={period}
              onChange={(event) => setPeriod(event.target.value as Period)}
            >
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
              <option value="custom">Personalizado</option>
            </Select>
          </FormField>
          <FormField id="uso-feature" label="Funcionalidade">
            <Select
              id="uso-feature"
              value={feature}
              onChange={(event) => setFeature(event.target.value)}
            >
              <option value="">Todas</option>
              {Object.entries(AI_FEATURE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        {period === "custom" ? (
          <div className="vj-split">
            <FormField id="uso-from" label="De">
              <Input
                id="uso-from"
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </FormField>
            <FormField id="uso-to" label="Até">
              <Input
                id="uso-to"
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </FormField>
          </div>
        ) : null}
        <FormField id="uso-model" label="Modelo">
          {models.length > 0 ? (
            <Select id="uso-model" value={model} onChange={(event) => setModel(event.target.value)}>
              <option value="">Todos</option>
              {models.map((item) => (
                <option key={item.id} value={item.externalModelId}>
                  {item.displayName}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              id="uso-model"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="Identificador do modelo"
              autoComplete="off"
            />
          )}
        </FormField>
        <div className="vj-form-actions">
          <Button type="submit" disabled={loading}>
            Aplicar filtros
          </Button>
        </div>
      </form>

      {loading ? <LoadingState label="Carregando uso de IA" /> : null}
      {notConfigured ? <NotConfiguredNotice /> : null}
      {error ? <ErrorState title="Erro ao carregar uso">{error}</ErrorState> : null}

      {!loading && !error && !notConfigured && totals ? (
        <>
          <section className="vj-split" aria-label="Totais do período" aria-live="polite">
            <div className="vj-card">
              <p className="vj-meta">Solicitações</p>
              <p className="vj-title">{formatNumber(totals.requests)}</p>
            </div>
            <div className="vj-card">
              <p className="vj-meta">Custo estimado</p>
              <p className="vj-title">{formatMicros(totals.estimatedCostMicros, currency)}</p>
            </div>
            <div className="vj-card">
              <p className="vj-meta">Tokens de entrada</p>
              <p className="vj-title">{formatNumber(totals.inputTokens)}</p>
            </div>
            <div className="vj-card">
              <p className="vj-meta">Tokens de saída</p>
              <p className="vj-title">{formatNumber(totals.outputTokens)}</p>
            </div>
          </section>

          {items.length === 0 ? (
            <EmptyState title="Nenhum uso registrado no período.">
              Ajuste os filtros ou execute uma análise assistida para gerar registros.
            </EmptyState>
          ) : (
            <div className="vj-table-wrap">
              <table className="vj-table">
                <caption className="vj-visually-hidden">Registros de uso de IA</caption>
                <thead>
                  <tr>
                    <th scope="col">Data</th>
                    <th scope="col">Funcionalidade</th>
                    <th scope="col">Modelo</th>
                    <th scope="col">Tokens (entrada/saída)</th>
                    <th scope="col">Custo estimado</th>
                    <th scope="col">Duração</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.id ?? `${item.recordedAt}-${index}`}>
                      <td data-label="Data">{formatDateTime(item.recordedAt)}</td>
                      <td data-label="Funcionalidade">{featureLabel(item.feature)}</td>
                      <td data-label="Modelo">
                        <span className="vj-technical">{item.modelExternalId ?? "—"}</span>
                      </td>
                      <td data-label="Tokens (entrada/saída)">
                        {formatNumber(item.inputTokens)} / {formatNumber(item.outputTokens)}
                        {item.tokensAreEstimate ? (
                          <span className="vj-meta"> (estimado)</span>
                        ) : null}
                      </td>
                      <td data-label="Custo estimado">
                        {formatMicros(item.estimatedCostMicros, item.currency ?? currency)}
                      </td>
                      <td data-label="Duração">{formatDuration(item.durationMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
