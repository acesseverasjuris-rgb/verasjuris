# ADR 206 — Safe condition DSL

## Status

Accepted

## Context

Expressões livres = RCE / bypass.

## Decision

Árvore de operadores allowlisted (equals, in, and/or, …) sem eval.

## Consequences

Validação Zod; rejeitar campos não mapeados.
