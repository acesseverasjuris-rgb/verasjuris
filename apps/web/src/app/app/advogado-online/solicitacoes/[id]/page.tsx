"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { NoPermission } from "../../../../../components/ai-ui";
import {
  MatchCandidateCards,
  OnlineLawyerProvidersBanner,
} from "../../../../../components/online-lawyer-ui";
import {
  acceptLawyerMatch,
  declineLawyerMatch,
  fetchOnlineLawyerProvidersStatus,
  fetchOnlineLegalRequest,
  fetchRequestMatchCandidates,
  hasOnlineLawyerPermission,
  isApiFailure,
  onlineLawyerErrorMessage,
  type OnlineLawyerProvidersStatus,
  type OnlineLegalRequest,
  type OnlineMatchCandidate,
} from "../../../../../lib/online-lawyer";
import { useOrgContext } from "../../../../../lib/use-org-context";

export default function AdvogadoOnlineSolicitacaoDetailPage() {
  const params = useParams<{ id: string }>();
  const org = useOrgContext();
  const canRequest = hasOnlineLawyerPermission(org.permissions, "request");
  const canRespond = hasOnlineLawyerPermission(org.permissions, "match.respond");
  const canReadMatch = hasOnlineLawyerPermission(org.permissions, "match.read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<OnlineLegalRequest | null>(null);
  const [matches, setMatches] = useState<OnlineMatchCandidate[]>([]);
  const [providers, setProviders] = useState<OnlineLawyerProvidersStatus | null>(null);

  async function reloadMatches() {
    if (!org.orgId || !params.id || !canReadMatch) return;
    const m = await fetchRequestMatchCandidates(org.orgId, params.id);
    if (!isApiFailure(m)) setMatches(m.items);
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadMatches/canReadMatch no mount do detalhe
  useEffect(() => {
    if (!org.ready || !org.orgId || !params.id || !canRequest) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const [detail, status] = await Promise.all([
        fetchOnlineLegalRequest(org.orgId!, params.id),
        fetchOnlineLawyerProvidersStatus(org.orgId!),
      ]);
      if (cancelled) return;
      if (!isApiFailure(status)) setProviders(status);
      if (isApiFailure(detail)) {
        setError(onlineLawyerErrorMessage(detail, "Não foi possível carregar."));
      } else {
        setRequest(detail.request);
        await reloadMatches();
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, params.id, canRequest]);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Advogado Online", href: "/app/advogado-online" },
    { label: "Solicitações", href: "/app/advogado-online/solicitacoes" },
    { label: "Detalhe" },
  ];

  if (org.ready && !canRequest) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Sem permissão para esta solicitação.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader title="Solicitação" description={request?.summary?.slice(0, 160)} />
      <OnlineLawyerProvidersBanner status={providers} />
      {loading ? <LoadingState label="Carregando" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {request ? (
        <>
          <p className="vj-meta">
            {request.stateCode} · {request.status}
          </p>
          {canReadMatch ? (
            <MatchCandidateCards
              items={matches}
              readOnly={!canRespond}
              onAccept={
                canRespond
                  ? async (id) => {
                      if (!org.orgId) return;
                      const r = await acceptLawyerMatch(org.orgId, id);
                      if (isApiFailure(r)) {
                        setError(onlineLawyerErrorMessage(r, "Não foi possível aceitar."));
                        return;
                      }
                      await reloadMatches();
                    }
                  : undefined
              }
              onDecline={
                canRespond
                  ? async (id) => {
                      if (!org.orgId) return;
                      const r = await declineLawyerMatch(org.orgId, id);
                      if (isApiFailure(r)) {
                        setError(onlineLawyerErrorMessage(r, "Não foi possível recusar."));
                        return;
                      }
                      await reloadMatches();
                    }
                  : undefined
              }
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
