# Analytics

**Read model** agregado sobre domínios-fonte (ADR 200–201). Não substitui Ledger, CRM, Tasks, etc.

## Abas

EXECUTIVO · RECEITA · CLIENTES · JURÍDICO · OPERAÇÃO · MARKETPLACE · IA · FINANCEIRO · PRODUTO · RH · COMPLIANCE

## Filtros

período, organização, produto, área, região, plano, departamento.

## UI

`/app/control/analytics` — gráficos com alternativa tabular (acessibilidade).

## API

`/v1/organizations/:orgId/analytics/dashboard|metrics|snapshots|exports`

## Docs satélite

`METRIC_REGISTRY.md`, `BI_DASHBOARDS.md`. ADRs 200–203.


## Analytics × a11y

Gráficos devem oferecer tabela alternativa (`ChartWithTableAlternative`). Métricas de MFA adoption etc. vêm de read models quando publicados — sem inventar números.
