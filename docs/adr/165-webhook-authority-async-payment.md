# ADR 165 — Webhook é autoridade da confirmação assíncrona

## Status

Accepted

## Context

Polling do browser e “página de sucesso” não são fontes confiáveis de liquidação.

## Decision

- Confirmação assíncrona via webhook verificado (`verifyWebhook` + evento idempotente).
- Persistência em `payment_webhook_events` antes/durante o processamento.
- Sem assinatura válida → não confirma.

## Consequences

Dependência de endpoint público e allowlist de provider; job sync não inventa paid.
