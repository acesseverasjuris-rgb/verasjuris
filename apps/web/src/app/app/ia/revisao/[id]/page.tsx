"use client";

import {
  Alert,
  Breadcrumb,
  Button,
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
  IA_TABS,
  ModelConfidence,
  NoPermission,
  NotConfiguredNotice,
  SectionTabs,
  SourceReference,
} from "../../../../../components/ai-ui";
import {
  ItemReviewBadge,
  LayerTag,
  ReviewItemCard,
  ReviewStatusBadge,
  ReviewTypeBadge,
} from "../../../../../components/legal-review-ui";
import { aiErrorMessage, formatDateTime, isNotConfigured } from "../../../../../lib/ai";
import {
  fetchLegalReview,
  hasLegalReviewPermission,
  isApiFailure,
  LEGAL_REVIEW_SECTIONS,
  reviewLegalReview,
  reviewLegalReviewItem,
  sectionLabel,
  type LegalReviewDetail,
  type LegalReviewSection,
  type ReviewContradiction,
} from "../../../../../lib/legal-review";
import { useOrgContext } from "../../../../../lib/use-org-context";

export default function RevisaoDetailPage() {
  const params = useParams<{ id: string }>();
  const reviewId = params.id;
  const org = useOrgContext();
  const canRead = hasLegalReviewPermission(org.permissions, "read");
  const canReview = hasLegalReviewPermission(org.permissions, "review");

  const [review, setReview] = useState<LegalReviewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionOk, setActionOk] = useState<string | null>(null);

  const load = useCallback(async (orgId: string, id: string) => {
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    const data = await fetchLegalReview(orgId, id);
    if (isApiFailure(data)) {
      if (isNotConfigured(data)) setNotConfigured(true);
      else setError(aiErrorMessage(data, "Não foi possível carregar a revisão."));
      setReview(null);
    } else {
      setReview(data.review);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!org.ready) return;
    if (!org.orgId || !canRead || !reviewId) {
      setLoading(false);
      return;
    }
    void load(org.orgId, reviewId);
  }, [org.ready, org.orgId, canRead, reviewId, load]);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "IA", href: "/app/ia" },
    { label: "Revisão", href: "/app/ia/revisao" },
    { label: "Detalhe" },
  ];

  async function onItemAction(
    section: LegalReviewSection,
    itemId: string,
    action: "confirm" | "reject",
  ) {
    if (!org.orgId || !review) return;
    setPending(true);
    setActionError(null);
    setActionOk(null);
    const result = await reviewLegalReviewItem(org.orgId, review.id, section, itemId, { action });
    if (isApiFailure(result)) {
      setActionError(aiErrorMessage(result, "Não foi possível registrar a revisão do item."));
    } else {
      setActionOk(action === "confirm" ? "Item confirmado." : "Item rejeitado.");
      await load(org.orgId, review.id);
    }
    setPending(false);
  }

  async function onCloseReview() {
    if (!org.orgId || !review) return;
    setPending(true);
    setActionError(null);
    setActionOk(null);
    const result = await reviewLegalReview(org.orgId, review.id, {
      comment: comment.trim() || undefined,
    });
    if (isApiFailure(result)) {
      setActionError(aiErrorMessage(result, "Não foi possível concluir a revisão."));
    } else {
      setActionOk("Revisão marcada como revisada.");
      await load(org.orgId, review.id);
    }
    setPending(false);
  }

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar esta revisão.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Detalhe da revisão"
        description="Apontamentos preparados pela IA. Confirme ou rejeite cada item — nada se aplica sozinho ao caso."
      />
      <SectionTabs label="Seções de IA" items={IA_TABS} current="/app/ia/revisao" />

      {loading || !org.ready ? <LoadingState label="Carregando revisão" /> : null}
      {notConfigured ? <NotConfiguredNotice /> : null}
      {error ? <ErrorState title="Erro ao carregar">{error}</ErrorState> : null}
      {actionError ? (
        <Alert tone="warning" title="Ação não concluída">
          {actionError}
        </Alert>
      ) : null}
      {actionOk ? (
        <Alert tone="success" title="Atualizado">
          {actionOk}
        </Alert>
      ) : null}

      {review ? (
        <>
          <AssistedNotice />
          <section className="vj-card vj-stack" aria-labelledby="rev-resumo">
            <div className="vj-header-actions">
              <h2 id="rev-resumo" className="vj-section-title">
                RESUMO
              </h2>
              <LayerTag layer="ANÁLISE" />
            </div>
            <div className="vj-inline-actions">
              <ReviewTypeBadge type={review.reviewType} />
              <ReviewStatusBadge status={review.status} />
            </div>
            <p className="vj-prose">{review.summary ?? "Resumo não disponível."}</p>
            <p className="vj-meta">
              Criada em {formatDateTime(review.createdAt)}
              {review.pendingReviewItems != null
                ? ` · ${review.pendingReviewItems} item(ns) pendente(s)`
                : ""}
            </p>
          </section>

          <ContradictionSection
            items={review.contradictions ?? []}
            canReview={canReview}
            pending={pending}
            onAction={(id, action) => void onItemAction("contradictions", id, action)}
          />

          <ItemSection
            title="ERROS FORMAIS"
            section="formal_issues"
            items={(review.formalIssues ?? []).map((item) => ({
              id: item.id,
              reviewStatus: item.reviewStatus,
              unsupported: item.unsupported,
              sourceLabel: item.sourceLabel,
              pageNumber: item.pageNumber,
              confidence: item.confidence,
              body: item.description,
            }))}
            canReview={canReview}
            pending={pending}
            onAction={(id, action) => void onItemAction("formal_issues", id, action)}
          />

          <ItemSection
            title="DOCUMENTOS AUSENTES"
            section="missing_documents"
            items={(review.missingDocuments ?? []).map((item) => ({
              id: item.id,
              reviewStatus: item.reviewStatus,
              unsupported: item.unsupported,
              sourceLabel: item.sourceLabel,
              body:
                item.message ??
                item.documentDescription ??
                item.description ??
                "Documento não localizado no conjunto analisado.",
            }))}
            canReview={canReview}
            pending={pending}
            onAction={(id, action) => void onItemAction("missing_documents", id, action)}
          />

          <ItemSection
            title="PEDIDOS"
            section="unaddressed_claims"
            items={(review.unaddressedClaims ?? []).map((item) => ({
              id: item.id,
              reviewStatus: item.reviewStatus,
              unsupported: item.unsupported,
              pageNumber: item.sourcePage ?? item.pageNumber,
              body: item.claimText ?? item.description ?? "Pedido sem texto.",
            }))}
            canReview={canReview}
            pending={pending}
            onAction={(id, action) => void onItemAction("unaddressed_claims", id, action)}
          />

          <ItemSection
            title="TESES"
            section="unanswered_grounds"
            items={(review.unansweredGrounds ?? []).map((item) => ({
              id: item.id,
              reviewStatus: item.reviewStatus,
              unsupported: item.unsupported,
              sourceLabel: item.sourceLabel,
              body: item.groundText ?? item.description ?? "Tese sem texto.",
              note: "A IA não afirma procedência jurídica.",
            }))}
            canReview={canReview}
            pending={pending}
            onAction={(id, action) => void onItemAction("unanswered_grounds", id, action)}
          />

          <ItemSection
            title="RISCOS"
            section="risks"
            items={(review.risks ?? []).map((item) => ({
              id: item.id,
              reviewStatus: item.reviewStatus,
              unsupported: item.unsupported,
              sourceLabel: item.sourceLabel,
              body: item.description,
            }))}
            canReview={canReview}
            pending={pending}
            onAction={(id, action) => void onItemAction("risks", id, action)}
          />

          <ItemSection
            title="INCONSISTÊNCIAS"
            section="inconsistencies"
            items={(review.inconsistencies ?? []).map((item) => ({
              id: item.id,
              reviewStatus: item.reviewStatus,
              unsupported: item.unsupported,
              sourceLabel: item.sourceLabel,
              body: item.description,
            }))}
            canReview={canReview}
            pending={pending}
            onAction={(id, action) => void onItemAction("inconsistencies", id, action)}
          />

          <section className="vj-card vj-stack" aria-labelledby="rev-fontes">
            <h2 id="rev-fontes" className="vj-section-title">
              FONTES
            </h2>
            <LayerTag layer="FONTE" />
            {(review.sources ?? []).length === 0 ? (
              <p className="vj-meta">Nenhuma fonte registrada nesta revisão.</p>
            ) : (
              <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {(review.sources ?? []).map((source) => (
                  <li
                    key={`${source.documentId ?? "src"}-${source.documentVersionId ?? "v"}-${source.sourceLabel ?? "label"}`}
                  >
                    <SourceReference label={source.sourceLabel} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {LEGAL_REVIEW_SECTIONS.every(
            (section) =>
              ((review as Record<string, unknown>)[sectionKey(section)] as unknown[])?.length === 0,
          ) && (review.contradictions ?? []).length === 0 ? (
            <Alert tone="info" title="Sem apontamentos">
              A revisão não gerou itens nas seções disponíveis, ou ainda está em processamento.
            </Alert>
          ) : null}

          {canReview && (review.status === "human_review" || review.status === "generated") ? (
            <section className="vj-card vj-stack" aria-labelledby="rev-humana">
              <h2 id="rev-humana" className="vj-section-title">
                REVISÃO
              </h2>
              <LayerTag layer="AÇÃO" />
              <p className="vj-meta">
                Ao concluir, você registra que uma pessoa revisou o conjunto. Isso não aplica
                alterações automáticas aos documentos do caso.
              </p>
              <FormField id="rev-comment" label="Comentário (opcional)">
                <Textarea
                  id="rev-comment"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  rows={3}
                />
              </FormField>
              <Button type="button" disabled={pending} onClick={() => void onCloseReview()}>
                Marcar revisão como revisada
              </Button>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function sectionKey(section: LegalReviewSection): string {
  const map: Record<LegalReviewSection, string> = {
    formal_issues: "formalIssues",
    missing_documents: "missingDocuments",
    unaddressed_claims: "unaddressedClaims",
    unanswered_grounds: "unansweredGrounds",
    risks: "risks",
    inconsistencies: "inconsistencies",
    contradictions: "contradictions",
  };
  return map[section];
}

function ContradictionSection({
  items,
  canReview,
  pending,
  onAction,
}: {
  items: ReviewContradiction[];
  canReview: boolean;
  pending: boolean;
  onAction: (id: string, action: "confirm" | "reject") => void;
}) {
  return (
    <section className="vj-stack" aria-labelledby="rev-contradictions">
      <h2 id="rev-contradictions" className="vj-section-title">
        CONTRADIÇÕES
      </h2>
      <p className="vj-meta">Rótulo: “Possível contradição” até confirmação humana.</p>
      {items.length === 0 ? (
        <p className="vj-meta">Nenhuma possível contradição apontada.</p>
      ) : null}
      {items.map((item) => (
        <ReviewItemCard
          key={item.id}
          title="Possível contradição"
          item={item}
          canReview={canReview}
          pending={pending}
          onAction={(action) => onAction(item.id, action)}
        >
          <p className="vj-prose">
            <strong>A:</strong> {item.statementA}
          </p>
          <p className="vj-meta">
            FONTE A: {item.sourceA ?? "não informada"}
            {item.pageA != null ? `, p. ${item.pageA}` : ""}
          </p>
          <p className="vj-prose">
            <strong>B:</strong> {item.statementB}
          </p>
          <p className="vj-meta">
            FONTE B: {item.sourceB ?? "não informada"}
            {item.pageB != null ? `, p. ${item.pageB}` : ""}
          </p>
          {item.explanation ? <p className="vj-prose">{item.explanation}</p> : null}
          <ModelConfidence value={item.confidence} />
        </ReviewItemCard>
      ))}
    </section>
  );
}

function ItemSection({
  title,
  section,
  items,
  canReview,
  pending,
  onAction,
}: {
  title: string;
  section: LegalReviewSection;
  items: Array<{
    id: string;
    reviewStatus: string;
    unsupported?: boolean;
    sourceLabel?: string | null;
    pageNumber?: number | null;
    confidence?: number | null;
    body: string;
    note?: string;
  }>;
  canReview: boolean;
  pending: boolean;
  onAction: (id: string, action: "confirm" | "reject") => void;
}) {
  return (
    <section className="vj-stack" aria-labelledby={`rev-${section}`}>
      <h2 id={`rev-${section}`} className="vj-section-title">
        {title}
      </h2>
      <p className="vj-visually-hidden">{sectionLabel(section)}</p>
      {items.length === 0 ? <p className="vj-meta">Nenhum item nesta seção.</p> : null}
      {items.map((item) => (
        <ReviewItemCard
          key={item.id}
          title={title}
          item={item}
          canReview={canReview}
          pending={pending}
          onAction={(action) => onAction(item.id, action)}
        >
          <p className="vj-prose">{item.body}</p>
          {item.note ? <p className="vj-meta">{item.note}</p> : null}
          <div className="vj-inline-actions">
            <ItemReviewBadge status={item.reviewStatus} />
            <ModelConfidence value={item.confidence} />
          </div>
        </ReviewItemCard>
      ))}
    </section>
  );
}
