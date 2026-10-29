# ADR 158 — Invoice ≠ Payment

## Status

Accepted

## Context

Fatura é obrigação; pagamento é liquidação. Colapsar os dois impede parcial, void e reconciliação.

## Decision

- `invoices` / `invoice_lines` separados de `payment_intents` / `payments`.
- Status `paid` na invoice só após confirmação de payment(s) / crédito aplicado.
- Redirect de checkout não marca invoice paga.

## Consequences

Fluxo emit → intent → confirm → ledger; UI distingue “em aberto” de “liquidado”.
