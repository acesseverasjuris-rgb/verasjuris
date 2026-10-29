# Planos comerciais

## Modelo

Tiers configuráveis (`plan_tier`: individual, professional, office, business, enterprise, white_label) e alvo (`plan_target`). Produtos seed em `MonetizationService.ensureDefaultPlanProducts`; catálogo formal em `billing_plans` / versões / features.

## Princípio

Nome do plano **não** é gate. Limites tipados em `billing_plan_features` + `EntitlementService` (ADR 169 / 185). Preços em `product_prices` versionados (centavos).

## ≠ assinatura

Plano = catálogo. Assinatura = vínculo temporal (`docs/SUBSCRIPTIONS.md`). Invoice/Payment liquidam.

## Relacionado

`docs/MONETIZATION.md`, `docs/BILLING.md`, `docs/ENTITLEMENTS.md`, `docs/SUBSCRIPTIONS.md`.
