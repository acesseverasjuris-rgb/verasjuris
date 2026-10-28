"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../components/ai-ui";
import {
  ADVOGADO_ONLINE_TABS,
  ConsultationsTable,
  OnlineLawyerProvidersBanner,
  OnlineRequestsTable,
} from "../../../components/online-lawyer-ui";
import {
  fetchOnlineConsultations,
  fetchOnlineLawyerProvidersStatus,
  fetchOnlineLegalRequests,
  hasOnlineLawyerPermission,
  isApiFailure,
  onlineLawyerErrorMessage,
  type OnlineConsultation,
  type OnlineLawyerProvidersStatus,
  type OnlineLegalRequest,
} from "../../../lib/online-lawyer";
import { useOrgContext } from "../../../lib/use-org-context";

export default function AdvogadoOnlineDashboardPage() {
  const org = useOrgContext();
  const canRequests = hasOnlineLawyerPermission(org.permissions, "request");
  const canConsult = hasOnlineLawyerPermission(org.permissions, "consultation.read");
  const canMatch = hasOnlineLawyerPermission(org.permissions, "match.read");
  const canEnter = canRequests || canConsult || canMatch;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<OnlineLawyerProvidersStatus | null>(null);
  const [requests, setRequests] = useState<OnlineLegalRequest[]>([]);
  const [consultations, setConsultations] = useState<OnlineConsultation[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !canEnter) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const status = await fetchOnlineLawyerProvidersStatus(org.orgId!);
      if (!cancelled && !isApiFailure(status)) setProviders(status);

      const tasks: Promise<void>[] = [];
      if (canRequests) {
        tasks.push(
          fetchOnlineLegalRequests(org.orgId!, { limit: 8 }).then((data) => {
            if (!isApiFailure(data)) setRequests(data.items);
          }),
        );
      }
      if (canConsult) {
        tasks.push(
          fetchOnlineConsultations(org.orgId!, { limit: 8 }).then((data) => {
            if (!isApiFailure(data)) setConsultations(data.items);
          }),
        );
      }
      await Promise.all(tasks);
      if (cancelled) return;
      setLoading(false);
    })().catch(() => {
      if (!cancelled) setError("Não foi possível carregar o módulo.");
    });
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, canEnter, canRequests, canConsult]);

  const breadcrumb = [{ label: "Painel", href: "/app" }, { label: "Advogado Online" }];

  if (org.ready && !canEnter) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para Advogado Online.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Advogado Online"
        description="Match, consultas e disponibilidade — sem simular pagamento ou vídeo NOT_CONFIGURED."
      />
      <SectionTabs label="Seções" items={ADVOGADO_ONLINE_TABS} current="/app/advogado-online" />
      <OnlineLawyerProvidersBanner status={providers} />
      {loading || !org.ready ? <LoadingState label="Carregando" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && canRequests && requests.length > 0 ? (
        <>
          <h2 className="vj-section-title">Solicitações recentes</h2>
          <OnlineRequestsTable items={requests} />
        </>
      ) : null}
      {!loading && canConsult && consultations.length > 0 ? (
        <>
          <h2 className="vj-section-title">Consultas recentes</h2>
          <ConsultationsTable items={consultations} linkPrefix="/app/advogado-online/consultas" />
        </>
      ) : null}
      {!loading && !error && requests.length === 0 && consultations.length === 0 ? (
        <EmptyState title="Sem movimentação">Crie solicitações ou aguarde matches.</EmptyState>
      ) : null}
    </div>
  );
}
