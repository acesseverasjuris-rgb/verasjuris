# ADR 173 — Payout ≠ Ledger Balance

## Status

Accepted

## Context

Tratar saldo contábil (`PROFESSIONAL_PAYABLE` / clearing) como “já pago” gera payouts sem obrigação rastreável e inventa liquidação.

## Decision

- Saldo de ledger = obrigação/posição contábil derivada de entries.
- `payout` = ato de pagamento externo (ou tentativa) com status próprio e provider.
- Confirmação de payout pode postar ledger; o inverso não autoriza marcar `paid` sem provider.

## Consequences

UI e APIs distinguem “a pagar” (payable/ledger) de “pago” (payout confirmed). Docs: `docs/PAYOUTS.md`, `docs/LEDGER.md`.
