# ADR 097 — Domínio de pagamento pós-leilão sem gateway

## Status

Aceito (Prompt 15).

## Decisão

- `auction_payments` acompanha valores/status operacionais no tenant.
- Sem PaymentProvider, Stripe, Pix gateway, ledger de plataforma ou captura automática.
- Distinto do domínio Payments/Billing (ainda não implementado).

## Motivo

Permitir checklist financeiro pós-arrematação sem fingir PSP.

## Relacionado

`docs/AUCTION_POST_SALE.md`, `docs/DOMAINS.md`
