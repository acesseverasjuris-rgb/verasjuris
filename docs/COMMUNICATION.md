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

Transacional de billing/pagamento (recibo, falha de cobrança) reutiliza este outbox quando houver template — sem misturar com marketing (ADR 134). Financeiro: `docs/FINANCE.md`, `docs/PAYMENTS.md`.

## Relacionado

`docs/COMMUNICATION_PROVIDERS.md`, `docs/COMMUNICATION_CONSENT.md`, `docs/NOTIFICATIONS.md`, `docs/FINANCE.md`, ADRs 131–135

## VerasJuris Control / Analytics / Workflows

Domínios internos (Etapa 23+): operação da organização (`docs/CONTROL.md` e satélites), analytics como read model (`docs/ANALYTICS.md`) e automações (`docs/WORKFLOWS.md`). ADRs 192–211. UI sob `/app/control/*`. Não confundir com produto cliente nem com financeiro de plataforma (`docs/FINANCE.md`).


## Comunicação × privacy

Consentimentos de comunicação reutilizados no domínio privacy; preferências de idioma/locale alinhadas a i18n. Assistente pode abrir solicitação de suporte sem canal paralelo não auditado.
