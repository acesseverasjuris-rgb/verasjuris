# ADR 153 — Domínio Education

## Status

Accepted

## Context

Cursos, trilhas e certificados precisam de modelo próprio sem misturar com marketplace, advogado online ou LegalMatter.

## Decision

- Schema `education.ts` + módulo `apps/api/src/modules/education/`.
- Reutiliza User/Profile, Document, AIGateway e PaymentProvider de plataforma.
- Media/live/PDF providers default NOT_CONFIGURED.
- Matrícula paga fica `pending_payment` até confirmação real.

## Consequences

Educação é domínio de primeira classe; docs em `docs/EDUCATION*.md`.
