# Conciliação financeira

## Princípio

**Gateway ≠ Ledger ≠ Bank** (ADR 181). Três fontes distintas; igualdade nunca é assumida. Conciliação compara, registra discrepâncias e exige review humano — **nunca muta** ledger postado (ADR 182). Correção financeira: `LedgerPostingService.reverse` + novo lançamento.

Schema: `external_financial_transactions`, `reconciliation_runs`, `reconciliation_items`, `financial_discrepancies` (+ legado `financial_reconciliations`). Serviço: `reconciliation-service.ts`.

## Fontes

`payment_provider` | `ledger` | `bank` | `manual_import` | `erp`. Import via `api` / `webhook` / `csv` / `ofx` / `cnab` / `manual`.

## ReconciliationProvider

`@verasjuris/ai` — fetch de extrato e sugestão de match. Default `not_configured`: **nunca** marca `matched` fictício; import automatizado por API/webhook/OFX/CNAB exige provider real (`RECONCILIATION_PROVIDER_NOT_CONFIGURED`). Import **manual** permitido.

## Runs e itens

Run: `pending` | `running` | `completed` | `failed` | `cancelled`. Item: `matched` | `partial` | `missing_*` | `amount_mismatch` | `date_mismatch` | `duplicate` | `review_required` | `resolved`. Resolução = nota/status de review, não rewrite do livro-razão.

## Discrepâncias

Tipos: missing payment/ledger/bank, amount/duplicate, unexpected fee/refund, payout mismatch, other. Severidade e owner explícitos.

## Escopo

Conciliação do **ledger de plataforma**. Distinta da reconciliação detect-only DB↔storage (ADR 099) e dos registros manuais de portal/consulta/leilão.

## Relacionado

`docs/RECONCILIATION.md` (alias), `docs/LEDGER.md`, `docs/TREASURY.md`, `docs/PAYMENTS.md`, ADRs 160, 181–182.
