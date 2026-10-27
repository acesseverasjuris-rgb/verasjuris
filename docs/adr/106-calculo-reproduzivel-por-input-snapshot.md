# ADR 106 — Cálculo reprodutível por input snapshot

## Status

Aceito (Prompt 16).

## Decisão

- `previdentiary_calculations` e `labor_calculations` persistem `inputSnapshot` e `resultSnapshot` (JSON).
- Reexecução usa o snapshot (e `ruleSetVersion`); não “reconstrói” silenciosamente a partir do estado mutável atual do caso.
- Envelope do motor: `result` + `memory` + `warnings` + `missingData` + `ruleSetVersion`.

## Motivo

Auditoria e contestação exigem saber exatamente o que foi calculado. Sem snapshot, mudanças posteriores no CNIS/contrato invalidariam o histórico.

## Relacionado

`docs/PREVIDENTIARY_CALCULATIONS.md`, `docs/LABOR_CALCULATIONS.md`, ADR 103 / 104
