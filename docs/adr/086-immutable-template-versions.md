# ADR 086 — Versões de template imutáveis

## Status

Aceito (Prompt 15).

## Decisão

- Conteúdo de modelo vive em `legal_document_template_versions`.
- Versões publicadas/ativas não são reescritas in-place; correção = nova versão.
- Ativação aponta `currentVersionId` para a versão `active`.

## Motivo

Rastreabilidade e reprodutibilidade de minutas geradas a partir de um modelo específico.

## Relacionado

`docs/LEGAL_DOCUMENT_TEMPLATES.md`
