# Retenções financeiras

## Princípio

Retenção reduz o net da alocação **antes** do payable. A origem (`source`) é sempre explícita (ADR 175): `manual` | `estimated` | `provider_confirmed`. Estimativa ≠ confirmado pelo provider/fisco.

Tabela: `financial_retentions`. Tipos: `tax_withholding` | `platform_reserve` | `chargeback_reserve` | `compliance_hold` | `dispute_hold` | `other`.

## Providers

`TaxWithholdingProvider` (e correlatos) default `not_configured`. Sem confirmação externa: `source` permanece `manual`/`estimated` — nunca promover a `provider_confirmed` fictício.

## Status

`pending` | `applied` | `released` | `cancelled`. Release devolve capacidade ao fluxo de payable (sem editar ledger postado).

## Relacionado

`docs/SPLIT.md`, `docs/PAYABLES.md`, `docs/CHARGEBACKS.md`, ADR 175.
