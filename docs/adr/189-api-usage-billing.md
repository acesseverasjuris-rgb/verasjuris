# ADR 189 — API usage billing

## Status

Accepted

## Context

Registrar usage sem caminho até invoice/charge deixa monetização de API como contador morto ou paid inventado.

## Decision

- Usage → agregação → `billing_charges` / invoice lines pelo fluxo Finance existente.
- Sem `BillingProvider`/`PaymentProvider`: charge pode ficar `not_configured` / pending — nunca paid fictício.
- Scopes e rate limits via entitlements + client status.

## Consequences

Mesmo pipeline de planos/invoices/payments. Docs: `docs/API_MONETIZATION.md`, `docs/BILLING.md`.
