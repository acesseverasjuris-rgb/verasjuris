"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../../components/ai-ui";
import {
  DisputeDetailPanels,
  financeTabsForPermissions,
} from "../../../../../components/finance-ui";
import {
  fetchDispute,
  financeErrorMessage,
  hasFinancePermission,
  isApiFailure,
  type DisputeEvidence,
  type DisputeHistoryEntry,
  type FinancialDispute,
} from "../../../../../lib/finance";
import { useOrgContext } from "../../../../../lib/use-org-context";

export default function DisputeDetailPage() {
  const org = useOrgContext();
  const params = useParams();
  const disputeId = typeof params.id === "string" ? params.id : "";
  const can =
    hasFinancePermission(org.permissions, "dispute.read") ||
    hasFinancePermission(org.permissions, "read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dispute, setDispute] = useState<FinancialDispute | null>(null);
  const [evidence, setEvidence] = useState<DisputeEvidence[]>([]);
  const [history, setHistory] = useState<DisputeHistoryEntry[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can || !disputeId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchDispute(org.orgId!, disputeId);
      if (cancelled) return;
      if (isApiFailure(res)) setError(financeErrorMessage(res));
      else {
        setDispute(res.dispute);
        setEvidence(res.evidence);
        setHistory(res.history);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can, disputeId]);

  if (org.ready && !can) {
    return <NoPermission>Sem permissão para disputas (finance.dispute.read).</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Financeiro", href: "/app/financeiro" },
          { label: "Disputas", href: "/app/financeiro/disputas" },
          { label: disputeId ? `${disputeId.slice(0, 8)}…` : "Detalhe" },
        ]}
      />
      <PageHeader
        title="Disputa"
        description="Evidências, hold e linha do tempo. Provedor NOT_CONFIGURED não inventa ganho/perda."
      />
      <SectionTabs
        label="Seções"
        items={financeTabsForPermissions(org.permissions)}
        current="/app/financeiro/disputas"
      />
      {loading ? <LoadingState label="Carregando disputa…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && dispute ? (
        <DisputeDetailPanels dispute={dispute} evidence={evidence} history={history} />
      ) : null}
    </div>
  );
}
