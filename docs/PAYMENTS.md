# Pagamentos de plataforma

## Princípio

`payment_intents` → `payments` → (opcional) `refunds` / `payment_disputes` / `payment_allocations` / `payouts`. Confirmação assíncrona via webhook ou registro manual com evidência. Serviço: `payment-service.ts`, checkout: `checkout-service.ts`.

## Estados

Intent: `created` | `requires_action` | `processing` | `authorized` | `confirmed` | `failed` | `cancelled` | `expired` | `not_configured`.

Payment: `pending` | `authorized` | `confirmed` | `failed` | `cancelled` | `refunded` | `partially_refunded` | `chargeback` | `disputed`.

## Confirmação (ADRs 165–168)

1. **Webhook** (assinatura válida) é autoridade assíncrona.
2. **Frontend redirect nunca confirma** sozinho.
3. **Manual** exige `evidenceDocumentId` no tenant (`finance.payment.record_manual`).
4. `confirmPayment` posta ledger **exactly-once** (`idempotencyKey` `payment_confirm:{paymentId}`, unique em `payments.ledgerTransactionId`).

## Distinções

| Escopo | Tabela / doc |
| --- | --- |
| Plataforma | `payments` — este doc |
| Portal | `client_payment_records` — `docs/CLIENT_PORTAL.md` |
| Consulta online | `online_consultation_payments` — `docs/ONLINE_CONSULTATIONS.md` |
| Pós-leilão | `auction_payments` — `docs/AUCTION_POST_SALE.md` |

Todos reutilizam o **mesmo** `PaymentProvider` (ADR 164); registros de domínio ≠ ledger SaaS.

## Split, disputas e chargebacks

Após confirmação: alocações internas (`docs/SPLIT.md`) ≠ split do PSP (ADR 171). Disputas financeiras / chargebacks: `docs/FINANCIAL_DISPUTES.md`, `docs/CHARGEBACKS.md` (`PaymentDisputeProvider` not_configured).

## Relacionado

`docs/PAYMENT_PROVIDER.md`, `docs/PAYMENT_WEBHOOKS.md`, `docs/REFUNDS.md`, `docs/PAYOUTS.md`, `docs/SPLIT.md`, `docs/LEDGER.md`, ADRs 141, 164–168, 171–180.
