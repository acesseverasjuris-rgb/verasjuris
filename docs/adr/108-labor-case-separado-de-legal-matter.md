# ADR 108 — LaborCase separado de LegalMatter

## Status

Aceito (Prompt 16).

## Decisão

- `labor_cases` é agregado próprio com FK a `legal_matters` (e vínculo opcional a `judicial_processes`).
- Contrato, jornada, remuneração, FGTS, rescisão, pedidos e liquidação **não** são colunas do matter.
- Papel do cliente (`employee` / `employer` / …) e status trabalhista vivem no LaborCase.

## Motivo

Demanda trabalhista tem ciclo e artefatos distintos do hub jurídico genérico; misturar no matter repetiria o erro de embutir processo judicial na Etapa 3.

## Relacionado

`docs/LABOR.md`, `docs/LEGAL_MATTERS.md`, ADR 038 / 100
