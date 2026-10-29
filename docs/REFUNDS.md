# Reembolsos

## Modelo

`refunds` (+ `refund_history`) ligados a `payments` confirmados. Tipos: `full` | `partial` | `credit`. Status: `requested` | `processing` | `confirmed` | `failed` | `cancelled` | `not_configured`.

## Provider

`PaymentProvider.refund` / `refundPayment`. Sem adapter → `PAYMENT_PROVIDER_NOT_CONFIGURED` / status `not_configured` — não inventa estorno liquidado. Tipo `credit` concede `billing_credits` interno (sem cash-out PSP).

## Ledger (ADR 176)

Confirmação posta **nova** transação tipo `refund` (não edita o `payment_received`). Idempotência `refund_confirm:{refundId}` + unique `refunds.ledgerTransactionId` (ADR 167). Payment → `refunded` / `partially_refunded`.

## Partial (ADR 177)

Valor ≤ refundable (soma de confirmados). Over-refund bloqueado. Alocações/payables ajustados via política de reversão e payables de offset append-only — sem reescrever histórico pago.

## Após payout (ADR 178)

Se já houve payout: hold em payouts in-flight; unpaid payables cancelados/offset; parcela já paga gera **clawback** (payable negativo / receivable `refund_clawback`) — não apaga o payout histórico.

## Relacionado

`docs/PAYMENTS.md`, `docs/PAYABLES.md`, `docs/PAYOUTS.md`, `docs/LEDGER.md`, ADRs 167, 176–178.
