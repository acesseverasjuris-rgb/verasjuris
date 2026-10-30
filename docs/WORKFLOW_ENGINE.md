# Workflow Engine

- Definição + versões imutáveis após publish (ADR 205).
- Triggers: domain_event, schedule, manual, webhook, threshold, state_change.
- Condições: DSL segura (ADR 206) — sem eval/código arbitrário (ADR 208).
- Runs idempotentes (ADR 209); dry-run sem side-effects (ADR 211).
- Aprovações via integração Control/approvals (ADR 210).

Schema: `packages/database/src/schema/workflows.ts`.
