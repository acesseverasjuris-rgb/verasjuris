# ADR 170 — Dinheiro em unidades menores inteiras

## Status

Accepted

## Context

Float e strings decimais causam erro de arredondamento em ledger e cobrança.

## Decision

- Todos os valores monetários de finance/education/payments em `bigint` centavos (`*Cents`).
- Percentuais comerciais em bps quando aplicável.
- Validação: inteiros positivos nos entries; moeda explícita (default BRL).

## Consequences

Mesmo padrão de auctions/propostas/cálculos; formatação só na UI.
