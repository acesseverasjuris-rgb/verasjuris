# ADR 142 — Avaliação só após concluída

## Status

Aceito (Etapas 14–16).

## Decisão

- `online_consultation_reviews` criadas apenas quando consulta `status=completed`.
- Moderação via `online_lawyer.review.moderate`; estados `hidden` / `removed` / `reported`.

## Motivo

Evitar review antes do serviço prestado.

## Relacionado

`docs/ONLINE_CONSULTATIONS.md`, ADR 140
