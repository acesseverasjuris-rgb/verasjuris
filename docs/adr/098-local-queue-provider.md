# ADR 098 — LocalInProcessQueueProvider opt-in

## Status

Aceito (Prompt 15).

## Decisão

- Produção permanece `NotConfiguredJobQueue` (ADR 006).
- `LocalInProcessQueueProvider` só com `FEATURE_LOCAL_QUEUE=true|1` ou `LOCAL_QUEUE=enabled`.
- Mesmo processo; não é broker distribuído.

## Motivo

Desbloquear jobs locais (alertas, reconciliação) em DEV/teste sem simular Redis/SQS em produção.

## Relacionado

`docs/TECHNICAL_DEBT_CLOSURE.md`, `@verasjuris/events`
