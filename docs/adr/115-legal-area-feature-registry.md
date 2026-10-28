# ADR 115 — Registry de features por área

## Status

Aceito (Etapas 11–13).

## Decisão

- `LEGAL_AREA_FEATURES` (in-memory) documenta capacidades por `LegalAreaModuleKey`.
- Persistência espelhada em `legal_area_feature_config` por organização/módulo.
- API expõe features; código consulta registry/helpers (`hasFeature`) em vez de strings soltas.

## Motivo

Escalar para dezenas de áreas sem ramificações ad hoc.

## Relacionado

`apps/api/src/modules/legal-areas/registry.ts`, `docs/LEGAL_AREAS.md`
