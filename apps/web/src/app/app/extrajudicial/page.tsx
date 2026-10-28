"use client";

import { EmptyState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import {
  fetchExtrajudicialProvidersStatus,
  fetchExtrajudicialRequests,
  isApiFailure,
  type ExtrajudicialRequest,
} from "../../../lib/extrajudicial";
import { useOrgContext } from "../../../lib/use-org-context";

export default function ExtrajudicialPage() {
  const org = useOrgContext();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<ExtrajudicialRequest[]>([]);
  const [registryStatus, setRegistryStatus] = useState("not_configured");
  const [feeStatus, setFeeStatus] = useState("not_configured");

  useEffect(() => {
    if (!org.orgId) {
      setLoading(false);
      return;
    }
    void (async () => {
      const [req, providers] = await Promise.all([
        fetchExtrajudicialRequests(org.orgId!),
        fetchExtrajudicialProvidersStatus(org.orgId!),
      ]);
      if (!isApiFailure(req)) setRequests(req.requests);
      if (!isApiFailure(providers)) {
        setRegistryStatus(providers.registry.status);
        setFeeStatus(providers.feeTable.status);
      }
      setLoading(false);
    })();
  }, [org.orgId]);

  if (loading) return <LoadingState label="Carregando extrajudicial…" />;
  if (!org.orgId) return <EmptyState title="Selecione uma organização">Nenhum item.</EmptyState>;

  return (
    <>
      <PageHeader
        title="Extrajudicial"
        description="Cartórios e serviços extrajudiciais. Providers ausentes = NOT_CONFIGURED."
      />
      <p className="vj-meta">
        Registry: {registryStatus} · Fee table: {feeStatus}
      </p>
      {requests.length === 0 ? (
        <EmptyState title="Sem solicitações">Nenhum pedido extrajudicial.</EmptyState>
      ) : (
        <ul className="vj-stack">
          {requests.map((r) => (
            <li key={r.id}>
              {r.description.slice(0, 80)} — {r.status}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
