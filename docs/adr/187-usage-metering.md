# ADR 187 — Usage metering

## Status

Accepted

## Context

Limites e cobrança por uso precisam de registro idempotente, separado da liquidação e do entitlement check.

## Decision

- `usage_meters` definem unidade/agregação/reset; `usage_records` gravam quantidade com `idempotencyKey`.
- Metering ≠ invoice/payment: gera input para billing/entitlements; não marca paid.
- API usage tem tabela dedicada (`api_usage_records`) no mesmo espírito.

## Consequences

Retries seguros; overage auditável. Docs: `docs/MONETIZATION.md`, `docs/API_MONETIZATION.md`.
