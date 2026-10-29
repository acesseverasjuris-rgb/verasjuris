# ADR 191 — White-label limited to branding

## Status

Accepted

## Context

“White-label completo” sem isolamento real de tenant/dados sugere produto que o monólito não entrega e convida bypass de segurança.

## Decision

- `white_label_configs` cobre branding: nome, logo, cores, support branding, domínio custom.
- Domínio verificado só via `CustomDomainProvider` real; default `not_configured`.
- Não altera modelo de identidade, permissões, ledger nem “instância dedicada” falsa.
- Habilitação comercial via entitlement/plano.

## Consequences

Parceiros personalizam aparência; compliance e dados seguem o tenant VerasJuris. Doc: `docs/WHITE_LABEL.md`.
