# ADR 081 — Auction global vs interesse de tenant

## Status

Aceito (Etapa 8).

## Decisão

- **`auctions.organizationId = null`**: referência global (somente leitura para o tenant).
- **`organizationId` preenchido**: cadastro/import da organização.
- Interesses, alertas, due diligence e `document_links` são **sempre** tenant-bound.
- Política bloqueia mutação de leilão global pelo tenant.

## Motivo

Mesmo padrão de oportunidades públicas (ADR 068), sem misturar catálogos.
