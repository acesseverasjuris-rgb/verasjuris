# ADR 175 — Retention source explicit

## Status

Accepted

## Context

Retenção fiscal/reserva sem origem confunde estimativa interna com valor confirmado pelo provider/fisco.

## Decision

- `financial_retentions.source` obrigatório: `manual` | `estimated` | `provider_confirmed`.
- `provider_confirmed` só com evidência/adapter real (`TaxWithholdingProvider` etc.).
- Default providers `not_configured` → nunca promover fonte fictícia.

## Consequences

Net da allocation permanece auditável. Doc: `docs/FINANCIAL_RETENTIONS.md`.
