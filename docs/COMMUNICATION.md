# Comunicação omnichannel (Etapa 15)

## Princípio

Templates + preferências + consent + **outbox** assíncrona. Canal `in_app` reutiliza `notifications`; canais externos via adapters `@verasjuris/ai` (ADR 132–133).

Schema: `packages/database/src/schema/communication.ts`. API: `apps/api/src/modules/communication/`. Dispatch: `apps/api/src/modules/communication/dispatch.ts` (worker `communication-handlers.ts`).

## Modelo

| Entidade | Papel |
| --- | --- |
| `communication_templates` / `communication_template_versions` | Modelos versionados por canal |
| `communication_preferences` | Opt-in/out por usuário, canal e categoria |
| `communication_consents` | Histórico regulatório (ADR 135) |
| `communication_messages` | Mensagem lógica + snapshot de corpo |
| `communication_message_history` | Transições de status |
| `communication_outbox` | Fila de despacho (`pending` → `processing` → `completed` / `failed` / `not_configured`) |

## Categorias e canais

Enums `communication_channel` (`in_app`, `email`, `sms`, `whatsapp`, `push`) e `communication_category` (`transactional`, `case_update`, `marketing`, …). Marketing vs transacional: ADR 134.

## Despacho

1. API enfileira outbox / marca message `queued`.
2. Worker `COMMUNICATION_DISPATCH` processa entrada ou lote due por `organizationId`.
3. `COMMUNICATION_RETRY` reprocessa falhas transitórias (`TRANSIENT_COMMUNICATION_ERROR_CODES`).
4. Provider ausente → status `not_configured`, sem simular entrega.

## RBAC

`communication.read` | `send` | `manage_templates` | `manage_preferences` | `manage_consents` | `admin`.

## Variáveis de template

Substituição `{{var}}` com whitelist (`substituteTemplateVariables`) — sem eval.

## Relacionado

`docs/COMMUNICATION_PROVIDERS.md`, `docs/COMMUNICATION_CONSENT.md`, `docs/NOTIFICATIONS.md`, ADRs 131–135
