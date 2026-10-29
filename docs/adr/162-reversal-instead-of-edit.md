# ADR 162 — Reversão em vez de edição

## Status

Accepted

## Context

Erros pós-postagem são inevitáveis; edição silenciosa é inaceitável.

## Decision

- Nova transação `reversal` com `reversalOfTransactionId`.
- Original marca `reversed`; permissão `finance.ledger.reverse`.
- Idempotência também nas reversões.

## Consequences

Histórico append-only; saldos refletem par original+reversão.
