# ADR 113 — Núcleo jurídico comum (Etapas 11–13)

## Status

Aceito (Etapas 11–13).

## Decisão

- `legal_area_modules`, bindings, checklists, template packs, workflow configs e `versioned_rule_sets` formam o **núcleo transversal** compartilhado por ramos do direito.
- LegalMatter permanece agregado central; módulos de área **estendem**, não substituem.
- Agregados pesados (tax, previdenciário, trabalhista) mantêm domínio dedicado com FK ao matter.

## Motivo

Evitar colunas por área no matter e evitar CRM paralelo; alinhar Prompt 16 (Labor/Prev) com expansão multi-área.

## Relacionado

`docs/LEGAL_AREAS.md`, ADR 108, 100, 114
