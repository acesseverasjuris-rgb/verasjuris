# ADR 190 — Licensing domain

## Status

Accepted

## Context

Contrato comercial de software (seats, termo, white_label license) não é assinatura SaaS nem entitlement de feature.

## Decision

- Entidade `software_licenses` com tipo, vigência, seats, status e vínculos opcionais a `contracts` / `subscriptions`.
- Feature access continua em `EntitlementService`.
- Provider de ativação externa, se houver, nasce `not_configured`.

## Consequences

CLM e billing coexistem sem sobrecarregar `subscriptions`. Doc: `docs/LICENSING.md`.
