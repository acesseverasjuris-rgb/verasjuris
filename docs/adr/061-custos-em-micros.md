# ADR 061 — Custos de IA em micros inteiros

## Status

Aceito (Etapa 6).

## Decisão

- 1 unidade monetária = **1_000_000 micros** (`MICROS_PER_UNIT`).
- Persistência em `bigint`/inteiro JS seguro: `estimatedCostMicros`, `providerReportedCostMicros`, limites de orçamento.
- **`estimatedCostMicros` ≠ `providerReportedCostMicros`** — campos e relatórios distintos.

## Motivo

Evitar erro de arredondamento em float e alinhar catálogo `ai_models` com `ai_usage`.
