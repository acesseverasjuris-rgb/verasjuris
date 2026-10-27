# ADR 107 — Comparação de cenários de benefício

## Status

Aceito (Prompt 16).

## Decisão

- `benefit_scenarios` + `compareBenefitScenarios` ordenam por RMI estimada em centavos.
- Label oficial do “maior”: *“Cenário com maior valor estimado entre os dados simulados.”* — **nunca** “melhor benefício definitivo”.
- Comparação é estimativa com `assumptions` / `missingData`; exige revisão (`reviewStatus`).

## Motivo

Simulação de DER/espécies ajuda a estratégia, mas rotular “melhor” como definitivo induz erro jurídico e responsabilidade indevida do sistema.

## Relacionado

`docs/PREVIDENTIARY_CALCULATIONS.md`, `@verasjuris/calculations` (`scenarios.ts`)
