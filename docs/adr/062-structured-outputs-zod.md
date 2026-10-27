# ADR 062 — Saídas estruturadas validadas com Zod

## Status

Aceito (Etapa 6).

## Decisão

- Features `STRUCTURED_OUTPUT` (classificação documental, análise jurídica, etc.) passam schema **Zod** no gateway.
- Resposta fora do esquema → `AI_INVALID_RESPONSE`, request `failed`, domínio **não** persiste resultado como válido.

## Motivo

Impedir JSON parcial ou alucinado de virar dado operacional silenciosamente.
