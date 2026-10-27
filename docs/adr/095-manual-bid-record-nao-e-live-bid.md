# ADR 095 — Bid record manual ≠ live bid

## Status

Aceito (Prompt 15).

## Decisão

- `auction_bid_records` são registros internos (manual/external/import).
- Envio de lance ao vivo continua `AUCTION_BID_PROVIDER_NOT_CONFIGURED` / `placeLiveBidNotConfigured`.
- `source=provider` não dispara rede ao portal.

## Motivo

Continuidade do ADR 083: nunca afirmar lance eletrônico real.

## Relacionado

`docs/AUCTION_POST_SALE.md`, ADR 083
