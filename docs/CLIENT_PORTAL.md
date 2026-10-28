# Portal do Cliente (Etapa 14)

## Princípio

**Projection layer** sobre o núcleo jurídico — não duplica `LegalMatter`, `Document`, `Contract`, agenda nem notificações (ADR 128).

Schema: `packages/database/src/schema/client-portal.ts`. API: `apps/api/src/modules/client-portal/`. Contexto: `resolveClientPortalContext` em `@verasjuris/auth` via `organization_client_users`.

## Vínculo conta ↔ cliente CRM

- Staff com `client_portal.link_user` associa `users` a `crm_clients` (`organization_client_users`).
- Portal exige vínculo ativo; ausência → **404** (deny-by-default, ADR 129).

## Entidades do portal

| Entidade | Papel |
| --- | --- |
| `client_requests` | Solicitações genéricas (documento, status, ligação, contrato, pagamento, etc.) |
| `client_document_requests` | Pedido formal de documento com ciclo de upload/revisão |
| `client_appointment_requests` | Pedido de agendamento |
| `conversation_threads` / `messages` / `conversation_participants` | Mensagens internas cliente↔escritório (ADR 131) |
| `client_payment_records` | Ledger mínimo de cobranças do cliente (manual até PSP) |

## Leituras projetadas

- **Casos:** matters onde `legal_matters.client_id` = cliente do vínculo.
- **Timeline:** somente `legal_matter_timeline_events` com `client_visible=true` (ADR 130).
- **Processos:** judicial/administrativo do matter; judicial `secret` omitido.
- **Documentos:** owners `client` ou `legal_matter` do cliente, filtrados por ACL/confidencialidade (`portalCanReadDocument`).
- **Contratos:** contratos ligados ao cliente/matter com permissão de leitura projetada.
- **Agenda:** eventos com flag de visibilidade ao cliente (`staffPatchCalendarClientVisible`).
- **Notificações:** lista in-app do usuário no tenant.

## Staff vs portal

Rotas `/portal/…` usam contexto do cliente; rotas staff usam RBAC (`client_portal.manage_requests`, `client_portal.manage_payments`) + policies `policyClientPortal`, `portalAuthorizeScope`.

## Permissões

`client_portal.link_user` | `client_portal.manage_requests` | `client_portal.manage_payments` (+ `matter.read`, `document.*`, `contract.read`, `communication.*` conforme operação).

## NOT_CONFIGURED

Sem UI pública separada de login: mesma conta VerasJuris com participação portal. Exportações PDF, PSP e push externo seguem adapters globais.

## Relacionado

`docs/CLIENT_PORTAL_SECURITY.md`, ADRs 128–131, `docs/DOCUMENTS.md`, `docs/CONTRACTS.md`
