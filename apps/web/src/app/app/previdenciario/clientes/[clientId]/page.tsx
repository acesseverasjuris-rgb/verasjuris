"use client";

import { Alert, Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../../components/ai-ui";
import { ClientProfileCard, PREVIDENCIARIO_TABS } from "../../../../../components/previdentiary-ui";
import {
  fetchClientProfile,
  hasPrevidentiaryPermission,
  isApiFailure,
  previdentiaryErrorMessage,
  type PrevidentiaryClientProfile,
} from "../../../../../lib/previdentiary";
import { useOrgContext } from "../../../../../lib/use-org-context";

export default function ClientePrevidenciarioPage() {
  const params = useParams<{ clientId: string }>();
  const clientId = params.clientId;
  const org = useOrgContext();
  const canRead = hasPrevidentiaryPermission(org.permissions, "read");

  const [profile, setProfile] = useState<PrevidentiaryClientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (orgId: string) => {
      setLoading(true);
      setError(null);
      const data = await fetchClientProfile(orgId, clientId, { maskSensitive: true });
      if (isApiFailure(data)) {
        setError(previdentiaryErrorMessage(data, "Não foi possível carregar o perfil."));
        setProfile(null);
      } else {
        setProfile(data.profile);
      }
      setLoading(false);
    },
    [clientId],
  );

  useEffect(() => {
    if (!org.ready) return;
    if (!org.orgId || !canRead) {
      setLoading(false);
      return;
    }
    void load(org.orgId);
  }, [org.ready, org.orgId, canRead, load]);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Previdenciário", href: "/app/previdenciario" },
    { label: "Cliente" },
  ];

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar perfis previdenciários.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Perfil previdenciário do cliente"
        description={`Cliente ${clientId.slice(0, 8)}… — NIT/PIS mascarados na listagem.`}
      />
      <SectionTabs
        label="Seções previdenciárias"
        items={PREVIDENCIARIO_TABS}
        current="/app/previdenciario"
      />
      <Alert tone="info" title="Dados sensíveis">
        NIT e PIS são exibidos mascarados quando a consulta solicita maskSensitive.
      </Alert>

      {loading || !org.ready ? <LoadingState label="Carregando perfil" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? (
        <div className="vj-card vj-stack">
          <ClientProfileCard profile={profile} />
        </div>
      ) : null}
    </div>
  );
}
