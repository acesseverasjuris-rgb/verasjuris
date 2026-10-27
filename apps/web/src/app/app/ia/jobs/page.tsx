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
  SectionTabs,
} from "../../../../components/ai-ui";
import {
  aiErrorMessage,
  fetchAiJobs,
  formatDateTime,
  hasPermission,
  isApiFailure,
  isNotConfigured,
  JOB_STATUS_LABELS,
  jobTypeLabel,
  type AiJob,
} from "../../../../lib/ai";
import { useOrgContext } from "../../../../lib/use-org-context";

function resourceHref(job: AiJob): string | null {
  if (job.resourceType === "document") return `/app/documentos/${job.resourceId}`;
  if (job.resourceType === "legal_matter") return `/app/casos/${job.resourceId}`;
  if (job.resourceType === "public_opportunity")
    return `/app/oportunidades-publicas/${job.resourceId}`;
  return null;
}

function resourceLabel(type: string): string {
  const labels: Record<string, string> = {
    document: "Documento",
    legal_matter: "Caso",
    public_opportunity: "Oportunidade pública",
  };
  return labels[type] ?? type;
}

export default function IaJobsPage() {
  const org = useOrgContext();
  const canRead = hasPermission(org.permissions, "ai.jobs.read");
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<AiJob[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const load = useCallback(async (orgId: string, filters: { status: string }) => {
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    const data = await fetchAiJobs(orgId, { status: filters.status || undefined, limit: 50 });
    if (isApiFailure(data)) {
      if (isNotConfigured(data)) setNotConfigured(true);
      else setError(aiErrorMessage(data, "Não foi possível listar os jobs."));
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
    { label: "Jobs" },
  ];

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar os jobs de IA.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Jobs de processamento"
        description="Tarefas em segundo plano: extração de texto, OCR, classificação e análises assistidas."
      />
      <SectionTabs label="Seções de IA" items={IA_TABS} current="/app/ia/jobs" />

      <form
        className="vj-card vj-stack"
        aria-label="Filtros de jobs"
        onSubmit={(event) => {
          event.preventDefault();
          if (org.orgId) void load(org.orgId, { status });
        }}
      >
        <FormField id="jobs-status" label="Situação">
          <Select
            id="jobs-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">Todas</option>
            {Object.entries(JOB_STATUS_LABELS).map(([key, label]) => (
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

      {loading ? <LoadingState label="Carregando jobs" /> : null}
      {notConfigured ? <NotConfiguredNotice /> : null}
      {error ? <ErrorState title="Erro ao carregar jobs">{error}</ErrorState> : null}

      {!loading && !error && !notConfigured && items.length === 0 ? (
        <EmptyState title="Nenhum job encontrado.">
          Jobs aparecem aqui quando documentos ou casos são enviados para processamento.
        </EmptyState>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <>
          <p className="vj-meta" aria-live="polite">
            {total} job{total === 1 ? "" : "s"}
          </p>
          <div className="vj-table-wrap">
            <table className="vj-table">
              <caption className="vj-visually-hidden">Jobs de processamento</caption>
              <thead>
                <tr>
                  <th scope="col">Tipo</th>
                  <th scope="col">Recurso</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Progresso</th>
                  <th scope="col">Tentativas</th>
                  <th scope="col">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {items.map((job) => {
                  const href = resourceHref(job);
                  return (
                    <tr key={job.id}>
                      <td data-label="Tipo">
                        <strong>{jobTypeLabel(job.jobType)}</strong>
                      </td>
                      <td data-label="Recurso">
                        {href ? (
                          <a href={href}>{resourceLabel(job.resourceType)}</a>
                        ) : (
                          resourceLabel(job.resourceType)
                        )}
                      </td>
                      <td data-label="Situação">
                        <JobStatusBadge status={job.status} />
                        {job.status === "not_configured" ? (
                          <div className="vj-meta">Não há provedor configurado para este job.</div>
                        ) : null}
                        {job.status === "failed" && job.lastErrorCode ? (
                          <div className="vj-meta">
                            Código: <span className="vj-technical">{job.lastErrorCode}</span>
                          </div>
                        ) : null}
                      </td>
                      <td data-label="Progresso">{job.progress}%</td>
                      <td data-label="Tentativas">
                        {job.attempts ?? 0}
                        {job.maxAttempts ? ` / ${job.maxAttempts}` : ""}
                      </td>
                      <td data-label="Criado em">{formatDateTime(job.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
