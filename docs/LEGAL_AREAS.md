# Núcleo jurídico comum e módulos de área (Etapas 11–13)

## Princípio

**LegalMatter** permanece o agregado central. Módulos de área (`legal_area_modules`) registram capacidades sem `if (area === …)` espalhado (ADR 113–115). Extensões 1:1/1:N ligam o matter a dados especializados **sem** duplicar `Client`, `Document`, `Task` ou `Deadline`.

Schema: `packages/database/src/schema/legal-areas.ts`. Rotas: `apps/api/src/modules/legal-areas/`. Registry: `apps/api/src/modules/legal-areas/registry.ts`. ADRs 113–116, 127.

## Catálogo de módulos

Chaves: `TAX`, `CIVIL`, `CONSUMER`, `FAMILY`, `SUCCESSION`, `CORPORATE`, `CRIMINAL`, `ADMINISTRATIVE`, `MEDICAL`, `REAL_ESTATE`, `ENVIRONMENTAL`, `ELECTORAL`, `SPORTS`, `DIGITAL`, `INTERNATIONAL`, `ARBITRATION`, `MEDIATION`.

Tributário pesado usa agregado `tax_cases` (domínio próprio); demais áreas usam extensões no schema `legal-areas.ts` + bindings.

## Entidades transversais

| Entidade | Papel |
| --- | --- |
| `legal_area_modules` | Catálogo sistema (key, versão, config) |
| `legal_area_feature_config` | Features ativas por módulo |
| `legal_area_checklists` | Checklists versionados |
| `legal_area_template_packs` | Packs de templates por área |
| `legal_area_workflow_configs` | Estágios sobre workflow existente |
| `versioned_rule_sets` | Parâmetros versionados (danos, tax, etc.) |
| `legal_matter_area_bindings` | Matter ↔ módulo + `confidentiality` + metadata |

## Partes no matter

`legal_matter_parties.personType`: `person` | `organization` | `public_body` | `other` (enum fixo).

Papéis mais ricos (herdeiro, árbitro, perito, etc.) usam **`position`** (`legal_matter_party_position`) + **metadata/labels** nas extensões de área (`estate_heirs`, partes de contrato, etc.) — **sem** duplicar entidade `Client` e **sem** expandir o enum histórico salvo necessidade futura documentada (ADR 114).

## Providers de área

`RegistryProvider`, `EnvironmentalDataProvider`, `ElectoralDataProvider` em `@verasjuris/ai` — default `not_configured`. Status agregado: `GET …/area-providers/status`.

## RBAC

`legal_area_module.read` | `legal_area_module.manage` + permissões dos domínios especializados (tax, contract, …).

## API (resumo)

| Recurso | Caminho |
| --- | --- |
| Módulos / features | `…/legal-area-modules`, `…/:key/features` |
| Checklists / packs / workflow | `…/legal-area-checklists`, `…/template-packs`, `…/workflow-configs` |
| Rule sets | `…/versioned-rule-sets` |
| Bindings / extensões | `…/legal-matters/:id/area-bindings`, `…/area-extensions` |
| Extensões por área | `…/legal-matters/:id/civil/…`, `…/consumer-cases`, `…/criminal-cases`, etc. |

## NOT_CONFIGURED

Sync cartorial/ambiental/eleitoral via providers; análise documental assíncrona `AREA_DOCUMENT_ANALYSIS` (worker local stub). Features desligadas em `legal_area_feature_config` não simulam dados.

## Documentação por área

Ver `docs/CIVIL.md`, `docs/CONSUMER.md`, … e `docs/LEGAL_AREA_EXTENSION_MODEL.md`.

## Relacionado

`docs/LEGAL_MATTERS.md`, `docs/TAX.md`, `docs/CONTRACTS.md`, ADRs 113–116
