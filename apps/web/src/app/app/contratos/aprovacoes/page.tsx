"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import { CONTRATO_TABS, ContractApprovalsList } from "../../../../components/contracts-ui";
import {
  contractErrorMessage,
  fetchContractApprovals,
  fetchContracts,
  hasContractPermission,
  isApiFailure,
  type ContractApproval,
} from "../../../../lib/contracts";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function ContratosAprovacoesPage() {
  const org = useOrgContext();
  const canRead = hasContractPermission(org.permissions, "read");
  const [items, setItems] = useState<ContractApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!org.ready || !org.orgId || !canRead) {
      setLoading(false);
      return;
    }
    void (async () => {
      setLoading(true);
      const contracts = await fetchContracts(org.orgId!, { status: "pending_approval", limit: 30 });
      if (isApiFailure(contracts)) {
        setError(contractErrorMessage(contracts, "Não foi possível carregar aprovações."));
        setLoading(false);
        return;
      }
      const groups = await Promise.all(
        contracts.items.map((c) => fetchContractApprovals(org.orgId!, c.id, { limit: 20 })),
      );
      const merged: ContractApproval[] = [];
      for (const g of groups) if (!isApiFailure(g)) merged.push(...g.items);
      setItems(merged);
      setLoading(false);
    })();
  }, [org.ready, org.orgId, canRead]);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Contratos", href: "/app/contratos" },
    { label: "Aprovações" },
  ];

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Sem permissão para aprovações.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader title="Aprovações pendentes" description="Contratos aguardando decisão humana." />
      <SectionTabs
        label="Seções de contratos"
        items={CONTRATO_TABS}
        current="/app/contratos/aprovacoes"
      />
      {loading ? <LoadingState label="Carregando aprovações" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && items.length === 0 ? (
        <EmptyState title="Nenhuma aprovação pendente">Sem fluxos abertos.</EmptyState>
      ) : null}
      {!loading && items.length > 0 ? <ContractApprovalsList items={items} /> : null}
    </div>
  );
}
