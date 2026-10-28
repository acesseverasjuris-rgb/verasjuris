# ADR 141 — Pagamento manual ≠ provider

## Status

Aceito (Etapas 14–16).

## Decisão

- `online_consultation_payments` aceita `paid_manual` com evidência; `paid_provider` só com `PaymentProvider` real.
- `PaymentProvider` default `NotConfiguredPaymentProvider`; `PAYMENT_STATUS_SYNC` falha `NOT_CONFIGURED`.
- Ledger do portal (`client_payment_records`) idem: `source=manual` até adapter.

## Motivo

Paralelo ADR 097 / 125 — dinheiro sem gateway fingido.

## Relacionado

`docs/PAYMENT_PROVIDER.md`, ADR 097
