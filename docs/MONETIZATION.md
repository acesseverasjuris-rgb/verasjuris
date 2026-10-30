# Monetização

## Princípio

Produtos, preços versionados, usage, créditos de IA, API, licenças e white-label. Feature gates e limites passam por **`EntitlementService`** — nunca `if (plan === 'pro')` (ADRs 169, 185).

Schema: `monetization.ts`. Serviço: `monetization-service.ts`. Rotas: `treasury-monetization-routes.ts`.

## Mapa

| Conceito | Doc |
| --- | --- |
| Planos / tiers | `docs/PLANS.md` |
| Entitlements | `docs/ENTITLEMENTS.md` |
| Créditos de IA | `docs/AI_CREDITS.md` |
| API monetizada | `docs/API_MONETIZATION.md` |
| Licenciamento | `docs/LICENSING.md` |
| White-label | `docs/WHITE_LABEL.md` |
| Billing / assinaturas | `docs/BILLING.md`, `docs/SUBSCRIPTIONS.md` |

## Produtos

`monetization_products` + `product_prices` (versionados). Tipos: subscription, one_time_service, ai_credit_pack, api_package, license, white_label_setup, technology_fee, other. Money em centavos; % em bps.

## Usage (ADR 187)

`usage_meters` + `usage_records` (idempotencyKey). Agregação/reset configuráveis; metering ≠ cobrança automática sem invoice/charge.

## Honestidade

Providers (`BillingProvider`, `CustomDomainProvider`, PSP) default `not_configured`. Sem inventar assinatura ativa, domínio verificado ou paid.

## Relacionado

`docs/FINANCE.md`, ADRs 157, 169, 185–191.

## VerasJuris Control / Analytics / Workflows

Domínios internos (Etapa 23+): operação da organização (`docs/CONTROL.md` e satélites), analytics como read model (`docs/ANALYTICS.md`) e automações (`docs/WORKFLOWS.md`). ADRs 192–211. UI sob `/app/control/*`. Não confundir com produto cliente nem com financeiro de plataforma (`docs/FINANCE.md`).
