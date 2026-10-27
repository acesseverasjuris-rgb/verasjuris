# Cálculos trabalhistas (Prompt 16)

## Princípio

`LaborCalculationEngine` e funções em `@verasjuris/calculations` — TypeScript puro, centavos inteiros, rule sets versionados, snapshots reprodutíveis (ADRs 103, 104, 106, 110, 111).

## Motores

| Função | Uso |
| --- | --- |
| `calculateJornada` | Horas, extras, noturno a partir de segmentos |
| `calculateRemuneracao` | Composição de rubricas |
| `calculateFerias` | Férias / abono conforme params do rule set |
| `calculateFgtsEstimate` | Estimativa FGTS (label fixa ≠ saldo oficial) |
| `TerminationCalculator` / rescisão | Verbas rescisórias a partir do input |
| `calculateLiquidacao` | Agrega pedidos com correção/juros informados |

Envelope: `result` + `memory` + `warnings` + `missingData` + `ruleSetVersion`.

## FGTS estimado ≠ oficial

Constante `FGTS_ESTIMATE_LABEL`:

> Estimativa de FGTS com base nos valores informados (não é saldo oficial).

Sem `FGTSProvider` configurado, a API/UI **não** afirma extrato oficial. Registros em `fgts_records` são informados/manuais com `reviewStatus`.

## Persistência e fluxo

1. `POST …/labor-calculations` — draft + `inputSnapshot` + `ruleSetVersion`.
2. `POST …/:id/run` — motor determinístico → `resultSnapshot`.
3. `POST …/:id/review` — `labor.review_calculation`.

Rule sets: `labor_rule_sets` com lock após uso.

## IA

Sugestão de tarefas/prazos no caso trabalhista **não** é cálculo. `AI_PROVIDER=not_configured` não inventa verbas.

## Limites

- Sem tabela oficial de índices sincronizada.
- Sem homologação judicial automática do resultado.
- Dados faltantes listados — não inventados.
