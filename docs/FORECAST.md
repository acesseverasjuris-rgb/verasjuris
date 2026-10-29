# Forecast de tesouraria

## Princípio

Forecast **determinístico** (ADR 183): fatores fixos em basis points por cenário (`pessimistic` / `base` / `favorable` / `custom`). **Actual ≠ forecast** (ADR 184) — campos `projected*` e `actual*` separados em `treasury_forecast_versions`.

Tabelas: `treasury_forecasts`, `treasury_forecast_versions`. Serviço: `TreasuryForecastService` em `treasury-service.ts`.

## Regras

- Opening/inflows/outflows/closing projetados a partir de AR/AP/ledger snapshot + multiplicadores.
- Não usa ML nem números inventados de banco.
- Nova versão append-only; `currentVersionId` aponta a vigente.

## Relacionado

`docs/TREASURY.md`, ADRs 183–184.
