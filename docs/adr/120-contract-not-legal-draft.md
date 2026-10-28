# ADR 120 — Contract ≠ LegalDraft

## Status

Aceito (Etapas 11–13).

## Decisão

- Minutas (`legal_document_drafts`) seguem workflow de peça/processual (Prompt 15).
- Contratos (`contracts`) seguem aprovação, assinatura, renovação e obrigações pós-assinatura.
- Opcionalmente compartilham template engine, mas entidades e APIs permanecem distintas.

## Motivo

Evitar misturar protocolo judicial com CLM/contratos comerciais.

## Relacionado

`docs/CONTRACTS.md`, `docs/LEGAL_DRAFTING.md`, ADR 088, 090
