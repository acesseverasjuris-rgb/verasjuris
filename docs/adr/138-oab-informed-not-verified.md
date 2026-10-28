# ADR 138 — OAB informada ≠ verificada

## Status

Aceito (Etapas 14–16).

## Decisão

- `lawyer_profiles.oab_verification_status` default `informed` ou `not_configured`.
- Bônus de score para `verified` no matching; `informed` permanece elegível.
- `OABVerificationProvider` default `not_configured`; job `OAB_VERIFICATION` não simula verificação.

## Motivo

Evitar falsa confiança regulatória (paralelo ADR 022).

## Relacionado

`docs/OAB_VERIFICATION.md`, ADR 022
