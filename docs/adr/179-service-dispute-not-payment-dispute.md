# ADR 179 — Service dispute ≠ payment dispute

## Status

Accepted

## Context

Disputa de entrega (marketplace/diligência) e chargeback do cartão têm atores, evidências e efeitos financeiros diferentes. Unificar em um único status confunde operação e PSP.

## Decision

- `financial_disputes.disputeType` distingue `service`, `payment`, `chargeback`, etc.
- `marketplace_disputes` permanece fluxo operacional de engagement.
- Chargeback/PSP usa `PaymentDisputeProvider` (default `not_configured`); resolução interna não finge won/lost externo.

## Consequences

Hold e refunds podem ser aplicados seletivamente. Docs: `docs/FINANCIAL_DISPUTES.md`, `docs/CHARGEBACKS.md`, `docs/MARKETPLACE_DISPUTES.md`.
