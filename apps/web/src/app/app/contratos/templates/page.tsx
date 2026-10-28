"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import { CONTRATO_TABS } from "../../../../components/contracts-ui";
import {
  contractErrorMessage,
  fetchContractTemplates,
  hasContractPermission,
  isApiFailure,
  type ContractTemplate,
} from "../../../../lib/contracts";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function ContratosTemplatesPage() {
  const org = useOrgContext();
  const canRead = hasContractPermission(org.permissions, "read");
  const [items, setItems] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!org.ready || !org.orgId || !canRead) {
      setLoading(false);
      return;
    }
    void (async () => {
      setLoading(true);
      const data = await fetchContractTemplates(org.orgId!, { limit: 50 });
      if (isApiFailure(data))
        setError(contractErrorMessage(data, "Não foi possível listar modelos."));
      else setItems(data.items);
      setLoading(false);
    })();
  }, [org.ready, org.orgId, canRead]);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Contratos", href: "/app/contratos" },
    { label: "Modelos" },
  ];

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Sem permissão para modelos de contrato.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Modelos de contrato"
        description="Templates organizacionais e do sistema."
      />
      <SectionTabs
        label="Seções de contratos"
        items={CONTRATO_TABS}
        current="/app/contratos/templates"
      />
      {loading ? <LoadingState label="Carregando modelos" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && items.length === 0 ? (
        <EmptyState title="Nenhum modelo">Cadastre modelos pela API.</EmptyState>
      ) : null}
      {!loading && items.length > 0 ? (
        <ul className="vj-stack">
          {items.map((t) => (
            <li key={t.id} className="vj-card">
              <strong>{t.title}</strong>
              <span className="vj-meta">{t.contractType ?? "—"}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
