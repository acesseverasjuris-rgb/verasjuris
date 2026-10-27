# Cálculos previdenciários (Prompt 16)

## Princípio

Cálculo **determinístico** em `@verasjuris/calculations` (`PrevidentiaryCalculationEngine` e funções exportadas). Sem LLM no caminho numérico. Persistência com `inputSnapshot` / `resultSnapshot` e `ruleSetVersion` (ADRs 103, 104, 106, 107).

## Motores

| Função / tipo | Uso |
| --- | --- |
| `calculateCarencia` | Competências para carência |
| `calculateContributionTime` / tempo | Tempo de contribuição |
| `InsuredStatusCalculator` / `calculate` qualidade | Qualidade de segurado |
| `calculateSalarioBeneficio` | Salário de benefício |
| `InitialMonthlyBenefitCalculator` / RMI | Renda mensal inicial |
| `calculateAtrasados` | Atrasados (centavos + correção/juros informados) |
| `compareBenefitScenarios` | Ordenação de cenários por RMI estimada |

Envelope padrão: `result`, `memory`, `warnings`, `missingData`, `ruleSetVersion`, status tipicamente `calculated` → exige `review_required` / revisão humana na API.

## Rule sets

Tabela `previdentiary_rule_sets`: `(key, version)`, vigência, `locked` após uso. Seed `system_seed` — **não** é texto consolidado oficial da legislação; parâmetros explícitos no input/metadata.

## Persistência e fluxo API

1. `POST …/previdentiary-calculations` — cria draft com tipo, data de referência, snapshot de entrada.
2. `POST …/:id/run` — executa motor; grava `resultSnapshot`; status calculado / review.
3. `POST …/:id/review` — revisão humana (`previdentiary.review_calculation`); não reabre mutação silenciosa do resultado aprovado (reexecução consciente).

Cenários: `benefit_scenarios` + `POST …/previdentiary-scenarios/compare`. Label do maior valor: *“Cenário com maior valor estimado entre os dados simulados.”* — nunca “melhor benefício definitivo”.

Atrasados: `benefit_arrears_calculations` com totais em centavos.

## O que a IA não faz

Não calcula carência/RMI, não aprova cenário, não altera benefício. Pode, no máximo, assistir leitura documental via gateway (`AI_PROVIDER=not_configured` por padrão).

## Limites honestos

- Sem índices oficiais de correção sincronizados automaticamente.
- Dados faltantes entram em `missingData` — não são inventados.
- Resultado não protocola nem defere benefício.
