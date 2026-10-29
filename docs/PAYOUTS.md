# Repasses (payouts)

## Modelo

`split_rules` → `payment_allocations` → `financial_retentions` → **`payables`** → `payouts` (+ `payout_schedules`). Status default `not_configured` até provider/fluxo real.

## Payable before Payout (ADR 174)

Payout consome payables existentes (`createFromPayables`). Não criar payout “solto” a partir de saldo imaginário. **Payout ≠ ledger balance** (ADR 173): saldo em `PROFESSIONAL_PAYABLE` é contábil; liquidação exige payout confirmado.

## Provider

`PayoutProvider` (e capacidade de split do `PaymentProvider`). Sem configuração: status `not_configured` — **nunca** marcar `paid`. Erro típico: `PAYOUT_PROVIDER_NOT_CONFIGURED`.

## Ledger

Payout confirmado pode gerar transação tipo `payout` (exactly-once via `ledgerTransactionId` quando postado).

## Hold / refund

Disputa aplica hold em payables e payouts in-flight (ADR 180). Refund após payout gera clawback/receivable — ver `docs/REFUNDS.md` (ADR 178).

## Distinção

≠ pagamento ao cliente no portal; ≠ honorário accrual; ≠ accounts_payable de fornecedor. É o dinheiro **saindo** da plataforma para profissional/beneficiário.

## Relacionado

`docs/SPLIT.md`, `docs/PAYABLES.md`, `docs/PLATFORM_FEES.md`, `docs/PAYMENTS.md`, `docs/LEDGER.md`, ADRs 171–174, 178, 180.
