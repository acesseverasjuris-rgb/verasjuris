# ADR 083 — AuctionProvider / sem lance real enquanto ausente

## Status

Aceito (Etapa 8).

## Decisão

- Sync/descoberta via **`AuctionProvider`**; default `not_configured` (`AUCTION_PROVIDER_NOT_CONFIGURED`).
- **`AuctionBidProvider`** e **`MapProvider`** stubs; detalhe expõe `bidding.available = false`.
- Endpoint de bid **não** afirma execução de lance eletrônico real.
- Badge `official` só com origem `public_provider` (provedor real futuro).

## Motivo

Contrato honesto: cadastro manual e assistência IA sem fingir portal de arrematação.
