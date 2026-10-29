# Taxas de plataforma

## Modelo

`platform_fee_rules` versionadas por `key` + `version`. Base: `marketplace` | `online_consultation` | `diligence` | `extrajudicial` | `education` | `subscription` | `other`. Percentual em bps e/ou valor fixo em centavos.

## Uso

Regra ativa (`effectiveFrom`/`effectiveTo`) alimenta alocações (`payment_allocations.feeCents`) e lançamentos de ledger tipo `platform_fee`. Não substitui registros operacionais de fee em marketplace/diligência/extrajudicial — é a taxa **da plataforma** sobre o fluxo financeiro.

## Relacionado

`docs/FINANCE.md`, `docs/PAYOUTS.md`, `docs/MARKETPLACE.md`, `docs/DILIGENCES.md`, `docs/EXTRAJUDICIAL.md`.
