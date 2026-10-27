# ADR 103 — Cálculo determinístico separado de IA

## Status

Aceito (Prompt 16).

## Decisão

- Motores previdenciários e trabalhistas vivem em `@verasjuris/calculations` (TypeScript puro: sem DB, Fastify ou LLM).
- IA (`AIGateway`) pode **sugerir** tarefas/prazos ou auxiliar leitura; **não** executa nem confirma carência, RMI, rescisão ou liquidação.
- Resultado de cálculo exige revisão humana (`review_required` → `reviewed` / `approved`).

## Motivo

Cálculos jurídicos devem ser reprodutíveis e auditáveis. Misturar LLM no motor geraria aleatoriedade e risco de alucinação numérica.

## Relacionado

`docs/PREVIDENTIARY_CALCULATIONS.md`, `docs/LABOR_CALCULATIONS.md`, `docs/AI_CORE.md`, ADR 065
