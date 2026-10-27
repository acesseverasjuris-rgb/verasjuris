"use client";

import {
  Alert,
  Breadcrumb,
  ButtonLink,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@verasjuris/ui";
import { useCallback, useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../components/ai-ui";
import { DashboardCountCard } from "../../../components/legal-draft-ui";
import { DOCUMENTOS_JURIDICOS_TABS } from "../../../components/legal-template-ui";
import { LayerTag } from "../../../components/legal-review-ui";
import { fetchLegalDrafts, hasLegalDraftPermission, isApiFailure } from "../../../lib/legal-drafts";
import {
  fetchLegalComparisons,
  hasLegalComparisonPermission,
  isApiFailure as isComparisonFailure,
} from "../../../lib/legal-comparisons";
import { hasLegalTemplatePermission } from "../../../lib/legal-templates";
import { useOrgContext } from "../../../lib/use-org-context";

type Counts = {
  humanReview: number;
  awaitingApproval: number;
  readyToFile: number;
  awaitingConfirm: number;
  pendingComparisons: number;
};

export default function DocumentosJuridicosHubPage() {
  const org = useOrgContext();
  const canTemplates = hasLegalTemplatePermission(org.permissions, "read");
  const canDrafts = hasLegalDraftPermission(org.permissions, "read");
  const canComparisons = hasLegalComparisonPermission(org.permissions, "read");
  const canRead = canTemplates || canDrafts;

  const [counts, setCounts] = useState<Counts>({
    humanReview: 0,
    awaitingApproval: 0,
    readyToFile: 0,
    awaitingConfirm: 0,
    pendingComparisons: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (orgId: string) => {
      setLoading(true);
      setError(null);
      try {
        const next: Counts = {
          humanReview: 0,
          awaitingApproval: 0,
          readyToFile: 0,
          awaitingConfirm: 0,
          pendingComparisons: 0,
        };
        if (canDrafts) {
          const [review, approved, ready, filed] = await Promise.all([
            fetchLegalDrafts(orgId, { status: "human_review", limit: 1 }),
            fetchLegalDrafts(orgId, { status: "approved", limit: 1 }),
            fetchLegalDrafts(orgId, { status: "ready_to_file", limit: 1 }),
            fetchLegalDrafts(orgId, { status: "filed", limit: 1 }),
          ]);
          if (!isApiFailure(review)) next.humanReview = review.total;
          if (!isApiFailure(approved)) next.awaitingApproval = approved.total;
          if (!isApiFailure(ready)) next.readyToFile = ready.total;
          if (!isApiFailure(filed)) next.awaitingConfirm = filed.total;
        }
        if (canComparisons) {
          const pending = await fetchLegalComparisons(orgId, {
            status: "human_review",
            limit: 1,
          });
          if (!isComparisonFailure(pending)) next.pendingComparisons = pending.total;
        }
        setCounts(next);
      } catch {
        setError("Não foi possível carregar os indicadores.");
      }
      setLoading(false);
    },
    [canDrafts, canComparisons],
  );

  useEffect(() => {
    if (!org.ready) return;
    if (!org.orgId || !canRead) {
      setLoading(false);
      return;
    }
    void load(org.orgId);
  }, [org.ready, org.orgId, canRead, load]);

  const breadcrumb = [{ label: "Painel", href: "/app" }, { label: "Documentos jurídicos" }];

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>
          Você não tem permissão para consultar modelos ou minutas jurídicas.
        </NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Documentos jurídicos"
        description="Modelos versionados e minutas com workflow humano. A IA, quando usada, apenas apoia — a decisão e o protocolo são sempre manuais."
        actions={
          <div className="vj-inline-actions">
            {canTemplates ? (
              <ButtonLink href="/app/documentos-juridicos/templates" variant="secondary">
                Modelos
              </ButtonLink>
            ) : null}
            {canDrafts ? (
              <ButtonLink href="/app/documentos-juridicos/minutas" variant="primary">
                Minutas
              </ButtonLink>
            ) : null}
            {canComparisons ? (
              <ButtonLink href="/app/comparador" variant="secondary">
                Comparador
              </ButtonLink>
            ) : null}
          </div>
        }
      />
      <SectionTabs
        label="Seções de documentos jurídicos"
        items={DOCUMENTOS_JURIDICOS_TABS}
        current="/app/documentos-juridicos"
      />

      <Alert tone="info" title="FONTE → ANÁLISE → AÇÃO">
        Modelos e documentos são a fonte; a IA gera análise assistiva; protocolo e confirmação são
        ações humanas.
      </Alert>

      {loading || !org.ready ? <LoadingState label="Carregando indicadores" /> : null}
      {error ? <ErrorState title="Indicadores">{error}</ErrorState> : null}

      {!loading && !error ? (
        <section
          className="vj-split"
          aria-label="Indicadores de workflow"
          style={{
            display: "grid",
            gap: "1rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))",
          }}
        >
          {canDrafts ? (
            <>
              <DashboardCountCard
                title="Minutas em revisão"
                count={counts.humanReview}
                href="/app/documentos-juridicos/minutas?status=human_review"
                layer="AÇÃO"
              />
              <DashboardCountCard
                title="Aguardando aprovação"
                count={counts.awaitingApproval}
                href="/app/documentos-juridicos/minutas?status=approved"
                layer="AÇÃO"
              />
              <DashboardCountCard
                title="Prontas para protocolo"
                count={counts.readyToFile}
                href="/app/documentos-juridicos/minutas?status=ready_to_file"
                layer="AÇÃO"
              />
              <DashboardCountCard
                title="Protocolos aguardando confirmação"
                count={counts.awaitingConfirm}
                href="/app/documentos-juridicos/minutas?status=filed"
                layer="AÇÃO"
              />
            </>
          ) : null}
          {canComparisons ? (
            <DashboardCountCard
              title="Comparações pendentes"
              count={counts.pendingComparisons}
              href="/app/comparador?status=human_review"
              layer="ANÁLISE"
            />
          ) : null}
        </section>
      ) : null}

      <section className="vj-card vj-stack" aria-labelledby="hub-links">
        <h2 id="hub-links" className="vj-section-title">
          Atalhos
        </h2>
        <LayerTag layer="FONTE" />
        <div className="vj-inline-actions">
          {canTemplates ? (
            <>
              <ButtonLink href="/app/documentos-juridicos/templates" variant="secondary">
                Listar modelos
              </ButtonLink>
              {hasLegalTemplatePermission(org.permissions, "create") ? (
                <ButtonLink href="/app/documentos-juridicos/templates/novo" variant="secondary">
                  Novo modelo
                </ButtonLink>
              ) : null}
            </>
          ) : null}
          {canDrafts ? (
            <>
              <ButtonLink href="/app/documentos-juridicos/minutas" variant="secondary">
                Listar minutas
              </ButtonLink>
              {hasLegalDraftPermission(org.permissions, "create") ? (
                <ButtonLink href="/app/documentos-juridicos/minutas/nova" variant="primary">
                  Nova minuta
                </ButtonLink>
              ) : null}
            </>
          ) : (
            <EmptyState title="Sem minutas">
              Você não tem permissão de leitura de minutas nesta organização.
            </EmptyState>
          )}
        </div>
      </section>
    </div>
  );
}
