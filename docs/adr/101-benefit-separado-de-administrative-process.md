# ADR 101 — Benefit separado de AdministrativeProcess

## Status

Aceito (Prompt 16).

## Decisão

- `social_security_benefits` é entidade própria (NB, espécies, DER/DIB/DCB, status de benefício).
- Vínculo opcional a `administrative_processes` e/ou `judicial_processes` — o benefício **não** é o processo.
- Catálogo `benefit_types` é seed de referência (`system_seed`); **não** é catálogo oficial do INSS.

## Motivo

Benefício previdenciário tem ciclo de vida e identidade (NB) distintos do protocolo administrativo genérico. Reutilizar só `administrative_processes` perderia semântica e campos obrigatórios.

## Relacionado

`docs/PREVIDENTIARY.md`, `docs/ADMINISTRATIVE_PROCESSES.md`, ADR 046
