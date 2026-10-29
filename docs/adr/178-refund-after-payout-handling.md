# ADR 178 — Refund after payout handling

## Status

Accepted

## Context

Reembolsar o pagador depois que o beneficiário já recebeu exige clawback — não apagar o payout histórico.

## Decision

- Hold/cancel de payouts ainda não liquidados.
- Unpaid payables: cancel ou offset append-only.
- Parcela já `paid`: cria obrigação de clawback (`refund_after_payout` / receivable `refund_clawback`) sem deletar o payout.

## Consequences

Risco de caixa fica explícito; conciliação pode apontar mismatch até recuperação. Docs: `docs/REFUNDS.md`, `docs/PAYOUTS.md`.
