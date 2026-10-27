# ADR 088 — Draft ≠ Document

## Status

Aceito (Prompt 15).

## Decisão

- Minuta (`legal_document_drafts`) é agregado de elaboração + workflow.
- Documento (`documents` / `document_versions`) é binário versionado no storage.
- Referências entre eles são explícitas; não há equivalência automática.

## Motivo

Evitar confundir peça em edição com arquivo protocolável/armazenado e com export inexistente (PDF/DOCX `NOT_CONFIGURED`).

## Relacionado

`docs/LEGAL_DRAFTING.md`, `docs/DOCUMENTS.md`
