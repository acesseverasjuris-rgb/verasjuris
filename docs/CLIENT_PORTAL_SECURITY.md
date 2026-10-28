# Segurança do Portal do Cliente (Etapa 14)

## Deny-by-default (ADR 129)

- Recurso fora do par `(organizationId, clientId)` do vínculo → **404** (`portalAuthorizeScope`), não vaza existência cross-tenant.
- Timeline: default `client_visible=false` no banco; staff publica explicitamente.
- Upload pelo portal cria documento com confidencialidade `normal` e membership nula — revisão interna antes de ampliar ACL.

## Confidencialidade e processos

- Processos judiciais com `confidentialityLevel=secret` **não** aparecem no portal.
- Demais níveis retornam metadados reduzidos (sem peças sigilosas automaticamente).

## Mensagens

- Threads exigem `clientId` do vínculo ou participação em `conversation_participants`.
- `messages.client_visible` permite notas internas (`false`) ocultas do cliente na listagem portal.

## Documentos

- Reutiliza `document_acl_entries` e regras de confidencialidade do módulo Documentos.
- Download/upload passam por storage privado + scanner `NOT_CONFIGURED` padrão.

## Auditoria

Mutações staff (vínculo, pedidos, pagamentos, visibilidade timeline/agenda) gravam `audit_events` na transação.

## LGPD

Portal expõe apenas dados do cliente vinculado. Staff não “vira” cliente — contextos separados por rota e policy.

## Relacionado

`docs/CLIENT_PORTAL.md`, `docs/SECURITY.md`, ADRs 127–130
