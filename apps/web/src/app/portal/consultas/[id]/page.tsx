"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PortalAccessDenied } from "../../../../components/client-portal-ui";
import {
  ConsultationRatingForm,
  OnlineLawyerProvidersBanner,
  VideoNotConfiguredNotice,
} from "../../../../components/online-lawyer-ui";
import {
  createOnlineConsultationReview,
  fetchOnlineConsultation,
  fetchOnlineLawyerProvidersStatus,
  hasOnlineLawyerPermission,
  isApiFailure,
  onlineLawyerErrorMessage,
  type OnlineConsultation,
  type OnlineLawyerProvidersStatus,
  type ProviderHealth,
} from "../../../../lib/online-lawyer";
import { usePortalContext } from "../../../../lib/use-portal-context";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function PortalConsultaPage() {
  const params = useParams<{ id: string }>();
  const portal = usePortalContext();
  const org = useOrgContext();
  const canRead = hasOnlineLawyerPermission(org.permissions, "consultation.read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [consultation, setConsultation] = useState<OnlineConsultation | null>(null);
  const [videoProvider, setVideoProvider] = useState<ProviderHealth | null>(null);
  const [providers, setProviders] = useState<OnlineLawyerProvidersStatus | null>(null);
  const [reviewSent, setReviewSent] = useState(false);

  useEffect(() => {
    if (!portal.ready || !portal.linked || !portal.orgId || !params.id || !canRead) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const [detail, status] = await Promise.all([
        fetchOnlineConsultation(portal.orgId!, params.id),
        fetchOnlineLawyerProvidersStatus(portal.orgId!),
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
  }, [portal.ready, portal.linked, portal.orgId, params.id, canRead]);

  async function submitReview(rating: number, comment: string) {
    if (!portal.orgId || !params.id) return;
    const result = await createOnlineConsultationReview(portal.orgId, params.id, {
      rating,
      comment,
    });
    if (isApiFailure(result)) {
      setError(onlineLawyerErrorMessage(result, "Não foi possível enviar a avaliação."));
      return;
    }
    setReviewSent(true);
  }

  const breadcrumb = [
    { label: "Portal", href: "/portal" },
    { label: "Advogado Online", href: "/portal/advogado-online" },
    { label: "Consulta" },
  ];

  if (portal.ready && !portal.linked) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <PortalAccessDenied message={portal.deniedMessage ?? undefined} />
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Consulta online"
        description="Acompanhe status e avalie após a conclusão."
      />
      <OnlineLawyerProvidersBanner status={providers} />
      <VideoNotConfiguredNotice videoProvider={videoProvider} />
      {!canRead ? (
        <ErrorState title="Sem permissão">Você não pode ver esta consulta.</ErrorState>
      ) : null}
      {loading && canRead ? <LoadingState label="Carregando consulta" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {consultation && canRead ? (
        <>
          <p className="vj-meta">
            {consultation.mode} · {consultation.status}
          </p>
          {consultation.status === "completed" && !reviewSent ? (
            <ConsultationRatingForm
              onSubmit={(rating, comment) => void submitReview(rating, comment)}
            />
          ) : null}
          {reviewSent ? <p role="status">Avaliação registrada. Obrigado.</p> : null}
        </>
      ) : null}
    </div>
  );
}
