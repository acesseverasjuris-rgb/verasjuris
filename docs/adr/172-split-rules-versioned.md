# ADR 172 — Split rules versionadas

## Status

Accepted

## Context

Alterar percentual “in place” reescreve o passado e inviabiliza auditoria de repasses já alocados.

## Decision

- `split_rules` versionadas por `(organizationId, key, version)`.
- Status `draft` | `active` | `archived`; mudança efetiva = nova versão.
- Cada `payment_allocation` guarda `ruleVersionId` + `ruleSnapshotJson`.

## Consequences

Recálculo histórico usa o snapshot da alocação, não a regra vigente. Doc: `docs/SPLIT.md`.
