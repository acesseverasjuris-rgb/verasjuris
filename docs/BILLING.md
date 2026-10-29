# Billing (planos e cobrança)

## Princípio

**Billing ≠ Payment** (ADR 157). Billing modela o que se cobra (planos, features, charges, créditos comerciais). Liquidação é `Payment` / `PaymentProvider`.

## Entidades

- `billing_plans` + `billing_plan_versions` + `billing_plan_features` (limites tipados).
- `billing_charges` — tentativa de cobrança ligada a invoice/intent (`status` inclui `not_configured`).
- `billing_credits` — crédito **comercial** aplicável a fatura (≠ saldo de ledger, ADR 159).

## BillingProvider

`@verasjuris/ai` `BillingProvider`: assinatura/cobrança recorrente externa. Default `NotConfiguredBillingProvider` — não marca `active`/`paid` inventado. Distinto de `PaymentProvider`.

## Fiscal

`FiscalDocumentProvider` (NFS-e/NF-e) default `not_configured` — sem número de nota fictício.

## Monetização

Catálogo estendido (tiers, usage, AI credits, API, licenses, white-label): `docs/MONETIZATION.md`, `docs/PLANS.md`. Feature gates: `docs/ENTITLEMENTS.md` (ADRs 169, 185). Usage → charge sem inventar paid (ADRs 187, 189).

## Relacionado

`docs/SUBSCRIPTIONS.md`, `docs/INVOICES.md`, `docs/PAYMENTS.md`, `docs/MONETIZATION.md`, ADRs 157, 159, 185–189.
