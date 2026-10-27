# Custos e uso de IA

## Unidade: micros

Todo valor monetário de IA usa **micros inteiros**:

- **1 unidade** da moeda (ex.: 1 BRL) = **`1_000_000` micros**
- Constante: `MICROS_PER_UNIT` em `@verasjuris/ai` (`cost.ts`)
- **Proibido** persistir ou somar `float` para dinheiro de IA

Catálogo `ai_models` guarda `inputCostPerMillionMicros` e `outputCostPerMillionMicros` (preço por milhão de tokens, em micros).

## Dois campos de custo (sempre distintos)

| Campo | Origem | Significado |
| --- | --- | --- |
| `estimatedCostMicros` | Cálculo interno (tokens × tabela / heurística) | Estimativa do gateway; sempre preenchido (0 se indeterminado) |
| `providerReportedCostMicros` | Resposta do provedor (quando existir) | Valor informado pelo vendor; pode ser `null` |

**`estimatedCostMicros` ≠ `providerReportedCostMicros`.** Relatórios devem deixar claro qual coluna está sendo exibida. Nunca substituir um pelo outro silenciosamente.

Registro em **`ai_usage`** (1:1 com `ai_request_id`), separado de **`ai_requests`** (ADR 060).

## Tokens

- `inputTokens`, `outputTokens`, `cachedInputTokens`, `totalTokens`
- `tokensAreEstimate`: `true` quando o provedor não informou contagem e o gateway estimou (~4 caracteres/token via `estimateTokens`)

## Orçamento por organização

Tabela **`ai_budgets`**: período `daily` | `monthly`, `softLimitMicros`, `hardLimitMicros`.

- Estouro **hard** → `AI_BUDGET_EXCEEDED` (402), chamada não executada
- Soft limit: política de aviso (UI/relatório); hard bloqueia

Env opcional `AI_MONTHLY_BUDGET_MICROS` alimenta configuração inicial; gestão via API `ai.config.manage`.

## API de leitura

- `GET …/ai/usage` — agregados e séries (`ai.usage.read`)
- `GET …/ai/requests/:id` — request + usage associado

## Com provedor `not_configured`

Requests registram status `not_configured`, provedor `not_configured`, **sem** custo inventado e **sem** tokens fictícios.

## Formatação

`formatMicros(micros, currency)` para exibição humana — sempre a partir de inteiros.
