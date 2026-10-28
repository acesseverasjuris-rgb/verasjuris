# ADR 131 — Modelo de conversa compartilhado

## Status

Aceito (Etapas 14–16).

## Decisão

- `conversation_threads` / `messages` / `conversation_participants` vivem no schema do portal (Etapa 14).
- Comunicação omnichannel (Etapa 15) usa `communication_messages` + outbox para canais externos.
- Consultas online (Etapa 16) reutilizam threads ao aceitar match (`contextType=online_consultation`).

## Motivo

Um fio conversacional interno; despacho externo separado.

## Relacionado

`docs/COMMUNICATION.md`, `docs/ONLINE_CONSULTATIONS.md`, ADR 132
