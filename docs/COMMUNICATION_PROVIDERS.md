# Provedores de comunicação (Etapa 15)

## Contratos (`@verasjuris/ai`)

| Canal | Provider | Adapter |
| --- | --- | --- |
| email | `EmailProvider` | `EmailCommunicationChannel` |
| sms | `SmsProvider` | `SmsCommunicationChannel` |
| whatsapp | `WhatsAppProvider` | `WhatsAppCommunicationChannel` |
| push | `PushProvider` | `PushCommunicationChannel` |

Implementações default: `NotConfiguredEmailProvider`, `NotConfiguredSmsProvider`, `NotConfiguredWhatsAppProvider`, `NotConfiguredPushProvider`.

## Configuração na API

`communicationModuleDeps` injeta providers opcionais; omitidos → `not_configured`.

## in_app

Não usa provider externo: dispatch grava/atualiza linhas em `notifications` (pacote `@verasjuris/notifications`).

## Jobs worker

| Job | Comportamento |
| --- | --- |
| `COMMUNICATION_DISPATCH` | Processa outbox (handler real local) |
| `COMMUNICATION_RETRY` | Reprocessa falhas transitórias |
| `PUSH_DISPATCH` | Stub **NOT_CONFIGURED** até adapter push dedicado |

## Health

Cada adapter expõe `healthCheck()` com `status: not_configured` quando aplicável (ADR 070).

## Relacionado

`docs/COMMUNICATION.md`, ADR 133, `docs/NOTIFICATIONS.md`
