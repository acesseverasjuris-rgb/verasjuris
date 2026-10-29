# ADR 188 — API credential hash-only

## Status

Accepted

## Context

Persistir secret em claro (ou reversível) vaza em backup/log e viola o padrão de senhas/sessões do produto.

## Decision

- `api_credentials` armazena apenas `secretHash` (scrypt via `hashPassword`), `prefix` e `credentialId`.
- Segredo em claro só na resposta de criação.
- Revogação via `revokedAt`; sem “recuperar” o secret.

## Consequences

Rotação = nova credencial. Doc: `docs/API_MONETIZATION.md`, `docs/SECURITY.md`.
