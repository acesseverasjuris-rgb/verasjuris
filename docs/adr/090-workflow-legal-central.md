# ADR 090 — Workflow legal central de minuta

## Status

Aceito (Prompt 15).

## Decisão

- Transições de status centralizadas em `legal-draft-state.ts` (grafo + guards).
- Histórico em `legal_document_workflow_history`.
- Aprovação, ready-to-file, filed e confirmed têm pré-condições explícitas.

## Motivo

Uma única máquina evita atalhos de API que pulem revisão humana ou protocolo sem evidência.

## Relacionado

`docs/LEGAL_DOCUMENT_WORKFLOW.md`
