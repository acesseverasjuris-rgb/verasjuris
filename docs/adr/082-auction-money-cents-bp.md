# ADR 082 — Dinheiro de leilão em centavos / comissão em basis points

## Status

Aceito (Etapa 8).

## Decisão

- Valores monetários em **centavos inteiros** (sem float).
- Comissão em **basis points** (100 bp = 1%).
- Estimativa (`estimateAuctionCost`) é determinística e rotulada como estimativa — não custo garantido nem recomendação de compra.

## Motivo

Consistência com CRM/pipeline/honorários; evita erro de arredondamento em UI jurídica.
