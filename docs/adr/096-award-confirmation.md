# ADR 096 — Confirmação de arrematação (award)

## Status

Aceito (Prompt 15).

## Decisão

- Award com máquina de status e `verificationStatus` explícito (incl. `not_configured` / `unverified`).
- Confirmação é ato humano no tenant; dinheiro em centavos / bp (ADR 082).
- Sem confirmação automática de leiloeiro/tribunal.

## Motivo

Rastrear obrigações pós-arrematação sem inventar oficialidade.

## Relacionado

`docs/AUCTION_POST_SALE.md`
