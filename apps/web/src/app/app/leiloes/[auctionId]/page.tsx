"use client";

import {
  Alert,
  Breadcrumb,
  Button,
  ButtonLink,
  ErrorState,
  LoadingState,
  PageHeader,
  Select,
} from "@verasjuris/ui";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { NoPermission, NotConfiguredNotice, SectionTabs } from "../../../../components/ai-ui";
import {
  AuctionSourceBadge,
  AuctionStatusBadge,
  AUCTION_TABS,
  InterestStatusBadge,
  LotSummaryRow,
} from "../../../../components/auction-ui";
import {
  AUCTION_INTEREST_LABELS,
  AUCTION_TYPE_LABELS,
  BID_NOT_CONFIGURED_MESSAGE,
  auctionErrorMessage,
  fetchAuction,
  formatDateTime,
  hasAuctionPermission,
  isApiFailure,
  isNotConfigured,
  placeAuctionBidStub,
  upsertAuctionInterest,
  type AuctionDetail,
  type AuctionInterestStatus,
} from "../../../../lib/auctions";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function LeilaoDetailPage() {
  const params = useParams<{ auctionId: string }>();
  const auctionId = params.auctionId;
  const org = useOrgContext();
  const canRead = hasAuctionPermission(org.permissions, "read");
  const canSave = hasAuctionPermission(org.permissions, "save");

  const [auction, setAuction] = useState<AuctionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interestStatus, setInterestStatus] = useState<AuctionInterestStatus>("saved");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(async (orgId: string, id: string) => {
    setLoading(true);
    setError(null);
    const data = await fetchAuction(orgId, id);
    if (isApiFailure(data)) {
      setError(auctionErrorMessage(data, "Não foi possível carregar o leilão."));
      setAuction(null);
    } else {
      setAuction(data.auction);
      if (data.auction.interest?.status) {
        setInterestStatus(data.auction.interest.status as AuctionInterestStatus);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!org.ready) return;
    if (!org.orgId || !canRead || !auctionId) {
      setLoading(false);
      return;
    }
    void load(org.orgId, auctionId);
  }, [org.ready, org.orgId, canRead, auctionId, load]);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Leilões", href: "/app/leiloes" },
    { label: auction?.title ?? "Detalhe" },
  ];

  async function onSaveInterest() {
    if (!org.orgId || !auction) return;
    setPending(true);
    setMsg(null);
    const data = await upsertAuctionInterest(org.orgId, auction.id, {
      status: interestStatus,
      confirmOutcome: interestStatus === "won" || interestStatus === "lost" ? true : undefined,
    });
    if (isApiFailure(data)) {
      setMsg(auctionErrorMessage(data, "Não foi possível atualizar o interesse."));
    } else {
      setMsg("Interesse atualizado.");
      await load(org.orgId, auction.id);
    }
    setPending(false);
  }

  async function onBidAttempt() {
    if (!org.orgId || !auction) return;
    setPending(true);
    setMsg(null);
    const data = await placeAuctionBidStub(org.orgId, auction.id);
    if (isApiFailure(data) || isNotConfigured(data)) {
      setMsg(
        isApiFailure(data)
          ? auctionErrorMessage(data, BID_NOT_CONFIGURED_MESSAGE)
          : BID_NOT_CONFIGURED_MESSAGE,
      );
    } else {
      setMsg(BID_NOT_CONFIGURED_MESSAGE);
    }
    setPending(false);
  }

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar este leilão.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title={auction?.title ?? "Leilão"}
        description="Detalhes cadastrados. Confira sempre o edital na fonte original antes de qualquer decisão."
        actions={
          auction ? (
            <ButtonLink
              href={`/app/leiloes/due-diligence?auctionId=${auction.id}`}
              variant="secondary"
            >
              Due diligence
            </ButtonLink>
          ) : undefined
        }
      />
      <SectionTabs label="Seções de leilões" items={AUCTION_TABS} current="/app/leiloes" />

      {loading || !org.ready ? <LoadingState label="Carregando leilão" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {msg ? (
        <Alert tone="info" title="Atualização">
          {msg}
        </Alert>
      ) : null}

      {auction ? (
        <>
          <section className="vj-card vj-stack" aria-labelledby="lei-resumo">
            <div className="vj-header-actions">
              <h2 id="lei-resumo" className="vj-section-title">
                Resumo
              </h2>
              <AuctionStatusBadge status={auction.status} />
            </div>
            <div className="vj-inline-actions">
              <span className="vj-meta">
                {AUCTION_TYPE_LABELS[auction.auctionType as keyof typeof AUCTION_TYPE_LABELS] ??
                  auction.auctionType}
              </span>
              <AuctionSourceBadge source={auction.source} />
              {auction.interest ? <InterestStatusBadge status={auction.interest.status} /> : null}
            </div>
            {auction.description ? <p className="vj-prose">{auction.description}</p> : null}
            <dl className="vj-meta" style={{ display: "grid", gap: "0.35rem", margin: 0 }}>
              <div>
                <dt style={{ display: "inline" }}>Vendedor: </dt>
                <dd style={{ display: "inline", margin: 0 }}>
                  {auction.sellerName ?? "Não informado"}
                </dd>
              </div>
              <div>
                <dt style={{ display: "inline" }}>Publicação: </dt>
                <dd style={{ display: "inline", margin: 0 }}>
                  {formatDateTime(auction.publicationDate)}
                </dd>
              </div>
              <div>
                <dt style={{ display: "inline" }}>Primeiro evento: </dt>
                <dd style={{ display: "inline", margin: 0 }}>
                  {formatDateTime(auction.firstEventAt)}
                </dd>
              </div>
              <div>
                <dt style={{ display: "inline" }}>Segundo evento: </dt>
                <dd style={{ display: "inline", margin: 0 }}>
                  {formatDateTime(auction.secondEventAt)}
                </dd>
              </div>
              {auction.source.url ? (
                <div>
                  <dt style={{ display: "inline" }}>FONTE: </dt>
                  <dd style={{ display: "inline", margin: 0 }}>
                    <a href={auction.source.url} target="_blank" rel="noopener noreferrer">
                      Abrir fonte original
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          {(auction.events ?? []).length > 0 ? (
            <section className="vj-card vj-stack" aria-labelledby="lei-eventos">
              <h2 id="lei-eventos" className="vj-section-title">
                Eventos
              </h2>
              <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {(auction.events ?? []).map((event) => (
                  <li key={event.id} className="vj-inline-actions">
                    <strong>{event.eventType.replaceAll("_", " ")}</strong>
                    <span className="vj-meta">{formatDateTime(event.startsAt)}</span>
                    <span className="vj-meta">{event.status}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="vj-card vj-stack" aria-labelledby="lei-lotes">
            <h2 id="lei-lotes" className="vj-section-title">
              Lotes
            </h2>
            {(auction.lots ?? []).length === 0 ? (
              <p className="vj-meta">Nenhum lote cadastrado neste leilão.</p>
            ) : (
              <div className="vj-table-wrap">
                <table className="vj-table">
                  <caption className="vj-visually-hidden">Lotes do leilão</caption>
                  <thead>
                    <tr>
                      <th scope="col">Lote</th>
                      <th scope="col">Bem</th>
                      <th scope="col">Avaliação</th>
                      <th scope="col">Lance mínimo</th>
                      <th scope="col">Ocupação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(auction.lots ?? []).map((lot) => (
                      <LotSummaryRow key={lot.id} lot={lot} auctionId={auction.id} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {canSave ? (
            <section className="vj-card vj-stack" aria-labelledby="lei-interesse">
              <h2 id="lei-interesse" className="vj-section-title">
                AÇÃO · Interesse
              </h2>
              <label className="vj-meta" htmlFor="lei-interest-status">
                Situação do acompanhamento
              </label>
              <Select
                id="lei-interest-status"
                value={interestStatus}
                onChange={(event) => setInterestStatus(event.target.value as AuctionInterestStatus)}
              >
                {Object.entries(AUCTION_INTEREST_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => void onSaveInterest()}
              >
                Salvar interesse
              </Button>
            </section>
          ) : null}

          <section className="vj-card vj-stack" aria-labelledby="lei-lance">
            <h2 id="lei-lance" className="vj-section-title">
              Lance eletrônico
            </h2>
            {!auction.bidding?.available ? (
              <NotConfiguredNotice message={BID_NOT_CONFIGURED_MESSAGE}>
                Esta tela não inicia lances. Use o canal oficial do leiloeiro quando houver.
              </NotConfiguredNotice>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => void onBidAttempt()}
            >
              Verificar disponibilidade de lance
            </Button>
          </section>
        </>
      ) : null}
    </div>
  );
}
