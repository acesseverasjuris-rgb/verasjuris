# ADR 133 — Abstração de canal e provider

## Status

Aceito (Etapas 14–16).

## Decisão

- Adapters em `@verasjuris/ai`: `EmailCommunicationChannel`, `SmsCommunicationChannel`, `WhatsAppCommunicationChannel`, `PushCommunicationChannel`.
- Default: `NotConfigured*Provider` por canal.
- `@verasjuris/email` permanece para identidade/cadastro; comunicação transacional usa providers do pacote `ai`.

## Motivo

Mesmo padrão ADR 112 / 124 — contrato primeiro.

## Relacionado

`docs/COMMUNICATION_PROVIDERS.md`, ADR 070
