# ADR 164 — PaymentProvider única abstração

## Status

Accepted

## Context

Vários domínios (portal, consulta, leilão, finance, educação) precisam de PSP sem duplicar contratos.

## Decision

- Um único `PaymentProvider` em `@verasjuris/ai` — evoluir, não forkar.
- Domínios guardam seus registros operacionais; liquidação PSP passa pelo mesmo adapter.
- Default `NotConfiguredPaymentProvider`.

## Consequences

Capacidades compartilhadas (intent, checkout, webhook, refund); docs atualizam escopos em `PAYMENT_PROVIDER.md`.
