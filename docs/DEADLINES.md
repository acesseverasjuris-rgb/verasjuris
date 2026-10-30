# Prazos centrais (Etapa 5.2)

## Distinções

- Deadline central (`deadlines`) ≠ tarefa ≠ SLA operacional.
- Prazos administrativos (`administrative_deadlines`) podem espelhar o central via `centralDeadlineId` + `sourceType=administrative_deadline`.

## Sugerido × confirmado

Cálculo (`calendar_days` / `business_days` / `manual_date` / `custom`) produz status **suggested** ou **pending_confirmation**. Só `confirm` torna o prazo **confirmed**. Alteração de data confirmada exige histórico + motivo.

## Feriados

`HolidayCalendarProvider` padrão: `NotConfiguredHolidayCalendar` (`NOT_CONFIGURED`). Dias úteis excluem sáb/dom; **não** tratar como prazo jurídico definitivo.

## Alertas e escalonamento

Regras persistidas; disparo **in-app** apenas. E-mail / WhatsApp / SMS / push: `NOT_CONFIGURED`.

Com `FEATURE_LOCAL_QUEUE` / `LOCAL_QUEUE=enabled`, o worker pode processar `DEADLINE_ALERT_DISPATCH` localmente (ADR 098) — ainda só in-app. Sem a flag, a fila genérica permanece `not_configured`.

## Distinções (Prompts 15–16)

Prazo central ≠ tarefa ≠ checklist de minuta ≠ prazo de regularização pós-leilão. Workflow de protocolo de peça: `docs/LEGAL_DOCUMENT_WORKFLOW.md`.

Sugestões de prazo em casos trabalhistas (`POST …/labor-cases/:id/suggest-deadlines`) **não** confirmam prazo legal — permanecem sugeridas até `deadline.confirm`. Cálculos de carência/RMI/rescisão em `@verasjuris/calculations` **não** são o motor de prazos centrais.

## API

`/v1/organizations/:organizationId/deadlines` (+ calculate, confirm, change, complete, cancel, alerts/dispatch, escalate) e regras de alerta/escalonamento.

## UI

`/app/prazos`, `/app/prazos/novo`, `/app/prazos/[id]` com microcopy explícito sugerido vs confirmado.

## VerasJuris Control / Analytics / Workflows

Domínios internos (Etapa 23+): operação da organização (`docs/CONTROL.md` e satélites), analytics como read model (`docs/ANALYTICS.md`) e automações (`docs/WORKFLOWS.md`). ADRs 192–211. UI sob `/app/control/*`. Não confundir com produto cliente nem com financeiro de plataforma (`docs/FINANCE.md`).
