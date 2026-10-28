# ADR 126 — Ciclo renovação e rescisão

## Status

Aceito (Etapas 11–13).

## Decisão

- `contract_renewals` e `contract_terminations` modelam aviso, proposta, efetivação e cancelamento.
- Status do contrato (`expiring`, `expired`, `terminated`) atualizado por serviço explícito (`mark-expired`, `…/effective`) — não silenciosamente por cron fictício.
- Alertas (`CONTRACT_RENEWAL_ALERT`) stub local até canal/agendador real.

## Motivo

CLM honesto: lifecycle explícito sem automação inventada.

## Relacionado

`docs/CONTRACTS.md`, ADR 094 (paralelo pós-leilão)
