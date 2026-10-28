# ADR 150 — Disputa e review compartilhados

## Status

Accepted

## Context

Marketplace, diligência e extrajudicial precisam de disputa/avaliação.

## Decision

- `marketplace_disputes` com `sourceType` (marketplace/diligence/…).
- `service_reviews` com `origin` enum compartilhado.
- Review só após conclusão real; sem self-review; unique por engagement quando aplicável.

## Consequences

Um núcleo de disputa/review; policies específicas por origem.
