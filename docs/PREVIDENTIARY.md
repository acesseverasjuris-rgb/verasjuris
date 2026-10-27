# Previdenciário (Prompt 16)

## Princípio

**LegalMatter ≠ PrevidentiaryCase ≠ SocialSecurityBenefit ≠ AdministrativeProcess.**

Caso previdenciário (`previdentiary_cases`) é agregado tenant-bound ligado a um LegalMatter e a um cliente CRM. Concentra regime, situação do segurado, períodos, contribuições, benefícios, CNIS, requerimentos, perícias e cálculos — **sem** embutir isso em `legal_matters`.

Schema: `packages/database/src/schema/previdentiary.ts`. Rotas: `apps/api/src/modules/previdentiary/`. Motores: `@verasjuris/calculations`. ADRs 100–107, 112.

## Modelo

| Entidade | Papel |
| --- | --- |
| `previdentiary_cases` | Caso previdenciário (regime RGPS/RPPS/…, responsável) |
| `previdentiary_client_profiles` | Perfil complementar do cliente (NIT/PIS mascarados, flags rural/especial) |
| `benefit_types` | Catálogo de espécies — seed de referência, **não** oficial INSS |
| `social_security_benefits` | Benefício (NB, DER/DIB/DCB, status); vínculo opcional a processo admin/judicial |
| `social_security_periods` / `contributions` | Vínculos e competências |
| `special_periods` / `rural_periods` | Especial e rural com revisão |
| `previdentiary_requests` | Requerimento especializado (ver `PREVIDENTIARY_ADMIN_REQUESTS.md`) |
| `previdentiary_medical_exams` / `social_assessments` | Perícia e avaliação social (agenda opcional) |
| `cnis_*` | Importação revisável (ver `CNIS.md`) |
| `previdentiary_rule_sets` / `calculations` / `benefit_scenarios` | Cálculo versionado (ver `PREVIDENTIARY_CALCULATIONS.md`) |

## Separações críticas

- **Benefit ≠ processo administrativo** — NB e ciclo do benefício são próprios; processo é opcional (ADR 101).
- **Request ≠ Benefit** — requerimento pede; benefício é o direito/ato.
- **Cálculo ≠ IA** — motores determinísticos; revisão humana (ADR 103).
- **Providers** — `SocialSecurityProvider` / `CNISProvider` default **`NOT_CONFIGURED`** (ver `SOCIAL_SECURITY_PROVIDERS.md`).

## Dinheiro e datas

- Valores em **centavos inteiros**.
- Competências como texto `YYYY-MM`.
- Timezone padrão de perícias: `America/Sao_Paulo`.

## Documentos

Vínculos via `document_links` / rotas `previdentiary-document-links` com alvos como `previdentiary_case`, benefício, CNIS, etc. Sem storage paralelo. Ver `docs/DOCUMENTS.md`.

## RBAC

`previdentiary.read` | `create` | `update` | `manage_benefits` | `manage_requests` | `manage_cnis` | `calculate` | `review_calculation` | `manage_medical_exam`.

## API (resumo)

Prefixo: `/v1/organizations/:organizationId`

| Recurso | Caminho |
| --- | --- |
| Health providers | `…/previdentiary/providers/health` |
| Espécies | `…/previdentiary/benefit-types` |
| Casos | `…/previdentiary-cases` (+ periods, contributions, special/rural, benefits, documents) |
| Perfil cliente | `…/previdentiary-client-profiles` |
| Benefícios | `…/previdentiary-benefits` |
| Requerimentos / perícias | `…/previdentiary-requests` (+ medical-exams, social-assessments) |
| Cálculos / rule sets / cenários | `…/previdentiary-calculations`, `…/previdentiary-rule-sets`, `…/previdentiary-scenarios/compare` |
| CNIS | `…/cnis-imports`, `…/cnis-entries/:id/review` |

Cross-tenant → **404**.

## Fora do escopo / honestidade

- Sem Meu INSS, Dataprev, API oficial de benefício ou scraping.
- Catálogo de espécies não é TPU/INSS oficial.
- Protocolo de requerimento não é confirmação do órgão.
- Cálculo não concede benefício nem altera status do LegalMatter automaticamente.

## Relacionado

- `docs/PREVIDENTIARY_ADMIN_REQUESTS.md`
- `docs/PREVIDENTIARY_CALCULATIONS.md`
- `docs/CNIS.md`
- `docs/SOCIAL_SECURITY_PROVIDERS.md`
- `docs/ADMINISTRATIVE_PROCESSES.md`
- `docs/LEGAL_MATTERS.md`
