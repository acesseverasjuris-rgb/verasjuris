# ADR 070 — Integração externa NOT_CONFIGURED

## Status

Aceito (Etapa 6).

## Decisão

- Flag `FEATURE_EXTERNAL_INTEGRATIONS` existe; adapters concretos (PNCP, tribunais, OpenAI, etc.) **não** estão registrados.
- Provedores de IA, OCR e oportunidades públicas permanecem `not_configured` até ADR + implementação dedicada.
- Health/status expõe `not_configured` explicitamente.

## Motivo

Manter o mesmo padrão de honestidade de storage, e-mail, fila e feriados: contrato sem fingir integração.
