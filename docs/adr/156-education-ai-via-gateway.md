# ADR 156 — IA educacional via AIGateway

## Status

Accepted

## Context

Assistência a conteúdo/quiz não deve inventar provedor paralelo nem mutar domínio crítico.

## Decision

- Usar `AIGateway` existente; default `not_configured`.
- IA assistiva com revisão humana; não altera matrícula, progresso, certificado ou pagamento automaticamente.

## Consequences

Mesmo padrão ADR 007/065; dependência opcional em `EducationModuleDeps`.
