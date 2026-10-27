# ADR 075 — Fonte verificável exigida para citações

## Status

Aceito (Etapa 7.1).

## Decisão

- Citação persistida exige metadados mínimos conforme o tipo (ex.: case law com tribunal/número e URL https quando aplicável).
- Payload incompleto → `invalid` / `VALIDATION_ERROR`, não `verified`.
- Label de produto: *“Fonte não verificada.”*

## Motivo

Evitar que saída de modelo ou digitação incompleta seja apresentada como julgado autenticado.
