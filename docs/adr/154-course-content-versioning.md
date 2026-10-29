# ADR 154 — Versionamento de conteúdo de curso

## Status

Accepted

## Context

Editar aula publicada sem histórico perde rastreio do que o aluno viu.

## Decision

- `lesson_contents` + `lesson_content_versions` com versão monotônica.
- `currentVersionId` aponta a versão vigente; progresso pode guardar `contentVersionId`.
- Não sobrescrever versão publicada in-place.

## Consequences

Auditoria pedagógica e suporte a “o que foi estudado”; custo de storage de versões.
