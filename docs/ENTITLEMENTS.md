# Entitlements

## Princípio

`EntitlementService` é a **única** fonte de feature gates e limites (ADR 169, reforçado em monetização — ADR 185). Domínios consultam o serviço; não o slug do plano.

## Limites tipados

`boolean` | `count` | `amount_cents` | `unlimited` | `storage` | `rate` | `credit` | `currency` — via `billing_plan_features` / `entitlement_limit_type`.

## Uso

Educação, API scopes, white-label enablement, AI credit packs e features SaaS passam pelo mesmo serviço. Bypass por string de plano é dívida proibida.

## Relacionado

`docs/SUBSCRIPTIONS.md`, `docs/MONETIZATION.md`, `docs/PLANS.md`, ADRs 169, 185.
