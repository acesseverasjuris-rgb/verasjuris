# Contas a receber (AR)

## Modelo

`receivables` — obrigação a receber vinculada a fonte (`invoice`, charge, etc.). Status: `open` | `partial` | `paid` | `overdue` | `disputed` | `written_off` | `cancelled`.

Serviço: `accounts-receivable.ts` / `TreasuryService.ar`. Valores em centavos.

## Distinções

- ≠ `PAYMENT_RECEIVABLE` do ledger (conta contábil) — AR operacional pode espelhar invoice sem substituir entries.
- ≠ `client_payment_records` do portal.
- ≠ payable de beneficiário (`docs/PAYABLES.md`).

## Relacionado

`docs/TREASURY.md`, `docs/DELINQUENCY.md`, `docs/INVOICES.md`.
