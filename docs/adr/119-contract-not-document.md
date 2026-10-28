# ADR 119 — Contract ≠ Document

## Status

Aceito (Etapas 11–13).

## Decisão

- `contracts` é agregado lógico de ciclo de vida comercial/jurídico-operacional.
- Binário e versões de arquivo permanecem em `documents` / `document_versions`.
- Exportação futura pode **gerar** documento; documento existente não implica contrato assinado.

## Motivo

Paralelo ADR 088 (Draft ≠ Document): separar metadados de workflow de storage.

## Relacionado

`docs/CONTRACTS.md`, ADR 088
