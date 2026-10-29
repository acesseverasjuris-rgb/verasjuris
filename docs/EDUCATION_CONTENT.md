# Conteúdo educacional

## Versionamento

`lesson_contents` aponta `currentVersionId` → `lesson_content_versions` (versão monotônica, `bodyText` / `payloadJson`). Publicar conteúdo cria nova versão; progresso pode referenciar `contentVersionId` (ADR 154).

## Blocos

Tipos: `text`, `video_reference`, `audio_reference`, `document_reference`, `embed`, `quiz_reference`, `exercise`, `code`, `external_link`.

Mídia externa: `mediaProviderKey` default `not_configured` + `externalMediaRef` opcional. Sem `EducationMediaProvider` real não há `playbackUrl`.

## Documentos

Referências a `documents` (ACL/tenant existentes). Biblioteca (`education_library_items`) distingue `authored_internally` / `licensed` / `public_source` / `external_link` com `licenseNote`.

## Liberação

Módulos usam `releaseRule`: `immediate` | `sequential` | `date_gated` | `manual`.

## NOT_CONFIGURED

Streaming, CDN e aulas ao vivo (`LiveClassProvider`) — status honesto, sem sala fictícia.

## Relacionado

`docs/EDUCATION.md`, ADR 154, `docs/DOCUMENTS.md`.
