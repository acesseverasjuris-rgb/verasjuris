# ADR 146 — OAB informada ≠ OAB verificada (Marketplace)

## Status

Accepted

## Context

Campo OAB no perfil é declaração. Verificação depende de `OABVerificationProvider`.

## Decision

- Status `informed` / `pending_verification` / `not_configured` nunca viram `verified` automaticamente.
- Sem provider: `NOT_CONFIGURED` / pending — nunca fake pass.

## Consequences

Trust summary e UI devem distinguir claramente informado vs verificado.
