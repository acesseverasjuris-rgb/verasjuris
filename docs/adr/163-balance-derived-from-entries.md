# ADR 163 — Saldo derivado de entries

## Status

Accepted

## Context

Coluna `balance` mutável diverge do razão e permite bypass de double-entry.

## Decision

- `LedgerBalanceService` agrega só entries de transações `posted`.
- Sem saldo primário armazenado em conta.
- Crédito comercial (`billing_credits`) não é saldo de ledger (ADR 159).

## Consequences

Leituras um pouco mais caras; verdade única no razão.
