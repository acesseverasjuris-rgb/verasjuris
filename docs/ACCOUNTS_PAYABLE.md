# Contas a pagar (AP operacional)

## Modelo

`accounts_payable` — obrigações a fornecedores/custos (draft → approved → scheduled → paid / overdue / cancelled / disputed). Evidência opcional via `documentId`.

## ≠ payables de split

`payables` (repasse a profissional) ≠ esta tabela. Ver `docs/PAYABLES.md`.

## Liquidação

Pagamento real a fornecedor exige fluxo/provider configurado; sem isso não marcar `paid` inventado. Pode gerar custo (`cost_records`) e/ou lançamento de ledger tipo `cost` quando postado de forma consciente.

## Relacionado

`docs/TREASURY.md`, `docs/COSTS.md`, `docs/PAYABLES.md`.
