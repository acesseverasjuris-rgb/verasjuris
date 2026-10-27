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
  NoPermission,
  NotConfiguredNotice,
  SectionTabs,
} from "../../../../../../../components/ai-ui";
import {
  AwardsList,
  BidsList,
  DeliveriesList,
  ManualDisclaimer,
  PaymentsList,
  PostSectionNav,
  RegularizationList,
  ResultsList,
  TimelineList,
  TransfersList,
} from "../../../../../../../components/auction-post-ui";
import { AUCTION_TABS } from "../../../../../../../components/auction-ui";
import { LayerTag } from "../../../../../../../components/legal-review-ui";
import {
  LIVE_BID_NOT_CONFIGURED_MESSAGE,
  auctionPostErrorMessage,
  createAward,
  createBidRecord,
  createDelivery,
  createParticipation,
  createPayment,
  createResult,
  createTransfer,
  fetchAwardDocuments,
  fetchAwardEvents,
  fetchAwardTimeline,
  fetchAwards,
  fetchBidRecords,
  fetchDeliveries,
  fetchParticipations,
  fetchPayments,
  fetchRegularization,
  fetchResults,
  fetchTransfers,
  hasAuctionPostPermission,
  isApiFailure,
  isNotConfigured,
  parseMoneyToCents,
  placeLiveBid,
  suggestAwardDeadlines,
  suggestAwardTasks,
  upsertRegularizationItem,
  type AuctionAward,
  type AuctionAwardDocument,
  type AuctionAwardEvent,
  type AuctionAwardTimelineItem,
  type AuctionBidRecord,
  type AuctionDelivery,
  type AuctionParticipation,
  type AuctionPayment,
  type AuctionRegularizationItem,
  type AuctionResult,
  type AuctionTransfer,
} from "../../../../../../../lib/auction-post";
import {
  fetchLot,
  hasAuctionPermission,
  type AuctionLotDetail,
} from "../../../../../../../lib/auctions";
import { useOrgContext } from "../../../../../../../lib/use-org-context";

export default function PosLeilaoPage() {
  const params = useParams<{ auctionId: string; lotId: string }>();
  const { auctionId, lotId } = params;
  const org = useOrgContext();

  const canAuctionRead = hasAuctionPermission(org.permissions, "read");
  const canPostRead = hasAuctionPostPermission(org.permissions, "read");
  const canManage = hasAuctionPostPermission(org.permissions, "manage");
  const canRead = canAuctionRead && canPostRead;

  const [lot, setLot] = useState<AuctionLotDetail | null>(null);
  const [participations, setParticipations] = useState<AuctionParticipation[]>([]);
  const [bids, setBids] = useState<AuctionBidRecord[]>([]);
  const [results, setResults] = useState<AuctionResult[]>([]);
  const [awards, setAwards] = useState<AuctionAward[]>([]);
  const [payments, setPayments] = useState<AuctionPayment[]>([]);
  const [deliveries, setDeliveries] = useState<AuctionDelivery[]>([]);
  const [transfers, setTransfers] = useState<AuctionTransfer[]>([]);
  const [regularization, setRegularization] = useState<AuctionRegularizationItem[]>([]);
  const [documents, setDocuments] = useState<AuctionAwardDocument[]>([]);
  const [events, setEvents] = useState<AuctionAwardEvent[]>([]);
  const [timeline, setTimeline] = useState<AuctionAwardTimelineItem[]>([]);
  const [activeAwardId, setActiveAwardId] = useState<string | null>(null);

  const [bidAmount, setBidAmount] = useState("");
  const [resultStatus, setResultStatus] = useState("sold");
  const [resultAmount, setResultAmount] = useState("");
  const [awardAmount, setAwardAmount] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentType, setPaymentType] = useState("bid_price");
  const [regKey, setRegKey] = useState("itbi");
  const [regLabel, setRegLabel] = useState("ITBI");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [suggestNote, setSuggestNote] = useState<string | null>(null);

  const loadAwardExtras = useCallback(async (orgId: string, awardId: string) => {
    const [pay, del, tr, reg, docs, ev, tl] = await Promise.all([
      fetchPayments(orgId, awardId),
      fetchDeliveries(orgId, awardId),
      fetchTransfers(orgId, awardId),
      fetchRegularization(orgId, awardId),
      fetchAwardDocuments(orgId, awardId),
      fetchAwardEvents(orgId, awardId),
      fetchAwardTimeline(orgId, awardId),
    ]);
    if (!isApiFailure(pay)) setPayments(pay.items);
    if (!isApiFailure(del)) setDeliveries(del.items);
    if (!isApiFailure(tr)) setTransfers(tr.items);
    if (!isApiFailure(reg)) setRegularization(reg.items);
    if (!isApiFailure(docs)) setDocuments(docs.items);
    if (!isApiFailure(ev)) setEvents(ev.items);
    if (!isApiFailure(tl)) setTimeline(tl.items);
  }, []);

  const load = useCallback(
    async (orgId: string) => {
      setLoading(true);
      setError(null);
      const [lotData, partData, bidData, resultData, awardData] = await Promise.all([
        fetchLot(orgId, lotId),
        fetchParticipations(orgId, { auctionId, lotId, limit: 50 }),
        fetchBidRecords(orgId, { auctionId, lotId, limit: 50 }),
        fetchResults(orgId, { auctionId, lotId, limit: 50 }),
        fetchAwards(orgId, { auctionId, lotId, limit: 50 }),
      ]);
      if (isApiFailure(lotData)) {
        setError(auctionPostErrorMessage(lotData, "Não foi possível carregar o lote."));
      } else {
        setLot(lotData.lot);
      }
      if (!isApiFailure(partData)) setParticipations(partData.items);
      if (!isApiFailure(bidData)) setBids(bidData.items);
      if (!isApiFailure(resultData)) setResults(resultData.items);
      if (!isApiFailure(awardData)) {
        setAwards(awardData.items);
        const first = awardData.items[0]?.id ?? null;
        setActiveAwardId(first);
        if (first) await loadAwardExtras(orgId, first);
      }
      setLoading(false);
    },
    [auctionId, lotId, loadAwardExtras],
  );

  useEffect(() => {
    if (!org.ready) return;
    if (!org.orgId || !canRead) {
      setLoading(false);
      return;
    }
    void load(org.orgId);
  }, [org.ready, org.orgId, canRead, load]);

  useEffect(() => {
    if (!org.orgId || !activeAwardId) return;
    void loadAwardExtras(org.orgId, activeAwardId);
  }, [org.orgId, activeAwardId, loadAwardExtras]);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Leilões", href: "/app/leiloes" },
    { label: "Leilão", href: `/app/leiloes/${auctionId}` },
    {
      label: lot ? `Lote ${lot.lotNumber}` : "Lote",
      href: `/app/leiloes/${auctionId}/lotes/${lotId}`,
    },
    { label: "Pós-leilão" },
  ];

  async function ensureParticipation(): Promise<string | null> {
    if (!org.orgId) return null;
    if (participations[0]) return participations[0].id;
    const data = await createParticipation(org.orgId, {
      auctionId,
      lotId,
      status: "interested",
      notes: notes.trim() || undefined,
    });
    if (isApiFailure(data)) {
      setActionError(auctionPostErrorMessage(data, "Não foi possível criar a participação."));
      return null;
    }
    setParticipations([data.participation, ...participations]);
    return data.participation.id;
  }

  async function onManualBid(event: React.FormEvent) {
    event.preventDefault();
    if (!org.orgId || !canManage) return;
    const cents = parseMoneyToCents(bidAmount);
    if (cents == null) {
      setActionError("Informe um valor de lance válido.");
      return;
    }
    setBusy(true);
    setActionError(null);
    const participationId = await ensureParticipation();
    if (!participationId) {
      setBusy(false);
      return;
    }
    const data = await createBidRecord(org.orgId, {
      participationId,
      amountCents: cents,
      source: "manual",
      notes: notes.trim() || undefined,
    });
    if (isApiFailure(data)) {
      setActionError(auctionPostErrorMessage(data, "Não foi possível registrar o lance."));
    } else {
      setBidAmount("");
      await load(org.orgId);
    }
    setBusy(false);
  }

  async function onLiveBid() {
    if (!org.orgId) return;
    setBusy(true);
    setNotConfigured(false);
    setActionError(null);
    const data = await placeLiveBid(org.orgId);
    if (isApiFailure(data) || isNotConfigured(data)) {
      setNotConfigured(true);
    } else {
      setActionError("Resposta inesperada do lance eletrônico.");
    }
    setBusy(false);
  }

  async function onResult(event: React.FormEvent) {
    event.preventDefault();
    if (!org.orgId || !canManage) return;
    setBusy(true);
    setActionError(null);
    const cents = resultAmount.trim() ? parseMoneyToCents(resultAmount) : undefined;
    if (resultAmount.trim() && cents == null) {
      setActionError("Valor do resultado inválido.");
      setBusy(false);
      return;
    }
    const data = await createResult(org.orgId, {
      auctionId,
      lotId,
      status: resultStatus,
      winningBidCents: cents ?? undefined,
      source: "manual",
      notes: notes.trim() || undefined,
    });
    if (isApiFailure(data)) {
      setActionError(auctionPostErrorMessage(data, "Não foi possível registrar o resultado."));
    } else {
      setResultAmount("");
      await load(org.orgId);
    }
    setBusy(false);
  }

  async function onAward(event: React.FormEvent) {
    event.preventDefault();
    if (!org.orgId || !canManage) return;
    const cents = parseMoneyToCents(awardAmount) ?? 0;
    setBusy(true);
    setActionError(null);
    const data = await createAward(org.orgId, {
      auctionId,
      lotId,
      participationId: participations[0]?.id,
      resultId: results[0]?.id,
      winningBidCents: cents,
      totalKnownCostCents: cents,
      source: "manual",
      notes: notes.trim() || undefined,
    });
    if (isApiFailure(data)) {
      setActionError(auctionPostErrorMessage(data, "Não foi possível registrar a arrematação."));
    } else {
      setAwardAmount("");
      setActiveAwardId(data.award.id);
      await load(org.orgId);
    }
    setBusy(false);
  }

  async function onPayment(event: React.FormEvent) {
    event.preventDefault();
    if (!org.orgId || !canManage || !activeAwardId) return;
    const cents = parseMoneyToCents(paymentAmount);
    if (cents == null) {
      setActionError("Informe um valor de pagamento válido.");
      return;
    }
    setBusy(true);
    setActionError(null);
    const data = await createPayment(org.orgId, activeAwardId, {
      paymentType,
      amountCents: cents,
      notes: notes.trim() || undefined,
    });
    if (isApiFailure(data)) {
      setActionError(auctionPostErrorMessage(data, "Não foi possível registrar o pagamento."));
    } else {
      setPaymentAmount("");
      await loadAwardExtras(org.orgId, activeAwardId);
    }
    setBusy(false);
  }

  async function onDelivery() {
    if (!org.orgId || !canManage || !activeAwardId) return;
    setBusy(true);
    setActionError(null);
    const data = await createDelivery(org.orgId, activeAwardId, {
      deliveryType: "possession",
      status: "pending",
      possessionStatus: "pending",
      notes: notes.trim() || undefined,
    });
    if (isApiFailure(data)) {
      setActionError(auctionPostErrorMessage(data, "Não foi possível registrar a posse."));
    } else {
      await loadAwardExtras(org.orgId, activeAwardId);
    }
    setBusy(false);
  }

  async function onTransfer() {
    if (!org.orgId || !canManage || !activeAwardId) return;
    setBusy(true);
    setActionError(null);
    const data = await createTransfer(org.orgId, activeAwardId, {
      transferType: "real_estate_registration",
      status: "pending",
      notes: notes.trim() || undefined,
    });
    if (isApiFailure(data)) {
      setActionError(auctionPostErrorMessage(data, "Não foi possível registrar a transferência."));
    } else {
      await loadAwardExtras(org.orgId, activeAwardId);
    }
    setBusy(false);
  }

  async function onRegularization(event: React.FormEvent) {
    event.preventDefault();
    if (!org.orgId || !canManage || !activeAwardId) return;
    setBusy(true);
    setActionError(null);
    const data = await upsertRegularizationItem(org.orgId, activeAwardId, {
      itemKey: regKey.trim(),
      label: regLabel.trim(),
      status: "pending",
      required: true,
      notes: notes.trim() || undefined,
    });
    if (isApiFailure(data)) {
      setActionError(auctionPostErrorMessage(data, "Não foi possível salvar a regularização."));
    } else {
      await loadAwardExtras(org.orgId, activeAwardId);
    }
    setBusy(false);
  }

  async function onSuggestTasks() {
    if (!org.orgId || !canManage || !activeAwardId) return;
    setBusy(true);
    setActionError(null);
    const data = await suggestAwardTasks(org.orgId, activeAwardId);
    if (isApiFailure(data)) {
      setActionError(auctionPostErrorMessage(data, "Não foi possível sugerir tarefas."));
      setSuggestNote(null);
    } else {
      setSuggestNote(data.note ?? "Sugestões de tarefas criadas sob demanda humana.");
    }
    setBusy(false);
  }

  async function onSuggestDeadlines() {
    if (!org.orgId || !canManage || !activeAwardId) return;
    setBusy(true);
    setActionError(null);
    const data = await suggestAwardDeadlines(org.orgId, activeAwardId, {
      baseDate: new Date().toISOString(),
    });
    if (isApiFailure(data)) {
      setActionError(auctionPostErrorMessage(data, "Não foi possível sugerir prazos."));
      setSuggestNote(null);
    } else {
      setSuggestNote(data.note ?? "Sugestões de prazos criadas sob demanda humana.");
    }
    setBusy(false);
  }

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar o pós-leilão deste lote.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title={lot ? `Pós-leilão — Lote ${lot.lotNumber}` : "Pós-leilão"}
        description="Resumo, resultado, arrematação, pagamentos, documentos, posse, transferência, regularização, tarefas, prazos e histórico. Lances eletrônicos não estão disponíveis."
        actions={
          <ButtonLink href={`/app/leiloes/${auctionId}/lotes/${lotId}`} variant="secondary">
            Voltar ao lote
          </ButtonLink>
        }
      />
      <SectionTabs label="Seções de leilões" items={AUCTION_TABS} current="/app/leiloes" />
      <PostSectionNav />

      {loading || !org.ready ? <LoadingState label="Carregando pós-leilão" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {actionError ? <ErrorState title="Ação">{actionError}</ErrorState> : null}
      {notConfigured ? (
        <NotConfiguredNotice message={LIVE_BID_NOT_CONFIGURED_MESSAGE}>
          Use o formulário de lance manual abaixo. Nenhuma operação eletrônica foi iniciada.
        </NotConfiguredNotice>
      ) : null}

      <FormField id="pos-notes" label="Observações gerais (opcional)">
        <Textarea
          id="pos-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </FormField>

      <section id="resumo" className="vj-card vj-stack" aria-labelledby="pos-resumo">
        <h2 id="pos-resumo" className="vj-section-title">
          Resumo
        </h2>
        <LayerTag layer="FONTE" />
        <p className="vj-meta">
          Participações: {participations.length} · Lances: {bids.length} · Resultados:{" "}
          {results.length} · Arrematações: {awards.length}
        </p>
        {awards.length > 1 ? (
          <FormField id="pos-award-select" label="Arrematação ativa">
            <Select
              id="pos-award-select"
              value={activeAwardId ?? ""}
              onChange={(e) => setActiveAwardId(e.target.value || null)}
            >
              {awards.map((award) => (
                <option key={award.id} value={award.id}>
                  {award.id.slice(0, 8)} · {award.awardStatus}
                </option>
              ))}
            </Select>
          </FormField>
        ) : null}
      </section>

      <section id="resultado" className="vj-card vj-stack" aria-labelledby="pos-resultado">
        <h2 id="pos-resultado" className="vj-section-title">
          Resultado
        </h2>
        <ManualDisclaimer kind="result" />
        <ResultsList items={results} />
        {canManage ? (
          <form className="vj-stack" onSubmit={(e) => void onResult(e)}>
            <div className="vj-split">
              <FormField id="pos-result-status" label="Situação">
                <Select
                  id="pos-result-status"
                  value={resultStatus}
                  onChange={(e) => setResultStatus(e.target.value)}
                >
                  <option value="sold">Vendido / arrematado</option>
                  <option value="unsold">Não vendido</option>
                  <option value="pending">Pendente</option>
                  <option value="cancelled">Cancelado</option>
                </Select>
              </FormField>
              <FormField id="pos-result-amount" label="Lance vencedor (R$)">
                <Input
                  id="pos-result-amount"
                  value={resultAmount}
                  onChange={(e) => setResultAmount(e.target.value)}
                  inputMode="decimal"
                />
              </FormField>
            </div>
            <Button type="submit" variant="secondary" disabled={busy}>
              Registrar resultado (manual)
            </Button>
          </form>
        ) : null}
      </section>

      <section id="arrematacao" className="vj-card vj-stack" aria-labelledby="pos-award">
        <h2 id="pos-award" className="vj-section-title">
          Arrematação
        </h2>
        <ManualDisclaimer kind="bid" />
        <BidsList items={bids} />
        <AwardsList items={awards} />
        {canManage ? (
          <>
            <form className="vj-stack" onSubmit={(e) => void onManualBid(e)}>
              <FormField id="pos-bid" label="Lance manual (R$)">
                <Input
                  id="pos-bid"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  inputMode="decimal"
                />
              </FormField>
              <div className="vj-inline-actions">
                <Button type="submit" variant="secondary" disabled={busy}>
                  Registrar lance (manual)
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void onLiveBid()}
                >
                  Tentar lance eletrônico
                </Button>
              </div>
            </form>
            <form className="vj-stack" onSubmit={(e) => void onAward(e)}>
              <FormField id="pos-award-amount" label="Valor da arrematação (R$)">
                <Input
                  id="pos-award-amount"
                  value={awardAmount}
                  onChange={(e) => setAwardAmount(e.target.value)}
                  inputMode="decimal"
                />
              </FormField>
              <Button type="submit" variant="primary" disabled={busy}>
                Registrar arrematação
              </Button>
            </form>
          </>
        ) : null}
      </section>

      <section id="pagamentos" className="vj-card vj-stack" aria-labelledby="pos-pay">
        <h2 id="pos-pay" className="vj-section-title">
          Pagamentos
        </h2>
        <PaymentsList items={payments} />
        {canManage && activeAwardId ? (
          <form className="vj-stack" onSubmit={(e) => void onPayment(e)}>
            <div className="vj-split">
              <FormField id="pos-pay-type" label="Tipo">
                <Select
                  id="pos-pay-type"
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value)}
                >
                  <option value="bid_price">Valor do lance</option>
                  <option value="auctioneer_commission">Comissão</option>
                  <option value="court_fee">Custas</option>
                  <option value="tax">Tributo</option>
                  <option value="transfer_fee">Taxa de transferência</option>
                  <option value="other">Outro</option>
                </Select>
              </FormField>
              <FormField id="pos-pay-amount" label="Valor (R$)">
                <Input
                  id="pos-pay-amount"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  inputMode="decimal"
                />
              </FormField>
            </div>
            <Button type="submit" variant="secondary" disabled={busy}>
              Registrar pagamento
            </Button>
          </form>
        ) : (
          <p className="vj-meta">Registre uma arrematação para gerenciar pagamentos.</p>
        )}
      </section>

      <section id="documentos" className="vj-card vj-stack" aria-labelledby="pos-docs">
        <h2 id="pos-docs" className="vj-section-title">
          Documentos
        </h2>
        {documents.length === 0 ? (
          <p className="vj-meta">Nenhum documento vinculado à arrematação.</p>
        ) : (
          <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {documents.map((doc) => (
              <li key={`${doc.documentId}-${doc.linkType}`}>
                <a href={`/app/documentos/${doc.documentId}`}>{doc.documentId.slice(0, 8)}</a>
                <span className="vj-meta"> · {doc.linkType}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="posse" className="vj-card vj-stack" aria-labelledby="pos-posse">
        <h2 id="pos-posse" className="vj-section-title">
          Posse
        </h2>
        <DeliveriesList items={deliveries} />
        {canManage && activeAwardId ? (
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => void onDelivery()}
          >
            Registrar processo de posse
          </Button>
        ) : null}
      </section>

      <section id="transferencia" className="vj-card vj-stack" aria-labelledby="pos-transf">
        <h2 id="pos-transf" className="vj-section-title">
          Transferência
        </h2>
        <TransfersList items={transfers} />
        {canManage && activeAwardId ? (
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => void onTransfer()}
          >
            Registrar transferência
          </Button>
        ) : null}
      </section>

      <section id="regularizacao" className="vj-card vj-stack" aria-labelledby="pos-reg">
        <h2 id="pos-reg" className="vj-section-title">
          Regularização
        </h2>
        <RegularizationList items={regularization} />
        {canManage && activeAwardId ? (
          <form className="vj-stack" onSubmit={(e) => void onRegularization(e)}>
            <div className="vj-split">
              <FormField id="pos-reg-key" label="Chave">
                <Input
                  id="pos-reg-key"
                  value={regKey}
                  onChange={(e) => setRegKey(e.target.value)}
                />
              </FormField>
              <FormField id="pos-reg-label" label="Rótulo">
                <Input
                  id="pos-reg-label"
                  value={regLabel}
                  onChange={(e) => setRegLabel(e.target.value)}
                />
              </FormField>
            </div>
            <Button type="submit" variant="secondary" disabled={busy}>
              Salvar item
            </Button>
          </form>
        ) : null}
      </section>

      <section id="tarefas" className="vj-card vj-stack" aria-labelledby="pos-tasks">
        <h2 id="pos-tasks" className="vj-section-title">
          Tarefas
        </h2>
        <LayerTag layer="AÇÃO" />
        <Alert tone="info" title="Sob demanda humana">
          Sugestões não disparam workflow automático.
        </Alert>
        {canManage && activeAwardId ? (
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => void onSuggestTasks()}
          >
            Sugerir tarefas
          </Button>
        ) : (
          <p className="vj-meta">Disponível após registrar arrematação.</p>
        )}
        {suggestNote ? <p className="vj-meta">{suggestNote}</p> : null}
      </section>

      <section id="prazos" className="vj-card vj-stack" aria-labelledby="pos-deadlines">
        <h2 id="pos-deadlines" className="vj-section-title">
          Prazos
        </h2>
        {canManage && activeAwardId ? (
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => void onSuggestDeadlines()}
          >
            Sugerir prazos
          </Button>
        ) : (
          <p className="vj-meta">Disponível após registrar arrematação.</p>
        )}
      </section>

      <section id="historico" className="vj-card vj-stack" aria-labelledby="pos-hist">
        <h2 id="pos-hist" className="vj-section-title">
          Histórico
        </h2>
        <TimelineList items={timeline} events={events} />
      </section>
    </div>
  );
}
