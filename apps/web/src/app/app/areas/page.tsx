"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission } from "../../../components/ai-ui";
import { LegalAreaHubGrid } from "../../../components/legal-areas-ui";
import {
  fetchLegalAreaModules,
  hasLegalAreaPermission,
  isApiFailure,
  staticLegalAreaModules,
  type LegalAreaModule,
} from "../../../lib/legal-areas";
import { useOrgContext } from "../../../lib/use-org-context";

export default function AreasJuridicasHubPage() {
  const org = useOrgContext();
  const canRead = hasLegalAreaPermission(org.permissions, "read");
  const [modules, setModules] = useState<LegalAreaModule[]>(staticLegalAreaModules());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!org.ready) return;
    if (!org.orgId || !canRead) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const data = await fetchLegalAreaModules(org.orgId!);
      if (cancelled) return;
      if (isApiFailure(data)) {
        setModules(staticLegalAreaModules());
        setError(null);
      } else {
        setModules(data.items);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, canRead]);

  const breadcrumb = [{ label: "Painel", href: "/app" }, { label: "Áreas jurídicas" }];

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar áreas jurídicas.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Áreas jurídicas"
        description="Dezesseis áreas em um hub — acesse ferramentas filtradas sem poluir a navegação lateral."
      />
      {loading || !org.ready ? <LoadingState label="Carregando áreas" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && modules.length === 0 ? (
        <EmptyState title="Nenhuma área">Catálogo indisponível.</EmptyState>
      ) : null}
      {!loading && modules.length > 0 ? <LegalAreaHubGrid modules={modules} /> : null}
    </div>
  );
}
