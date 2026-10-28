# ADR 140 — Ciclo de vida da consulta

## Status

Aceito (Etapas 14–16).

## Decisão

- `online_consultations` 1:1 com request após match aceito.
- Status: `matched` → `awaiting_payment` → `scheduled` → `ready` → `in_progress` → `completed` | cancelamentos / `no_show` / `disputed`.
- Opcional: `calendarEventId`, `contractId`, `conversationThreadId`, termos em `consultation_terms_acceptances`.

## Motivo

Estados explícitos para pagamento, agenda e encerramento.

## Relacionado

`docs/ONLINE_CONSULTATIONS.md`, ADR 141, ADR 142
