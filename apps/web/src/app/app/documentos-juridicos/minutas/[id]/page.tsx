"use client";

import {
  Alert,
  Breadcrumb,
  Button,
  ButtonLink,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  PageHeader,
  Select,
  Textarea,
} from "@verasjuris/ui";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  AssistedNotice,
  NoPermission,
  NotConfiguredNotice,
  SectionTabs,
} from "../../../../../components/ai-ui";
import {
  ChecklistPanel,
  DraftHistoryList,
  DraftStatusBadge,
  DraftWorkflowMilestones,
} from "../../../../../components/legal-draft-ui";
import { DOCUMENTOS_JURIDICOS_TABS } from "../../../../../components/legal-template-ui";
import { LayerTag } from "../../../../../components/legal-review-ui";
import {
  aiAssistLegalDraft,
  aiErrorMessage,
  approveLegalDraft,
  confirmLegalDraftFiling,
  convertLegalDraftToDocument,
  draftDocumentTypeLabel,
  exportLegalDraft,
  fetchLegalDraft,
  fileLegalDraft,
  formatDateTime,
  hasLegalDraftPermission,
  isApiFailure,
  isNotConfigured,
  markLegalDraftReadyToFile,
  submitLegalDraftForReview,
  updateLegalDraft,
  updateLegalDraftChecklistItem,
  type LegalDraftChecklistItem,
  type LegalDraftDetail,
} from "../../../../../lib/legal-drafts";
import { useOrgContext } from "../../../../../lib/use-org-context";

export default function MinutaDetailPage() {
  const params = useParams<{ id: string }>();
  const draftId = params.id;
  const org = useOrgContext();

  const canRead = hasLegalDraftPermission(org.permissions, "read");
  const canUpdate = hasLegalDraftPermission(org.permissions, "update");
  const canAi = hasLegalDraftPermission(org.permissions, "ai_assist");
  const canReview = hasLegalDraftPermission(org.permissions, "review");
  const canApprove = hasLegalDraftPermission(org.permissions, "approve");
  const canReady = hasLegalDraftPermission(org.permissions, "ready_to_file");
  const canFile = hasLegalDraftPermission(org.permissions, "file");
  const canConfirm = hasLegalDraftPermission(org.permissions, "confirm");

  const [detail, setDetail] = useState<LegalDraftDetail | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [aiInstructions, setAiInstructions] = useState("");
  const [reviewReason, setReviewReason] = useState("");
  const [protocolNumber, setProtocolNumber] = useState("");
  const [filingNotes, setFilingNotes] = useState("");
  const [confirmEvidenceId, setConfirmEvidenceId] = useState("");
  const [exportFormat, setExportFormat] = useState<"html" | "pdf" | "docx">("html");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checklistPending, setChecklistPending] = useState<string | null>(null);
  const [exportResult, setExportResult] = useState<string | null>(null);
  const [convertedDocId, setConvertedDocId] = useState<string | null>(null);

  const load = useCallback(
    async (orgId: string) => {
      setLoading(true);
      setError(null);
      const data = await fetchLegalDraft(orgId, draftId);
      if (isApiFailure(data)) {
        setError(aiErrorMessage(data, "Não foi possível carregar a minuta."));
        setDetail(null);
      } else {
        setDetail(data);
        setTitle(data.draft.title);
        setContent(data.draft.content ?? "");
        setProtocolNumber(data.draft.protocolNumber ?? "");
      }
      setLoading(false);
    },
    [draftId],
  );

  useEffect(() => {
    if (!org.ready) return;
    if (!org.orgId || !canRead) {
      setLoading(false);
      return;
    }
    void load(org.orgId);
  }, [org.ready, org.orgId, canRead, load]);

  const draft = detail?.draft;
  const checklistItems = detail?.checklists.flatMap((checklist) => checklist.items) ?? [];

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Documentos jurídicos", href: "/app/documentos-juridicos" },
    { label: "Minutas", href: "/app/documentos-juridicos/minutas" },
    { label: draft?.title ?? "Minuta" },
  ];

  async function saveContent() {
    if (!org.orgId || !draft || !canUpdate) return;
    setBusy(true);
    setActionError(null);
    const data = await updateLegalDraft(org.orgId, draft.id, {
      title: title.trim(),
      content,
    });
    if (isApiFailure(data)) {
      setActionError(aiErrorMessage(data, "Não foi possível salvar."));
    } else {
      await load(org.orgId);
    }
    setBusy(false);
  }

  async function onAiAssist() {
    if (!org.orgId || !draft || !canAi) return;
    setBusy(true);
    setActionError(null);
    setNotConfigured(false);
    const data = await aiAssistLegalDraft(org.orgId, draft.id, {
      instructions: aiInstructions.trim() || undefined,
      idempotencyKey: `draft-ai-${crypto.randomUUID()}`,
    });
    if (isApiFailure(data)) {
      if (isNotConfigured(data)) setNotConfigured(true);
      else setActionError(aiErrorMessage(data, "Não foi possível solicitar assistência de IA."));
    } else {
      await load(org.orgId);
    }
    setBusy(false);
  }

  async function onReview() {
    if (!org.orgId || !draft || !canReview) return;
    setBusy(true);
    setActionError(null);
    const data = await submitLegalDraftForReview(org.orgId, draft.id, {
      reason: reviewReason.trim() || undefined,
    });
    if (isApiFailure(data)) {
      setActionError(aiErrorMessage(data, "Não foi possível enviar para revisão."));
    } else {
      await load(org.orgId);
    }
    setBusy(false);
  }

  async function onApprove() {
    if (!org.orgId || !draft || !canApprove) return;
    setBusy(true);
    setActionError(null);
    const data = await approveLegalDraft(org.orgId, draft.id, {
      reason: reviewReason.trim() || undefined,
    });
    if (isApiFailure(data)) {
      setActionError(aiErrorMessage(data, "Não foi possível aprovar."));
    } else {
      await load(org.orgId);
    }
    setBusy(false);
  }

  async function onReady() {
    if (!org.orgId || !draft || !canReady) return;
    setBusy(true);
    setActionError(null);
    const data = await markLegalDraftReadyToFile(org.orgId, draft.id, {
      reason: reviewReason.trim() || undefined,
    });
    if (isApiFailure(data)) {
      setActionError(aiErrorMessage(data, "Não foi possível marcar como pronta."));
    } else {
      await load(org.orgId);
    }
    setBusy(false);
  }

  async function onFile() {
    if (!org.orgId || !draft || !canFile) return;
    setBusy(true);
    setActionError(null);
    const data = await fileLegalDraft(org.orgId, draft.id, {
      filedAt: new Date().toISOString(),
      filingMethod: "manual",
      protocolNumber: protocolNumber.trim() || undefined,
      filingNotes: filingNotes.trim() || undefined,
    });
    if (isApiFailure(data)) {
      setActionError(aiErrorMessage(data, "Não foi possível registrar o protocolo."));
    } else {
      await load(org.orgId);
    }
    setBusy(false);
  }

  async function onConfirm() {
    if (!org.orgId || !draft || !canConfirm) return;
    if (!confirmEvidenceId.trim()) {
      setActionError("Informe o ID do documento de evidência da confirmação.");
      return;
    }
    setBusy(true);
    setActionError(null);
    const data = await confirmLegalDraftFiling(org.orgId, draft.id, {
      confirmationMethod: "manual",
      confirmationEvidenceDocumentId: confirmEvidenceId.trim(),
      notes: filingNotes.trim() || undefined,
    });
    if (isApiFailure(data)) {
      setActionError(aiErrorMessage(data, "Não foi possível confirmar o protocolo."));
    } else {
      await load(org.orgId);
    }
    setBusy(false);
  }

  async function onConvert() {
    if (!org.orgId || !draft) return;
    setBusy(true);
    setActionError(null);
    const data = await convertLegalDraftToDocument(org.orgId, draft.id, { format: "html" });
    if (isApiFailure(data)) {
      setActionError(aiErrorMessage(data, "Não foi possível converter em documento."));
    } else {
      setConvertedDocId(typeof data.document?.id === "string" ? data.document.id : null);
      await load(org.orgId);
    }
    setBusy(false);
  }

  async function onExport() {
    if (!org.orgId || !draft) return;
    setBusy(true);
    setActionError(null);
    const data = await exportLegalDraft(org.orgId, draft.id, exportFormat);
    if (isApiFailure(data)) {
      setActionError(aiErrorMessage(data, "Não foi possível exportar."));
      setExportResult(null);
    } else {
      setExportResult(
        typeof data.content === "string"
          ? data.content.slice(0, 4000)
          : JSON.stringify(data, null, 2).slice(0, 4000),
      );
    }
    setBusy(false);
  }

  async function onChecklistToggle(item: LegalDraftChecklistItem, status: "done" | "pending") {
    if (!org.orgId || !draft || !canUpdate) return;
    setChecklistPending(item.id);
    const data = await updateLegalDraftChecklistItem(org.orgId, draft.id, item.id, { status });
    if (isApiFailure(data)) {
      setActionError(aiErrorMessage(data, "Não foi possível atualizar o checklist."));
    } else {
      await load(org.orgId);
    }
    setChecklistPending(null);
  }

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar esta minuta.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title={draft?.title ?? "Minuta"}
        description="Editor, fontes, checklist e ações de workflow. Protocolo e confirmação são sempre manuais."
        actions={
          draft?.legalMatterId ? (
            <ButtonLink href={`/app/casos/${draft.legalMatterId}`} variant="secondary">
              Abrir caso
            </ButtonLink>
          ) : null
        }
      />
      <SectionTabs
        label="Seções de documentos jurídicos"
        items={DOCUMENTOS_JURIDICOS_TABS}
        current="/app/documentos-juridicos/minutas"
      />

      {loading || !org.ready ? <LoadingState label="Carregando minuta" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {actionError ? <ErrorState title="Ação">{actionError}</ErrorState> : null}
      {notConfigured ? <NotConfiguredNotice /> : null}

      {draft && detail ? (
        <>
          <div className="vj-inline-actions">
            <DraftStatusBadge status={draft.status} />
            <span className="vj-meta">{draftDocumentTypeLabel(draft.documentType)}</span>
            <span className="vj-meta">
              Atualizada {formatDateTime(draft.updatedAt ?? draft.createdAt)}
            </span>
          </div>

          <DraftWorkflowMilestones status={draft.status} />

          <section className="vj-card vj-stack" aria-labelledby="draft-editor">
            <h2 id="draft-editor" className="vj-section-title">
              Conteúdo
            </h2>
            <LayerTag layer="FONTE" />
            {(detail.missingVariables?.length ?? 0) > 0 ? (
              <Alert tone="warning" title="Variáveis ausentes">
                {detail.missingVariables!.join(", ")}
              </Alert>
            ) : null}
            {canUpdate ? (
              <>
                <FormField id="draft-title" label="Título">
                  <Input
                    id="draft-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </FormField>
                <FormField id="draft-content" label="Texto da minuta">
                  <Textarea
                    id="draft-content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={16}
                  />
                </FormField>
                <Button
                  type="button"
                  variant="primary"
                  disabled={busy}
                  onClick={() => void saveContent()}
                >
                  Salvar conteúdo
                </Button>
              </>
            ) : (
              <pre className="vj-prose" style={{ whiteSpace: "pre-wrap" }}>
                {draft.content || "Sem conteúdo."}
              </pre>
            )}
          </section>

          <section className="vj-card vj-stack" aria-labelledby="draft-sources">
            <h2 id="draft-sources" className="vj-section-title">
              Fontes
            </h2>
            <LayerTag layer="FONTE" />
            {!detail.sourceSet || !detail.sourceSet.items?.length ? (
              <p className="vj-meta">Nenhum conjunto de fontes vinculado.</p>
            ) : (
              <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {detail.sourceSet.items.map((item) => (
                  <li key={item.id}>
                    <strong>{item.itemType}</strong>
                    <div className="vj-meta">
                      {item.documentId
                        ? `Documento ${item.documentId.slice(0, 8)}`
                        : item.instructionText?.slice(0, 120) || "—"}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="vj-card vj-stack" aria-labelledby="draft-checklist">
            <h2 id="draft-checklist" className="vj-section-title">
              Checklist
            </h2>
            <LayerTag layer="AÇÃO" />
            <ChecklistPanel
              items={checklistItems}
              canUpdate={canUpdate}
              pending={checklistPending}
              onToggle={(item, status) => void onChecklistToggle(item, status)}
            />
          </section>

          {canAi ? (
            <section className="vj-card vj-stack" aria-labelledby="draft-ai">
              <h2 id="draft-ai" className="vj-section-title">
                Assistência de IA
              </h2>
              <LayerTag layer="ANÁLISE" />
              <AssistedNotice />
              <FormField id="draft-ai-instructions" label="Instruções (opcional)">
                <Textarea
                  id="draft-ai-instructions"
                  value={aiInstructions}
                  onChange={(e) => setAiInstructions(e.target.value)}
                  rows={3}
                />
              </FormField>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => void onAiAssist()}
              >
                Solicitar assistência
              </Button>
            </section>
          ) : null}

          <section className="vj-card vj-stack" aria-labelledby="draft-workflow">
            <h2 id="draft-workflow" className="vj-section-title">
              Workflow
            </h2>
            <LayerTag layer="AÇÃO" />
            <FormField id="draft-reason" label="Motivo / comentário (opcional)">
              <Textarea
                id="draft-reason"
                value={reviewReason}
                onChange={(e) => setReviewReason(e.target.value)}
                rows={2}
              />
            </FormField>
            <div className="vj-inline-actions">
              {canReview ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void onReview()}
                >
                  Enviar para revisão (humano)
                </Button>
              ) : null}
              {canApprove ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void onApprove()}
                >
                  Aprovar
                </Button>
              ) : null}
              {canReady ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void onReady()}
                >
                  Pronta para protocolo
                </Button>
              ) : null}
            </div>

            {canFile ? (
              <div className="vj-stack">
                <h3 className="vj-section-title">Protocolo manual</h3>
                <Alert tone="info" title="AÇÃO · Protocolo manual">
                  O VerasJuris registra o protocolo informado. Não há protocolo eletrônico
                  automático.
                </Alert>
                <FormField id="draft-protocol" label="Número do protocolo">
                  <Input
                    id="draft-protocol"
                    value={protocolNumber}
                    onChange={(e) => setProtocolNumber(e.target.value)}
                  />
                </FormField>
                <FormField id="draft-filing-notes" label="Observações">
                  <Textarea
                    id="draft-filing-notes"
                    value={filingNotes}
                    onChange={(e) => setFilingNotes(e.target.value)}
                    rows={2}
                  />
                </FormField>
                <Button
                  type="button"
                  variant="primary"
                  disabled={busy}
                  onClick={() => void onFile()}
                >
                  Registrar protocolo
                </Button>
              </div>
            ) : null}

            {canConfirm ? (
              <div className="vj-stack">
                <h3 className="vj-section-title">Confirmação</h3>
                <FormField id="draft-confirm-evidence" label="ID do documento de evidência">
                  <Input
                    id="draft-confirm-evidence"
                    value={confirmEvidenceId}
                    onChange={(e) => setConfirmEvidenceId(e.target.value)}
                    className="vj-technical"
                  />
                </FormField>
                <Button
                  type="button"
                  variant="primary"
                  disabled={busy}
                  onClick={() => void onConfirm()}
                >
                  Confirmar protocolo
                </Button>
              </div>
            ) : null}
          </section>

          <section className="vj-card vj-stack" aria-labelledby="draft-export">
            <h2 id="draft-export" className="vj-section-title">
              Documento e exportação
            </h2>
            <div className="vj-inline-actions">
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => void onConvert()}
              >
                Converter em documento
              </Button>
              <FormField id="draft-export-format" label="Formato">
                <Select
                  id="draft-export-format"
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as "html" | "pdf" | "docx")}
                >
                  <option value="html">HTML</option>
                  <option value="pdf">PDF</option>
                  <option value="docx">DOCX</option>
                </Select>
              </FormField>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => void onExport()}
              >
                Exportar
              </Button>
            </div>
            {convertedDocId ? (
              <p className="vj-meta">
                Documento criado:{" "}
                <a href={`/app/documentos/${convertedDocId}`}>{convertedDocId.slice(0, 8)}</a>
              </p>
            ) : null}
            {draft.currentDocumentId ? (
              <p className="vj-meta">
                Documento vinculado:{" "}
                <a href={`/app/documentos/${draft.currentDocumentId}`}>
                  {draft.currentDocumentId.slice(0, 8)}
                </a>
              </p>
            ) : null}
            {exportResult ? (
              <pre
                className="vj-prose"
                style={{ whiteSpace: "pre-wrap", maxHeight: "16rem", overflow: "auto" }}
              >
                {exportResult}
              </pre>
            ) : null}
          </section>

          <section className="vj-card vj-stack" aria-labelledby="draft-history">
            <h2 id="draft-history" className="vj-section-title">
              Histórico
            </h2>
            <DraftHistoryList items={detail.history} />
          </section>
        </>
      ) : null}
    </div>
  );
}
