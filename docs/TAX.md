# Tributário (Etapas 11–13)

## Princípio

**LegalMatter ≠ TaxCase ≠ AdministrativeProcess/JudicialProcess.**

`tax_cases` é agregado tenant-bound com FK a `legal_matters` e cliente CRM. Obrigações, créditos, restituições, compensações, lançamentos, execuções, garantias, teses e cálculos vivem neste domínio — não em colunas do matter (ADR 117). Processos administrativos/judiciais existentes são **reutilizados** via vínculos (`tax_administrative_cases`, etc.), não duplicados.

Schema: `packages/database/src/schema/tax.ts`. Rotas: `apps/api/src/modules/tax/`. Motores: `@verasjuris/calculations` (`TaxCalculationEngine`). ADRs 113–118, 127.

## Modelo

| Entidade | Papel |
| --- | --- |
| `tax_cases` | Caso tributário (`taxpayerType`, escopo, status, responsável) |
| `tax_types` | Catálogo de tributos (seed / org / import / provider) |
| `tax_obligations` | Obrigações acessórias/principais/pagamento |
| `tax_credits` / `tax_refund_requests` / `tax_compensations` | Crédito, restituição, compensação |
| `tax_assessments` | Lançamento / auto de infração |
| `tax_administrative_cases` | Ponte para `administrative_processes` |
| `tax_debt_certificates` | CND / certidões (dados informados ou futuro provider) |
| `tax_enforcement_cases` / `tax_guarantees` | Execução fiscal e garantias |
| `tax_legal_theses` / `tax_case_thesis_links` | Teses e aplicabilidade |
| `tax_rule_sets` / `tax_calculations` | Cálculo versionado (ver `TAX_CALCULATIONS.md`) |

## Status do caso

`draft` | `active` | `suspended` | `closed` | `archived` — encerramento do TaxCase **não** fecha o LegalMatter automaticamente.

## Relação com núcleo comum

- Partes processuais continuam em `legal_matter_parties` + extensões de área quando aplicável.
- Prazos centrais e documentos usam os módulos existentes (`deadlines`, `document_links`).
- Módulo de área `TAX` em `legal_area_modules` + binding opcional (`legal_matter_area_bindings`).

## Providers

`FederalTaxProvider`, `StateTaxProvider`, `MunicipalTaxProvider`, `TaxDebtProvider`, `TaxFilingProvider` default **`NOT_CONFIGURED`**. Ver `docs/TAX_PROVIDERS.md`. Status: `GET …/tax-providers/status`.

## RBAC

`tax.read` | `create` | `update` | `manage_obligations` | `manage_credits` | `manage_refunds` | `manage_compensations` | `manage_assessments` | `manage_enforcement` | `manage_theses` | `calculate` | `review_calculation`.

## API (resumo)

Prefixo: `/v1/organizations/:organizationId`

| Recurso | Caminho |
| --- | --- |
| Providers | `…/tax-providers/status` |
| Tipos / rule sets / teses | `…/tax-types`, `…/tax-rule-sets`, `…/tax-theses` |
| Casos | `…/tax-cases` (+ timeline, sub-recursos) |
| Cálculos | `…/tax-cases/:id/calculations`, `…/tax-calculations/:id/run`, `…/review` |

## Segurança

Dados fiscais são sensíveis (LGPD + sigilo fiscal operacional). Cross-tenant → **404**. Providers oficiais não sincronizam sem adapter; nenhum scraping Receita/SEFAZ/prefeitura neste repositório (ADR 127). Cálculo determinístico ≠ decisão administrativa; revisão humana antes de uso operacional.

## NOT_CONFIGURED

Sync de declarações, lançamentos oficiais, certidões automáticas, importação fiscal em lote via broker externo (`TAX_IMPORT`, `TAX_PROVIDER_SYNC` no worker local). Fila distribuída default `not_configured` (ADR 098).

## Fora do escopo

Homologação automática perante Fisco, DCTF/EFD automática, protesto/penhora eletrônica real, parecer fiscal vinculante gerado por IA.

## Relacionado

- `docs/TAX_CALCULATIONS.md`, `docs/TAX_PROVIDERS.md`
- `docs/LEGAL_MATTERS.md`, `docs/ADMINISTRATIVE_PROCESSES.md`
- `docs/LEGAL_AREAS.md` (módulo TAX)
