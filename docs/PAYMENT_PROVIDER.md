# PaymentProvider (Etapas 8 + 16 + 21)

## Contrato

`PaymentProvider` em `@verasjuris/ai` (`payment-provider.ts`) — **única** abstração PSP (ADR 164). Evoluir este contrato; não criar um segundo provider.

Capacidades opcionais: `refund`, `split`, `webhook`, `checkout_session`.

Métodos: `createPayment`, `createPaymentIntent`, `createCheckoutSession`, status/cancel/refund, `verifyWebhook` / `parseWebhook` / `handleWebhook`, `healthCheck`.

- Default: `NotConfiguredPaymentProvider` → status/`PAYMENT_PROVIDER_NOT_CONFIGURED`
- Health: `status: not_configured`
- Checkout sem adapter: `checkoutUrl: null`, status `not_configured` — nunca finge sessão paga

## Escopos no produto

| Domínio | Uso |
| --- | --- |
| Pós-leilão | `auction_payments` operacionais (ADR 097) — manual |
| Portal | `client_payment_records` — `source=manual` até PSP |
| Advogado online | `online_consultation_payments` — `paid_manual` / `paid_provider` |
| Plataforma (Finance) | `payment_intents` / `payments` / refunds / payouts — ledger double-entry |
| Educação (pago) | matrícula `pending_payment` até confirmação real |

## Manual vs provider (ADR 141 / 168)

- **Manual:** staff registra pagamento com evidência (`evidenceDocumentId` quando aplicável).
- **Provider:** status pago/confirmado somente após confirmação real do adapter (webhook ou consulta).
- Nunca marcar `paid` / `confirmed` por job/sync/redirect sem provider configurado (ADR 166).

## Job

`PAYMENT_STATUS_SYNC` no worker — lança `PAYMENT_PROVIDER_NOT_CONFIGURED` (não inventa liquidação).

## Distinção

- ≠ `BillingProvider` (assinatura externa — `docs/BILLING.md`, ADR 157).
- Registros operacionais de domínio ≠ ledger de plataforma (`docs/LEDGER.md`, `docs/FINANCE.md`).

## Relacionado

`docs/PAYMENTS.md`, `docs/PAYMENT_WEBHOOKS.md`, `docs/ONLINE_CONSULTATIONS.md`, `docs/CLIENT_PORTAL.md`, `docs/AUCTION_POST_SALE.md`, `docs/EDUCATION_ACCESS.md`, ADR 097, 141, 164–168.
