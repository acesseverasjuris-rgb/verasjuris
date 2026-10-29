# ADR 166 — Redirect do frontend nunca confirma pagamento

## Status

Accepted

## Context

URLs de success/cancel são controláveis pelo cliente; marcar paid no redirect gera fraude e drift.

## Decision

- `/checkout` e redirects só exibem estado / aguardam.
- `confirmPayment` só por webhook, consulta provider autenticada ou manual com evidência.
- Comentário/contrato explícito em `payment-service.ts`.

## Consequences

UX pode mostrar “processando”; liberação de curso/assinatura espera confirmação real.
