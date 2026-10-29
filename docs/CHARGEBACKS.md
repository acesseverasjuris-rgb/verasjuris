# Chargebacks

## Princípio

Chargeback é disputa/estorno iniciado pelo emissor/PSP. Modelado como `financial_disputes` com `disputeType=chargeback` (e/ou status de `payments` em `chargeback` / `disputed`). Não confundir com disputa de serviço nem com refund solicitado pela plataforma.

## Provider

`PaymentDisputeProvider` — default `not_configured` (`CHARGEBACK_PROVIDER_NOT_CONFIGURED`). Sem adapter: não marcar chargeback `won`/`lost` externo.

## Ledger

Confirmação de chargeback posta transação tipo `chargeback` (contas `CHARGEBACK_CLEARING` etc.) exactly-once quando houver evento confiável. Correção posterior: reversão + novo lançamento (ADRs 161–162).

## Hold e reserva

Pode aplicar `dispute_hold` / `chargeback_reserve` em retentions e payables até resolução.

## Relacionado

`docs/FINANCIAL_DISPUTES.md`, `docs/PAYMENTS.md`, `docs/LEDGER.md`, ADRs 179–180.
