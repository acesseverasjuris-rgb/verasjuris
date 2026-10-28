# ADR 132 — Outbox de comunicação

## Status

Aceito (Etapas 14–16).

## Decisão

- Mensagens externas passam por `communication_outbox` → worker `COMMUNICATION_DISPATCH` / `COMMUNICATION_RETRY`.
- `in_app` cria/atualiza `notifications` no dispatch; canais email/sms/whatsapp/push usam adapters.
- Falha de provider marca `not_configured` ou `failed` com histórico em `communication_message_history`.

## Motivo

Entrega assíncrona, retries transitórios, auditoria de status.

## Relacionado

`docs/COMMUNICATION.md`, ADR 133
