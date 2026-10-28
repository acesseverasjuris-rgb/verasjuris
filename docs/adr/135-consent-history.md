# ADR 135 — Histórico de consentimento

## Status

Aceito (Etapas 14–16).

## Decisão

- `communication_consents` append-friendly: `grantedAt`, `revokedAt`, `source`, `evidence`.
- Preferências por usuário/canal/categoria em `communication_preferences`.
- Revogação não apaga registros anteriores.

## Motivo

Rastreabilidade regulatória.

## Relacionado

`docs/COMMUNICATION_CONSENT.md`, ADR 134
