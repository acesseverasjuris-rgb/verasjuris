# Custos

## Modelo

`cost_records` por organização: categoria (`infrastructure`, `ai`, `provider`, `registry`, `court`, `travel`, `marketing`, `personnel`, `refund`, `processing_fee`, `other`), valor em centavos, vínculo opcional a matter/serviço/documento.

## Ledger

Pode gerar lançamento `cost` com `ledgerTransactionId`. Fonte default `manual`. Sem inventar custo a partir de provider `not_configured`.

## Distinção

≠ `AI` usage budgets (`docs/AI_COSTS.md`) — orçamento de consumo de IA. `cost_records` é contabilidade operacional/financeira da org.

## Relacionado

`docs/FINANCE.md`, `docs/LEDGER.md`, `docs/AI_COSTS.md`.
