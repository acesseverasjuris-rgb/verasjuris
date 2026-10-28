"use client";

import { Breadcrumb, ErrorState, PageHeader } from "@verasjuris/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { NoPermission } from "../../../../../components/ai-ui";
import { OnlineLawyerProvidersBanner } from "../../../../../components/online-lawyer-ui";
import {
  createOnlineLegalRequest,
  fetchOnlineLawyerProvidersStatus,
  hasOnlineLawyerPermission,
  isApiFailure,
  onlineLawyerErrorMessage,
  type OnlineLawyerProvidersStatus,
} from "../../../../../lib/online-lawyer";
import { useOrgContext } from "../../../../../lib/use-org-context";

export default function NovaSolicitacaoStaffPage() {
  const org = useOrgContext();
  const router = useRouter();
  const canRequest = hasOnlineLawyerPermission(org.permissions, "request");
  const [providers, setProviders] = useState<OnlineLawyerProvidersStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stateCode, setStateCode] = useState("SP");
  const [summary, setSummary] = useState("");

  useEffect(() => {
    if (!org.orgId || !canRequest) return;
    void fetchOnlineLawyerProvidersStatus(org.orgId).then((status) => {
      if (!isApiFailure(status)) setProviders(status);
    });
  }, [org.orgId, canRequest]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!org.orgId) return;
    const result = await createOnlineLegalRequest(org.orgId, {
      stateCode,
      summary,
      status: "submitted",
    });
    if (isApiFailure(result)) {
      setError(onlineLawyerErrorMessage(result, "Não foi possível criar."));
      return;
    }
    router.push(`/app/advogado-online/solicitacoes/${result.request.id}`);
  }

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Advogado Online", href: "/app/advogado-online" },
    { label: "Solicitações", href: "/app/advogado-online/solicitacoes" },
    { label: "Nova" },
  ];

  if (org.ready && !canRequest) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Sem permissão online_lawyer.request.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader title="Nova solicitação" />
      <OnlineLawyerProvidersBanner status={providers} />
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      <form className="vj-stack vj-card" onSubmit={(e) => void handleSubmit(e)}>
        <label htmlFor="staff-ol-uf">UF</label>
        <input
          id="staff-ol-uf"
          className="vj-input"
          value={stateCode}
          onChange={(e) => setStateCode(e.target.value.toUpperCase().slice(0, 2))}
          required
          maxLength={2}
        />
        <label htmlFor="staff-ol-summary">Resumo</label>
        <textarea
          id="staff-ol-summary"
          className="vj-textarea"
          rows={5}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          required
          minLength={10}
        />
        <button type="submit" className="vj-button vj-button-primary">
          Enviar
        </button>
      </form>
    </div>
  );
}
