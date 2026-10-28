# ADR 129 — Portal deny-by-default

## Status

Aceito (Etapas 14–16).

## Decisão

- Sem vínculo `organization_client_users` → 404 (não 403 genérico).
- Timeline de caso: `legal_matter_timeline_events.client_visible` default **false**; portal só lista `clientVisible=true`.
- Mensagens: `messages.client_visible` default true, mas thread exige participação ou `clientId` do vínculo.
- Processos judiciais com `confidentialityLevel=secret` omitidos no portal.

## Motivo

LGPD e sigilo — exposição explícita, nunca inferida.

## Relacionado

`docs/CLIENT_PORTAL_SECURITY.md`, ADR 130
