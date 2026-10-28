"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import {
  COMUNICACAO_TABS,
  CommunicationProvidersBanner,
} from "../../../../components/communication-ui";
import {
  COMMUNICATION_CATEGORY_LABELS,
  COMMUNICATION_CHANNEL_LABELS,
  communicationErrorMessage,
  fetchCommunicationPreferences,
  fetchCommunicationProvidersStatus,
  hasCommunicationPermission,
  isApiFailure,
  type CommunicationPreference,
  type CommunicationProvidersStatus,
} from "../../../../lib/communication";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function ComunicacaoPreferenciasPage() {
  const org = useOrgContext();
  const canManage = hasCommunicationPermission(org.permissions, "manage_preferences");
  const canRead = hasCommunicationPermission(org.permissions, "read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<CommunicationProvidersStatus | null>(null);
  const [items, setItems] = useState<CommunicationPreference[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !canRead) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const [status, prefs] = await Promise.all([
        fetchCommunicationProvidersStatus(org.orgId!),
        fetchCommunicationPreferences(org.orgId!),
      ]);
      if (cancelled) return;
      if (!isApiFailure(status)) setProviders(status);
      if (isApiFailure(prefs)) {
        setError(communicationErrorMessage(prefs, "Não foi possível listar preferências."));
      } else {
        setItems(prefs.items);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, canRead]);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Comunicação", href: "/app/comunicacao" },
    { label: "Preferências" },
  ];

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar preferências.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Preferências"
        description={
          canManage
            ? "Quiet hours e opt-in por canal."
            : "Somente leitura — peça permissão manage_preferences para editar."
        }
      />
      <SectionTabs
        label="Seções de comunicação"
        items={COMUNICACAO_TABS}
        current="/app/comunicacao/preferencias"
      />
      <CommunicationProvidersBanner status={providers} />
      {loading || !org.ready ? <LoadingState label="Carregando preferências" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && items.length > 0 ? (
        <ul className="vj-stack">
          {items.map((pref) => (
            <li key={pref.id} className="vj-card">
              {COMMUNICATION_CHANNEL_LABELS[pref.channel] ?? pref.channel} ·{" "}
              {COMMUNICATION_CATEGORY_LABELS[pref.category] ?? pref.category} —{" "}
              {pref.enabled ? "Ativo" : "Inativo"}
            </li>
          ))}
        </ul>
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState title="Sem preferências">Nenhuma preferência cadastrada.</EmptyState>
      ) : null}
    </div>
  );
}
