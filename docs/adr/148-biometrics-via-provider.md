# ADR 148 — Biometria via provider + minimização

## Status

Accepted

## Context

Biometria exige consentimento, provider externo e retenção controlada.

## Decision

- `BiometricVerificationProvider` default `NOT_CONFIGURED` — sem simulação de pass.
- Armazenar referência de sessão externa, score/result, timestamps, consent, retention — não template bruto.
- Consentimento registrado antes da sessão.

## Consequences

Fluxo biométrico fica bloqueado honestamente até haver provider real.
