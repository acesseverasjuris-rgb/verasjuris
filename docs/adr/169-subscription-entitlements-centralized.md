# ADR 169 — Entitlements de assinatura centralizados

## Status

Accepted

## Context

Checks `if (plan === 'pro')` espalhados geram bypass e features fantasmas.

## Decision

- `EntitlementService` + `billing_plan_features` são a única fonte de feature gates.
- Limites tipados: boolean / count / amount_cents / unlimited.
- Domínios (educação, etc.) consultam o serviço — não o nome do plano.

## Consequences

Planos versionados mudam features sem refactor de módulos; testes focam no entitlement.
