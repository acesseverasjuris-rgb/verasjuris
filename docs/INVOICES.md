# Invoices (faturas)

## Princípio

**Invoice ≠ Payment** (ADR 158). Invoice é obrigação/documento de cobrança (`draft` → `open` → `paid` / `void` / …). Pagamento é confirmação de liquidação (intent + payment + ledger).

## Entidades

`invoices` + `invoice_lines` (tipos: subscription, service, legal_fee, platform_fee, course, credit, …). Valores em centavos; `amountDueCents` / `amountPaidCents` derivados da aplicação de pagamentos/créditos.

## Fluxo típico

1. Emitir invoice (`finance.invoice.create`).
2. Criar `payment_intent` / checkout.
3. Confirmar payment (webhook / manual com evidência) → atualiza invoice + posta ledger.

Redirect de sucesso no browser **não** marca invoice paga (ADR 166).

## Relacionado

`docs/BILLING.md`, `docs/PAYMENTS.md`, `docs/LEDGER.md`, ADR 158, 166.
