# ADR 111 — FGTS estimado ≠ saldo oficial

## Status

Aceito (Prompt 16).

## Decisão

- `calculateFgtsEstimate` e registros `fgts_records` (fonte manual/informada) **nunca** são rotulados como saldo oficial.
- Label fixa: *“Estimativa de FGTS com base nos valores informados (não é saldo oficial).”*
- `FGTSProvider` default `not_configured` (`FGTS_PROVIDER_NOT_CONFIGURED`); sem adapter, a UI/API não afirma extrato Caixa/FGTS.

## Motivo

Saldo oficial exige integração certificada. Estimativa local útil para litígio não pode ser confundida com consulta oficial.

## Relacionado

`docs/LABOR_CALCULATIONS.md`, `docs/LABOR_PROVIDERS.md`, ADR 112
