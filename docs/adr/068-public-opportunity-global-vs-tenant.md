# ADR 068 — Oportunidade pública global vs dados de tenant

## Status

Aceito (Etapa 6).

## Decisão

- **`public_opportunities.organizationId = null`**: referência global (futuro feed oficial).
- **`organizationId` preenchido**: cadastro manual/import da organização.
- Interesses, requisitos e documentos vinculados são **sempre** escopados ao tenant.

## Motivo

Separar catálogo compartilhável de CRM operacional por escritório.
