"use client";

import {
  Alert,
  Breadcrumb,
  Button,
  ButtonLink,
  ErrorState,
  FormField,
  LoadingState,
  PageHeader,
  Textarea,
} from "@verasjuris/ui";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  AssistedNotice,
  NoPermission,
  NotConfiguredNotice,
  SectionTabs,
} from "../../../../components/ai-ui";
import {
  COMPARADOR_TABS,
  ComparisonLayout,
  ComparisonStatusBadge,
  ComparisonTypeBadge,
} from "../../../../components/comparison-ui";
import { LayerTag } from "../../../../components/legal-review-ui";
import { aiErrorMessage, formatDateTime, isNotConfigured } from "../../../../lib/ai";
import {
  fetchLegalComparison,
  hasLegalComparisonPermission,
  isApiFailure,
  reviewLegalComparison,
  reviewLegalComparisonItem,
  runLegalComparison,
  type LegalComparisonDetail,
  type LegalComparisonItem,
  type LegalComparisonItemReviewStatus,
} from "../../../../lib/legal-comparisons";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function ComparacaoDetailPage() {
  const params = useParams<{ id: string }>();
  const comparisonId = params.id;
  const org = useOrgContext();

  const canRead = hasLegalComparisonPermission(org.permissions, "read");
  const canRun = hasLegalComparisonPermission(org.permissions, "run");
  const canReview = hasLegalComparisonPermission(org.permissions, "review");

  const [comparison, setComparison] = useState<LegalComparisonDetail | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);

  const load = useCallback(
    async (orgId: string) => {
      setLoading(true);
      setError(null);
      const data = await fetchLegalComparison(orgId, comparisonId);
      if (isApiFailure(data)) {
        if (isNotConfigured(data)) setNotConfigured(true);
        else setError(aiErrorMessage(data, "Não foi possível carregar a comparação."));
        setComparison(null);
      } else {
        setComparison(data.comparison);
        setReviewComment(data.comparison.reviewComment ?? "");
        if (data.comparison.status === "not_configured") setNotConfigured(true);
      }
      setLoading(false);
    },
    [comparisonId],
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
    { label: "Comparador", href: "/app/comparador" },
    { label: comparison?.title ?? "Comparação" },
  ];

  async function onRun() {
    if (!org.orgId || !comparison || !canRun) return;
    setBusy(true);
    setActionError(null);
    setNotConfigured(false);
    const data = await runLegalComparison(org.orgId, comparison.id, {
      idempotencyKey: `cmp-run-${crypto.randomUUID()}`,
    });
    if (isApiFailure(data)) {
      if (isNotConfigured(data)) setNotConfigured(true);
      else setActionError(aiErrorMessage(data, "Não foi possível executar a comparação."));
    } else {
      setComparison(data.comparison);
      if (data.comparison.status === "not_configured") setNotConfigured(true);
    }
    setBusy(false);
  }

  async function onItemAction(item: LegalComparisonItem, action: LegalComparisonItemReviewStatus) {
    if (!org.orgId || !comparison || !canReview) return;
    setPendingItemId(item.id);
    setActionError(null);
    const data = await reviewLegalComparisonItem(org.orgId, comparison.id, item.id, {
      reviewStatus: action,
    });
    if (isApiFailure(data)) {
      setActionError(aiErrorMessage(data, "Não foi possível revisar o achado."));
    } else {
      await load(org.orgId);
    }
    setPendingItemId(null);
  }

  async function onReviewComplete() {
    if (!org.orgId || !comparison || !canReview) return;
    setBusy(true);
    setActionError(null);
    const data = await reviewLegalComparison(org.orgId, comparison.id, {
      reviewComment: reviewComment.trim() || undefined,
      status: "reviewed",
    });
    if (isApiFailure(data)) {
      setActionError(aiErrorMessage(data, "Não foi possível concluir a revisão."));
    } else {
      await load(org.orgId);
    }
    setBusy(false);
  }

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar esta comparação.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title={comparison?.title || "Comparação de peças"}
        description="Lado A | Achados | Lado B. Em telas estreitas as colunas empilham."
        actions={
          comparison?.legalMatterId ? (
            <ButtonLink href={`/app/casos/${comparison.legalMatterId}`} variant="secondary">
              Abrir caso
            </ButtonLink>
          ) : null
        }
      />
      <SectionTabs label="Seções do comparador" items={COMPARADOR_TABS} current="/app/comparador" />
      <AssistedNotice />
      {notConfigured ? <NotConfiguredNotice /> : null}

      {loading || !org.ready ? <LoadingState label="Carregando comparação" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {actionError ? <ErrorState title="Ação">{actionError}</ErrorState> : null}

      {comparison ? (
        <>
          <div className="vj-inline-actions">
            <ComparisonTypeBadge type={comparison.comparisonType} />
            <ComparisonStatusBadge status={comparison.status} />
            <span className="vj-meta">Criada {formatDateTime(comparison.createdAt)}</span>
          </div>

          {canRun ? (
            <section className="vj-card vj-stack" aria-labelledby="cmp-run">
              <h2 id="cmp-run" className="vj-section-title">
                Executar análise
              </h2>
              <LayerTag layer="ANÁLISE" />
              <Alert tone="info" title="AÇÃO · Sob demanda">
                A execução chama a IA apenas quando você solicita. Nada é aplicado automaticamente
                ao caso.
              </Alert>
              <Button type="button" variant="primary" disabled={busy} onClick={() => void onRun()}>
                {busy ? "Executando…" : "Executar comparação"}
              </Button>
            </section>
          ) : null}

          <ComparisonLayout
            comparison={comparison}
            canReview={canReview}
            pendingItemId={pendingItemId}
            onItemAction={(item, action) => void onItemAction(item, action)}
          />

          {canReview ? (
            <section className="vj-card vj-stack" aria-labelledby="cmp-review">
              <h2 id="cmp-review" className="vj-section-title">
                Revisão humana
              </h2>
              <LayerTag layer="AÇÃO" />
              <FormField id="cmp-review-comment" label="Comentário de revisão">
                <Textarea
                  id="cmp-review-comment"
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  rows={3}
                />
              </FormField>
              <Button
                type="button"
                variant="primary"
                disabled={busy}
                onClick={() => void onReviewComplete()}
              >
                Marcar comparação como revisada
              </Button>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
