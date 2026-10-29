# Ledger de plataforma

## Princípio

Livro-razão double-entry da plataforma (`ledger_accounts`, `ledger_transactions`, `ledger_entries`). Fonte de verdade monetária após postagem. Serviços: `ledger-posting-service.ts`, `ledger-balance-service.ts`, `ledger-ops.ts`.

## Contas de sistema

Chaves: `CASH_CLEARING`, `PAYMENT_RECEIVABLE`, `CUSTOMER_CREDIT_LIABILITY`, `PROFESSIONAL_PAYABLE`, `PLATFORM_REVENUE`, `PROCESSING_FEE_EXPENSE`, `REFUND_PAYABLE`, `CHARGEBACK_CLEARING`.

## Transações

Tipos: `payment_received`, `refund`, `invoice_recognition`, `credit_applied`, `fee_accrual`, `platform_fee`, `payout`, `chargeback`, `manual_journal`, `reversal`, `cost`, … Status: `draft` | `posted` | `reversed`.

Idempotência: `(organizationId, idempotencyKey)` único.

## Regras (ADRs 160–163)

- Double-entry equilibrado (débito = crédito).
- Após `posted`: imutável; correção só por **reversão**.
- Saldo **derivado** de entries — nunca coluna de saldo primária.

## ≠ ledgers de domínio

`client_payment_records` (portal) e pagamentos operacionais de consulta/leilão **não** são este ledger. Podem coexistir; integração futura postando no ledger de plataforma usa o mesmo `PaymentProvider` / efeito exactly-once (ADR 167).

## Split / payout / refund

Allocations e payables podem postar fee/payable; payout e refund confirmados geram txs próprias (ADRs 173, 176–178). Conciliação **nunca** muta entries postadas (ADR 182).

## Relacionado

`docs/DOUBLE_ENTRY.md`, `docs/FINANCIAL_RECONCILIATION.md`, `docs/PAYMENTS.md`, `docs/SPLIT.md`, `docs/TREASURY.md`, ADRs 160–163, 167, 170, 173, 176, 181–182.
