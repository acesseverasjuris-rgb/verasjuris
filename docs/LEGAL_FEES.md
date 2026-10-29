# Honorários jurídicos (plataforma)

## Princípio

`legal_fee_agreements` + `legal_fee_accruals` modelam honorários cobráveis no financeiro de plataforma, ligados opcionalmente a `crm_clients`, `legal_matters` e `contracts`.

Tipos: `fixed` | `hourly` | `percentage` | `success` | `mixed` | `installment` | `other` (centavos / bps).

## Distinção

Honorários **contratuais no matter** (`matter.manage_fees` / campos do LegalMatter) descrevem o acordo operacional do caso. Accrual aqui gera linha de invoice / lançamento de ledger quando faturado — sem duplicar o matter como fonte de verdade comercial SaaS.

## Relacionado

`docs/FINANCE.md`, `docs/INVOICES.md`, `docs/LEGAL_MATTERS.md`, `docs/CONTRACTS.md`.
