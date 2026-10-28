"use client";

import { EmptyState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import {
  fetchDiligenceRequests,
  isApiFailure,
  type DiligenceRequest,
} from "../../../lib/diligence";
import { useOrgContext } from "../../../lib/use-org-context";

export default function DiligenciasPage() {
  const org = useOrgContext();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<DiligenceRequest[]>([]);

  useEffect(() => {
    if (!org.orgId) {
      setLoading(false);
      return;
    }
    void fetchDiligenceRequests(org.orgId)
      .then((res) => {
        if (!isApiFailure(res)) setRequests(res.requests);
      })
      .finally(() => setLoading(false));
  }, [org.orgId]);

  if (loading) return <LoadingState label="Carregando diligências…" />;
  if (!org.orgId) return <EmptyState title="Selecione uma organização">Nenhum item.</EmptyState>;

  return (
    <>
      <PageHeader title="Diligências" description="Solicitações e execução de correspondentes." />
      {requests.length === 0 ? (
        <EmptyState title="Sem diligências">Nenhuma solicitação ainda.</EmptyState>
      ) : (
        <ul className="vj-stack">
          {requests.map((r) => (
            <li key={r.id}>
              {r.title} — {r.status}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
