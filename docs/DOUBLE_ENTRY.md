# Double-entry

## Decisão (ADR 160)

Todo lançamento postado tem ≥ 2 entries; soma dos débitos = soma dos créditos, mesma moeda, valores em centavos positivos.

## Direções e saldo (ADR 163)

Convenção em `LedgerBalanceService`: ativo / despesa / clearing → saldo = débitos − créditos; passivo / receita / equity → créditos − débitos. Sempre a partir de `ledger_entries` de transações `posted`.

## Imutabilidade e reversão (ADRs 161–162)

Não editar nem apagar entries de transação `posted`. Erro → nova transação `reversal` com `reversalOfTransactionId`, marcando a original `reversed`.

## Relacionado

`docs/LEDGER.md`, ADRs 160–163.
