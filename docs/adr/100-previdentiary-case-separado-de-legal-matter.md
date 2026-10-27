# ADR 100 — PrevidentiaryCase separado de LegalMatter

## Status

Aceito (Prompt 16).

## Decisão

- `previdentiary_cases` é agregado próprio, tenant-bound, com FK obrigatória a `legal_matters`.
- Dados previdenciários (regime, períodos, contribuições, benefícios, CNIS, cálculos) **não** vivem em colunas de `legal_matters`.
- Um LegalMatter pode ter 0..N casos previdenciários; o matter permanece o hub jurídico genérico.

## Motivo

Previdenciário exige modelo rico (NB, DER/DIB, carência, qualidade, RMI) sem inflar o caso genérico nem misturar com judicial/administrativo genérico.

## Relacionado

`docs/PREVIDENTIARY.md`, `docs/LEGAL_MATTERS.md`, ADR 038 / 046
