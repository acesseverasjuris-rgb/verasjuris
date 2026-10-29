# Disputas financeiras

## Princípio

**Service dispute ≠ payment dispute** (ADR 179). Controvérsia de entrega/serviço (marketplace, diligência, consulta) é distinta de chargeback/disputa no PSP. Ambos podem coexistir e ambos podem aplicar **dispute hold** em payables/payouts (ADR 180).

Tabela: `financial_disputes` + evidência + histórico. Serviço: `dispute-service.ts`. Provider: `PaymentDisputeProvider` default `not_configured`.

## Tipos

`service` | `payment` | `chargeback` | `fraud` | `refund` | `delivery` | `other`.

## Status

`open` → `under_review` / `waiting_*` / `evidence_required` / `submitted` → `won` | `lost` | `partially_won` | `resolved` | `closed`.

Sem adapter: resolução **interna** permitida; nunca inventar `won`/`lost` via PSP.

## Hold

Abertura com `holdApplied` coloca payables relacionados em `held` e pode bloquear payouts in-flight. Resolução libera hold quando apropriado.

## ≠ marketplace_disputes

`marketplace_disputes` permanece fluxo operacional do engagement. Disputa financeira de plataforma liga-se a `payment`/`invoice` e efeitos de ledger/payable. Ver `docs/MARKETPLACE_DISPUTES.md`.

## Relacionado

`docs/CHARGEBACKS.md`, `docs/REFUNDS.md`, `docs/PAYABLES.md`, ADRs 179–180.
