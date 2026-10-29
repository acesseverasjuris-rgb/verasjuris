# Créditos de IA

## Princípio

**AI credits ≠ AI tokens** (ADR 186). Crédito comercial/consumo (`ai_credit_wallets`, `ai_credit_transactions`) é unidade de produto. Tokens do provider e custo (`providerTokens`, `providerCostMicros`) são metadados na mesma transação — não são o saldo vendável.

## Tipos de movimento

`grant` | `purchase` | `consumption` | `refund` | `expiration` | `adjustment`. Idempotência por `(walletId, idempotencyKey)`.

## Distinções

- ≠ `billing_credits` (crédito comercial de fatura — ADR 159).
- ≠ saldo de ledger.
- ≠ cotas do `AIGateway` / provider LLM.

## Relacionado

`docs/MONETIZATION.md`, `docs/AI_COSTS.md`, `docs/AI_CORE.md`, ADR 186.
