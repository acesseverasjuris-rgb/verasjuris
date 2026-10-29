# Assinaturas

## Modelo

`subscriptions` liga org ou user a `billing_plans` / `billing_plan_versions`. Status: `incomplete` | `trialing` | `active` | `past_due` | `suspended` | `cancelled` | `expired` | `not_configured`.

`providerKey` default `not_configured`; `externalSubscriptionId` só com adapter real (`BillingProvider`).

## Entitlements (ADR 169)

`EntitlementService` (`entitlement-service.ts`) é a **única** fonte de feature gates por plano (`billing_plan_features`). Nunca espalhar `plan === PRO` no código de domínio.

## Faturamento

Invoices por período (`periodKey` único por subscription). Charge + PaymentIntent separam obrigação de liquidação.

## Relacionado

`docs/BILLING.md`, `docs/INVOICES.md`, `docs/ENTITLEMENTS.md`, `docs/PLANS.md`, `docs/MONETIZATION.md`, ADRs 157, 169, 185.
