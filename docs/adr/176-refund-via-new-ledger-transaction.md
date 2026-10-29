# ADR 176 — Refund via new ledger transaction

## Status

Accepted

## Context

Editar ou apagar o lançamento `payment_received` viola imutabilidade do ledger (ADRs 161–162).

## Decision

- Reembolso confirmado cria **nova** transação tipo `refund` (débito/crédito equilibrados).
- Exactly-once: idempotencyKey + `refunds.ledgerTransactionId` único.
- Tipo `credit` pode conceder `billing_credits` sem cash-out PSP.

## Consequences

Histórico de caixa preservado; payment status deriva de soma de refunds. Docs: `docs/REFUNDS.md`, `docs/LEDGER.md`.
