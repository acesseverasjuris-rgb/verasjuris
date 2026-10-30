# ADR 219 — field encryption strategy

## Status

Accepted

## Context

Etapas 26–33 (platform hardening).

## Decision

Field encryption seletiva com KeyManagementProvider; não criptografar tudo.

## Consequences

Implementação alinhada a docs da seção 290; providers ausentes permanecem NOT_CONFIGURED.
