"use client";

import { Alert, Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { CheckCircle2, CircleDashed } from "lucide-react";
import { useEffect, useState } from "react";
import {
  NoPermission,
  NotConfiguredNotice,
  ProviderStatusBadge,
  StatePill,
} from "../../../../components/ai-ui";
import {
  aiErrorMessage,
  featureLabel,
  fetchAiBudgets,
  fetchAiModels,
  fetchAiPrompts,
  fetchAiStatus,
  formatMicros,
  hasAnyPermission,
  hasPermission,
  isApiFailure,
  isNotConfigured,
  OCR_NOT_CONFIGURED_MESSAGE,
  type AiBudget,
  type AiModel,
  type AiPrompt,
  type AiStatus,
} from "../../../../lib/ai";
import { useOrgContext } from "../../../../lib/use-org-context";

type Section<T> = { data: T; error: string | null };

export default function ConfiguracoesIaPage() {
  const org = useOrgContext();
  const permissions = org.permissions;
  const canView = hasAnyPermission(permissions, [
    "ai.config.manage",
    "ai.models.manage",
    "ai.prompts.read",
    "ai.prompts.manage",
  ]);

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Section<AiStatus | null>>({ data: null, error: null });
  const [models, setModels] = useState<Section<AiModel[]>>({ data: [], error: null });
  const [prompts, setPrompts] = useState<Section<AiPrompt[]>>({ data: [], error: null });
  const [budgets, setBudgets] = useState<Section<AiBudget[]>>({ data: [], error: null });

  useEffect(() => {
    if (!org.ready) return;
    if (!org.orgId || !canView) {
      setLoading(false);
      return;
    }
    const orgId = org.orgId;
    let cancelled = false;
    void (async () => {
      const [statusData, modelData, promptData, budgetData] = await Promise.all([
        fetchAiStatus(orgId),
        hasAnyPermission(permissions, ["ai.models.manage", "ai.config.manage"])
          ? fetchAiModels(orgId)
          : Promise.resolve(null),
        hasAnyPermission(permissions, ["ai.prompts.read", "ai.prompts.manage"])
          ? fetchAiPrompts(orgId)
          : Promise.resolve(null),
        hasPermission(permissions, "ai.config.manage")
          ? fetchAiBudgets(orgId)
          : Promise.resolve(null),
      ]);
      if (cancelled) return;
      if (isApiFailure(statusData)) {
        if (isNotConfigured(statusData)) {
          setStatus({
            data: {
              provider: { configured: false, state: "not_configured" },
              ocr: { configured: false, state: "not_configured" },
              features: [],
            },
            error: null,
          });
        } else {
          setStatus({
            data: null,
            error: aiErrorMessage(statusData, "Não foi possível carregar o status."),
          });
        }
      } else {
        setStatus({ data: statusData, error: null });
      }
      if (modelData) {
        setModels(
          isApiFailure(modelData)
            ? {
                data: [],
                error: aiErrorMessage(modelData, "Não foi possível carregar os modelos."),
              }
            : { data: modelData.models, error: null },
        );
      }
      if (promptData) {
        setPrompts(
          isApiFailure(promptData)
            ? {
                data: [],
                error: aiErrorMessage(promptData, "Não foi possível carregar os prompts."),
              }
            : { data: promptData.prompts, error: null },
        );
      }
      if (budgetData) {
        setBudgets(
          isApiFailure(budgetData)
            ? {
                data: [],
                error: aiErrorMessage(budgetData, "Não foi possível carregar os custos."),
              }
            : { data: budgetData.budgets, error: null },
        );
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, canView, permissions]);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Configurações" },
    { label: "IA" },
  ];

  if (org.ready && !canView) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar as configurações de IA.</NoPermission>
      </div>
    );
  }

  const s = status.data;

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Configurações de IA"
        description="Visão administrativa de provedores, modelos, funcionalidades, prompts e custos."
      />
      <Alert tone="info" title="Credenciais não são exibidas aqui">
        Chaves e segredos dos provedores são definidos no ambiente do servidor e nunca aparecem na
        interface, em registros ou em respostas da API.
      </Alert>

      {loading || !org.ready ? <LoadingState label="Carregando configurações de IA" /> : null}
      {status.error ? (
        <ErrorState title="Erro ao carregar status">{status.error}</ErrorState>
      ) : null}

      {s && !s.provider.configured ? <NotConfiguredNotice /> : null}

      {s ? (
        <section className="vj-split" aria-labelledby="cfg-providers">
          <h2 id="cfg-providers" className="vj-visually-hidden">
            Provedores
          </h2>
          <div className="vj-card vj-stack">
            <h3 className="vj-section-title">Provedor de IA</h3>
            <p>
              <ProviderStatusBadge status={s.provider} />
            </p>
            <p className="vj-meta">
              {s.provider.label || s.provider.key
                ? `Provedor: ${s.provider.label ?? s.provider.key}`
                : "Nenhum provedor selecionado."}
            </p>
          </div>
          <div className="vj-card vj-stack">
            <h3 className="vj-section-title">OCR</h3>
            <p>
              <ProviderStatusBadge status={s.ocr} />
            </p>
            <p className="vj-meta">
              {s.ocr.configured
                ? `Provedor: ${s.ocr.label ?? s.ocr.key ?? "configurado"}`
                : OCR_NOT_CONFIGURED_MESSAGE}
            </p>
          </div>
        </section>
      ) : null}

      {s ? (
        <section className="vj-card vj-stack" aria-labelledby="cfg-features">
          <h2 id="cfg-features" className="vj-section-title">
            Funcionalidades
          </h2>
          {s.features.length === 0 ? (
            <p className="vj-meta">Nenhuma funcionalidade informada pela API.</p>
          ) : (
            <div className="vj-table-wrap">
              <table className="vj-table">
                <caption className="vj-visually-hidden">Funcionalidades de IA</caption>
                <thead>
                  <tr>
                    <th scope="col">Funcionalidade</th>
                    <th scope="col">Situação</th>
                    <th scope="col">Permissão exigida</th>
                  </tr>
                </thead>
                <tbody>
                  {s.features.map((feature) => (
                    <tr key={feature.key}>
                      <td data-label="Funcionalidade">
                        {feature.label ?? featureLabel(feature.key)}
                      </td>
                      <td data-label="Situação">
                        {feature.enabled && feature.configured !== false ? (
                          <StatePill
                            tone="success"
                            icon={<CheckCircle2 size={14} aria-hidden="true" />}
                          >
                            Disponível
                          </StatePill>
                        ) : (
                          <StatePill
                            tone="warning"
                            icon={<CircleDashed size={14} aria-hidden="true" />}
                          >
                            {feature.enabled ? "Aguardando configuração" : "Desativada"}
                          </StatePill>
                        )}
                      </td>
                      <td data-label="Permissão exigida">
                        <span className="vj-technical">{feature.requiredPermission ?? "—"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {!loading && hasAnyPermission(permissions, ["ai.models.manage", "ai.config.manage"]) ? (
        <section className="vj-card vj-stack" aria-labelledby="cfg-models">
          <h2 id="cfg-models" className="vj-section-title">
            Modelos
          </h2>
          {models.error ? (
            <Alert tone="warning" title="Modelos indisponíveis">
              {models.error}
            </Alert>
          ) : null}
          {!models.error && models.data.length === 0 ? (
            <p className="vj-meta">Nenhum modelo cadastrado.</p>
          ) : null}
          {models.data.length > 0 ? (
            <div className="vj-table-wrap">
              <table className="vj-table">
                <caption className="vj-visually-hidden">Catálogo de modelos</caption>
                <thead>
                  <tr>
                    <th scope="col">Modelo</th>
                    <th scope="col">Situação</th>
                    <th scope="col">Capacidades</th>
                    <th scope="col">Custo por 1M tokens (entrada / saída)</th>
                  </tr>
                </thead>
                <tbody>
                  {models.data.map((model) => (
                    <tr key={model.id}>
                      <td data-label="Modelo">
                        <strong>{model.displayName}</strong>
                        <div className="vj-meta vj-technical">
                          {model.providerKey}/{model.externalModelId}
                        </div>
                      </td>
                      <td data-label="Situação">
                        {model.active && model.configured ? (
                          <StatePill
                            tone="success"
                            icon={<CheckCircle2 size={14} aria-hidden="true" />}
                          >
                            Ativo
                          </StatePill>
                        ) : (
                          <StatePill
                            tone="warning"
                            icon={<CircleDashed size={14} aria-hidden="true" />}
                          >
                            {model.active ? "Não configurado" : "Inativo"}
                          </StatePill>
                        )}
                      </td>
                      <td data-label="Capacidades">{model.capabilities.join(", ") || "—"}</td>
                      <td data-label="Custo por 1M tokens (entrada / saída)">
                        {formatMicros(model.inputCostPerMillionMicros, model.currency)} /{" "}
                        {formatMicros(model.outputCostPerMillionMicros, model.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {!loading && hasAnyPermission(permissions, ["ai.prompts.read", "ai.prompts.manage"]) ? (
        <section className="vj-card vj-stack" aria-labelledby="cfg-prompts">
          <h2 id="cfg-prompts" className="vj-section-title">
            Prompts
          </h2>
          <p className="vj-meta">
            Versões de prompt são controladas e auditadas. Aqui aparecem apenas nome, funcionalidade
            e versão ativa.
          </p>
          {prompts.error ? (
            <Alert tone="warning" title="Prompts indisponíveis">
              {prompts.error}
            </Alert>
          ) : null}
          {!prompts.error && prompts.data.length === 0 ? (
            <p className="vj-meta">Nenhum prompt cadastrado.</p>
          ) : null}
          {prompts.data.length > 0 ? (
            <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {prompts.data.map((prompt) => (
                <li key={prompt.id}>
                  <strong>{prompt.name}</strong>{" "}
                  {prompt.active ? (
                    <StatePill tone="success" icon={<CheckCircle2 size={14} aria-hidden="true" />}>
                      Ativo
                    </StatePill>
                  ) : (
                    <StatePill icon={<CircleDashed size={14} aria-hidden="true" />}>
                      Inativo
                    </StatePill>
                  )}
                  <div className="vj-meta">
                    {featureLabel(prompt.feature)} ·{" "}
                    <span className="vj-technical">{prompt.key}</span>
                    {prompt.activeVersion != null ? ` · versão ativa v${prompt.activeVersion}` : ""}
                  </div>
                  {prompt.description ? <div className="vj-meta">{prompt.description}</div> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {!loading && hasPermission(permissions, "ai.config.manage") ? (
        <section className="vj-card vj-stack" aria-labelledby="cfg-costs">
          <h2 id="cfg-costs" className="vj-section-title">
            Custos e limites
          </h2>
          <p className="vj-meta">
            Custos são estimativas calculadas localmente a partir do catálogo de modelos.
          </p>
          {budgets.error ? (
            <Alert tone="warning" title="Limites indisponíveis">
              {budgets.error}
            </Alert>
          ) : null}
          {!budgets.error && budgets.data.length === 0 ? (
            <p className="vj-meta">Nenhum limite de uso configurado.</p>
          ) : null}
          {budgets.data.length > 0 ? (
            <div className="vj-table-wrap">
              <table className="vj-table">
                <caption className="vj-visually-hidden">Limites de uso</caption>
                <thead>
                  <tr>
                    <th scope="col">Período</th>
                    <th scope="col">Escopo</th>
                    <th scope="col">Limite</th>
                    <th scope="col">Consumido (estimado)</th>
                  </tr>
                </thead>
                <tbody>
                  {budgets.data.map((budget) => (
                    <tr key={budget.id}>
                      <td data-label="Período">
                        {budget.period === "daily"
                          ? "Diário"
                          : budget.period === "monthly"
                            ? "Mensal"
                            : budget.period}
                      </td>
                      <td data-label="Escopo">
                        {budget.feature ? featureLabel(budget.feature) : "Toda a organização"}
                      </td>
                      <td data-label="Limite">
                        {formatMicros(budget.limitMicros, budget.currency)}
                      </td>
                      <td data-label="Consumido (estimado)">
                        {formatMicros(budget.usedMicros, budget.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
