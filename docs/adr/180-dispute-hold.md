# ADR 180 — Dispute hold

## Status

Accepted

## Context

Durante disputa, continuar pagando o beneficiário aumenta perda irreversível se o caso for perdido.

## Decision

- Abertura de disputa financeira pode aplicar hold (`holdApplied`) em payables relacionados e bloquear payouts in-flight.
- Status de payable → `held` com `heldByDisputeId`; retenção tipo `dispute_hold` quando aplicável.
- Resolução libera hold conforme outcome; não muta ledger postado.

## Consequences

PayoutService rejeita payables held. Docs: `docs/FINANCIAL_DISPUTES.md`, `docs/PAYABLES.md`.
