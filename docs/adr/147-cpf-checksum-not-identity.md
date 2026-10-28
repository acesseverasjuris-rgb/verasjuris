# ADR 147 — Validação de dígitos CPF ≠ verificação de identidade

## Status

Accepted

## Context

Checksum matemático do CPF não prova titularidade.

## Decision

- `isValidCpfChecksum` = format validation apenas.
- Identidade via `CPFVerificationProvider` (default `NotConfigured`).
- UI/logs mascaram CPF.

## Consequences

Nenhuma API pode marcar identidade/CPF como VERIFIED só com checksum.
