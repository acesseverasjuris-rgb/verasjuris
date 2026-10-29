# ADR 157 — Billing ≠ Payment

## Status

Accepted

## Context

Planos/assinaturas/cobranças misturados com liquidação PSP geram estados “paid” falsos.

## Decision

- Billing: planos, features, charges, créditos comerciais, `BillingProvider`.
- Payment: intents, payments, webhooks, `PaymentProvider`.
- Não marcar assinatura/fatura paga só porque billing externo está `not_configured`.

## Consequences

Dois contratos em `@verasjuris/ai`; docs `BILLING.md` vs `PAYMENTS.md`.
