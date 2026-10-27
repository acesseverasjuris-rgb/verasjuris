# ADR 069 — Provedor de oportunidades públicas NOT_CONFIGURED

## Status

Aceito (Etapa 6).

## Decisão

- `PUBLIC_OPPORTUNITY_PROVIDER=not_configured` é o único valor no schema de env.
- `NotConfiguredPublicOpportunityProvider` responde `PUBLIC_OPPORTUNITY_PROVIDER_NOT_CONFIGURED`.
- CRUD manual, interesses e requisitos permanecem; **sem** busca PNCP ou sync.

## Motivo

Não simular edital oficial nem inventar oportunidades de portal externo.
