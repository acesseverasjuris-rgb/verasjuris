# ADR 128 — Portal como camada de projeção

## Status

Aceito (Etapas 14–16).

## Decisão

- Portal do cliente **não** duplica `LegalMatter`, `Document`, `Contract`, `calendar_events` nem `notifications`.
- Leituras filtram por `organization_client_users` → `crm_clients` e escopos de ACL/confidencialidade existentes.
- Entidades próprias do portal: solicitações, pedidos de documento, threads/mensagens, ledger de pagamentos do cliente.

## Motivo

Evitar dois SSOT e drift entre escritório e cliente.

## Relacionado

`docs/CLIENT_PORTAL.md`, ADR 129
