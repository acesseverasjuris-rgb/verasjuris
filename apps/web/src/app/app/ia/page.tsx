"use client";

import {
  Alert,
  Breadcrumb,
  ButtonLink,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@verasjuris/ui";
import { CheckCircle2, CircleDashed } from "lucide-react";
import { useEffect, useState } from "react";
import {
  IA_TABS,
  JobStatusBadge,
  NoPermission,
  NotConfiguredNotice,
  ProviderStatusBadge,
  SectionTabs,
  StatePill,
} from "../../../components/ai-ui";
import {
  aiErrorMessage,
  fetchAiJobs,
  fetchAiStatus,
  featureLabel,
  formatDateTime,
  hasAnyPermission,
  hasPermission,
  isApiFailure,
  isNotConfigured,
  jobTypeLabel,
  OCR_NOT_CONFIGURED_MESSAGE,
  type AiJob,
  type AiStatus,
} from "../../../lib/ai";
import { useOrgContext } from "../../../lib/use-org-context";

export default function IaOverviewPage() {
  const org = useOrgContext();
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [jobs, setJobs] = useState<AiJob[]>([]);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const canRead = hasAnyPermission(org.permissions, [
    "ai.use",
    "ai.usage.read",
    "ai.jobs.read",
    "legal_analysis.read",
    "legal_review.read",
  ]);
  const canReview = hasPermission(org.permissions, "legal_review.read");
  const canJobs = hasPermission(org.permissions, "ai.jobs.read");
  const canConfig = hasAnyPermission(org.permissions, [
    "ai.config.manage",
    "ai.models.manage",
    "ai.prompts.read",
  ]);

  useEffect(() => {
    if (!org.ready) return;
    if (!org.orgId || !canRead) {
      setLoading(false);
      return;
    }
    const orgId = org.orgId;
    let cancelled = false;
    void (async () => {
      const [statusData, jobsData] = await Promise.all([
        fetchAiStatus(orgId),
        canJobs ? fetchAiJobs(orgId, { limit: 5 }) : Promise.resolve(null),
      ]);
      if (cancelled) return;
      if (isApiFailure(statusData)) {
        // NOT_CONFIGURED é um estado esperado, não uma falha.
        if (isNotConfigured(statusData)) {
          setStatus({
            provider: { configured: false, state: "not_configured" },
            ocr: { configured: false, state: "not_configured" },
            features: [],
          });
        } else {
          setStatusError(aiErrorMessage(statusData, "Não foi possível carregar o status de IA."));
        }
      } else {
        setStatus(statusData);
      }
      if (jobsData) {
        if (isApiFailure(jobsData)) {
          setJobsError(aiErrorMessage(jobsData, "Não foi possível carregar os jobs recentes."));
        } else {
          setJobs(jobsData.items);
        }
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, canRead, canJobs]);

  const breadcrumb = [{ label: "Painel", href: "/app" }, { label: "IA" }];

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar os recursos de IA.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="IA assistiva"
        description="Recursos de apoio à leitura de documentos e à análise de casos. Todo resultado é uma análise assistida e exige revisão humana."
        actions={
          canConfig ? (
            <ButtonLink href="/app/configuracoes/ia" variant="secondary">
              Configurações de IA
            </ButtonLink>
          ) : undefined
        }
      />
      <SectionTabs label="Seções de IA" items={IA_TABS} current="/app/ia" />

      {loading || !org.ready ? <LoadingState label="Carregando status de IA" /> : null}
      {statusError ? <ErrorState title="Erro ao carregar status">{statusError}</ErrorState> : null}

      {status ? (
        <>
          {!status.provider.configured ? <NotConfiguredNotice /> : null}
          <section className="vj-split" aria-label="Status dos provedores">
            <div className="vj-card vj-stack">
              <h2 className="vj-section-title">Provedor de IA</h2>
              <p>
                <ProviderStatusBadge status={status.provider} />
              </p>
              <p className="vj-meta">
                {status.provider.message ??
                  (status.provider.configured
                    ? `Provedor: ${status.provider.label ?? status.provider.key ?? "configurado"}.`
                    : "Nenhuma análise assistida pode ser executada até que um provedor seja configurado.")}
              </p>
            </div>
            <div className="vj-card vj-stack">
              <h2 className="vj-section-title">OCR</h2>
              <p>
                <ProviderStatusBadge status={status.ocr} />
              </p>
              <p className="vj-meta">
                {status.ocr.message ??
                  (status.ocr.configured
                    ? "Documentos digitalizados podem ser lidos por OCR."
                    : `${OCR_NOT_CONFIGURED_MESSAGE} PDFs com camada de texto e arquivos de texto continuam sendo processados.`)}
              </p>
            </div>
          </section>

          {status.features.length > 0 ? (
            <section className="vj-card vj-stack" aria-labelledby="ia-features">
              <h2 id="ia-features" className="vj-section-title">
                Funcionalidades
              </h2>
              <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {status.features.map((feature) => (
                  <li key={feature.key} className="vj-inline-actions">
                    <strong>{feature.label ?? featureLabel(feature.key)}</strong>
                    {feature.enabled && feature.configured !== false ? (
                      <StatePill
                        tone="success"
                        icon={<CheckCircle2 size={14} aria-hidden="true" />}
                      >
                        Disponível
                      </StatePill>
                    ) : (
                      <StatePill
                        tone="warning"
                        icon={<CircleDashed size={14} aria-hidden="true" />}
                      >
                        {feature.enabled ? "Aguardando configuração" : "Desativada"}
                      </StatePill>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}

      {canJobs && !loading ? (
        <section className="vj-card vj-stack" aria-labelledby="ia-jobs-recent">
          <div className="vj-header-actions">
            <h2 id="ia-jobs-recent" className="vj-section-title">
              Jobs recentes
            </h2>
            <ButtonLink href="/app/ia/jobs" variant="ghost">
              Ver todos
            </ButtonLink>
          </div>
          {jobsError ? (
            <Alert tone="warning" title="Jobs indisponíveis">
              {jobsError}
            </Alert>
          ) : null}
          {!jobsError && jobs.length === 0 ? (
            <p className="vj-meta">Nenhum job de processamento registrado.</p>
          ) : null}
          {jobs.length > 0 ? (
            <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {jobs.map((job) => (
                <li key={job.id} className="vj-inline-actions">
                  <strong>{jobTypeLabel(job.jobType)}</strong>
                  <JobStatusBadge status={job.status} />
                  <span className="vj-meta">{formatDateTime(job.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section className="vj-card vj-stack" aria-labelledby="ia-links">
        <h2 id="ia-links" className="vj-section-title">
          Acessos rápidos
        </h2>
        <div className="vj-inline-actions">
          <ButtonLink href="/app/ia/analises" variant="secondary">
            Análises assistidas
          </ButtonLink>
          {canReview ? (
            <ButtonLink href="/app/ia/revisao" variant="secondary">
              Revisão assistida
            </ButtonLink>
          ) : null}
          <ButtonLink href="/app/ia/uso" variant="secondary">
            Uso e custos
          </ButtonLink>
          <ButtonLink href="/app/documentos" variant="secondary">
            Documentos
          </ButtonLink>
          <ButtonLink href="/app/casos" variant="secondary">
            Casos
          </ButtonLink>
        </div>
        <h3 className="vj-section-title">Como ler os resultados</h3>
        <p className="vj-prose">
          Resultados trazem o selo “IA · Não revisado” até que uma pessoa os revise. A “Confiança do
          modelo” é uma estimativa do próprio modelo e não garante correção. Informações que não
          constam dos documentos aparecem como “Não localizado nos documentos analisados”.
        </p>
      </section>
    </div>
  );
}
