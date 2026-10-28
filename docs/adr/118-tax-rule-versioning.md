# ADR 118 — Versionamento de regras tributárias

## Status

Aceito (Etapas 11–13).

## Decisão

- `tax_rule_sets` com `(key, version)`, vigência e `locked` após uso em `tax_calculations`.
- `inputSnapshot` / `resultSnapshot` reproduzem execução (paralelo ADR 106).
- Seed `system_seed` não afirma consolidado oficial da Receita.

## Motivo

Auditoria e revisão humana de cálculos fiscais simulados.

## Relacionado

`docs/TAX_CALCULATIONS.md`, ADR 104, 106
