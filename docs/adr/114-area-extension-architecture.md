# ADR 114 — Arquitetura de extensão por área

## Status

Aceito (Etapas 11–13).

## Decisão

- Extensões 1:1/1:N em `legal-areas.ts` referenciam `legalMatterId` + `organizationId`.
- `legal_matter_area_bindings` registra módulo ativo + `confidentiality` + metadata.
- Papéis processuais ricos (herdeiro, árbitro, etc.) usam **position + extensão + metadata**, não expansão do enum `legal_matter_party_person_type` salvo necessidade futura.

## Motivo

Enum de person type estável; papéis variam por ramo sem duplicar `Client`.

## Relacionado

`docs/LEGAL_AREA_EXTENSION_MODEL.md`, `docs/LEGAL_MATTERS.md`
