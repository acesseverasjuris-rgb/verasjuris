# ADR 094 — Ciclo de vida pós-leilão

## Status

Aceito (Prompt 15).

## Decisão

- Pós-venda é módulo/schema próprio (`auction-post-sale`), ligado ao auction existente.
- Participação, resultado, award, pagamento, entrega, transferência e regularização são rastreados no tenant.
- Status manuais (`*_manually`) deixam explícita a ausência de sync com portal.

## Motivo

Separar descoberta/due diligence (Etapa 8) do acompanhamento pós-arrematação sem fingir integração.

## Relacionado

`docs/AUCTION_POST_SALE.md`, `docs/AUCTIONS.md`
