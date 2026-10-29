# Payables (obrigações a beneficiários)

## Princípio

**Payable before Payout** (ADR 174). `payables` é a obrigação da plataforma para um beneficiário; `payouts` é o ato de pagar essa obrigação. Saldo de ledger (`PROFESSIONAL_PAYABLE`) ≠ payout liquidado (ADR 173).

Tabela: `payables` (schema monetization). Serviço: `split-allocation-service.ts` (criação), `payout-service.ts` (consumo).

## Status

`pending` | `held` | `available` | `scheduled` | `paid` | `cancelled` | `reversed`.

Hold por disputa (`heldByDisputeId`, ADR 180) ou retenção/compliance. Payout só consome payables `available` / `pending` elegíveis.

## ≠ Accounts Payable (tesouraria)

`payables` = obrigação de **repasse** a profissional/parceiro a partir de allocation. `accounts_payable` (tesouraria) = contas a pagar operacionais (fornecedor, custo) — ver `docs/ACCOUNTS_PAYABLE.md`.

## Relacionado

`docs/SPLIT.md`, `docs/PAYOUTS.md`, `docs/FINANCIAL_DISPUTES.md`, ADRs 173–174, 180.
