# ADR 168 — Pagamento manual exige evidência

## Status

Accepted

## Context

Sem PSP, escritórios registram PIX/boleto manualmente; sem comprovante o ledger vira ficção.

## Decision

- `recordManualPayment` exige `evidenceDocumentId` no tenant (`requireDocumentInOrg`).
- Permissão `finance.payment.record_manual`; `isManual=true`.
- Paralelo ADR 141 nos domínios operacionais.

## Consequences

Auditoria com documento; UI bloqueia confirmação manual sem anexo.
