# ADR 134 — Transacional vs marketing

## Status

Aceito (Etapas 14–16).

## Decisão

- `communication_category` distingue `transactional`, `case_update`, `marketing`, etc.
- Envio `marketing` exige consentimento `opted_in` (checado no serviço de comunicação).
- Transacionais críticos (`security`, `system`) podem usar status `required` / `not_applicable` em consent.

## Motivo

LGPD e boas práticas de opt-in para campanhas.

## Relacionado

`docs/COMMUNICATION_CONSENT.md`, ADR 135
