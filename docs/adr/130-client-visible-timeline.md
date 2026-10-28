# ADR 130 — Timeline visível ao cliente

## Status

Aceito (Etapas 14–16).

## Decisão

- Eventos operacionais do matter continuam em `legal_matter_timeline_events`.
- Staff marca visibilidade via `staffPatchTimelineClientVisible` (`client_portal.manage_requests`).
- Portal (`portalGetCase`) retorna somente eventos com `clientVisible=true`, corpo sanitizado.

## Motivo

Separar timeline interna da narrativa permitida ao cliente.

## Relacionado

`docs/CLIENT_PORTAL.md`, ADR 129
