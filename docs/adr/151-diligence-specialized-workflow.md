# ADR 151 — Diligência como workflow especializado

## Status

Accepted

## Context

Correspondência/diligência é operacional e exige evidência/execução.

## Decision

- Domínio próprio: request → proposal → race-safe accept → assignment → execution events → evidence → completion.
- Aceite concorrência-safe (unique assignment por request).
- Evidência: autenticidade nunca afirmada automaticamente.
- Geocoding externo: `NOT_CONFIGURED`.

## Consequences

Pode reutilizar dispute/review do marketplace; não substitui Marketplace Core.
