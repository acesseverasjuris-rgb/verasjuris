# Financeiro de plataforma (Etapas 21+)

## Princípio

Catálogo de planos ≠ Assinatura ≠ Invoice ≠ PaymentIntent ≠ Payment ≠ Ledger ≠ crédito comercial ≠ allocation ≠ payable ≠ payout ≠ forecast. Dinheiro em **centavos inteiros** (ADR 170). % em **basis points**.

Schema: `packages/database/src/schema/finance.ts` + `monetization.ts`. Serviços: `apps/api/src/modules/finance/`. Policies: `packages/auth/src/finance-policies.ts`.

## Mapa

| Conceito | Doc |
| --- | --- |
| Planos, cobranças, créditos | `docs/BILLING.md`, `docs/PLANS.md` |
| Assinaturas + entitlements | `docs/SUBSCRIPTIONS.md`, `docs/ENTITLEMENTS.md` |
| Monetização (usage, AI, API, license, WL) | `docs/MONETIZATION.md` |
| Faturas | `docs/INVOICES.md` |
| Honorários jurídicos | `docs/LEGAL_FEES.md` |
| Taxas de plataforma | `docs/PLATFORM_FEES.md` |
| Custos | `docs/COSTS.md` |
| Ledger double-entry | `docs/LEDGER.md`, `docs/DOUBLE_ENTRY.md` |
| Split / retentions / payables | `docs/SPLIT.md`, `docs/FINANCIAL_RETENTIONS.md`, `docs/PAYABLES.md` |
| Payouts / refunds / chargebacks | `docs/PAYOUTS.md`, `docs/REFUNDS.md`, `docs/CHARGEBACKS.md` |
| Disputas financeiras | `docs/FINANCIAL_DISPUTES.md` |
| Conciliação | `docs/FINANCIAL_RECONCILIATION.md`, `docs/RECONCILIATION.md` |
| Tesouraria / AR / AP / delinquency / forecast | `docs/TREASURY.md`, … |
| Pagamentos / PSP | `docs/PAYMENTS.md`, `docs/PAYMENT_PROVIDER.md` |

## ≠ registros operacionais de domínio

| Domínio | Registro | vs plataforma |
| --- | --- | --- |
| Portal | `client_payment_records` | Cobrança cliente do escritório; não é ledger SaaS |
| Advogado online | `online_consultation_payments` | Pagamento da consulta |
| Pós-leilão | `auction_payments` | Operacional do leilão |
| Marketplace / diligência / extrajudicial | evidência / fee local | Podem gerar Invoice/Payment/allocation; não substituem o ledger |

Ver ADRs 157–191 e `docs/PAYMENT_PROVIDER.md`.

## Providers

`PaymentProvider`, `PayoutProvider`, `PaymentDisputeProvider`, `BillingProvider`, `FiscalDocumentProvider`, `ReconciliationProvider`, `BankingProvider`, `DebtCollectionProvider`, `TaxWithholdingProvider`, `CustomDomainProvider`, `LicenseProvider` — default `not_configured`. Nunca marcar paid/active/authorized/matched/verified fictício.

## UI

`/app/financeiro/*`, checkout `/checkout/*`.

## Relacionado

ADRs 157–191, `docs/ARCHITECTURE.md`, `docs/DOMAINS.md`.
