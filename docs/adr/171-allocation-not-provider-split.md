# ADR 171 — Allocation ≠ Provider Split

## Status

Accepted

## Context

PSPs oferecem “split” nativo. Confundir isso com a alocação interna da plataforma gera dependência do gateway e estados mentidos quando o provider está `not_configured`.

## Decision

- `payment_allocations` / `split_rules` são a fonte de verdade **interna** de quem recebe o quê.
- Split nativo do `PaymentProvider` é capacidade opcional de liquidação — nunca substitui a allocation.
- Sem provider: alocação e payables seguem; payout permanece `not_configured`.

## Consequences

Marketplace/diligência/educação podem alocar sem Stripe Connect (ou similar). Docs: `docs/SPLIT.md`, `docs/PAYOUTS.md`.
