"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import {
  EmployeesTable,
  HR_TABS,
  NoPermission,
  SectionTabs,
  controlTabsForPermissions,
} from "../../../../components/control-ui";
import {
  controlErrorMessage,
  fetchControlEmployees,
  hasControlPermission,
  isApiFailure,
  type ControlEmployee,
} from "../../../../lib/control";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function RhPage() {
  const org = useOrgContext();
  const can =
    hasControlPermission(org.permissions, "hr.read") ||
    hasControlPermission(org.permissions, "read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ControlEmployee[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchControlEmployees(org.orgId!, { limit: 20 });
      if (cancelled) return;
      if (isApiFailure(res)) setError(controlErrorMessage(res));
      else setItems(res.items);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) {
    return <NoPermission>Sem permissão para RH (control.hr.read).</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Control", href: "/app/control" }, { label: "RH" }]} />
      <PageHeader
        title="RH"
        description="Colaboradores são extensão de User/Membership — não substituem identidade."
      />
      <SectionTabs
        label="Control"
        items={controlTabsForPermissions(org.permissions)}
        current="/app/control/rh"
      />
      <SectionTabs label="RH" items={HR_TABS} current="/app/control/rh" />
      {loading ? <LoadingState label="Carregando RH…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? <EmployeesTable items={items} /> : null}
    </div>
  );
}
