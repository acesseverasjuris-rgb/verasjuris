"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import {
  NoPermission,
  SectionTabs,
  controlTabsForPermissions,
  LEGAL_INTERNAL_TABS,
  GenericRecordsTable,
} from "../../../../../components/control-ui";
import {
  fetchControlPolicies,
  controlErrorMessage,
  hasControlPermission,
  isApiFailure,
} from "../../../../../lib/control";
import { useOrgContext } from "../../../../../lib/use-org-context";

export default function Page() {
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
      const res = await fetchControlPolicies(org.orgId!, { limit: 50 });
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
    return <NoPermission>Sem permissão para jurídico interno (control.legal.read).</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Control", href: "/app/control" },
          { label: "Jurídico", href: "/app/control/juridico" },
          { label: "Políticas" },
        ]}
      />
      <PageHeader title="Políticas internas" description="Políticas publicadas e versões." />
      <SectionTabs
        label="Control"
        items={controlTabsForPermissions(org.permissions)}
        current="/app/control/juridico"
      />
      <SectionTabs
        label="Seções"
        items={LEGAL_INTERNAL_TABS}
        current="/app/control/juridico/politicas"
      />
      {loading ? <LoadingState label="Carregando…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? (
        <GenericRecordsTable
          items={items as never}
          emptyTitle="Nenhuma política"
          emptyDescription="Políticas internas ainda não foram publicadas."
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
