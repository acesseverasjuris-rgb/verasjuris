"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import { financeTabsForPermissions, HonorariosTable } from "../../../../components/finance-ui";
import {
  fetchHonorarios,
  financeErrorMessage,
  hasFinancePermission,
  isApiFailure,
  type LegalFeeAgreement,
} from "../../../../lib/finance";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function HonorariosPage() {
  const org = useOrgContext();
  const can =
    hasFinancePermission(org.permissions, "read") ||
    hasFinancePermission(org.permissions, "fee.manage");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<LegalFeeAgreement[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchHonorarios(org.orgId!, { limit: 50 });
      if (cancelled) return;
      if (isApiFailure(res)) setError(financeErrorMessage(res));
      else setItems(res.items);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) return <NoPermission>Sem permissão para honorários.</NoPermission>;

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[{ label: "Financeiro", href: "/app/financeiro" }, { label: "Honorários" }]}
      />
      <PageHeader title="Honorários" description="Acordos de honorários advocatícios." />
      <SectionTabs
        label="Seções"
        items={financeTabsForPermissions(org.permissions)}
        current="/app/financeiro/honorarios"
      />
      {loading ? <LoadingState label="Carregando honorários…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? <HonorariosTable items={items} /> : null}
    </div>
  );
}
