"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { NoPermission } from "../../../../../components/ai-ui";
import {
  OnlineLawyerProvidersBanner,
  VideoNotConfiguredNotice,
} from "../../../../../components/online-lawyer-ui";
import {
  fetchOnlineConsultation,
  fetchOnlineLawyerProvidersStatus,
  hasOnlineLawyerPermission,
  isApiFailure,
  onlineLawyerErrorMessage,
  type OnlineConsultation,
  type OnlineLawyerProvidersStatus,
  type ProviderHealth,
} from "../../../../../lib/online-lawyer";
import { useOrgContext } from "../../../../../lib/use-org-context";

export default function AdvogadoOnlineConsultaDetailPage() {
  const params = useParams<{ id: string }>();
  const org = useOrgContext();
  const canRead = hasOnlineLawyerPermission(org.permissions, "consultation.read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [consultation, setConsultation] = useState<OnlineConsultation | null>(null);
  const [videoProvider, setVideoProvider] = useState<ProviderHealth | null>(null);
  const [providers, setProviders] = useState<OnlineLawyerProvidersStatus | null>(null);

  useEffect(() => {
    if (!org.ready || !org.orgId || !params.id || !canRead) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const [detail, status] = await Promise.all([
        fetchOnlineConsultation(org.orgId!, params.id),
        fetchOnlineLawyerProvidersStatus(org.orgId!),
      ]);
      if (cancelled) return;
      if (!isApiFailure(status)) setProviders(status);
      if (isApiFailure(detail)) {
        setError(onlineLawyerErrorMessage(detail, "Não foi possível carregar a consulta."));
      } else {
        setConsultation(detail.consultation);
        setVideoProvider(detail.videoProvider);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, params.id, canRead]);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Advogado Online", href: "/app/advogado-online" },
    { label: "Consultas", href: "/app/advogado-online/consultas" },
    { label: "Detalhe" },
  ];

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Sem permissão para consultas online.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Consulta"
        description="Detalhes operacionais — sem botão falso de vídeo."
      />
      <OnlineLawyerProvidersBanner status={providers} />
      <VideoNotConfiguredNotice videoProvider={videoProvider} />
      {loading ? <LoadingState label="Carregando consulta" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {consultation ? (
        <dl className="vj-card vj-stack">
          <div>
            <dt className="vj-meta">Modo</dt>
            <dd>{consultation.mode}</dd>
          </div>
          <div>
            <dt className="vj-meta">Situação</dt>
            <dd>{consultation.status}</dd>
          </div>
          <div>
            <dt className="vj-meta">Agendada</dt>
            <dd>{consultation.scheduledAt ?? "—"}</dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}
