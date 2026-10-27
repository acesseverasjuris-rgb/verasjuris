"use client";

import { Alert, Button, FormField, Input, Select } from "@verasjuris/ui";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  AI_NOT_CONFIGURED_MESSAGE,
  aiErrorMessage,
  documentKindLabel,
  EXTRACTION_METHOD_LABELS,
  fetchDocumentPages,
  fetchDocumentProcessing,
  formatDateTime,
  formatNumber,
  isApiFailure,
  isNotConfigured,
  metadataFieldLabel,
  OCR_NOT_CONFIGURED_MESSAGE,
  PROCESSING_STATUS_LABELS,
  reviewDocumentProcessing,
  runDocumentProcessing,
  type DocumentPage,
  type DocumentProcessing,
} from "../lib/ai";
import { JobStatusBadge, ModelConfidence, NotConfiguredNotice, ReviewBadge } from "./ai-ui";

type Props = {
  orgId: string;
  documentId: string;
  /** Versão atual do documento (usada para processar e para o visualizador de páginas). */
  versionId?: string | null;
  canProcess: boolean;
  canReview: boolean;
};

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <p>
      <strong>{label}:</strong> {value}
    </p>
  );
}

function MetadataRow({
  orgId,
  documentId,
  item,
  canReview,
  onChanged,
}: {
  orgId: string;
  documentId: string;
  item: DocumentProcessing["metadata"][number];
  canReview: boolean;
  onChanged: () => void;
}) {
  const inputId = useId();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.correctedValue ?? item.originalValue ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(reviewStatus: "reviewed" | "corrected" | "rejected") {
    setPending(true);
    setError(null);
    const result = await reviewDocumentProcessing(orgId, documentId, {
      target: "metadata",
      targetId: item.id,
      reviewStatus,
      correctedValue: reviewStatus === "corrected" ? value.trim() : undefined,
    });
    setPending(false);
    if (isApiFailure(result)) {
      setError(aiErrorMessage(result, "Não foi possível registrar a revisão."));
      return;
    }
    setEditing(false);
    onChanged();
  }

  const shown = item.correctedValue ?? item.originalValue;
  const reviewable = item.reviewStatus === "unreviewed";

  return (
    <tr>
      <td data-label="Campo">{metadataFieldLabel(item.fieldKey)}</td>
      <td data-label="Valor">
        {shown ?? <span className="vj-meta">Não localizado nos documentos analisados</span>}
        {item.correctedValue && item.originalValue ? (
          <div className="vj-meta">Valor sugerido pela IA: {item.originalValue}</div>
        ) : null}
        {item.sourcePage != null ? <div className="vj-meta">Página {item.sourcePage}</div> : null}
        {editing ? (
          <div className="vj-stack">
            <FormField id={inputId} label="Valor corrigido">
              <Input
                id={inputId}
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            </FormField>
            <div className="vj-form-actions">
              <Button disabled={pending || !value.trim()} onClick={() => void submit("corrected")}>
                Salvar correção
              </Button>
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="vj-field-error">
            {error}
          </p>
        ) : null}
      </td>
      <td data-label="Confiança do modelo">
        <ModelConfidence value={item.confidence} />
      </td>
      <td data-label="Revisão">
        <ReviewBadge status={item.reviewStatus} />
        {canReview && reviewable && !editing ? (
          <div className="vj-inline-actions">
            <Button variant="ghost" disabled={pending} onClick={() => void submit("reviewed")}>
              Marcar como revisado
            </Button>
            <Button variant="ghost" disabled={pending} onClick={() => setEditing(true)}>
              Corrigir
            </Button>
          </div>
        ) : null}
      </td>
    </tr>
  );
}

/** Seção "Processamento" do detalhe do documento. */
export function DocumentProcessingSection({
  orgId,
  documentId,
  versionId,
  canProcess,
  canReview,
}: Props) {
  const [data, setData] = useState<DocumentProcessing | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState<"ai" | "ocr" | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runMessage, setRunMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await fetchDocumentProcessing(orgId, documentId);
    if (isApiFailure(result)) {
      setLoadError(aiErrorMessage(result, "Não foi possível carregar o processamento."));
      setLoading(false);
      return;
    }
    setLoadError(null);
    setData(result);
    setLoading(false);
  }, [orgId, documentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onRun() {
    setRunning(true);
    setRunError(null);
    setRunMessage(null);
    setNotConfigured(null);
    const result = await runDocumentProcessing(orgId, documentId, {
      documentVersionId: versionId ?? undefined,
    });
    setRunning(false);
    if (isApiFailure(result)) {
      if (isNotConfigured(result)) {
        setNotConfigured(result.error?.code === "OCR_PROVIDER_NOT_CONFIGURED" ? "ocr" : "ai");
      } else {
        setRunError(aiErrorMessage(result, "Não foi possível iniciar o processamento."));
      }
      await load();
      return;
    }
    setRunMessage("Processamento solicitado. O resultado ainda não foi revisado.");
    await load();
  }

  const run = data?.run ?? null;
  const ocrMissing =
    notConfigured === "ocr" ||
    (run?.ocrRequired && run.status === "not_configured") ||
    (data?.providers.ocr ? !data.providers.ocr.configured && Boolean(run?.ocrRequired) : false);

  return (
    <section className="vj-card vj-stack" aria-labelledby="doc-processing">
      <h2 id="doc-processing" className="vj-section-title">
        Processamento
      </h2>
      <p className="vj-meta">
        Extração de texto, OCR, classificação e metadados sugeridos. Todo resultado é uma análise
        assistida e permanece “IA · Não revisado” até a conferência por uma pessoa.
      </p>

      {loading ? (
        <p className="vj-meta" role="status">
          Carregando processamento…
        </p>
      ) : null}
      {loadError ? (
        <Alert tone="warning" title="Processamento indisponível">
          {loadError}
        </Alert>
      ) : null}
      {notConfigured === "ai" ? <NotConfiguredNotice /> : null}
      {ocrMissing ? (
        <NotConfiguredNotice message={OCR_NOT_CONFIGURED_MESSAGE}>
          Este documento parece digitalizado e depende de OCR para a leitura do texto. Nenhum texto
          foi extraído.
        </NotConfiguredNotice>
      ) : null}
      {!notConfigured && run?.status === "not_configured" && !ocrMissing ? (
        <NotConfiguredNotice message={AI_NOT_CONFIGURED_MESSAGE} />
      ) : null}

      {!loading && !loadError && !run ? (
        <p className="vj-meta">Este documento ainda não foi processado.</p>
      ) : null}

      {run ? (
        <div className="vj-stack">
          <h3 className="vj-section-title">Extração e OCR</h3>
          <p>
            <JobStatusBadge status={run.status} labels={PROCESSING_STATUS_LABELS} />
          </p>
          <MetaRow
            label="Método de extração"
            value={
              run.extractionMethod
                ? (EXTRACTION_METHOD_LABELS[run.extractionMethod] ?? run.extractionMethod)
                : "—"
            }
          />
          <MetaRow
            label="OCR"
            value={
              run.ocrRequired
                ? run.status === "not_configured"
                  ? "Necessário, mas não configurado"
                  : `Necessário${run.ocrProvider ? ` (${run.ocrProvider})` : ""}`
                : "Não necessário"
            }
          />
          <MetaRow label="Páginas" value={formatNumber(run.pageCount ?? data?.pageCount)} />
          <MetaRow label="Caracteres extraídos" value={formatNumber(run.charCount)} />
          <MetaRow label="Concluído em" value={formatDateTime(run.completedAt)} />
          {run.status === "failed" ? (
            <Alert tone="error" title="O processamento falhou">
              {run.errorSafeMessage ?? "Tente novamente. Nenhum dado do documento foi alterado."}
            </Alert>
          ) : null}
        </div>
      ) : null}

      {data?.classification ? (
        <div className="vj-stack">
          <h3 className="vj-section-title">Classificação</h3>
          <p>
            <strong>Tipo sugerido:</strong> {documentKindLabel(data.classification.suggestedKind)}{" "}
            <ReviewBadge status={data.classification.reviewStatus} />
          </p>
          {data.classification.appliedKind ? (
            <MetaRow
              label="Tipo aplicado"
              value={documentKindLabel(data.classification.appliedKind)}
            />
          ) : null}
          <ModelConfidence value={data.classification.confidence} />
          {canReview && data.classification.reviewStatus === "unreviewed" ? (
            <ClassificationReview
              orgId={orgId}
              documentId={documentId}
              classificationId={data.classification.id}
              onChanged={() => void load()}
            />
          ) : null}
        </div>
      ) : null}

      {data && data.segments.length > 0 ? (
        <div className="vj-stack">
          <h3 className="vj-section-title">Segmentos detectados</h3>
          <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {data.segments.map((segment) => (
              <li key={segment.id} className="vj-inline-actions">
                <span>
                  Páginas {segment.startPage}–{segment.endPage}:{" "}
                  {documentKindLabel(segment.detectedType)}
                </span>
                <ReviewBadge status={segment.reviewStatus} />
                <ModelConfidence value={segment.confidence} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {data && data.metadata.length > 0 ? (
        <div className="vj-stack">
          <h3 className="vj-section-title">Metadados sugeridos</h3>
          <div className="vj-table-wrap">
            <table className="vj-table">
              <caption className="vj-visually-hidden">Metadados extraídos do documento</caption>
              <thead>
                <tr>
                  <th scope="col">Campo</th>
                  <th scope="col">Valor</th>
                  <th scope="col">Confiança do modelo</th>
                  <th scope="col">Revisão</th>
                </tr>
              </thead>
              <tbody>
                {data.metadata.map((item) => (
                  <MetadataRow
                    key={item.id}
                    orgId={orgId}
                    documentId={documentId}
                    item={item}
                    canReview={canReview}
                    onChanged={() => void load()}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {runError ? (
        <Alert tone="error" title="Não foi possível processar">
          {runError}
        </Alert>
      ) : null}
      {runMessage ? (
        <Alert tone="success" title="Processamento solicitado">
          {runMessage}
        </Alert>
      ) : null}

      {canProcess ? (
        <div className="vj-form-actions">
          <Button
            variant={run ? "secondary" : "primary"}
            onClick={() => void onRun()}
            loading={running}
            loadingLabel="Solicitando…"
            disabled={!versionId}
          >
            {run ? "Reprocessar documento" : "Processar documento"}
          </Button>
          {!versionId ? (
            <span className="vj-meta">O documento ainda não possui arquivo disponível.</span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function ClassificationReview({
  orgId,
  documentId,
  classificationId,
  onChanged,
}: {
  orgId: string;
  documentId: string;
  classificationId: string;
  onChanged: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(reviewStatus: "reviewed" | "rejected") {
    setPending(true);
    setError(null);
    const result = await reviewDocumentProcessing(orgId, documentId, {
      target: "classification",
      targetId: classificationId,
      reviewStatus,
    });
    setPending(false);
    if (isApiFailure(result)) {
      setError(aiErrorMessage(result, "Não foi possível registrar a revisão."));
      return;
    }
    onChanged();
  }

  return (
    <div className="vj-stack">
      <div className="vj-form-actions">
        <Button variant="secondary" disabled={pending} onClick={() => void submit("reviewed")}>
          Marcar como revisada
        </Button>
        <Button variant="ghost" disabled={pending} onClick={() => void submit("rejected")}>
          Rejeitar sugestão
        </Button>
      </div>
      {error ? (
        <p role="alert" className="vj-field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Visualizador de texto extraído por página. Só renderiza quando existem páginas. */
export function DocumentPageViewer({
  orgId,
  documentId,
  versionId,
}: {
  orgId: string;
  documentId: string;
  versionId?: string | null;
}) {
  const selectId = useId();
  const [pages, setPages] = useState<DocumentPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const data = await fetchDocumentPages(orgId, documentId, versionId ?? undefined);
      if (cancelled) return;
      if (isApiFailure(data)) {
        // Rota ausente / sem páginas: o visualizador simplesmente não aparece.
        if (data.httpStatus !== 404)
          setError(aiErrorMessage(data, "Não foi possível carregar as páginas."));
        setLoading(false);
        return;
      }
      const sorted = [...data.pages].sort((a, b) => a.pageNumber - b.pageNumber);
      setPages(sorted);
      setCurrent(sorted[0]?.pageNumber ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, documentId, versionId]);

  const page = useMemo(
    () => pages.find((item) => item.pageNumber === current) ?? null,
    [pages, current],
  );
  const index = page ? pages.findIndex((item) => item.pageNumber === page.pageNumber) : -1;

  if (loading) return null;
  if (error) {
    return (
      <section className="vj-card vj-stack" aria-labelledby="doc-pages">
        <h2 id="doc-pages" className="vj-section-title">
          Texto extraído por página
        </h2>
        <Alert tone="warning" title="Páginas indisponíveis">
          {error}
        </Alert>
      </section>
    );
  }
  if (pages.length === 0 || !page) return null;

  return (
    <section className="vj-card vj-stack" aria-labelledby="doc-pages">
      <h2 id="doc-pages" className="vj-section-title">
        Texto extraído por página
      </h2>
      <p className="vj-meta">
        Texto obtido automaticamente do arquivo; pode conter falhas de leitura. Confira no documento
        original.
      </p>
      <div className="vj-inline-actions">
        <Button
          variant="secondary"
          disabled={index <= 0}
          onClick={() => setCurrent(pages[index - 1]?.pageNumber ?? current)}
        >
          Página anterior
        </Button>
        <label className="vj-visually-hidden" htmlFor={selectId}>
          Ir para a página
        </label>
        <Select
          id={selectId}
          value={String(page.pageNumber)}
          onChange={(event) => setCurrent(Number(event.target.value))}
        >
          {pages.map((item) => (
            <option key={item.id} value={item.pageNumber}>
              Página {item.pageNumber} de {pages.length}
            </option>
          ))}
        </Select>
        <Button
          variant="secondary"
          disabled={index >= pages.length - 1}
          onClick={() => setCurrent(pages[index + 1]?.pageNumber ?? current)}
        >
          Próxima página
        </Button>
      </div>
      <p className="vj-meta" aria-live="polite">
        Página {page.pageNumber} ·{" "}
        {EXTRACTION_METHOD_LABELS[page.extractionMethod] ?? page.extractionMethod} ·{" "}
        {formatNumber(page.charCount)} caracteres
        {page.confidence != null ? ` · ` : ""}
        {page.confidence != null ? <ModelConfidence value={page.confidence} /> : null}
      </p>
      <textarea
        className="vj-textarea vj-technical"
        readOnly
        rows={14}
        aria-label={`Texto extraído da página ${page.pageNumber}`}
        value={page.text.trim() ? page.text : "Nenhum texto foi extraído desta página."}
      />
    </section>
  );
}
