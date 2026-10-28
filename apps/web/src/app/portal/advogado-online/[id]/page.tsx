"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PortalAccessDenied } from "../../../../components/client-portal-ui";
import {
  MatchCandidateCards,
  OnlineLawyerProvidersBanner,
} from "../../../../components/online-lawyer-ui";
import {
  cancelOnlineLegalRequest,
  fetchOnlineLawyerProvidersStatus,
  fetchOnlineLegalRequest,
  fetchRequestMatchCandidates,
  hasOnlineLawyerPermission,
  isApiFailure,
  onlineLawyerErrorMessage,
  type OnlineLawyerProvidersStatus,
  type OnlineLegalRequest,
  type OnlineMatchCandidate,
} from "../../../../lib/online-lawyer";
import { usePortalContext } from "../../../../lib/use-portal-context";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function PortalSolicitacaoDetailPage() {
  const params = useParams<{ id: string }>();
  const portal = usePortalContext();
  const org = useOrgContext();
  const canReadMatch = hasOnlineLawyerPermission(org.permissions, "match.read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<OnlineLegalRequest | null>(null);
  const [matches, setMatches] = useState<OnlineMatchCandidate[]>([]);
  const [providers, setProviders] = useState<OnlineLawyerProvidersStatus | null>(null);

  useEffect(() => {
    if (!portal.ready || !portal.linked || !portal.orgId || !params.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const [detail, status] = await Promise.all([
        fetchOnlineLegalRequest(portal.orgId!, params.id),
        fetchOnlineLawyerProvidersStatus(portal.orgId!),
      ]);
      if (cancelled) return;
      if (!isApiFailure(status)) setProviders(status);
      if (isApiFailure(detail)) {
        setError(onlineLawyerErrorMessage(detail, "Não foi possível carregar a solicitação."));
      } else {
        setRequest(detail.request);
        if (canReadMatch) {
          const m = await fetchRequestMatchCandidates(portal.orgId!, params.id);
          if (!isApiFailure(m)) setMatches(m.items);
        }
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [portal.ready, portal.linked, portal.orgId, params.id, canReadMatch]);

  async function handleCancel() {
    if (!portal.orgId || !params.id) return;
    const result = await cancelOnlineLegalRequest(portal.orgId, params.id);
    if (isApiFailure(result)) {
      setError(onlineLawyerErrorMessage(result, "Não foi possível cancelar."));
      return;
    }
    setRequest(result.request);
  }

  const breadcrumb = [
    { label: "Portal", href: "/portal" },
    { label: "Advogado Online", href: "/portal/advogado-online" },
    { label: "Solicitação" },
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
      <PageHeader title="Solicitação" description={request?.summary?.slice(0, 120) ?? "Detalhes"} />
      <OnlineLawyerProvidersBanner status={providers} />
      {loading ? <LoadingState label="Carregando solicitação" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {request ? (
        <>
          <p className="vj-meta">
            {request.stateCode} · {request.status} · {request.preferredMode}
          </p>
          {request.status !== "cancelled" ? (
            <button
              type="button"
              className="vj-button vj-button-secondary"
              onClick={() => void handleCancel()}
            >
              Cancelar solicitação
            </button>
          ) : null}
          {canReadMatch ? (
            <section aria-labelledby="matches-heading">
              <h2 id="matches-heading" className="vj-section-title">
                Candidatos
              </h2>
              <MatchCandidateCards items={matches} readOnly />
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
