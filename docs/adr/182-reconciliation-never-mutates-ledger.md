# ADR 182 — Reconciliation never mutates ledger

## Status

Accepted

## Context

“Corrigir” o ledger durante o match apaga auditoria e viola imutabilidade pós-posting.

## Decision

- Conciliação só cria/atualiza runs, items e discrepancies + notas de resolução.
- Correção monetária: `reverse` + nova transação via `LedgerPostingService`.
- Provider `not_configured` nunca marca matched fictício.

## Consequences

Review humano obrigatório para remediação. Doc: `docs/FINANCIAL_RECONCILIATION.md`.
