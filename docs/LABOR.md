# Trabalhista (Prompt 16)

## Princípio

**LegalMatter ≠ LaborCase ≠ EmploymentContract ≠ JudicialProcess.**

`labor_cases` é agregado tenant-bound com FK a `legal_matters` e vínculo opcional a processo judicial. Contratos, jornada, remuneração, FGTS, rescisão, pedidos e liquidação vivem neste domínio — não em colunas do matter (ADR 108).

Schema: `packages/database/src/schema/labor.ts`. Rotas: `apps/api/src/modules/labor/`. Motores: `@verasjuris/calculations`. ADRs 108–112.

## Modelo

| Entidade | Papel |
| --- | --- |
| `labor_cases` | Caso trabalhista (`clientRole`, status, responsável) |
| `employment_contracts` | Contrato corrente |
| `employment_contract_history` | Histórico (salário, cargo, datas, …) — ADR 109 |
| `work_schedules` / `work_time_records` | Jornada e ponto |
| `labor_remuneration_items` | Rubricas (centavos) |
| `vacation_periods` | Férias |
| `fgts_records` | FGTS **informado** / estimado — ≠ saldo oficial (ADR 111) |
| `employment_terminations` | Rescisão |
| `labor_claim_items` | Pedidos / verbas |
| `labor_rule_sets` / `labor_calculations` | Cálculo versionado |
| `labor_liquidations` | Liquidação (ver `LABOR_LIQUIDATION.md`) |

## Status do caso

`draft` | `active` | `waiting` | `closed` | `archived` (e demais do enum no schema) — machine no serviço; encerramento do LaborCase **não** fecha o LegalMatter automaticamente.

## Documentos e produtividade

- Links `document_links` com `targetType` `labor_case` (e rotas de documentos do caso).
- `POST …/labor-cases/:id/suggest-tasks` e `suggest-deadlines` — sugestões assistivas / stubs honestos; **não** confirmam prazo legal.

## Providers

`ESocialProvider`, `FGTSProvider`, `LaborCourtProvider` default **`NOT_CONFIGURED`**. Ver `docs/LABOR_PROVIDERS.md`. Status: `GET …/labor-providers/status`.

## RBAC

`labor.read` | `create` | `update` | `manage_contract` | `manage_schedule` | `manage_remuneration` | `manage_fgts` | `manage_termination` | `manage_claims` | `calculate` | `review_calculation` | `liquidate`.

## API (resumo)

Prefixo: `/v1/organizations/:organizationId`

| Recurso | Caminho |
| --- | --- |
| Providers | `…/labor-providers/status` |
| Casos | `…/labor-cases` (+ timeline, documents, suggest-*) |
| Contratos / histórico | `…/employment-contracts`, `…/:id/history` |
| Jornada / ponto | `…/work-schedules`, `…/work-time-records` |
| Remuneração / férias / FGTS | `…/labor-remuneration`, `…/vacations`, `…/fgts` |
| Rescisão / pedidos | `…/employment-terminations`, `…/labor-claims` |
| Cálculos / liquidação / rule sets | `…/labor-calculations`, `…/labor-liquidations`, `…/labor-rule-sets` |

## Fora do escopo

eSocial oficial, saldo FGTS Caixa, PJe-JT / scraping, liquidação judicial homologada automática, petição trabalhista automática.

## Relacionado

- `docs/LABOR_CALCULATIONS.md`
- `docs/LABOR_LIQUIDATION.md`
- `docs/LABOR_PROVIDERS.md`
- `docs/LEGAL_MATTERS.md`
- `docs/JUDICIAL_PROCESSES.md`
