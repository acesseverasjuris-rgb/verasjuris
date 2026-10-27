# Tarefas e SLA operacional (Etapa 5)

## Distinções

- **Task ≠ Deadline**: tarefa é trabalho interno; prazo jurídico vive em `deadlines`.
- **SLA ≠ prazo legal**: `task_sla` / `sla_policies` medem tempo operacional (pausam em `waiting`/`blocked`).

## Capacidades

CRUD de tarefas, checklist, comentários (texto puro — HTML removido), dependências com detecção de ciclo, histórico, políticas de SLA.

## Permissões

`task.*`, `sla.manage` — ver `docs/AUTHORIZATION.md`.

## API

Prefixo `/v1/organizations/:organizationId/tasks` (+ `/sla-policies`, `/overview`).

## UI

`/app/tarefas`, `/app/tarefas/nova`, `/app/tarefas/[id]` — lista ou kanban acessível com filtro de status.

## Limites

Sem e-mail/WhatsApp, sem sync externo. Fila genérica default `not_configured`; jobs locais só com opt-in explícito (ADR 098) — tarefas em si não dependem disso.

## Distinções (Prompt 15)

Task ≠ Deadline ≠ checklist de minuta (`legal_draft_checklists`) ≠ checklist de regularização pós-leilão. Minutas: `docs/LEGAL_DRAFTING.md`.
