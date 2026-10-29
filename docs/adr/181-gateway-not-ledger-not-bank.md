# ADR 181 — Gateway ≠ Ledger ≠ Bank

## Status

Accepted

## Context

Assumir que saldo do PSP = livro-razão = extrato bancário esconde fees, timing e falhas de webhook.

## Decision

- Três fontes: `payment_provider`, `ledger`, `bank` (mais import manual/ERP).
- Conciliação compara pares via `reconciliation_runs` / items.
- Nenhuma fonte é “verdade absoluta” sozinha para caixa operacional.

## Consequences

Discrepâncias ficam explícitas. Docs: `docs/FINANCIAL_RECONCILIATION.md`, `docs/TREASURY.md`.
