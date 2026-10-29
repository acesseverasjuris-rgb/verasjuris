# ADR 161 — Ledger imutável após posting

## Status

Accepted

## Context

Editar lançamento postado quebra trilha e reconciliação.

## Decision

- Transação `posted` e seus entries não são atualizados/apagados in-place.
- Correção apenas por reversão (ADR 162).
- `onDelete: restrict` em entries → transaction/account.

## Consequences

Auditoria financeira confiável; UI sem “editar lançamento”.
