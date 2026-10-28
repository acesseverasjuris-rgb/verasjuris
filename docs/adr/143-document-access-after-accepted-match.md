# ADR 143 — Documentos após match aceito

## Status

Aceito (Etapas 14–16).

## Decisão

- Documentos da solicitação online não são legíveis ao advogado antes do accept.
- `grantRequestDocumentsToLawyer` concede ACL/`document_links` na transação de accept.
- `assertLawyerCanReadRequestDocument` valida vínculo pós-match.

## Motivo

Sigilo do cliente até contratação do advogado escolhido.

## Relacionado

`docs/ONLINE_LAWYER.md`, `docs/DOCUMENTS.md`, ADR 136
