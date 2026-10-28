"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import { CONTRATO_TABS } from "../../../../components/contracts-ui";
import {
  contractErrorMessage,
  fetchContractClausesLibrary,
  hasContractPermission,
  isApiFailure,
  type ContractClauseLibrary,
} from "../../../../lib/contracts";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function ContratosClausulasPage() {
  const org = useOrgContext();
  const canRead = hasContractPermission(org.permissions, "read");
  const [items, setItems] = useState<ContractClauseLibrary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!org.ready || !org.orgId || !canRead) {
      setLoading(false);
      return;
    }
    void (async () => {
      setLoading(true);
      const data = await fetchContractClausesLibrary(org.orgId!, { limit: 50 });
      if (isApiFailure(data))
        setError(contractErrorMessage(data, "Não foi possível listar cláusulas."));
      else setItems(data.items);
      setLoading(false);
    })();
  }, [org.ready, org.orgId, canRead]);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Contratos", href: "/app/contratos" },
    { label: "Cláusulas" },
  ];

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Sem permissão para biblioteca de cláusulas.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Biblioteca de cláusulas"
        description="Cláusulas reutilizáveis na organização."
      />
      <SectionTabs
        label="Seções de contratos"
        items={CONTRATO_TABS}
        current="/app/contratos/clausulas"
      />
      {loading ? <LoadingState label="Carregando cláusulas" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && items.length === 0 ? (
        <EmptyState title="Nenhuma cláusula">Cadastre cláusulas pela API.</EmptyState>
      ) : null}
      {!loading && items.length > 0 ? (
        <ul className="vj-stack">
          {items.map((c) => (
            <li key={c.id} className="vj-card">
              <strong>{c.title}</strong>
              {c.category ? <span className="vj-meta"> · {c.category}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
