"use client";

import {
  Breadcrumb,
  ButtonLink,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../components/ai-ui";
import {
  ContractStatusDashboard,
  ContractsTable,
  SignatureProviderBanner,
  CONTRATO_TABS,
} from "../../../components/contracts-ui";
import {
  contractErrorMessage,
  fetchContracts,
  fetchSignatureProvidersStatus,
  hasContractPermission,
  isApiFailure,
  isSignatureProviderNotConfigured,
  type Contract,
} from "../../../lib/contracts";
import { useOrgContext } from "../../../lib/use-org-context";

export default function ContratosDashboardPage() {
  const org = useOrgContext();
  const canRead = hasContractPermission(org.permissions, "read");
  const canCreate = hasContractPermission(org.permissions, "create");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(true);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [recent, setRecent] = useState<Contract[]>([]);

  useEffect(() => {
    if (!org.ready) return;
    if (!org.orgId || !canRead) {
      setLoading(false);
      return;
    }
    const orgId = org.orgId;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const [signature, contracts] = await Promise.all([
        fetchSignatureProvidersStatus(orgId),
        fetchContracts(orgId, { limit: 50 }),
      ]);
      if (cancelled) return;
      setNotConfigured(isSignatureProviderNotConfigured(signature));
      if (isApiFailure(contracts)) {
        setError(contractErrorMessage(contracts, "Não foi possível carregar contratos."));
      } else {
        const next: Record<string, number> = {};
        for (const c of contracts.items) next[c.status] = (next[c.status] ?? 0) + 1;
        setCounts(next);
        setRecent(contracts.items.slice(0, 8));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, canRead]);

  const breadcrumb = [{ label: "Painel", href: "/app" }, { label: "Contratos" }];

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar contratos.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Contratos"
        description="Ciclo de vida, aprovações e assinatura — sem simular envio ao provedor quando NOT_CONFIGURED."
        actions={
          canCreate ? (
            <ButtonLink href="/app/contratos/novo" variant="primary">
              Novo contrato
            </ButtonLink>
          ) : null
        }
      />
      <SectionTabs label="Seções de contratos" items={CONTRATO_TABS} current="/app/contratos" />
      <SignatureProviderBanner notConfigured={notConfigured} />

      {loading || !org.ready ? <LoadingState label="Carregando contratos" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? <ContractStatusDashboard counts={counts} /> : null}
      {!loading && !error && recent.length > 0 ? (
        <>
          <h2 className="vj-section-title">Recentes</h2>
          <ContractsTable items={recent} caption="Contratos recentes" />
        </>
      ) : null}
      {!loading && !error && Object.keys(counts).length === 0 ? (
        <EmptyState title="Nenhum contrato">Crie um contrato ou importe de minuta.</EmptyState>
      ) : null}
    </div>
  );
}
