# ADR 127 — Confidencialidade penal, saúde, tributário e eleitoral

## Status

Aceito (Etapas 11–13).

## Decisão

- `matter_extension_confidentiality` em bindings e defaults elevados em `criminal_cases` / `medical_cases`.
- Tax e electoral: tratar como dados sensíveis — RBAC, auditoria, providers `not_configured` (sem scraping).
- IA assistiva não downgrade confidencialidade nem expõe conteúdo restrito sem permissão.

## Motivo

LGPD + sigilo profissional + sigilo fiscal/eleitoral operacional.

## Relacionado

`docs/SECURITY.md`, `docs/CRIMINAL.md`, `docs/MEDICAL_LAW.md`, `docs/TAX.md`, `docs/ELECTORAL.md`
