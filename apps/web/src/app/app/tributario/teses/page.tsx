"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import { TRIBUTARIO_TABS } from "../../../../components/tax-ui";
import {
  fetchTaxTheses,
  hasTaxPermission,
  isApiFailure,
  taxErrorMessage,
  type TaxLegalThesis,
} from "../../../../lib/tax";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function TributarioTesesPage() {
  const org = useOrgContext();
  const canRead = hasTaxPermission(org.permissions, "read");
  const [items, setItems] = useState<TaxLegalThesis[]>([]);
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
      const data = await fetchTaxTheses(org.orgId!, { limit: 50 });
      if (cancelled) return;
      if (isApiFailure(data)) setError(taxErrorMessage(data, "Não foi possível listar teses."));
      else setItems(data.items);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, canRead]);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Tributário", href: "/app/tributario" },
    { label: "Teses" },
  ];

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar teses tributárias.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Teses tributárias"
        description="Catálogo organizacional de teses e vínculos a casos."
      />
      <SectionTabs
        label="Seções tributárias"
        items={TRIBUTARIO_TABS}
        current="/app/tributario/teses"
      />
      {loading || !org.ready ? <LoadingState label="Carregando teses" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState title="Nenhuma tese">
          Cadastre teses pela API ou fluxo administrativo.
        </EmptyState>
      ) : null}
      {!loading && items.length > 0 ? (
        <ul className="vj-stack">
          {items.map((t) => (
            <li key={t.id} className="vj-card vj-stack">
              <strong>{t.title}</strong>
              {t.summary ? <p className="vj-meta">{t.summary}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
