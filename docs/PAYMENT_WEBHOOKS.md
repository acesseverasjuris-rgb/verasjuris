# Webhooks de pagamento

## Princípio

Webhook do PSP é a **autoridade** para confirmação assíncrona (ADR 165). Frontend redirect / deep-link **não** confirma (ADR 166).

## Persistência

`payment_webhook_events`: `(providerKey, externalEventId)` único; `payloadHash`; `signatureValid`; status `received` → `processing` → `processed` | `ignored` | `failed`.

## Fluxo

1. Validar `providerKey` allowlist e assinatura (`PaymentProvider.verifyWebhook`) + tolerância de timestamp (anti-replay).
2. Persistir evento idempotente.
3. `parseWebhook` → se pago/confirmado, chamar `confirmPayment` (ledger exactly-once).
4. Sem provider: verificação falha / `PAYMENT_PROVIDER_NOT_CONFIGURED` — sem inventar liquidação.

## Relacionado

`docs/PAYMENTS.md`, `docs/PAYMENT_PROVIDER.md`, ADRs 165–167.
