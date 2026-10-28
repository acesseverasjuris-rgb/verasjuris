"use client";

import { Breadcrumb, ErrorState, PageHeader } from "@verasjuris/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PortalAccessDenied } from "../../../../components/client-portal-ui";
import { OnlineLawyerProvidersBanner } from "../../../../components/online-lawyer-ui";
import {
  createOnlineLegalRequest,
  fetchOnlineLawyerProvidersStatus,
  hasOnlineLawyerPermission,
  isApiFailure,
  isProviderNotConfigured,
  onlineLawyerErrorMessage,
  type OnlineLawyerProvidersStatus,
} from "../../../../lib/online-lawyer";
import { usePortalContext } from "../../../../lib/use-portal-context";
import { useOrgContext } from "../../../../lib/use-org-context";
export default function PortalNovaSolicitacaoPage() {
  const portal = usePortalContext();
  const org = useOrgContext();
  const router = useRouter();
  const canRequest = hasOnlineLawyerPermission(org.permissions, "request");
  const [providers, setProviders] = useState<OnlineLawyerProvidersStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stateCode, setStateCode] = useState("SP");
  const [summary, setSummary] = useState("");
  const [urgency, setUrgency] = useState("normal");
  const [mode, setMode] = useState("text");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!portal.orgId || !canRequest) return;
    void fetchOnlineLawyerProvidersStatus(portal.orgId).then((status) => {
      if (!isApiFailure(status)) setProviders(status);
    });
  }, [portal.orgId, canRequest]);

  const paymentBlocked = providers ? isProviderNotConfigured(providers.payment) : false;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!portal.orgId || !portal.context || !canRequest) return;
    setSubmitting(true);
    setError(null);
    const result = await createOnlineLegalRequest(portal.orgId, {
      clientId: portal.context.clientId,
      stateCode,
      summary,
      urgency,
      preferredMode: mode,
      status: "submitted",
    });
    setSubmitting(false);
    if (isApiFailure(result)) {
      setError(onlineLawyerErrorMessage(result, "Não foi possível enviar a solicitação."));
      return;
    }
    router.push(`/portal/advogado-online/${result.request.id}`);
  }

  const breadcrumb = [
    { label: "Portal", href: "/portal" },
    { label: "Advogado Online", href: "/portal/advogado-online" },
    { label: "Nova solicitação" },
  ];

  if (portal.ready && !portal.linked) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <PortalAccessDenied message={portal.deniedMessage ?? undefined} />
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader title="Nova solicitação" description="Descreva sua necessidade jurídica." />
      <OnlineLawyerProvidersBanner status={providers} />
      {!canRequest ? (
        <ErrorState title="Sem permissão">Você não pode criar solicitações.</ErrorState>
      ) : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {canRequest ? (
        <form
          className="vj-stack vj-card"
          onSubmit={(e) => void handleSubmit(e)}
          aria-label="Nova solicitação"
        >
          <label htmlFor="ol-uf">UF</label>
          <input
            id="ol-uf"
            className="vj-input"
            value={stateCode}
            onChange={(e) => setStateCode(e.target.value.toUpperCase().slice(0, 2))}
            required
            minLength={2}
            maxLength={2}
            pattern="[A-Z]{2}"
          />
          <label htmlFor="ol-urgency">Urgência</label>
          <select
            id="ol-urgency"
            className="vj-select"
            value={urgency}
            onChange={(e) => setUrgency(e.target.value)}
          >
            <option value="low">Baixa</option>
            <option value="normal">Normal</option>
            <option value="high">Alta</option>
            <option value="urgent">Urgente</option>
          </select>
          <label htmlFor="ol-mode">Modo preferido</label>
          <select
            id="ol-mode"
            className="vj-select"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="text">Texto</option>
            <option value="audio">Áudio</option>
            <option value="video">Vídeo</option>
          </select>
          <label htmlFor="ol-summary">Resumo</label>
          <textarea
            id="ol-summary"
            className="vj-textarea"
            rows={5}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            required
            minLength={10}
          />
          {paymentBlocked ? (
            <p className="vj-meta" role="status">
              Pagamento automático NOT_CONFIGURED — o escritório registrará cobrança manualmente se
              necessário.
            </p>
          ) : null}
          <button type="submit" className="vj-button vj-button-primary" disabled={submitting}>
            Enviar solicitação
          </button>
        </form>
      ) : null}
    </div>
  );
}
