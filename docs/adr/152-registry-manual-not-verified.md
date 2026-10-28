# ADR 152 — Cartório manual ≠ verificado; emolumentos via provider

## Status

Accepted

## Context

Cadastro manual de cartório e estimativas de taxa não são dados oficiais.

## Decision

- `registry_offices.source=manual` → `verificationStatus=unverified` (ou explicit).
- Emolumentos oficiais: `FeeTableProvider` (default NOT_CONFIGURED).
- Estimativa manual: `source=manual_estimate`.
- Protocolo automático só se `RegistryProvider` retornar; manual exige source + evidence.
- Sem integração cartório fictícia.

## Consequences

UI não apresenta cartório/manual fee/protocolo como oficiais sem evidência técnica.
