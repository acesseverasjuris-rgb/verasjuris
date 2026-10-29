# ADR 160 — Ledger double-entry

## Status

Accepted

## Context

Caixa único / saldo mutável não sustenta auditoria financeira nem reconciliação.

## Decision

- Toda postagem: ≥ 2 entries, débitos = créditos, mesma moeda, centavos positivos.
- Contas tipadas (asset/liability/equity/revenue/expense/clearing) + contas de sistema.

## Consequences

`LedgerPostingService` rejeita lançamento desbalanceado; base para ADRs 161–163.
