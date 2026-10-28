# Notificações (Etapa 5.2)

Pacote `@verasjuris/notifications`:

- `NotificationProvider` — contrato de envio
- `InAppNotificationProvider` — canal `in_app` (persistência em `notifications` pela API)
- `NotConfiguredNotificationProvider` — canais externos
- `HolidayCalendarProvider` / `NotConfiguredHolidayCalendar`
- `calculateDeadlineDueAt` — calculadora interna

## Canais

| Canal | Estado |
| --- | --- |
| in_app | ready |
| email | NOT_CONFIGURED |
| push | NOT_CONFIGURED |
| sms | NOT_CONFIGURED |
| whatsapp | NOT_CONFIGURED |

Não há envio fake. Job queue permanece `not_configured`.

## Comunicação omnichannel (Etapa 15)

Canal `in_app` do módulo **Comunicação** reutiliza a tabela `notifications` no dispatch (`COMMUNICATION_DISPATCH`). Canais email/sms/whatsapp/push usam adapters `@verasjuris/ai` (default `not_configured`). Job dedicado `PUSH_DISPATCH` permanece stub até adapter. Ver `docs/COMMUNICATION.md`, `docs/COMMUNICATION_PROVIDERS.md`, ADRs 132–133.

## Portal (Etapa 14)

`portalListNotifications` expõe notificações in-app do usuário autenticado no tenant — mesma persistência, rota portal separada.
