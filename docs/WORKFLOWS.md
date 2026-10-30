# Workflows / Automações

Motor central `WorkflowEngine` (ADR 204). Builder WHEN / IF / THEN / APPROVAL / ON FAILURE.

## UI

`/app/control/automacoes` (+ workflows, workflows/[id], templates, runs, falhas, logs)

## API

`/v1/organizations/:orgId/workflows/...`

## Docs satélite

`WORKFLOW_ENGINE.md`, `WORKFLOW_ACTIONS.md`, `WORKFLOW_SECURITY.md`, `WORKFLOW_TEMPLATES.md`. ADRs 204–211.


## Workflows × security/privacy

Ações registradas podem integrar aprovações de DSR/security alerts no futuro; sem execução arbitrária. Assistente não dispara ações críticas de workflow sem humano.
