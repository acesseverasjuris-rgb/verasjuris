# ADR 174 — Payable before Payout

## Status

Accepted

## Context

Criar payout direto a partir do pagamento pula retenções, holds e auditoria de beneficiário.

## Decision

- Fluxo obrigatório: allocation (+ retentions) → `payables` → `payouts`.
- `PayoutService.createFromPayables` exige payables existentes e elegíveis.
- Sem payable: sem payout.

## Consequences

Dispute hold e refund clawback operam sobre payables. Docs: `docs/PAYABLES.md`, `docs/PAYOUTS.md`.
