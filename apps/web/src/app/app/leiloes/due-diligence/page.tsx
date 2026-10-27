"use client";

import {
  Alert,
  Breadcrumb,
  Button,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  PageHeader,
  Select,
  Textarea,
} from "@verasjuris/ui";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import { AUCTION_TABS } from "../../../../components/auction-ui";
import {
  AUCTION_DUE_DILIGENCE_LABELS,
  auctionErrorMessage,
  fetchAuctions,
  getOrCreateDueDiligence,
  hasAuctionPermission,
  isApiFailure,
  updateDueDiligence,
  type AuctionDueDiligenceStatus,
  type AuctionSummary,
  type DueDiligenceItem,
} from "../../../../lib/auctions";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function DueDiligencePage() {
  return (
    <Suspense fallback={<LoadingState label="Carregando due diligence" />}>
      <DueDiligenceContent />
    </Suspense>
  );
}

function DueDiligenceContent() {
  const searchParams = useSearchParams();
  const presetAuctionId = searchParams.get("auctionId") ?? "";
  const org = useOrgContext();
  const canRead = hasAuctionPermission(org.permissions, "due_diligence.read");
  const canManage = hasAuctionPermission(org.permissions, "due_diligence.manage");
  const canList = hasAuctionPermission(org.permissions, "read");

  const [auctions, setAuctions] = useState<AuctionSummary[]>([]);
  const [auctionId, setAuctionId] = useState(presetAuctionId);
  const [lotId, setLotId] = useState("");
  const [items, setItems] = useState<DueDiligenceItem[]>([]);
  const [disclaimer, setDisclaimer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!org.ready) return;
    if (!org.orgId || !canList) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const data = await fetchAuctions(org.orgId!, { limit: 50 });
      if (cancelled) return;
      if (!isApiFailure(data)) {
        setAuctions(data.items);
        if (!auctionId && data.items[0]) setAuctionId(data.items[0].id);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, canList, auctionId]);

  const loadChecklist = useCallback(
    async (orgId: string, selectedAuctionId: string, selectedLotId?: string) => {
      setBusy(true);
      setError(null);
      setMsg(null);
      const data = await getOrCreateDueDiligence(orgId, {
        auctionId: selectedAuctionId,
        lotId: selectedLotId || undefined,
      });
      if (isApiFailure(data)) {
        setError(auctionErrorMessage(data, "Não foi possível carregar o checklist."));
        setItems([]);
      } else {
        setItems(data.items);
        setDisclaimer(data.disclaimer);
      }
      setBusy(false);
    },
    [],
  );

  useEffect(() => {
    if (!org.ready || !org.orgId || !canRead || !auctionId) return;
    void loadChecklist(org.orgId, auctionId, lotId || undefined);
  }, [org.ready, org.orgId, canRead, auctionId, lotId, loadChecklist]);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Leilões", href: "/app/leiloes" },
    { label: "Due diligence" },
  ];

  async function onUpdateItem(
    item: DueDiligenceItem,
    patch: { status?: AuctionDueDiligenceStatus; notes?: string },
  ) {
    if (!org.orgId || !canManage) return;
    setBusy(true);
    setMsg(null);
    const data = await updateDueDiligence(org.orgId, item.id, patch);
    if (isApiFailure(data)) {
      setMsg(auctionErrorMessage(data, "Não foi possível atualizar o item."));
    } else {
      setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, ...data.item } : row)));
      setMsg("Item atualizado.");
    }
    setBusy(false);
  }

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>
          Você não tem permissão para consultar o checklist de due diligence.
        </NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Due diligence assistiva"
        description="Checklist para organizar a verificação de documentos e riscos. Não constitui parecer jurídico nem recomendação de compra."
      />
      <SectionTabs
        label="Seções de leilões"
        items={AUCTION_TABS}
        current="/app/leiloes/due-diligence"
      />

      <Alert tone="info" title="ANÁLISE · Apoio assistivo">
        {disclaimer ??
          "Checklist assistivo para organização da verificação. A conclusão jurídica é sempre humana."}
      </Alert>

      {loading || !org.ready ? <LoadingState label="Carregando" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {msg ? (
        <Alert tone="info" title="Atualização">
          {msg}
        </Alert>
      ) : null}

      <form
        className="vj-card vj-stack"
        aria-label="Seleção de leilão"
        onSubmit={(event) => {
          event.preventDefault();
          if (org.orgId && auctionId) void loadChecklist(org.orgId, auctionId, lotId || undefined);
        }}
      >
        <FormField id="dd-auction" label="Leilão">
          <Select
            id="dd-auction"
            value={auctionId}
            onChange={(event) => setAuctionId(event.target.value)}
          >
            <option value="">Selecione</option>
            {auctions.map((auction) => (
              <option key={auction.id} value={auction.id}>
                {auction.title}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="dd-lot" label="Lote (UUID opcional)">
          <Input
            id="dd-lot"
            value={lotId}
            onChange={(event) => setLotId(event.target.value)}
            autoComplete="off"
            placeholder="Deixe em branco para o leilão inteiro"
          />
        </FormField>
        <Button type="submit" variant="secondary" disabled={!auctionId || busy}>
          Carregar checklist
        </Button>
      </form>

      {!auctionId && !loading ? (
        <EmptyState title="Selecione um leilão">
          Escolha um leilão cadastrado para abrir o checklist. Nenhum item fictício é pré-carregado
          sem leilão.
        </EmptyState>
      ) : null}

      {auctionId && items.length === 0 && !busy && !error ? (
        <EmptyState title="Checklist vazio">
          Ainda não há itens para este leilão, ou a criação automática não está disponível no seu
          perfil.
        </EmptyState>
      ) : null}

      {items.length > 0 ? (
        <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {items.map((item) => (
            <li key={item.id} className="vj-card vj-stack">
              <div className="vj-header-actions">
                <h3 className="vj-section-title">{item.label}</h3>
                <span className="vj-meta">{item.category ?? "Geral"}</span>
              </div>
              {canManage ? (
                <>
                  <FormField id={`dd-status-${item.id}`} label="Situação">
                    <Select
                      id={`dd-status-${item.id}`}
                      value={item.status}
                      disabled={busy}
                      onChange={(event) =>
                        void onUpdateItem(item, {
                          status: event.target.value as AuctionDueDiligenceStatus,
                        })
                      }
                    >
                      {Object.entries(AUCTION_DUE_DILIGENCE_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField id={`dd-notes-${item.id}`} label="Notas">
                    <Textarea
                      id={`dd-notes-${item.id}`}
                      defaultValue={item.notes ?? ""}
                      rows={2}
                      onBlur={(event) => {
                        const value = event.target.value;
                        if (value !== (item.notes ?? "")) {
                          void onUpdateItem(item, { notes: value });
                        }
                      }}
                    />
                  </FormField>
                </>
              ) : (
                <>
                  <p className="vj-meta">
                    {AUCTION_DUE_DILIGENCE_LABELS[
                      item.status as keyof typeof AUCTION_DUE_DILIGENCE_LABELS
                    ] ?? item.status}
                  </p>
                  {item.notes ? <p className="vj-prose">{item.notes}</p> : null}
                </>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
