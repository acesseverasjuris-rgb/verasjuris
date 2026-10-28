# PaymentProvider (Etapas 8 + 16)

## Contrato

`PaymentProvider` em `@verasjuris/ai` (`payment-provider.ts`):

- `createPayment`, webhooks, consulta de status
- Default: `NotConfiguredPaymentProvider` → `PAYMENT_PROVIDER_NOT_CONFIGURED`
- Health: `status: not_configured`

## Escopos no produto

| Domínio | Uso |
| --- | --- |
| Pós-leilão | `auction_payments` operacionais (ADR 097) — manual |
| Portal | `client_payment_records` — `source=manual` até PSP |
| Advogado online | `online_consultation_payments` — `paid_manual` / `paid_provider` |

## Manual vs provider (ADR 141)

- **Manual:** staff registra pagamento com evidência (`evidenceDocumentId` quando aplicável).
- **Provider:** status `paid_provider` somente após confirmação real do adapter.
- Nunca marcar `paid` por job/sync sem provider configurado.

## Job

`PAYMENT_STATUS_SYNC` no worker — lança `PAYMENT_PROVIDER_NOT_CONFIGURED` (não inventa liquidação).

## Distinção

≠ ledger de plataforma / billing SaaS (fora de escopo — `docs/DOMAINS.md`).

## Relacionado

`docs/ONLINE_CONSULTATIONS.md`, `docs/CLIENT_PORTAL.md`, `docs/AUCTION_POST_SALE.md`, ADR 097, ADR 141
