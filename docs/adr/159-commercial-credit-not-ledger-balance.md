# ADR 159 — Crédito comercial ≠ saldo de ledger

## Status

Accepted

## Context

`billing_credits.remainingCents` parece “saldo”, mas ledger já deriva saldos de entries.

## Decision

- Crédito comercial: entidade de billing aplicável a faturas (`billing_credits`).
- Saldo contábil: só derivado de `ledger_entries` (ex.: `CUSTOMER_CREDIT_LIABILITY`).
- Aplicação de crédito pode gerar lançamento; o crédito não substitui o ledger.

## Consequences

Evita double-source-of-truth; ADR 163 reforça saldo derivado.
