"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import {
  NoPermission,
  SectionTabs,
  controlTabsForPermissions,
  PRODUCT_TABS,
  GenericRecordsTable,
} from "../../../../../components/control-ui";
import {
  fetchControlRoadmap,
  controlErrorMessage,
  hasControlPermission,
  isApiFailure,
} from "../../../../../lib/control";
import { useOrgContext } from "../../../../../lib/use-org-context";

export default function Page() {
  const org = useOrgContext();
  const can =
    hasControlPermission(org.permissions, "product.read") ||
    hasControlPermission(org.permissions, "read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Array<Record<string, unknown> & { id: string }>>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchControlRoadmap(org.orgId!, { limit: 50 });
      if (cancelled) return;
      if (isApiFailure(res)) setError(controlErrorMessage(res));
      else {
        const payload = res as { items?: Array<Record<string, unknown> & { id: string }> };
        setItems(payload.items ?? []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) {
    return <NoPermission>Sem permissão para produto (control.product.read).</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Control", href: "/app/control" },
          { label: "Produto", href: "/app/control/produto" },
          { label: "Roadmap" },
        ]}
      />
      <PageHeader title="Roadmap" description="Itens de roadmap de produto/tecnologia." />
      <SectionTabs
        label="Control"
        items={controlTabsForPermissions(org.permissions)}
        current="/app/control/produto"
      />
      <SectionTabs label="Seções" items={PRODUCT_TABS} current="/app/control/produto/roadmap" />
      {loading ? <LoadingState label="Carregando…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? (
        <GenericRecordsTable
          items={items as never}
          emptyTitle="Roadmap vazio"
          emptyDescription="Não há itens de roadmap."
          columns={[
            { key: "title", header: "Item" },
            { key: "itemType", header: "Tipo" },
            { key: "status", header: "Status" },
            { key: "priority", header: "Prioridade" },
          ]}
        />
      ) : null}
    </div>
  );
}
