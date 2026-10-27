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
