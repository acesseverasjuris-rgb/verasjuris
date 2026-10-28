# ADR 136 — Domínio OnlineLegalRequest

## Status

Aceito (Etapas 14–16).

## Decisão

- Agregado `online_legal_requests` separado de LegalMatter e marketplace.
- Ciclo: `draft` → `submitted` → `matching` → `matched` | `cancelled` | `expired` | `converted`.
- Documentos anexos à solicitação; ACL ao advogado só após match aceito (ADR 143).

## Motivo

Fluxo B2C controlado sem confundir com caso interno.

## Relacionado

`docs/ONLINE_LAWYER.md`, ADR 137
