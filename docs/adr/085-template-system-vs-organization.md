# ADR 085 — Template system vs organization

## Status

Aceito (Prompt 15).

## Decisão

- Escopos distintos: `system` (`organizationId` nulo) vs `organization` (tenant).
- Templates de sistema são institucionais e não mutáveis pelo tenant.
- Templates de organização são isolados por tenant (404 cross-org).

## Motivo

Evitar misturar catálogo VerasJuris com customização de escritório e vazamento entre organizações.

## Relacionado

`docs/LEGAL_DOCUMENT_TEMPLATES.md`
