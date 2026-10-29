# ADR 167 — Payment→Ledger exactly-once

## Status

Accepted

## Context

Webhooks e retries duplicados não podem postar o mesmo efeito duas vezes no razão.

## Decision

- `confirmPayment` usa idempotência `payment_confirm:{paymentId}` + unique `payments.ledgerTransactionId`.
- Refunds: `refund_confirm:{refundId}` + unique em `refunds.ledgerTransactionId`.
- Reentrega de webhook reutiliza payment/ledger já confirmados.

## Consequences

Efeito financeiro único por pagamento/estorno; retries seguros.
