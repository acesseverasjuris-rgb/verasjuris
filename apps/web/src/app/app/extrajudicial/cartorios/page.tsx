"use client";

import { EmptyState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function Page() {
  const org = useOrgContext();
  if (!org.ready) return <LoadingState label="Carregando…" />;
  if (!org.orgId) return <EmptyState title="Selecione uma organização">Nenhum item.</EmptyState>;
  return (
    <>
      <PageHeader
        title="Cartórios"
        description="Cadastro manual = não verificado. RegistryProvider NOT_CONFIGURED."
      />
      <EmptyState title="Sem itens">Nenhum registro ainda neste recorte.</EmptyState>
    </>
  );
}
