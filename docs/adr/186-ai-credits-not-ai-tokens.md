# ADR 186 — AI credits ≠ AI tokens

## Status

Accepted

## Context

Tokens do provider e custo em micros variam por modelo; vendê-los 1:1 como “crédito” confunde produto e custo.

## Decision

- Saldo vendável: `ai_credit_wallets.balanceCredits` / movimentos em `ai_credit_transactions`.
- `providerTokens` e `providerCostMicros` são metadados opcionais da mesma tx — não são o saldo.
- Distinto de `billing_credits` e do ledger.

## Consequences

Packs comerciais e consumo de feature usam créditos; custos reais ficam rastreáveis à parte. Doc: `docs/AI_CREDITS.md`.
