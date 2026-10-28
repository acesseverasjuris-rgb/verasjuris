"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import {
  ADVOGADO_ONLINE_TABS,
  ConsultationsTable,
  OnlineLawyerProvidersBanner,
} from "../../../../components/online-lawyer-ui";
import {
  fetchOnlineConsultations,
  fetchOnlineLawyerProvidersStatus,
  hasOnlineLawyerPermission,
  isApiFailure,
  onlineLawyerErrorMessage,
  type OnlineConsultation,
  type OnlineLawyerProvidersStatus,
} from "../../../../lib/online-lawyer";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function AdvogadoOnlineConsultasPage() {
  const org = useOrgContext();
  const canRead = hasOnlineLawyerPermission(org.permissions, "consultation.read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<OnlineLawyerProvidersStatus | null>(null);
  const [items, setItems] = useState<OnlineConsultation[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !canRead) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const [status, consultations] = await Promise.all([
        fetchOnlineLawyerProvidersStatus(org.orgId!),
        fetchOnlineConsultations(org.orgId!, { limit: 50 }),
      ]);
      if (cancelled) return;
      if (!isApiFailure(status)) setProviders(status);
      if (isApiFailure(consultations)) {
        setError(onlineLawyerErrorMessage(consultations, "Não foi possível listar consultas."));
      } else {
        setItems(consultations.items);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, canRead]);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Advogado Online", href: "/app/advogado-online" },
    { label: "Consultas" },
  ];

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar consultas online.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader title="Consultas online" description="Agenda, status e avaliações." />
      <SectionTabs
        label="Seções"
        items={ADVOGADO_ONLINE_TABS}
        current="/app/advogado-online/consultas"
      />
      <OnlineLawyerProvidersBanner status={providers} />
      {loading || !org.ready ? <LoadingState label="Carregando consultas" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && items.length > 0 ? (
        <ConsultationsTable items={items} linkPrefix="/app/advogado-online/consultas" />
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState title="Nenhuma consulta">Consultas aparecerão após match aceito.</EmptyState>
      ) : null}
    </div>
  );
}
