# ADR 184 — Actual ≠ forecast

## Status

Accepted

## Context

Misturar realizado e projetado no mesmo campo impede variance analysis e mascara dados faltantes.

## Decision

- `treasury_forecast_versions` separa `projected*` de `actual*`.
- Caixa real continua derivado do ledger (`treasury_cash_positions.derivedFrom=ledger`).
- UI/API expõem a distinção explicitamente.

## Consequences

Variance = actual − projected quando actual preenchido; senão, gap honesto. Docs: `docs/FORECAST.md`, `docs/TREASURY.md`.
