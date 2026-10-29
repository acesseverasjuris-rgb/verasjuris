# Split e alocações

## Princípio

**Allocation interna ≠ split do PSP** (ADR 171). A plataforma calcula `payment_allocations` a partir de `split_rules` versionadas; o provider de pagamento pode ou não fazer split nativo — são camadas distintas.

Schema: `packages/database/src/schema/monetization.ts` (`split_rules`) + `payment_allocations` em `finance.ts`. Serviço: `split-allocation-service.ts`.

## Fluxo

1. Pagamento confirmado (ou `partially_refunded`).
2. `allocatePayment` carrega regras ativas por `productType` / `serviceType` (versão opcional).
3. Cria `payment_allocations` com snapshot da regra (`ruleVersionId`, `ruleSnapshotJson`).
4. Aplica `financial_retentions` → net.
5. Gera `payables` (obrigação antes do payout — ADR 174).
6. Opcionalmente posta ledger (fee / payable) — never inventa liquidação externa.

## Regras versionadas (ADR 172)

`split_rules`: `key` + `version` únicos por org; status `draft` | `active` | `archived`. Cálculo: `percentage` (bps) | `fixed` | `percentage_plus_fixed` | `remainder` | `custom_rule`. Mudança = nova versão; alocações antigas preservam o snapshot.

## Distinção PSP

`PaymentProvider` / split nativo do gateway é capacidade opcional. Sem adapter: alocação interna continua; status de payout/repasse permanece `not_configured` até fluxo real. Não marcar split do provider como “feito” sem confirmação externa.

## Relacionado

`docs/PAYABLES.md`, `docs/FINANCIAL_RETENTIONS.md`, `docs/PAYOUTS.md`, `docs/PLATFORM_FEES.md`, ADRs 171–175.
