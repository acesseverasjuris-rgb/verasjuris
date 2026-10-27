# ADR 079 — Auction separado de PublicOpportunity

## Status

Aceito (Etapa 8).

## Decisão

- Leilões vivem em módulo, schema e rotas **próprios** (`auctions`), distintos de `public_opportunities`.
- Sem unificar tipos, badges ou sync providers.
- Documentação cruzada deixa a fronteira explícita.

## Motivo

Licitações/contratação pública ≠ leilão de bens; modelos e compliance diferem.
