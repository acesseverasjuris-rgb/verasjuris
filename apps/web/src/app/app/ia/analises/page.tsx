"use client";

import {
  Breadcrumb,
  Button,
  EmptyState,
  ErrorState,
  FormField,
  LoadingState,
  PageHeader,
  Select,
} from "@verasjuris/ui";
import { useCallback, useEffect, useState } from "react";
import {
  IA_TABS,
  JobStatusBadge,
  NoPermission,
  NotConfiguredNotice,
  ReviewBadge,
  SectionTabs,
} from "../../../../components/ai-ui";
import {
  aiErrorMessage,
  ANALYSIS_STATUS_LABELS,
  analysisTypeLabel,
  fetchLegalAnalyses,
  formatDateTime,
  hasPermission,
  isApiFailure,
  isNotConfigured,
  type LegalAnalysisSummary,
} from "../../../../lib/ai";
import { useOrgContext } from "../../../../lib/use-org-context";

function reviewOf(analysis: LegalAnalysisSummary): string {
  if (analysis.status === "reviewed" || analysis.reviewedAt) return "reviewed";
  return "unreviewed";
}

export default function IaAnalisesPage() {
  const org = useOrgContext();
  const canRead = hasPermission(org.permissions, "legal_analysis.read");
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<LegalAnalysisSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const load = useCallback(async (orgId: string, filters: { status: string }) => {
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    const data = await fetchLegalAnalyses(orgId, {
      status: filters.status || undefined,
      limit: 50,
    });
    if (isApiFailure(data)) {
      if (isNotConfigured(data)) setNotConfigured(true);
      else setError(aiErrorMessage(data, "Não foi possível listar as análises."));
      setItems([]);
    } else {
      setItems(data.items);
      setTotal(data.total);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!org.ready) return;
    if (!org.orgId || !canRead) {
      setLoading(false);
      return;
    }
    void load(org.orgId, { status: "" });
  }, [org.ready, org.orgId, canRead, load]);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "IA", href: "/app/ia" },
    { label: "Análises" },
  ];

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar análises assistidas.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Análises assistidas"
        description="Resultados gerados com apoio de IA para casos e documentos. Cada análise permanece como “Resultado ainda não revisado” até a revisão por uma pessoa."
      />
      <SectionTabs label="Seções de IA" items={IA_TABS} current="/app/ia/analises" />

      <form
        className="vj-card vj-stack"
        aria-label="Filtros de análises"
        onSubmit={(event) => {
          event.preventDefault();
          if (org.orgId) void load(org.orgId, { status });
        }}
      >
        <FormField id="an-status" label="Situação">
          <Select id="an-status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Todas</option>
            {Object.entries(ANALYSIS_STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>
        <div className="vj-form-actions">
          <Button type="submit" disabled={loading}>
            Filtrar
          </Button>
        </div>
      </form>

      {loading ? <LoadingState label="Carregando análises" /> : null}
      {notConfigured ? <NotConfiguredNotice /> : null}
      {error ? <ErrorState title="Erro ao carregar análises">{error}</ErrorState> : null}

      {!loading && !error && !notConfigured && items.length === 0 ? (
        <EmptyState title="Nenhuma análise assistida foi gerada.">
          Abra um caso e use a seção “Análise assistida” para solicitar uma análise.
        </EmptyState>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <>
          <p className="vj-meta" aria-live="polite">
            {total} análise{total === 1 ? "" : "s"}
          </p>
          <div className="vj-table-wrap">
            <table className="vj-table">
              <caption className="vj-visually-hidden">Análises assistidas</caption>
              <thead>
                <tr>
                  <th scope="col">Análise</th>
                  <th scope="col">Origem</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Revisão</th>
                  <th scope="col">Criada em</th>
                </tr>
              </thead>
              <tbody>
                {items.map((analysis) => (
                  <tr key={analysis.id}>
                    <td data-label="Análise">
                      <strong>
                        {analysisTypeLabel(analysis.analysisType)} · v{analysis.version}
                      </strong>
                      {analysis.summary ? <div className="vj-meta">{analysis.summary}</div> : null}
                    </td>
                    <td data-label="Origem">
                      {analysis.legalMatterId ? (
                        <a href={`/app/casos/${analysis.legalMatterId}`}>
                          {analysis.legalMatterTitle ?? "Caso"}
                        </a>
                      ) : analysis.documentId ? (
                        <a href={`/app/documentos/${analysis.documentId}`}>Documento</a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td data-label="Situação">
                      <JobStatusBadge status={analysis.status} labels={ANALYSIS_STATUS_LABELS} />
                    </td>
                    <td data-label="Revisão">
                      {analysis.status === "not_configured" || analysis.status === "failed" ? (
                        "—"
                      ) : (
                        <ReviewBadge status={reviewOf(analysis)} />
                      )}
                    </td>
                    <td data-label="Criada em">{formatDateTime(analysis.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
