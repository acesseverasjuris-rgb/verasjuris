# ADR 074 — Contrato LegalSourceProvider

## Status

Aceito (Etapa 7).

## Decisão

- Fontes externas implementam **`LegalSourceProvider`** (`id`, `capabilities`, `search`, `fetchById`, `healthCheck`).
- Capacidades: `LEGISLATION`, `CASE_LAW`, `SUMULA`, `REPETITIVE_THEME`, `GENERAL_REPERCUSSION`, `PRECEDENT`, `DOCTRINE`.
- Default: `NotConfiguredLegalSourceProvider` com `capabilities = []`.
- Env: `LEGAL_SOURCE_PROVIDER` (padrão `not_configured`).

## Motivo

Mesmo padrão honesto de `AIProvider` / `OCRProvider` / `PublicOpportunityProvider`.
