"use client";

import {
  Alert,
  Breadcrumb,
  ButtonLink,
  EmptyState,
  ErrorState,
  FormField,
  LoadingState,
  PageHeader,
  Select,
} from "@verasjuris/ui";
import { useCallback, useEffect, useState } from "react";
import {
  AssistedNotice,
  IA_TABS,
  NoPermission,
  NotConfiguredNotice,
  SectionTabs,
} from "../../../../components/ai-ui";
import { ReviewListTable } from "../../../../components/legal-review-ui";
import { aiErrorMessage, isNotConfigured } from "../../../../lib/ai";
import {
  fetchLegalReviews,
  hasLegalReviewPermission,
  isApiFailure,
  LEGAL_REVIEW_STATUS_LABELS,
  LEGAL_REVIEW_TYPE_LABELS,
  type LegalReviewSummary,
} from "../../../../lib/legal-review";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function IaRevisaoListPage() {
  const org = useOrgContext();
  const canRead = hasLegalReviewPermission(org.permissions, "read");
  const canCreate = hasLegalReviewPermission(org.permissions, "create");

  const [status, setStatus] = useState("");
  const [reviewType, setReviewType] = useState("");
  const [items, setItems] = useState<LegalReviewSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const load = useCallback(
    async (orgId: string, filters: { status: string; reviewType: string }) => {
      setLoading(true);
      setError(null);
      setNotConfigured(false);
      const data = await fetchLegalReviews(orgId, {
        status: filters.status || undefined,
        reviewType: filters.reviewType || undefined,
        limit: 50,
      });
      if (isApiFailure(data)) {
        if (isNotConfigured(data)) setNotConfigured(true);
        else setError(aiErrorMessage(data, "Não foi possível listar as revisões."));
        setItems([]);
      } else {
        setItems(data.items);
        setTotal(data.total);
      }
      setLoading(false);
    },
    [],
  );

  useEffect(() => {
    if (!org.ready) return;
    if (!org.orgId || !canRead) {
      setLoading(false);
      return;
    }
    void load(org.orgId, { status: "", reviewType: "" });
  }, [org.ready, org.orgId, canRead, load]);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "IA", href: "/app/ia" },
    { label: "Revisão" },
  ];

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar revisões assistidas.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Revisão assistida"
        description="A IA prepara apontamentos sobre documentos do conjunto. Confirme ou rejeite cada item — a decisão é sempre humana."
        actions={
          canCreate ? <ButtonLink href="/app/ia/revisao/nova">Nova revisão</ButtonLink> : undefined
        }
      />
      <SectionTabs label="Seções de IA" items={IA_TABS} current="/app/ia/revisao" />
      <AssistedNotice />

      <form
        className="vj-card vj-stack"
        aria-label="Filtros de revisão"
        onSubmit={(event) => {
          event.preventDefault();
          if (org.orgId) void load(org.orgId, { status, reviewType });
        }}
      >
        <div className="vj-split">
          <FormField id="rev-status" label="Situação">
            <Select
              id="rev-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Todas</option>
              {Object.entries(LEGAL_REVIEW_STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="rev-type" label="Tipo">
            <Select
              id="rev-type"
              value={reviewType}
              onChange={(event) => setReviewType(event.target.value)}
            >
              <option value="">Todos</option>
              {Object.entries(LEGAL_REVIEW_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <button type="submit" className="vj-button vj-button-secondary">
          Aplicar filtros
        </button>
      </form>

      {loading || !org.ready ? <LoadingState label="Carregando revisões" /> : null}
      {notConfigured ? <NotConfiguredNotice /> : null}
      {error ? <ErrorState title="Erro ao listar revisões">{error}</ErrorState> : null}

      {!loading && !error && !notConfigured && items.length === 0 ? (
        <EmptyState title="Nenhuma revisão encontrada">
          Crie um conjunto de documentos e solicite uma revisão assistida. Nenhum dado de exemplo é
          exibido.
        </EmptyState>
      ) : null}

      {!loading && items.length > 0 ? (
        <>
          <Alert tone="info" title={`${total} revisão(ões)`}>
            ANÁLISE · Resultados assistivos aguardam confirmação humana antes de qualquer uso
            decisivo.
          </Alert>
          <ReviewListTable items={items} caption="Lista de revisões assistidas" />
        </>
      ) : null}
    </div>
  );
}
