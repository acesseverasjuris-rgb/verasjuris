# ADR 104 — Rule sets versionados

## Status

Aceito (Prompt 16).

## Decisão

- `previdentiary_rule_sets` e `labor_rule_sets` são versionados por `(key, version)` com vigência (`effectiveFrom` / `effectiveTo`).
- Após uso em cálculo, a versão pode ser `locked` — sem reescrita silenciosa dos parâmetros.
- Todo cálculo persiste `ruleSetVersion` (e opcionalmente `ruleSetId`) junto ao resultado.

## Motivo

Regras previdenciárias/trabalhistas mudam no tempo. Sem versionamento, o mesmo input produziria resultados irreconciliáveis e sem memória normativa.

## Relacionado

`docs/PREVIDENTIARY_CALCULATIONS.md`, `docs/LABOR_CALCULATIONS.md`, ADR 106
