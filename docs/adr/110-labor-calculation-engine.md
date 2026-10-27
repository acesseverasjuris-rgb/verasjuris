# ADR 110 — LaborCalculationEngine

## Status

Aceito (Prompt 16).

## Decisão

- `LaborCalculationEngine` em `@verasjuris/calculations` cobre jornada, remuneração, férias, FGTS estimado, rescisão e liquidação.
- API persiste em `labor_calculations` / `labor_liquidations` com snapshots e revisão humana.
- Dinheiro em centavos inteiros; alíquotas em basis points quando aplicável.

## Motivo

Um único pacote determinístico evita motores espalhados na API e garante o mesmo envelope (memória, avisos, dados faltantes) do lado previdenciário.

## Relacionado

`docs/LABOR_CALCULATIONS.md`, `docs/LABOR_LIQUIDATION.md`, ADR 103 / 106
