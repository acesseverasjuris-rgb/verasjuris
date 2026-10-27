"use client";

import { Alert, Button, FormField, Select, Textarea } from "@verasjuris/ui";
import { useCallback, useEffect, useId, useState } from "react";
import {
  aiErrorMessage,
  analysisTypeLabel,
  ANALYSIS_STATUS_LABELS,
  fetchAiStatus,
  fetchLegalAnalysis,
  formatDateTime,
  isApiFailure,
  isNotConfigured,
  reviewLegalAnalysis,
  type AiApiFailure,
  type AiStatus,
  type AnalysisItem,
  type LegalAnalysisDetail,
  type LegalAnalysisSummary,
} from "../lib/ai";
import {
  AssistedNotice,
  JobStatusBadge,
  ModelConfidence,
  NotConfiguredNotice,
  ReviewBadge,
  SourceReference,
} from "./ai-ui";

type Props = {
  orgId: string;
  canRun: boolean;
  canReview: boolean;
  /** Tipos de análise oferecidos. */
  analysisTypes: Array<{ value: string; label: string }>;
  loadItems: () => Promise<{ items: LegalAnalysisSummary[] } | AiApiFailure>;
  run: (analysisType: string) => Promise<{ analysis: LegalAnalysisSummary } | AiApiFailure>;
  headingId: string;
  heading?: string;
  emptyText?: string;
};

function ItemList({ title, items }: { title: string; items: AnalysisItem[] | undefined }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="vj-stack">
      <h4 className="vj-section-title">{title}</h4>
      <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {items.map((item) => (
          <li key={item.id}>
            <p>{item.correctedText ?? item.text}</p>
            <div className="vj-inline-actions">
              <ReviewBadge status={item.reviewStatus} />
              <SourceReference label={item.sourceLabel} pageNumber={item.pageNumber} />
              <ModelConfidence value={item.confidence} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AnalysisDetail({
  orgId,
  analysisId,
  canReview,
  onReviewed,
}: {
  orgId: string;
  analysisId: string;
  canReview: boolean;
  onReviewed: () => void;
}) {
  const commentId = useId();
  const [detail, setDetail] = useState<LegalAnalysisDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await fetchLegalAnalysis(orgId, analysisId);
    if (isApiFailure(data)) {
      setError(aiErrorMessage(data, "Não foi possível carregar o detalhe da análise."));
      return;
    }
    setDetail(data.analysis);
  }, [orgId, analysisId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function review(disposition: "reviewed" | "corrected") {
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await reviewLegalAnalysis(orgId, analysisId, {
      disposition,
      comment: comment.trim() || undefined,
    });
    setPending(false);
    if (isApiFailure(result)) {
      setError(aiErrorMessage(result, "Não foi possível registrar a revisão."));
      return;
    }
    setMessage("Revisão registrada.");
    setComment("");
    await load();
    onReviewed();
  }

  if (error && !detail)
    return (
      <Alert tone="warning" title="Detalhe indisponível">
        {error}
      </Alert>
    );
  if (!detail)
    return (
      <p className="vj-meta" role="status">
        Carregando detalhe…
      </p>
    );

  const hasContent =
    (detail.facts?.length ?? 0) +
      (detail.claims?.length ?? 0) +
      (detail.grounds?.length ?? 0) +
      (detail.contradictions?.length ?? 0) >
    0;
  const reviewed = detail.status === "reviewed";

  return (
    <div className="vj-stack">
      {detail.summary ? <p className="vj-prose">{detail.summary}</p> : null}
      {!hasContent && detail.status !== "not_configured" ? (
        <p className="vj-meta">Não localizado nos documentos analisados.</p>
      ) : null}
      <ItemList title="Fatos identificados" items={detail.facts} />
      <ItemList title="Pedidos identificados" items={detail.claims} />
      <ItemList title="Fundamentos" items={detail.grounds} />
      {detail.contradictions && detail.contradictions.length > 0 ? (
        <div className="vj-stack">
          <h4 className="vj-section-title">Possíveis inconsistências</h4>
          <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {detail.contradictions.map((item) => (
              <li key={item.id} className="vj-card vj-stack">
                <p>
                  <strong>Trecho A:</strong> {item.statementA}{" "}
                  <SourceReference label={item.sourceA} />
                </p>
                <p>
                  <strong>Trecho B:</strong> {item.statementB}{" "}
                  <SourceReference label={item.sourceB} />
                </p>
                {item.explanation ? <p className="vj-meta">{item.explanation}</p> : null}
                <div className="vj-inline-actions">
                  <ReviewBadge status={item.reviewStatus} />
                  <ModelConfidence value={item.confidence} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {detail.reviewComment ? (
        <p className="vj-meta">Comentário da revisão: {detail.reviewComment}</p>
      ) : null}

      {canReview && hasContent && !reviewed ? (
        <div className="vj-stack">
          <FormField id={commentId} label="Comentário da revisão" hint="Opcional">
            <Textarea
              id={commentId}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={2000}
            />
          </FormField>
          <div className="vj-form-actions">
            <Button variant="secondary" disabled={pending} onClick={() => void review("reviewed")}>
              Marcar como revisada
            </Button>
            <Button variant="ghost" disabled={pending} onClick={() => void review("corrected")}>
              Marcar como corrigida
            </Button>
          </div>
        </div>
      ) : null}
      {error ? (
        <Alert tone="error" title="Falha na revisão">
          {error}
        </Alert>
      ) : null}
      {message ? <Alert tone="success" title={message} /> : null}
    </div>
  );
}

/** Seção "Análise assistida" reutilizada em casos e oportunidades públicas. */
export function AssistedAnalysisPanel({
  orgId,
  canRun,
  canReview,
  analysisTypes,
  loadItems,
  run,
  headingId,
  heading = "Análise assistida",
  emptyText = "Nenhuma análise assistida foi gerada ainda.",
}: Props) {
  const typeId = useId();
  const [items, setItems] = useState<LegalAnalysisSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [analysisType, setAnalysisType] = useState(analysisTypes[0]?.value ?? "");
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runNotConfigured, setRunNotConfigured] = useState(false);
  const [runMessage, setRunMessage] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const data = await loadItems();
    if (isApiFailure(data)) {
      setLoadError(aiErrorMessage(data, "Não foi possível carregar as análises."));
      return;
    }
    setLoadError(null);
    setItems(data.items);
  }, [loadItems]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const data = await fetchAiStatus(orgId);
      if (cancelled) return;
      if (isApiFailure(data)) {
        if (isNotConfigured(data)) {
          setStatus({
            provider: { configured: false, state: "not_configured" },
            ocr: { configured: false, state: "not_configured" },
            features: [],
          });
        }
        return;
      }
      setStatus(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  async function onRun() {
    setRunning(true);
    setRunError(null);
    setRunMessage(null);
    setRunNotConfigured(false);
    const result = await run(analysisType);
    setRunning(false);
    if (isApiFailure(result)) {
      if (isNotConfigured(result)) setRunNotConfigured(true);
      else setRunError(aiErrorMessage(result, "Não foi possível solicitar a análise."));
      await reload();
      return;
    }
    setRunMessage(
      "Análise solicitada. O resultado ainda não foi revisado: confira os pontos nos documentos.",
    );
    await reload();
  }

  const providerMissing = status ? !status.provider.configured : false;

  return (
    <section className="vj-card vj-stack" aria-labelledby={headingId}>
      <h2 id={headingId} className="vj-section-title">
        {heading}
      </h2>
      <AssistedNotice />
      {providerMissing || runNotConfigured ? <NotConfiguredNotice /> : null}

      {canRun ? (
        <div className="vj-stack">
          {analysisTypes.length > 1 ? (
            <FormField id={typeId} label="Tipo de análise">
              <Select
                id={typeId}
                value={analysisType}
                onChange={(event) => setAnalysisType(event.target.value)}
              >
                {analysisTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : null}
          <div className="vj-form-actions">
            <Button onClick={() => void onRun()} loading={running} loadingLabel="Solicitando…">
              Executar análise assistida
            </Button>
          </div>
        </div>
      ) : (
        <p className="vj-meta">Você não tem permissão para solicitar análises assistidas.</p>
      )}

      {runError ? (
        <Alert tone="error" title="Não foi possível solicitar a análise">
          {runError}
        </Alert>
      ) : null}
      {runMessage ? (
        <Alert tone="success" title="Análise solicitada">
          {runMessage}
        </Alert>
      ) : null}
      {loadError ? (
        <Alert tone="warning" title="Análises indisponíveis">
          {loadError}
        </Alert>
      ) : null}

      {!loadError && items.length === 0 ? <p className="vj-meta">{emptyText}</p> : null}

      {items.length > 0 ? (
        <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {items.map((analysis) => {
            const expanded = openId === analysis.id;
            const canExpand = ![
              "not_configured",
              "failed",
              "pending",
              "running",
              "cancelled",
            ].includes(analysis.status);
            return (
              <li key={analysis.id} className="vj-card vj-stack">
                <div className="vj-inline-actions">
                  <strong>
                    {analysisTypeLabel(analysis.analysisType)} · v{analysis.version}
                  </strong>
                  <JobStatusBadge status={analysis.status} labels={ANALYSIS_STATUS_LABELS} />
                  {canExpand ? (
                    <ReviewBadge
                      status={analysis.status === "reviewed" ? "reviewed" : "unreviewed"}
                    />
                  ) : null}
                </div>
                <p className="vj-meta">{formatDateTime(analysis.createdAt)}</p>
                {analysis.status === "not_configured" ? (
                  <p className="vj-meta">Não há provedor de IA configurado neste ambiente.</p>
                ) : null}
                {canExpand ? (
                  <>
                    <Button
                      variant="ghost"
                      aria-expanded={expanded}
                      onClick={() => setOpenId(expanded ? null : analysis.id)}
                    >
                      {expanded ? "Ocultar detalhes" : "Ver detalhes"}
                    </Button>
                    {expanded ? (
                      <AnalysisDetail
                        orgId={orgId}
                        analysisId={analysis.id}
                        canReview={canReview}
                        onReviewed={() => void reload()}
                      />
                    ) : null}
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
