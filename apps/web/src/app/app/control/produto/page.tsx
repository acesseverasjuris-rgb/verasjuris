"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import {
  BugsTable,
  NoPermission,
  PRODUCT_TABS,
  ProjectsTable,
  SectionTabs,
  controlTabsForPermissions,
} from "../../../../components/control-ui";
import {
  controlErrorMessage,
  fetchControlBugs,
  fetchControlProjects,
  hasControlPermission,
  isApiFailure,
  type ControlBug,
  type ControlProject,
} from "../../../../lib/control";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function ProdutoPage() {
  const org = useOrgContext();
  const can =
    hasControlPermission(org.permissions, "product.read") ||
    hasControlPermission(org.permissions, "read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bugs, setBugs] = useState<ControlBug[]>([]);
  const [projects, setProjects] = useState<ControlProject[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [b, p] = await Promise.all([
        fetchControlBugs(org.orgId!, { limit: 10 }),
        fetchControlProjects(org.orgId!, { limit: 10 }),
      ]);
      if (cancelled) return;
      if (isApiFailure(b)) setError(controlErrorMessage(b));
      else setBugs(b.items);
      if (!isApiFailure(p)) setProjects(p.items);
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
        items={[{ label: "Control", href: "/app/control" }, { label: "Produto e tecnologia" }]}
      />
      <PageHeader
        title="Produto e tecnologia"
        description="Domínio interno de roadmap, bugs, releases e projetos — não é o catálogo de monetização."
      />
      <SectionTabs
        label="Control"
        items={controlTabsForPermissions(org.permissions)}
        current="/app/control/produto"
      />
      <SectionTabs label="Produto" items={PRODUCT_TABS} current="/app/control/produto" />
      {loading ? <LoadingState label="Carregando…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? (
        <>
          <section className="vj-stack">
            <h2 className="vj-subtitle">Projetos</h2>
            <ProjectsTable items={projects} />
          </section>
          <section className="vj-stack">
            <h2 className="vj-subtitle">Bugs recentes</h2>
            <BugsTable items={bugs} />
          </section>
        </>
      ) : null}
    </div>
  );
}
