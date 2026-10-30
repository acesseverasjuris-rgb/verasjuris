"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import {
  GenericRecordsTable,
  LEGAL_INTERNAL_TABS,
  NoPermission,
  SectionTabs,
  controlTabsForPermissions,
} from "../../../../components/control-ui";
import {
  controlErrorMessage,
  fetchControlPolicies,
  hasControlPermission,
  isApiFailure,
} from "../../../../lib/control";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function JuridicoInternoPage() {
  const org = useOrgContext();
  const can =
    hasControlPermission(org.permissions, "legal.read") ||
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
      const res = await fetchControlPolicies(org.orgId!, { limit: 20 });
      if (cancelled) return;
      if (isApiFailure(res)) setError(controlErrorMessage(res));
      else setItems(res.items as Array<Record<string, unknown> & { id: string }>);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) {
    return <NoPermission>Sem permissão para jurídico interno (control.legal.read).</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[{ label: "Control", href: "/app/control" }, { label: "Jurídico interno" }]}
      />
      <PageHeader
        title="Jurídico interno"
        description="Reutiliza LegalMatter e Contract — Control não duplica o domínio jurídico de clientes."
      />
      <SectionTabs
        label="Control"
        items={controlTabsForPermissions(org.permissions)}
        current="/app/control/juridico"
      />
      <SectionTabs
        label="Jurídico interno"
        items={LEGAL_INTERNAL_TABS}
        current="/app/control/juridico"
      />
      {loading ? <LoadingState label="Carregando…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? (
        <GenericRecordsTable
          items={items}
          emptyTitle="Nenhuma política recente"
          emptyDescription="Políticas e demais áreas estão nas abas ao lado."
          columns={[
            { key: "title", header: "Política" },
            { key: "status", header: "Status" },
            { key: "version", header: "Versão" },
          ]}
        />
      ) : null}
    </div>
  );
}
