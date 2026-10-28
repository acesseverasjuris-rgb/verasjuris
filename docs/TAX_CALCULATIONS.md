# Cálculos tributários (Etapas 11–13)

## Princípio

Cálculo **determinístico** em `@verasjuris/calculations` (`TaxCalculationEngine` e funções exportadas). Sem LLM no caminho numérico (ADR 103, 117). Persistência com `inputSnapshot` / `resultSnapshot` e `ruleSetVersion` (ADR 118).

## Motores

| Tipo / função | Uso |
| --- | --- |
| `calculateTaxUpdate` | Atualização monetária |
| `calculateTaxDebit` | Débito principal |
| `calculateTaxCredit` | Crédito |
| `calculateTaxRefund` | Restituição |
| `calculateTaxCompensation` | Compensação |
| `calculatePenaltyInterest` | Multa e juros |
| `calculateTaxInstallment` | Parcelamento |
| `compareTaxScenarios` | Cenários comparativos (`LOWEST_TAX_SCENARIO_LABEL` honesto) |

Envelope: `result`, `memory`, `warnings`, `missingData`, `ruleSetVersion`; status API tipicamente `calculated` → `review_required` → revisão humana.

## Rule sets

Tabela `tax_rule_sets`: `(key, version)`, vigência, `locked` após uso em cálculo. Seed `system_seed` — **não** substitui tabela oficial de índices/leis; parâmetros explícitos no input/metadata.

Rule sets transversais adicionais: `versioned_rule_sets` (`domain=tax`, etc.) no núcleo de áreas.

## Fluxo API

1. `POST …/tax-cases/:id/calculations` — draft com tipo (`tax_calculation_type`), referência, snapshot de entrada.
2. `POST …/tax-calculations/:id/run` — executa motor; grava `resultSnapshot`.
3. `POST …/tax-calculations/:id/review` — revisão (`tax.review_calculation`).

Job assíncrono `TAX_CALCULATION`: stub local no worker (execução síncrona na API é o caminho principal).

## O que a IA não faz

Não calcula multa/juros oficiais, não aprova compensação, não altera lançamento. Assistência documental passa pelo `AIGateway` (`AI_PROVIDER=not_configured` por padrão).

## Limites honestos

Índices e alíquotas dependem de rule set informado; comparativo indica menor cenário **entre os simulados**, não “melhor estratégia definitiva” perante o Fisco.

## Relacionado

`docs/TAX.md`, `docs/TAX_PROVIDERS.md`, ADRs 117–118
