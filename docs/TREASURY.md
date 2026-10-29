# Tesouraria

## Princípio

Caixa **derivado do ledger** (`CASH_CLEARING` / ativos) — nunca inventa saldo bancário. AR, AP, inadimplência e forecast são projeções/operacionais distintos do saldo real (ADRs 183–184).

Serviço: `treasury-service.ts`. Snapshot: `treasury_cash_positions` (`derivedFrom=ledger`).

## Subdomínios

| Conceito | Doc |
| --- | --- |
| Contas a receber | `docs/ACCOUNTS_RECEIVABLE.md` |
| Contas a pagar (fornecedor) | `docs/ACCOUNTS_PAYABLE.md` |
| Inadimplência | `docs/DELINQUENCY.md` |
| Forecast | `docs/FORECAST.md` |

## Providers

`BankingProvider` / `DebtCollectionProvider` default `not_configured`. Sem banco real: posição de caixa continua ledger-derived; cobrança externa não simula recuperação.

## Relacionado

`docs/LEDGER.md`, `docs/FINANCIAL_RECONCILIATION.md`, `docs/FINANCE.md`, ADRs 163, 183–184.
