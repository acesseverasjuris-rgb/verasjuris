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
} from "@verasjuris/ui";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../../../components/ai-ui";
import {
  AUCTION_TABS,
  EncumbranceBadge,
  OccupancyBadge,
} from "../../../../../../components/auction-ui";
import {
  AUCTION_ASSET_TYPE_LABELS,
  COST_ESTIMATE_DISCLAIMER,
  auctionErrorMessage,
  estimateAuctionCost,
  fetchLot,
  formatBasisPoints,
  formatMoneyCents,
  hasAuctionPermission,
  isApiFailure,
  parseMoneyToCents,
  type AuctionLotDetail,
  type CostEstimate,
} from "../../../../../../lib/auctions";
import { useOrgContext } from "../../../../../../lib/use-org-context";

export default function LoteDetailPage() {
  const params = useParams<{ auctionId: string; lotId: string }>();
  const { auctionId, lotId } = params;
  const org = useOrgContext();
  const canRead = hasAuctionPermission(org.permissions, "read");

  const [lot, setLot] = useState<AuctionLotDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bidInput, setBidInput] = useState("");
  const [estimate, setEstimate] = useState<CostEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);

  const load = useCallback(async (orgId: string, id: string) => {
    setLoading(true);
    setError(null);
    const data = await fetchLot(orgId, id);
    if (isApiFailure(data)) {
      setError(auctionErrorMessage(data, "Não foi possível carregar o lote."));
      setLot(null);
    } else {
      setLot(data.lot);
      if (data.lot.firstMinimumBidCents != null) {
        setBidInput(
          (data.lot.firstMinimumBidCents / 100).toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
          }),
        );
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!org.ready) return;
    if (!org.orgId || !canRead || !lotId) {
      setLoading(false);
      return;
    }
    void load(org.orgId, lotId);
  }, [org.ready, org.orgId, canRead, lotId, load]);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Leilões", href: "/app/leiloes" },
    { label: "Leilão", href: `/app/leiloes/${auctionId}` },
    { label: lot ? `Lote ${lot.lotNumber}` : "Lote" },
  ];

  async function onEstimate(event: React.FormEvent) {
    event.preventDefault();
    if (!org.orgId || !lot) return;
    const cents = bidInput.trim() ? parseMoneyToCents(bidInput) : null;
    if (bidInput.trim() && cents === null) {
      setEstimateError("Informe um valor válido, por exemplo 150.000,00.");
      return;
    }
    setEstimating(true);
    setEstimateError(null);
    const data = await estimateAuctionCost(org.orgId, {
      lotId: lot.id,
      bidCents: cents ?? undefined,
    });
    if (isApiFailure(data)) {
      setEstimateError(auctionErrorMessage(data, "Não foi possível estimar os custos."));
      setEstimate(null);
    } else {
      setEstimate(data.estimate);
    }
    setEstimating(false);
  }

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar este lote.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title={lot ? `Lote ${lot.lotNumber} — ${lot.title}` : "Lote"}
        description="Informações do lote e estimativa de custos com base nos valores informados. Não constitui recomendação de compra."
        actions={
          <ButtonLink href={`/app/leiloes/${auctionId}/lotes/${lotId}/pos`} variant="secondary">
            Pós-leilão
          </ButtonLink>
        }
      />
      <SectionTabs label="Seções de leilões" items={AUCTION_TABS} current="/app/leiloes" />

      {loading || !org.ready ? <LoadingState label="Carregando lote" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}

      {lot ? (
        <>
          <section className="vj-card vj-stack" aria-labelledby="lote-resumo">
            <h2 id="lote-resumo" className="vj-section-title">
              Bem e localização
            </h2>
            <p className="vj-meta">
              {AUCTION_ASSET_TYPE_LABELS[lot.assetType as keyof typeof AUCTION_ASSET_TYPE_LABELS] ??
                lot.assetType}
            </p>
            {lot.description ? <p className="vj-prose">{lot.description}</p> : null}
            <dl style={{ display: "grid", gap: "0.35rem", margin: 0 }}>
              <div className="vj-meta">
                Local: {lot.location ?? "Não informado"}
                {lot.municipality ? ` · ${lot.municipality}` : ""}
                {lot.stateCode ? ` / ${lot.stateCode}` : ""}
              </div>
              <div>
                <OccupancyBadge status={lot.occupancyStatus} />
              </div>
              <div className="vj-meta">
                Avaliação: {formatMoneyCents(lot.appraisalValueCents, lot.currency)}
              </div>
              <div className="vj-meta">
                Lance mínimo (1º): {formatMoneyCents(lot.firstMinimumBidCents, lot.currency)}
              </div>
              <div className="vj-meta">
                Lance mínimo (2º): {formatMoneyCents(lot.secondMinimumBidCents, lot.currency)}
              </div>
              <div className="vj-meta">
                Comissão: {formatBasisPoints(lot.commissionBasisPoints)}
              </div>
              {lot.discountVsAppraisalBp != null ? (
                <div className="vj-meta">
                  Diferença vs. avaliação: {formatBasisPoints(lot.discountVsAppraisalBp)}
                </div>
              ) : null}
            </dl>
          </section>

          <section className="vj-card vj-stack" aria-labelledby="lote-onus">
            <h2 id="lote-onus" className="vj-section-title">
              Ônus e gravames
            </h2>
            {(lot.encumbrances ?? []).length === 0 ? (
              <p className="vj-meta">Nenhum ônus informado neste lote. Situação: Não verificado.</p>
            ) : (
              <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {(lot.encumbrances ?? []).map((item) => (
                  <li key={item.id} className="vj-stack">
                    <strong>{item.type}</strong>
                    <p className="vj-prose">{item.description}</p>
                    <EncumbranceBadge item={item} />
                    {item.amountCents != null ? (
                      <span className="vj-meta">{formatMoneyCents(item.amountCents)}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="vj-card vj-stack" aria-labelledby="lote-custo">
            <h2 id="lote-custo" className="vj-section-title">
              Simulador de custos
            </h2>
            <Alert tone="info" title={COST_ESTIMATE_DISCLAIMER}>
              Inclui comissão e taxas conhecidas informadas no cadastro. Não cobre todos os custos
              possíveis (ITBI, débitos, posse etc.).
            </Alert>
            <form className="vj-stack" onSubmit={(event) => void onEstimate(event)}>
              <FormField id="lote-bid" label="Valor de referência do lance (R$)">
                <Input
                  id="lote-bid"
                  value={bidInput}
                  onChange={(event) => setBidInput(event.target.value)}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="150.000,00"
                />
              </FormField>
              <Button type="submit" variant="secondary" disabled={estimating}>
                {estimating ? "Calculando…" : "Estimar custos"}
              </Button>
            </form>
            {estimateError ? <ErrorState title="Estimativa">{estimateError}</ErrorState> : null}
            {estimate ? (
              <dl className="vj-stack" style={{ margin: 0 }}>
                <div className="vj-meta">Lance: {formatMoneyCents(estimate.bidCents)}</div>
                <div className="vj-meta">
                  Comissão: {formatMoneyCents(estimate.commissionCents)}
                </div>
                <div className="vj-meta">
                  Taxas conhecidas: {formatMoneyCents(estimate.knownFeesCents)}
                </div>
                <div className="vj-meta">
                  Outros custos informados:{" "}
                  {formatMoneyCents(estimate.otherCostsCents ?? estimate.informedCostsCents)}
                </div>
                <div>
                  <strong>Total estimado: {formatMoneyCents(estimate.totalCents)}</strong>
                </div>
                <p className="vj-meta">{estimate.disclaimer ?? COST_ESTIMATE_DISCLAIMER}</p>
              </dl>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
