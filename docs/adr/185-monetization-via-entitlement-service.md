# ADR 185 — Monetization via EntitlementService

## Status

Accepted

## Context

Monetização (API, AI credits, white-label, tiers) tende a reintroduzir `if (plan === 'pro')` e bypassar ADR 169.

## Decision

- Produtos/planos comerciais alimentam features; **gates** só via `EntitlementService`.
- Domínios de monetização consultam entitlements tipados, não o nome do tier.

## Consequences

Troca de plano/versão muda acesso sem refactor espalhado. Docs: `docs/MONETIZATION.md`, `docs/ENTITLEMENTS.md`.
