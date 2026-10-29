import { Alert, Badge, EmptyState } from "@verasjuris/ui";
import {
  ALLOCATION_STATUS_LABELS,
  ALLOCATION_TYPE_LABELS,
  API_CLIENT_STATUS_LABELS,
  AP_STATUS_LABELS,
  BENEFICIARY_TYPE_LABELS,
  BILLING_INTERVAL_LABELS,
  COST_CATEGORY_LABELS,
  CREDIT_STATUS_LABELS,
  DELINQUENCY_STAGE_LABELS,
  DELINQUENCY_STATUS_LABELS,
  DISCREPANCY_SEVERITY_LABELS,
  DISCREPANCY_STATUS_LABELS,
  DISPUTE_STATUS_LABELS,
  DISPUTE_TYPE_LABELS,
  EXTERNAL_SOURCE_LABELS,
  FORECAST_SCENARIO_LABELS,
  INVOICE_STATUS_LABELS,
  LEDGER_TX_STATUS_LABELS,
  LEDGER_TX_TYPE_LABELS,
  LEGAL_FEE_STATUS_LABELS,
  LICENSE_STATUS_LABELS,
  PAYABLE_STATUS_LABELS,
  PAYMENT_INTENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYOUT_FREQUENCY_LABELS,
  PAYOUT_STATUS_LABELS,
  PRODUCT_TYPE_LABELS,
  RECEIVABLE_STATUS_LABELS,
  RECONCILIATION_ITEM_STATUS_LABELS,
  RECONCILIATION_RUN_STATUS_LABELS,
  REFUND_STATUS_LABELS,
  REFUND_TYPE_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
  WHITE_LABEL_STATUS_LABELS,
  displayPayoutStatus,
  formatDateTime,
  formatMoneyCents,
  hasFinancePermission,
  hasMonetizationPermission,
  isProviderUnavailable,
  splitWaterfallFromAllocations,
  type ApiClient,
  type BillingCredit,
  type BillingInvoice,
  type BillingPlan,
  type BillingSubscription,
  type CashPosition,
  type CostRecord,
  type DelinquencyCase,
  type DisputeEvidence,
  type DisputeHistoryEntry,
  type FinanceDashboard,
  type FinancePayable,
  type FinancialDiscrepancy,
  type FinancialDispute,
  type LedgerTransaction,
  type LegalFeeAgreement,
  type MonetizationDashboard,
  type MonetizationProduct,
  type PaymentAllocation,
  type PaymentIntent,
  type PlatformFeeRule,
  type PlatformPayment,
  type PlatformRefund,
  type Payout,
  type PayoutSchedule,
  type ProviderHealth,
  type ReconciliationItem,
  type ReconciliationRun,
  type SoftwareLicense,
  type SplitRule,
  type TreasuryAccountsPayable,
  type TreasuryForecast,
  type TreasuryReceivable,
  type WhiteLabelConfig,
} from "../lib/finance";

export const FINANCE_APP_TABS = [
  { href: "/app/financeiro", label: "Visão geral", permission: "read" as const },
  { href: "/app/financeiro/planos", label: "Planos", permission: "read" as const },
  { href: "/app/financeiro/assinaturas", label: "Assinaturas", permission: "read" as const },
  { href: "/app/financeiro/invoices", label: "Faturas", permission: "read" as const },
  { href: "/app/financeiro/cobrancas", label: "Cobranças", permission: "payment.read" as const },
  { href: "/app/financeiro/creditos", label: "Créditos", permission: "read" as const },
  { href: "/app/financeiro/honorarios", label: "Honorários", permission: "read" as const },
  { href: "/app/financeiro/taxas", label: "Taxas", permission: "read" as const },
  { href: "/app/financeiro/custos", label: "Custos", permission: "read" as const },
  { href: "/app/financeiro/ledger", label: "Ledger", permission: "ledger.read" as const },
  { href: "/app/financeiro/pagamentos", label: "Pagamentos", permission: "payment.read" as const },
  { href: "/app/financeiro/splits", label: "Splits", permission: "split.read" as const },
  { href: "/app/financeiro/repasses", label: "Repasses", permission: "payout.read" as const },
  {
    href: "/app/financeiro/repasses/agenda",
    label: "Agenda de repasses",
    permission: "payout.read" as const,
  },
  { href: "/app/financeiro/retencoes", label: "Retenções", permission: "split.read" as const },
  {
    href: "/app/financeiro/beneficiarios",
    label: "Beneficiários",
    permission: "payout.read" as const,
  },
  { href: "/app/financeiro/reembolsos", label: "Reembolsos", permission: "refund.read" as const },
  { href: "/app/financeiro/disputas", label: "Disputas", permission: "dispute.read" as const },
  {
    href: "/app/financeiro/conciliacao",
    label: "Conciliação",
    permission: "reconciliation.read" as const,
  },
  {
    href: "/app/financeiro/divergencias",
    label: "Divergências",
    permission: "reconciliation.read" as const,
  },
  { href: "/app/financeiro/tesouraria", label: "Tesouraria", permission: "treasury.read" as const },
  {
    href: "/app/financeiro/contas-a-receber",
    label: "Contas a receber",
    permission: "treasury.read" as const,
  },
  {
    href: "/app/financeiro/contas-a-pagar",
    label: "Contas a pagar",
    permission: "treasury.read" as const,
  },
  {
    href: "/app/financeiro/inadimplencia",
    label: "Inadimplência",
    permission: "treasury.read" as const,
  },
  { href: "/app/financeiro/forecast", label: "Forecast", permission: "treasury.read" as const },
  { href: "/app/financeiro/caixa", label: "Caixa", permission: "treasury.read" as const },
  {
    href: "/app/financeiro/monetizacao",
    label: "Monetização",
    monetization: "read" as const,
  },
];

export const MONETIZATION_APP_TABS = [
  { href: "/app/financeiro/monetizacao", label: "Dashboard", monetization: "read" as const },
  {
    href: "/app/financeiro/monetizacao/planos",
    label: "Planos",
    monetization: "read" as const,
  },
  {
    href: "/app/financeiro/monetizacao/produtos",
    label: "Produtos",
    monetization: "read" as const,
  },
  { href: "/app/financeiro/monetizacao/ia", label: "IA / créditos", monetization: "read" as const },
  {
    href: "/app/financeiro/monetizacao/apis",
    label: "APIs",
    monetization: "read" as const,
    also: "api.manage" as const,
  },
  {
    href: "/app/financeiro/monetizacao/licencas",
    label: "Licenças",
    monetization: "read" as const,
    also: "license.manage" as const,
  },
  {
    href: "/app/financeiro/monetizacao/white-label",
    label: "White-label",
    monetization: "read" as const,
    also: "white_label.manage" as const,
  },
];

export function financeTabsForPermissions(permissions: string[]) {
  return FINANCE_APP_TABS.filter((tab) => {
    if ("monetization" in tab && tab.monetization) {
      return hasMonetizationPermission(permissions, tab.monetization);
    }
    if ("permission" in tab && tab.permission) {
      const required = tab.permission;
      if (required === "read") return hasFinancePermission(permissions, "read");
      if (required === "payment.read" || required === "ledger.read") {
        return (
          hasFinancePermission(permissions, required) || hasFinancePermission(permissions, "read")
        );
      }
      return hasFinancePermission(permissions, required);
    }
    return true;
  }).map(({ href, label }) => ({ href, label }));
}

export function monetizationTabsForPermissions(permissions: string[]) {
  return MONETIZATION_APP_TABS.filter((tab) => {
    if (hasMonetizationPermission(permissions, tab.monetization)) return true;
    if ("also" in tab && tab.also) {
      return hasMonetizationPermission(permissions, tab.also);
    }
    return false;
  }).map(({ href, label }) => ({ href, label }));
}

function tone(status: string): "neutral" | "success" | "warning" | "error" {
  if (
    status === "paid" ||
    status === "confirmed" ||
    status === "active" ||
    status === "posted" ||
    status === "available" ||
    status === "authorized" ||
    status === "won" ||
    status === "matched" ||
    status === "resolved" ||
    status === "completed"
  ) {
    return "success";
  }
  if (
    status === "open" ||
    status === "draft" ||
    status === "processing" ||
    status === "pending" ||
    status === "created" ||
    status === "requires_action" ||
    status === "trialing" ||
    status === "partially_paid" ||
    status === "scheduled" ||
    status === "held" ||
    status === "under_review" ||
    status === "investigating" ||
    status === "running"
  ) {
    return "warning";
  }
  if (
    status === "past_due" ||
    status === "failed" ||
    status === "cancelled" ||
    status === "void" ||
    status === "reversed" ||
    status === "not_configured" ||
    status === "chargeback" ||
    status === "expired" ||
    status === "lost" ||
    status === "overdue" ||
    status === "critical"
  ) {
    return "error";
  }
  return "neutral";
}

export function StatusTextBadge({
  status,
  labels,
}: {
  status: string;
  labels: Record<string, string>;
}) {
  return (
    <Badge tone={tone(status)}>
      <span className="vj-visually-hidden">Situação: </span>
      {labels[status] ?? status}
    </Badge>
  );
}

export function ProviderUnavailableBanner({
  status,
}: {
  status: string | ProviderHealth | null | undefined;
}) {
  if (!isProviderUnavailable(status)) return null;
  const detail =
    typeof status === "object" && status?.detail
      ? status.detail
      : "Provedor de pagamento não configurado (NOT_CONFIGURED).";
  return (
    <Alert tone="warning" title="Pagamento indisponível">
      {detail} Nenhum pagamento online será processado até a configuração do provedor.
    </Alert>
  );
}

export function FinanceDashboardCards({ data }: { data: FinanceDashboard }) {
  const contracted =
    (data.invoices.open?.totalDueCents ?? 0) +
    (data.invoices.past_due?.totalDueCents ?? 0) +
    (data.invoices.paid?.totalPaidCents ?? 0);
  const cashReceived = data.ledger.cashClearingBalanceCents;
  return (
    <div className="vj-stack">
      <ProviderUnavailableBanner status={data.providerStatus} />
      <div className="vj-card-grid">
        <section className="vj-card" aria-labelledby="fin-contracted">
          <h3 id="fin-contracted" className="vj-card-title">
            Volume contratado
          </h3>
          <p className="vj-title">{formatMoneyCents(contracted)}</p>
          <p className="vj-meta">Soma de faturas (devido + já pago reconhecido).</p>
        </section>
        <section className="vj-card" aria-labelledby="fin-cash">
          <h3 id="fin-cash" className="vj-card-title">
            Caixa recebido (ledger)
          </h3>
          <p className="vj-title">{formatMoneyCents(cashReceived)}</p>
          <p className="vj-meta">
            Saldo CASH_CLEARING · {data.ledger.currency}. Distinto do volume contratado.
          </p>
        </section>
        <section className="vj-card" aria-labelledby="fin-open">
          <h3 id="fin-open" className="vj-card-title">
            Em aberto
          </h3>
          <p className="vj-title">{formatMoneyCents(data.invoices.open.totalDueCents)}</p>
          <p className="vj-meta">{data.invoices.open.count} fatura(s)</p>
        </section>
        <section className="vj-card" aria-labelledby="fin-pastdue">
          <h3 id="fin-pastdue" className="vj-card-title">
            Vencidas
          </h3>
          <p className="vj-title">{formatMoneyCents(data.invoices.past_due.totalDueCents)}</p>
          <p className="vj-meta">{data.invoices.past_due.count} fatura(s)</p>
        </section>
        <section className="vj-card" aria-labelledby="fin-paid">
          <h3 id="fin-paid" className="vj-card-title">
            Pagas
          </h3>
          <p className="vj-title">{formatMoneyCents(data.invoices.paid.totalPaidCents)}</p>
          <p className="vj-meta">{data.invoices.paid.count} fatura(s)</p>
        </section>
        <section className="vj-card" aria-labelledby="fin-credits">
          <h3 id="fin-credits" className="vj-card-title">
            Créditos disponíveis
          </h3>
          <p className="vj-title">{formatMoneyCents(data.credits.availableCents)}</p>
        </section>
        <section className="vj-card" aria-labelledby="fin-costs">
          <h3 id="fin-costs" className="vj-card-title">
            Custos
          </h3>
          <p className="vj-title">{formatMoneyCents(data.costs.totalCents)}</p>
        </section>
        <section className="vj-card" aria-labelledby="fin-ar">
          <h3 id="fin-ar" className="vj-card-title">
            Contas a receber
          </h3>
          <p className="vj-title">{formatMoneyCents(data.accountsReceivable.openCents)}</p>
          <p className="vj-meta">
            {data.accountsReceivable.openInvoiceCount} abertas · vencido{" "}
            {formatMoneyCents(data.accountsReceivable.pastDueCents)}
          </p>
        </section>
      </div>
    </div>
  );
}

export function PlansTable({ items }: { items: BillingPlan[] }) {
  if (items.length === 0) {
    return (
      <EmptyState title="Nenhum plano">Cadastre planos de billing para a organização.</EmptyState>
    );
  }
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">Planos</caption>
        <thead>
          <tr>
            <th scope="col">Nome</th>
            <th scope="col">Intervalo</th>
            <th scope="col">Preço</th>
            <th scope="col">Ativo</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>{BILLING_INTERVAL_LABELS[item.billingInterval] ?? item.billingInterval}</td>
              <td>{formatMoneyCents(item.priceCents)}</td>
              <td>
                <Badge tone={item.active ? "success" : "neutral"}>
                  {item.active ? "Ativo" : "Inativo"}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SubscriptionsTable({ items }: { items: BillingSubscription[] }) {
  if (items.length === 0) {
    return (
      <EmptyState title="Nenhuma assinatura">Nenhuma assinatura nesta organização.</EmptyState>
    );
  }
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">Assinaturas</caption>
        <thead>
          <tr>
            <th scope="col">ID</th>
            <th scope="col">Plano</th>
            <th scope="col">Situação</th>
            <th scope="col">Período</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.id.slice(0, 8)}…</td>
              <td>{item.planId.slice(0, 8)}…</td>
              <td>
                <StatusTextBadge status={item.status} labels={SUBSCRIPTION_STATUS_LABELS} />
              </td>
              <td>
                {item.currentPeriodStart ? formatDateTime(item.currentPeriodStart) : "—"}
                {" → "}
                {item.currentPeriodEnd ? formatDateTime(item.currentPeriodEnd) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function InvoicesTable({ items }: { items: BillingInvoice[] }) {
  if (items.length === 0) {
    return <EmptyState title="Nenhuma fatura">Nenhuma fatura encontrada.</EmptyState>;
  }
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">Faturas</caption>
        <thead>
          <tr>
            <th scope="col">Número</th>
            <th scope="col">Total</th>
            <th scope="col">Devido</th>
            <th scope="col">Situação</th>
            <th scope="col">Vencimento</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.invoiceNumber ?? item.id.slice(0, 8)}</td>
              <td>{formatMoneyCents(item.totalCents)}</td>
              <td>{formatMoneyCents(item.amountDueCents)}</td>
              <td>
                <StatusTextBadge status={item.status} labels={INVOICE_STATUS_LABELS} />
              </td>
              <td>{item.dueAt ? formatDateTime(item.dueAt) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PaymentIntentsTable({ items }: { items: PaymentIntent[] }) {
  if (items.length === 0) {
    return <EmptyState title="Nenhuma cobrança">Nenhuma intenção de pagamento.</EmptyState>;
  }
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">Cobranças / payment intents</caption>
        <thead>
          <tr>
            <th scope="col">ID</th>
            <th scope="col">Valor</th>
            <th scope="col">Método</th>
            <th scope="col">Situação</th>
            <th scope="col">Criada</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <a href={`/checkout/${item.id}`}>{item.id.slice(0, 8)}…</a>
              </td>
              <td>{formatMoneyCents(item.amountCents)}</td>
              <td>{PAYMENT_METHOD_LABELS[item.paymentMethod] ?? item.paymentMethod}</td>
              <td>
                <StatusTextBadge status={item.status} labels={PAYMENT_INTENT_STATUS_LABELS} />
              </td>
              <td>{formatDateTime(item.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CreditsTable({ items }: { items: BillingCredit[] }) {
  if (items.length === 0) {
    return <EmptyState title="Nenhum crédito">Nenhum crédito de billing.</EmptyState>;
  }
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">Créditos</caption>
        <thead>
          <tr>
            <th scope="col">Valor</th>
            <th scope="col">Restante</th>
            <th scope="col">Situação</th>
            <th scope="col">Criado</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{formatMoneyCents(item.amountCents)}</td>
              <td>{formatMoneyCents(item.remainingCents)}</td>
              <td>
                <StatusTextBadge status={item.status} labels={CREDIT_STATUS_LABELS} />
              </td>
              <td>{formatDateTime(item.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HonorariosTable({ items }: { items: LegalFeeAgreement[] }) {
  if (items.length === 0) {
    return <EmptyState title="Nenhum honorário">Nenhum acordo de honorários.</EmptyState>;
  }
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">Honorários</caption>
        <thead>
          <tr>
            <th scope="col">Tipo</th>
            <th scope="col">Valor</th>
            <th scope="col">Situação</th>
            <th scope="col">Descrição</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.feeType}</td>
              <td>
                {item.fixedAmountCents != null
                  ? formatMoneyCents(item.fixedAmountCents)
                  : item.hourlyRateCents != null
                    ? `${formatMoneyCents(item.hourlyRateCents)}/h`
                    : "—"}
              </td>
              <td>
                <StatusTextBadge status={item.status} labels={LEGAL_FEE_STATUS_LABELS} />
              </td>
              <td>{item.notes ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FeesTable({ items }: { items: PlatformFeeRule[] }) {
  if (items.length === 0) {
    return <EmptyState title="Nenhuma taxa">Nenhuma regra de taxa da plataforma.</EmptyState>;
  }
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">Taxas da plataforma</caption>
        <thead>
          <tr>
            <th scope="col">Nome</th>
            <th scope="col">Base</th>
            <th scope="col">BPS</th>
            <th scope="col">Ativa</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>{item.feeBase}</td>
              <td>{item.percentageBps ?? "—"}</td>
              <td>
                <Badge tone={item.active ? "success" : "neutral"}>
                  {item.active ? "Ativa" : "Inativa"}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CostsTable({ items }: { items: CostRecord[] }) {
  if (items.length === 0) {
    return <EmptyState title="Nenhum custo">Nenhum custo operacional registrado.</EmptyState>;
  }
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">Custos</caption>
        <thead>
          <tr>
            <th scope="col">Categoria</th>
            <th scope="col">Valor</th>
            <th scope="col">Descrição</th>
            <th scope="col">Data</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{COST_CATEGORY_LABELS[item.category] ?? item.category}</td>
              <td>{formatMoneyCents(item.amountCents)}</td>
              <td>{item.description ?? "—"}</td>
              <td>
                {item.incurredAt
                  ? formatDateTime(
                      typeof item.incurredAt === "string"
                        ? item.incurredAt
                        : item.incurredAt.toISOString(),
                    )
                  : formatDateTime(
                      typeof item.createdAt === "string"
                        ? item.createdAt
                        : item.createdAt.toISOString(),
                    )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LedgerTable({ items }: { items: LedgerTransaction[] }) {
  if (items.length === 0) {
    return <EmptyState title="Ledger vazio">Nenhum lançamento contábil encontrado.</EmptyState>;
  }
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">
          Ledger imutável — transações, débitos, créditos
        </caption>
        <thead>
          <tr>
            <th scope="col">Transação</th>
            <th scope="col">Tipo</th>
            <th scope="col">Débito</th>
            <th scope="col">Crédito</th>
            <th scope="col">Conta</th>
            <th scope="col">Origem</th>
            <th scope="col">Data</th>
            <th scope="col">Estorno</th>
            <th scope="col">Situação</th>
          </tr>
        </thead>
        <tbody>
          {items.map((tx) => {
            const debits = tx.entries.filter((e) => e.direction === "debit");
            const credits = tx.entries.filter((e) => e.direction === "credit");
            const debitTotal = debits.reduce((s, e) => s + e.amountCents, 0);
            const creditTotal = credits.reduce((s, e) => s + e.amountCents, 0);
            const accounts = [...new Set(tx.entries.map((e) => e.accountId.slice(0, 8)))].join(
              ", ",
            );
            return (
              <tr key={tx.id}>
                <td>
                  <code>{tx.id.slice(0, 8)}…</code>
                </td>
                <td>{LEDGER_TX_TYPE_LABELS[tx.transactionType] ?? tx.transactionType}</td>
                <td>{formatMoneyCents(debitTotal)}</td>
                <td>{formatMoneyCents(creditTotal)}</td>
                <td>{accounts || "—"}</td>
                <td>
                  {tx.referenceType
                    ? `${tx.referenceType}${tx.referenceId ? `:${tx.referenceId.slice(0, 8)}` : ""}`
                    : "—"}
                </td>
                <td>{formatDateTime(tx.occurredAt)}</td>
                <td>
                  {tx.reversalOfTransactionId
                    ? `Estorno de ${tx.reversalOfTransactionId.slice(0, 8)}…`
                    : tx.status === "reversed"
                      ? "Estornada"
                      : "—"}
                </td>
                <td>
                  <StatusTextBadge status={tx.status} labels={LEDGER_TX_STATUS_LABELS} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function PaymentsTable({ items }: { items: PlatformPayment[] }) {
  if (items.length === 0) {
    return <EmptyState title="Nenhum pagamento">Nenhum pagamento registrado.</EmptyState>;
  }
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">Pagamentos</caption>
        <thead>
          <tr>
            <th scope="col">ID</th>
            <th scope="col">Valor</th>
            <th scope="col">Situação</th>
            <th scope="col">Manual</th>
            <th scope="col">Criado</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.id.slice(0, 8)}…</td>
              <td>{formatMoneyCents(item.amountCents)}</td>
              <td>
                <StatusTextBadge status={item.status} labels={PAYMENT_STATUS_LABELS} />
              </td>
              <td>{item.isManual ? "Sim" : "Não"}</td>
              <td>{formatDateTime(item.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Statuses that mean money actually moved / confirmed — never infer from redirect alone. */
export const CONFIRMED_PAYMENT_STATUSES = new Set(["confirmed", "authorized", "paid"]);

export function CheckoutSummary({
  intent,
  invoice,
}: {
  intent: PaymentIntent;
  invoice?: BillingInvoice | null;
}) {
  const subtotal = invoice?.subtotalCents ?? intent.amountCents;
  const discount = invoice?.discountCents ?? 0;
  const fees = invoice?.taxCents ?? 0;
  const total = invoice?.totalCents ?? intent.amountCents;
  const meta = intent.metadata ?? {};
  const description =
    typeof meta.description === "string" ? meta.description : intent.referenceType;

  return (
    <section className="vj-stack" aria-labelledby="checkout-summary">
      <h2 id="checkout-summary" className="vj-subtitle">
        Resumo
      </h2>
      <dl className="vj-stack">
        <div>
          <dt className="vj-meta">Item</dt>
          <dd>
            {description} ({intent.referenceType}/{intent.referenceId.slice(0, 8)}…)
          </dd>
        </div>
        <div>
          <dt className="vj-meta">Subtotal</dt>
          <dd>{formatMoneyCents(subtotal)}</dd>
        </div>
        <div>
          <dt className="vj-meta">Desconto</dt>
          <dd>{formatMoneyCents(discount)}</dd>
        </div>
        <div>
          <dt className="vj-meta">Taxas / impostos</dt>
          <dd>{formatMoneyCents(fees)}</dd>
        </div>
        <div>
          <dt className="vj-meta">Total</dt>
          <dd>
            <strong>{formatMoneyCents(total)}</strong>
          </dd>
        </div>
        <div>
          <dt className="vj-meta">Método</dt>
          <dd>{PAYMENT_METHOD_LABELS[intent.paymentMethod] ?? intent.paymentMethod}</dd>
        </div>
        <div>
          <dt className="vj-meta">Situação</dt>
          <dd>
            <StatusTextBadge status={intent.status} labels={PAYMENT_INTENT_STATUS_LABELS} />
          </dd>
        </div>
      </dl>
    </section>
  );
}

export function SplitWaterfall({ allocations }: { allocations: PaymentAllocation[] }) {
  const w = splitWaterfallFromAllocations(allocations);
  const steps = [
    { id: "bruto", label: "Bruto", value: w.brutoCents },
    { id: "plataforma", label: "Plataforma", value: w.plataformaCents },
    { id: "parceiro", label: "Parceiro", value: w.parceiroCents },
    { id: "retencoes", label: "Retenções", value: w.retencoesCents },
    { id: "liquido", label: "Líquido", value: w.liquidoCents },
  ];
  return (
    <section className="vj-stack" aria-labelledby="split-waterfall">
      <h2 id="split-waterfall" className="vj-subtitle">
        Cascata do split
      </h2>
      <p className="vj-meta">bruto → plataforma → parceiro → retenções → líquido</p>
      <ol className="vj-card-grid" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {steps.map((step, index) => (
          <li key={step.id} className="vj-card" aria-labelledby={`wf-${step.id}`}>
            <p className="vj-meta">
              {index + 1}. {step.label}
            </p>
            <h3 id={`wf-${step.id}`} className="vj-card-title">
              {formatMoneyCents(step.value)}
            </h3>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function SplitRulesTable({ items }: { items: SplitRule[] }) {
  if (items.length === 0) {
    return <EmptyState title="Sem regras de split">Nenhuma regra cadastrada.</EmptyState>;
  }
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">Regras de split</caption>
        <thead>
          <tr>
            <th scope="col">Chave</th>
            <th scope="col">Beneficiário</th>
            <th scope="col">Cálculo</th>
            <th scope="col">Prioridade</th>
            <th scope="col">Situação</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.key}</td>
              <td>{BENEFICIARY_TYPE_LABELS[item.beneficiaryType] ?? item.beneficiaryType}</td>
              <td>
                {item.calculationType}
                {item.percentageBps != null ? ` · ${item.percentageBps} bps` : ""}
                {item.fixedAmountCents != null
                  ? ` · ${formatMoneyCents(item.fixedAmountCents)}`
                  : ""}
              </td>
              <td>{item.priority}</td>
              <td>
                <Badge tone={item.status === "active" ? "success" : "neutral"}>{item.status}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AllocationsTable({ items }: { items: PaymentAllocation[] }) {
  if (items.length === 0) {
    return <EmptyState title="Sem alocações">Nenhuma alocação de pagamento.</EmptyState>;
  }
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">Alocações</caption>
        <thead>
          <tr>
            <th scope="col">Pagamento</th>
            <th scope="col">Tipo</th>
            <th scope="col">Beneficiário</th>
            <th scope="col">Bruto</th>
            <th scope="col">Taxa</th>
            <th scope="col">Retenção</th>
            <th scope="col">Líquido</th>
            <th scope="col">Situação</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.paymentId.slice(0, 8)}…</td>
              <td>{ALLOCATION_TYPE_LABELS[item.allocationType] ?? item.allocationType}</td>
              <td>
                {BENEFICIARY_TYPE_LABELS[item.beneficiaryType] ?? item.beneficiaryType} ·{" "}
                {item.beneficiaryId.slice(0, 8)}…
              </td>
              <td>{formatMoneyCents(item.grossAmountCents ?? item.grossCents ?? 0)}</td>
              <td>{formatMoneyCents(item.feeAmountCents ?? item.feeCents ?? 0)}</td>
              <td>{formatMoneyCents(item.retentionAmountCents ?? 0)}</td>
              <td>{formatMoneyCents(item.netAmountCents ?? item.netCents ?? 0)}</td>
              <td>
                <StatusTextBadge status={item.status} labels={ALLOCATION_STATUS_LABELS} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PayoutsTable({
  items,
  provider,
}: {
  items: Payout[];
  provider?: ProviderHealth | null;
}) {
  if (items.length === 0) {
    return <EmptyState title="Sem repasses">Nenhum repasse encontrado.</EmptyState>;
  }
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">Repasses</caption>
        <thead>
          <tr>
            <th scope="col">ID</th>
            <th scope="col">Beneficiário</th>
            <th scope="col">Valor</th>
            <th scope="col">Situação</th>
            <th scope="col">Pago em</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const status = displayPayoutStatus(item.status, provider);
            return (
              <tr key={item.id}>
                <td>{item.id.slice(0, 8)}…</td>
                <td>
                  {BENEFICIARY_TYPE_LABELS[item.beneficiaryType] ?? item.beneficiaryType} ·{" "}
                  {item.beneficiaryId.slice(0, 8)}…
                </td>
                <td>{formatMoneyCents(item.amountCents)}</td>
                <td>
                  <span className="vj-stack" style={{ gap: "0.25rem" }}>
                    <span>{PAYOUT_STATUS_LABELS[status] ?? status}</span>
                    <StatusTextBadge status={status} labels={PAYOUT_STATUS_LABELS} />
                  </span>
                </td>
                <td>{status === "paid" && item.paidAt ? formatDateTime(item.paidAt) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function PayoutSchedulesTable({ items }: { items: PayoutSchedule[] }) {
  if (items.length === 0) {
    return <EmptyState title="Sem agendas">Nenhuma agenda de repasse.</EmptyState>;
  }
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">Agenda de repasses</caption>
        <thead>
          <tr>
            <th scope="col">Beneficiário</th>
            <th scope="col">Frequência</th>
            <th scope="col">Mínimo</th>
            <th scope="col">Ativa</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                {BENEFICIARY_TYPE_LABELS[item.beneficiaryType] ?? item.beneficiaryType} ·{" "}
                {item.beneficiaryId.slice(0, 8)}…
              </td>
              <td>{PAYOUT_FREQUENCY_LABELS[item.frequency] ?? item.frequency}</td>
              <td>
                {item.minimumAmountCents != null ? formatMoneyCents(item.minimumAmountCents) : "—"}
              </td>
              <td>
                <Badge tone={item.active ? "success" : "neutral"}>
                  {item.active ? "Ativa" : "Inativa"}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FinancePayablesTable({ items }: { items: FinancePayable[] }) {
  if (items.length === 0) {
    return <EmptyState title="Sem payables">Nenhum payable de split.</EmptyState>;
  }
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">Payables / beneficiários</caption>
        <thead>
          <tr>
            <th scope="col">Beneficiário</th>
            <th scope="col">Valor</th>
            <th scope="col">Disponível</th>
            <th scope="col">Situação</th>
            <th scope="col">Retenção</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                {BENEFICIARY_TYPE_LABELS[item.beneficiaryType] ?? item.beneficiaryType} ·{" "}
                {item.beneficiaryId.slice(0, 8)}…
              </td>
              <td>{formatMoneyCents(item.amountCents)}</td>
              <td>{item.availableAt ? formatDateTime(item.availableAt) : "—"}</td>
              <td>
                <StatusTextBadge status={item.status} labels={PAYABLE_STATUS_LABELS} />
              </td>
              <td>{item.holdReason ?? (item.heldByDisputeId ? "Hold de disputa" : "—")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RefundsTable({ items }: { items: PlatformRefund[] }) {
  if (items.length === 0) {
    return <EmptyState title="Sem reembolsos">Nenhum reembolso registrado.</EmptyState>;
  }
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">Reembolsos — crédito ≠ caixa</caption>
        <thead>
          <tr>
            <th scope="col">Pagamento</th>
            <th scope="col">Valor</th>
            <th scope="col">Tipo</th>
            <th scope="col">Situação</th>
            <th scope="col">Solicitado</th>
            <th scope="col">Histórico</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.paymentId.slice(0, 8)}…</td>
              <td>{formatMoneyCents(item.amountCents)}</td>
              <td>
                <Badge tone={item.refundType === "credit" ? "warning" : "neutral"}>
                  {REFUND_TYPE_LABELS[item.refundType] ?? item.refundType}
                </Badge>
              </td>
              <td>
                <StatusTextBadge status={item.status} labels={REFUND_STATUS_LABELS} />
              </td>
              <td>{item.requestedAt ? formatDateTime(item.requestedAt) : "—"}</td>
              <td>
                {item.confirmedAt
                  ? `Confirmado ${formatDateTime(item.confirmedAt)}`
                  : item.failedAt
                    ? `Falhou ${formatDateTime(item.failedAt)}`
                    : item.creditId
                      ? `Crédito ${item.creditId.slice(0, 8)}… (≠ caixa)`
                      : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DisputesTable({ items }: { items: FinancialDispute[] }) {
  if (items.length === 0) {
    return <EmptyState title="Sem disputas">Nenhuma disputa financeira.</EmptyState>;
  }
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">Disputas</caption>
        <thead>
          <tr>
            <th scope="col">ID</th>
            <th scope="col">Tipo</th>
            <th scope="col">Valor</th>
            <th scope="col">Hold</th>
            <th scope="col">Situação</th>
            <th scope="col">Aberta</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <a href={`/app/financeiro/disputas/${item.id}`}>{item.id.slice(0, 8)}…</a>
              </td>
              <td>{DISPUTE_TYPE_LABELS[item.disputeType] ?? item.disputeType}</td>
              <td>{formatMoneyCents(item.amountCents)}</td>
              <td>{item.holdApplied ? "Sim" : "Não"}</td>
              <td>
                <StatusTextBadge status={item.status} labels={DISPUTE_STATUS_LABELS} />
              </td>
              <td>{formatDateTime(item.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DisputeDetailPanels({
  dispute,
  evidence,
  history,
}: {
  dispute: FinancialDispute;
  evidence: DisputeEvidence[];
  history: DisputeHistoryEntry[];
}) {
  return (
    <div className="vj-stack">
      <section className="vj-card-grid">
        <article className="vj-card" aria-labelledby="dispute-amount">
          <h3 id="dispute-amount" className="vj-card-title">
            Valor
          </h3>
          <p className="vj-title">{formatMoneyCents(dispute.amountCents)}</p>
        </article>
        <article className="vj-card" aria-labelledby="dispute-hold">
          <h3 id="dispute-hold" className="vj-card-title">
            Hold
          </h3>
          <p>{dispute.holdApplied ? "Hold aplicado em payables/repasses" : "Sem hold"}</p>
        </article>
        <article className="vj-card" aria-labelledby="dispute-status">
          <h3 id="dispute-status" className="vj-card-title">
            Situação
          </h3>
          <StatusTextBadge status={dispute.status} labels={DISPUTE_STATUS_LABELS} />
        </article>
      </section>
      <section className="vj-stack" aria-labelledby="dispute-evidence">
        <h2 id="dispute-evidence" className="vj-subtitle">
          Evidências
        </h2>
        {evidence.length === 0 ? (
          <EmptyState title="Sem evidências">Nenhum documento anexado.</EmptyState>
        ) : (
          <ul className="vj-stack">
            {evidence.map((e) => (
              <li key={e.id}>
                {e.evidenceType ?? "documento"} · {e.documentId.slice(0, 8)}… ·{" "}
                {formatDateTime(e.submittedAt)}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="vj-stack" aria-labelledby="dispute-timeline">
        <h2 id="dispute-timeline" className="vj-subtitle">
          Linha do tempo
        </h2>
        {history.length === 0 ? (
          <EmptyState title="Sem histórico">Nenhuma mudança de status.</EmptyState>
        ) : (
          <ol className="vj-stack">
            {history.map((h) => (
              <li key={h.id}>
                <strong>
                  {h.fromStatus ? `${DISPUTE_STATUS_LABELS[h.fromStatus] ?? h.fromStatus} → ` : ""}
                  {DISPUTE_STATUS_LABELS[h.toStatus] ?? h.toStatus}
                </strong>{" "}
                · {formatDateTime(h.createdAt)}
                {h.note ? ` — ${h.note}` : ""}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

export function ReconciliationRunsTable({ items }: { items: ReconciliationRun[] }) {
  if (items.length === 0) {
    return <EmptyState title="Sem conciliações">Nenhuma execução de conciliação.</EmptyState>;
  }
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">Conciliações Gateway / Ledger / Banco</caption>
        <thead>
          <tr>
            <th scope="col">Fonte A</th>
            <th scope="col">Fonte B</th>
            <th scope="col">Período</th>
            <th scope="col">Situação</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{EXTERNAL_SOURCE_LABELS[item.sourceA] ?? item.sourceA}</td>
              <td>{EXTERNAL_SOURCE_LABELS[item.sourceB] ?? item.sourceB}</td>
              <td>
                {formatDateTime(item.periodStart)} → {formatDateTime(item.periodEnd)}
              </td>
              <td>
                <StatusTextBadge status={item.status} labels={RECONCILIATION_RUN_STATUS_LABELS} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReconciliationSideBySide({
  items,
  imports,
}: {
  items: ReconciliationItem[];
  imports: Array<{
    sourceType: string;
    amountCents: number;
    externalId: string;
    occurredAt: string;
  }>;
}) {
  const bySource = {
    gateway: imports.filter((i) => i.sourceType === "payment_provider"),
    ledger: imports.filter((i) => i.sourceType === "ledger"),
    bank: imports.filter((i) => i.sourceType === "bank"),
  };
  return (
    <div className="vj-stack">
      <div className="vj-card-grid">
        {(
          [
            ["Gateway", bySource.gateway],
            ["Ledger", bySource.ledger],
            ["Banco", bySource.bank],
          ] as const
        ).map(([title, rows]) => (
          <section key={title} className="vj-card" aria-labelledby={`recon-${title}`}>
            <h3 id={`recon-${title}`} className="vj-card-title">
              {title}
            </h3>
            <p className="vj-title">{rows.length}</p>
            <p className="vj-meta">
              {formatMoneyCents(rows.reduce((s, r) => s + r.amountCents, 0))}
            </p>
          </section>
        ))}
      </div>
      {items.length === 0 ? (
        <EmptyState title="Sem itens">Nenhum item de conciliação neste período.</EmptyState>
      ) : (
        <div className="vj-table-wrap">
          <table className="vj-table">
            <caption className="vj-visually-hidden">Itens lado a lado</caption>
            <thead>
              <tr>
                <th scope="col">Fonte A</th>
                <th scope="col">Fonte B</th>
                <th scope="col">Diferença</th>
                <th scope="col">Situação</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    {EXTERNAL_SOURCE_LABELS[item.sourceAType ?? ""] ?? item.sourceAType ?? "—"}
                    {item.sourceAId ? ` · ${item.sourceAId.slice(0, 8)}…` : ""}
                  </td>
                  <td>
                    {EXTERNAL_SOURCE_LABELS[item.sourceBType ?? ""] ?? item.sourceBType ?? "—"}
                    {item.sourceBId ? ` · ${item.sourceBId.slice(0, 8)}…` : ""}
                  </td>
                  <td>
                    {item.amountDifferenceCents != null
                      ? formatMoneyCents(item.amountDifferenceCents)
                      : "—"}
                  </td>
                  <td>
                    <StatusTextBadge
                      status={item.status}
                      labels={RECONCILIATION_ITEM_STATUS_LABELS}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function DiscrepanciesTable({ items }: { items: FinancialDiscrepancy[] }) {
  if (items.length === 0) {
    return <EmptyState title="Sem divergências">Nenhuma divergência aberta.</EmptyState>;
  }
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">Divergências</caption>
        <thead>
          <tr>
            <th scope="col">Tipo</th>
            <th scope="col">Fonte</th>
            <th scope="col">Valor</th>
            <th scope="col">Severidade</th>
            <th scope="col">Situação</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.type}</td>
              <td>{EXTERNAL_SOURCE_LABELS[item.source ?? ""] ?? item.source ?? "—"}</td>
              <td>{formatMoneyCents(item.amountCents)}</td>
              <td>
                <StatusTextBadge status={item.severity} labels={DISCREPANCY_SEVERITY_LABELS} />
              </td>
              <td>
                <StatusTextBadge status={item.status} labels={DISCREPANCY_STATUS_LABELS} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CashActualCard({ cash }: { cash: CashPosition }) {
  return (
    <section className="vj-card" aria-labelledby="cash-actual">
      <p className="vj-meta">
        <Badge tone="success">ACTUAL</Badge> · derivado do ledger · não é saldo bancário
      </p>
      <h3 id="cash-actual" className="vj-card-title">
        Caixa (ledger)
      </h3>
      <p className="vj-title">{formatMoneyCents(cash.balanceCents)}</p>
      <p className="vj-meta">
        {cash.currency} · em {formatDateTime(cash.asOf)} · {cash.derivedFrom}
      </p>
    </section>
  );
}

export function ForecastVsActual({ forecasts }: { forecasts: TreasuryForecast[] }) {
  return (
    <div className="vj-stack">
      <p className="vj-meta">
        <Badge tone="success">ACTUAL</Badge> = posição real do ledger ·{" "}
        <Badge tone="warning">FORECAST</Badge> = projeção — nunca misturar.
      </p>
      {forecasts.length === 0 ? (
        <EmptyState title="Sem forecasts">Nenhuma projeção cadastrada.</EmptyState>
      ) : (
        <div className="vj-table-wrap">
          <table className="vj-table">
            <caption className="vj-visually-hidden">Forecasts</caption>
            <thead>
              <tr>
                <th scope="col">Nome</th>
                <th scope="col">Cenário</th>
                <th scope="col">Período</th>
                <th scope="col">Tipo</th>
              </tr>
            </thead>
            <tbody>
              {forecasts.map((f) => (
                <tr key={f.id}>
                  <td>{f.name}</td>
                  <td>{FORECAST_SCENARIO_LABELS[f.scenario] ?? f.scenario}</td>
                  <td>
                    {formatDateTime(f.periodStart)} → {formatDateTime(f.periodEnd)}
                  </td>
                  <td>
                    <Badge tone="warning">FORECAST</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ReceivablesTable({ items }: { items: TreasuryReceivable[] }) {
  if (items.length === 0) {
    return <EmptyState title="Sem recebíveis">Nenhuma conta a receber.</EmptyState>;
  }
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">Contas a receber</caption>
        <thead>
          <tr>
            <th scope="col">Contraparte</th>
            <th scope="col">Aberto</th>
            <th scope="col">Total</th>
            <th scope="col">Vencimento</th>
            <th scope="col">Situação</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                {item.debtorType ?? item.sourceType} ·{" "}
                {(item.debtorId ?? item.sourceId).slice(0, 8)}…
              </td>
              <td>{formatMoneyCents(item.amountDueCents)}</td>
              <td>{formatMoneyCents(item.amountCents)}</td>
              <td>{item.dueAt ? formatDateTime(item.dueAt) : "—"}</td>
              <td>
                <StatusTextBadge status={item.status} labels={RECEIVABLE_STATUS_LABELS} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AccountsPayableTable({ items }: { items: TreasuryAccountsPayable[] }) {
  if (items.length === 0) {
    return <EmptyState title="Sem contas a pagar">Nenhuma conta a pagar.</EmptyState>;
  }
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">Contas a pagar</caption>
        <thead>
          <tr>
            <th scope="col">Contraparte</th>
            <th scope="col">Categoria</th>
            <th scope="col">Valor</th>
            <th scope="col">Vencimento</th>
            <th scope="col">Situação</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.vendorName ?? item.description ?? "—"}</td>
              <td>{item.category ?? "—"}</td>
              <td>{formatMoneyCents(item.amountCents)}</td>
              <td>{item.dueAt ? formatDateTime(item.dueAt) : "—"}</td>
              <td>
                <StatusTextBadge status={item.status} labels={AP_STATUS_LABELS} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DelinquencyTable({ items }: { items: DelinquencyCase[] }) {
  if (items.length === 0) {
    return <EmptyState title="Sem inadimplência">Nenhum caso de inadimplência.</EmptyState>;
  }
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">Inadimplência</caption>
        <thead>
          <tr>
            <th scope="col">Estágio</th>
            <th scope="col">Dias em atraso</th>
            <th scope="col">Situação</th>
            <th scope="col">Notas</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{DELINQUENCY_STAGE_LABELS[item.stage] ?? item.stage}</td>
              <td>{item.daysOverdue ?? "—"}</td>
              <td>
                <StatusTextBadge status={item.status} labels={DELINQUENCY_STATUS_LABELS} />
              </td>
              <td>{item.notes ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MonetizationDashboardCards({ data }: { data: MonetizationDashboard }) {
  return (
    <div className="vj-stack">
      <Alert tone="info" title="Fórmulas">
        MRR: {data.formulas.mrr}. ARR: {data.formulas.arr} ({data.arrKind}).
      </Alert>
      <div className="vj-card-grid">
        <section className="vj-card" aria-labelledby="mrr">
          <h3 id="mrr" className="vj-card-title">
            MRR
          </h3>
          <p className="vj-title">{formatMoneyCents(data.mrrCents)}</p>
        </section>
        <section className="vj-card" aria-labelledby="arr">
          <h3 id="arr" className="vj-card-title">
            ARR (run-rate)
          </h3>
          <p className="vj-title">{formatMoneyCents(data.arrRunRateCents)}</p>
        </section>
        <section className="vj-card" aria-labelledby="subs">
          <h3 id="subs" className="vj-card-title">
            Assinaturas ativas
          </h3>
          <p className="vj-title">{data.activeSubscriptions}</p>
        </section>
        <section className="vj-card" aria-labelledby="ai-credits">
          <h3 id="ai-credits" className="vj-card-title">
            Créditos de IA
          </h3>
          <p className="vj-title">{data.aiCredits.balanceCredits}</p>
          <p className="vj-meta">
            Vendas {data.aiCredits.salesCredits} · uso {data.aiCredits.usageCredits}.{" "}
            {data.aiCredits.note} Créditos comerciais ≠ tokens do provedor.
          </p>
        </section>
        <section className="vj-card" aria-labelledby="api-usage">
          <h3 id="api-usage" className="vj-card-title">
            Uso de API
          </h3>
          <p className="vj-title">{data.apiUsageTotal}</p>
        </section>
      </div>
    </div>
  );
}

export function MonetizationProductsTable({ items }: { items: MonetizationProduct[] }) {
  if (items.length === 0) {
    return <EmptyState title="Sem produtos">Nenhum produto de monetização.</EmptyState>;
  }
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">Produtos</caption>
        <thead>
          <tr>
            <th scope="col">Nome</th>
            <th scope="col">Tipo</th>
            <th scope="col">Preço</th>
            <th scope="col">Público</th>
            <th scope="col">Ativo</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const price = item.prices?.find((p) => p.active) ?? item.prices?.[0];
            return (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{PRODUCT_TYPE_LABELS[item.productType] ?? item.productType}</td>
                <td>{price ? formatMoneyCents(price.amountCents) : "—"}</td>
                <td>{item.public ? "Sim" : "Não"}</td>
                <td>
                  <Badge tone={item.active ? "success" : "neutral"}>
                    {item.active ? "Ativo" : "Inativo"}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function PublicPlansComparison({ items }: { items: MonetizationProduct[] }) {
  if (items.length === 0) {
    return (
      <EmptyState title="Planos não configurados">
        Nenhum plano público ativo (NOT_CONFIGURED / catálogo vazio). Features só aparecem quando
        cadastradas de fato.
      </EmptyState>
    );
  }
  return (
    <div className="vj-card-grid">
      {items.map((plan) => {
        const price = plan.prices?.find((p) => p.active) ?? plan.prices?.[0];
        const features = Array.isArray(plan.features) ? plan.features : null;
        return (
          <article key={plan.id} className="vj-card" aria-labelledby={`plan-${plan.id}`}>
            <h2 id={`plan-${plan.id}`} className="vj-card-title">
              {plan.name}
            </h2>
            <p className="vj-title">
              {price ? formatMoneyCents(price.amountCents) : "Sob consulta"}
            </p>
            <p className="vj-meta">{plan.description ?? plan.planTier ?? plan.key}</p>
            {features && features.length > 0 ? (
              <ul>
                {features.map((f, i) => (
                  <li key={typeof f === "string" ? f : `feature-${i}`}>
                    {typeof f === "string" ? f : JSON.stringify(f)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="vj-meta">
                Features: não configuradas nesta listagem pública (fonte:{" "}
                {plan.featureSource ?? "entitlement_service"}).
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}

export function ApiClientsTable({ items }: { items: ApiClient[] }) {
  if (items.length === 0) {
    return <EmptyState title="Sem clientes de API">Nenhum cliente de API.</EmptyState>;
  }
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">Clientes de API</caption>
        <thead>
          <tr>
            <th scope="col">Nome</th>
            <th scope="col">Situação</th>
            <th scope="col">Criado</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>
                <StatusTextBadge status={item.status} labels={API_CLIENT_STATUS_LABELS} />
              </td>
              <td>{formatDateTime(item.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LicensesTable({ items }: { items: SoftwareLicense[] }) {
  if (items.length === 0) {
    return <EmptyState title="Sem licenças">Nenhuma licença de software.</EmptyState>;
  }
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">Licenças</caption>
        <thead>
          <tr>
            <th scope="col">Produto</th>
            <th scope="col">Tipo</th>
            <th scope="col">Assentos</th>
            <th scope="col">Situação</th>
            <th scope="col">Início</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.product}</td>
              <td>{item.licenseType}</td>
              <td>{item.seats ?? "—"}</td>
              <td>
                <StatusTextBadge status={item.status} labels={LICENSE_STATUS_LABELS} />
              </td>
              <td>{formatDateTime(item.startsAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function WhiteLabelPanel({ config }: { config: WhiteLabelConfig | null }) {
  if (!config) {
    return (
      <EmptyState title="White-label não configurado">
        Branding apenas — não altera segurança nem auditoria (NOT_CONFIGURED).
      </EmptyState>
    );
  }
  return (
    <section className="vj-stack" aria-labelledby="wl-title">
      <h2 id="wl-title" className="vj-subtitle">
        {config.brandName ?? "White-label"}
      </h2>
      <StatusTextBadge status={config.status} labels={WHITE_LABEL_STATUS_LABELS} />
      <dl className="vj-stack">
        <div>
          <dt className="vj-meta">Domínio</dt>
          <dd>
            {config.customDomain ?? "—"}
            {config.customDomainVerified ? " (verificado)" : ""}
          </dd>
        </div>
        <div>
          <dt className="vj-meta">Cores</dt>
          <dd>
            {config.primaryColor ?? "—"} / {config.secondaryColor ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="vj-meta">Escopo</dt>
          <dd>Somente branding — segurança e auditoria inalteradas.</dd>
        </div>
      </dl>
    </section>
  );
}
