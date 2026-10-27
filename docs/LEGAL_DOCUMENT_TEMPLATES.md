# Modelos de documento jurídico (Prompt 15)

## Objetivo

Catálogo versionado de **modelos** (`legal_document_templates` / `legal_document_template_versions`) para iniciar minutas. O modelo **não** é a minuta nem o documento protocolado.

Schema: `packages/database/src/schema/legal-templates.ts`.  
API: `apps/api/src/modules/legal-templates/`.  
Migração: `packages/database/drizzle/0012_etapa7_drafting_comparison_post_auction.sql`.

## Escopo: system vs organization (ADR 085)

| Escopo | `organizationId` | Uso |
| --- | --- | --- |
| `system` | `null` | Modelo institucional VerasJuris (leitura compartilhada) |
| `organization` | UUID da org | Modelo do tenant; CRUD conforme permissões |

Templates de sistema não são mutáveis pelo tenant. Templates de organização não vazam entre tenants (404 cross-org).

## Tipos e formatos

**Tipo** (`document_type` / template type): `initial_petition`, `defense`, `reply`, `motion`, `appeal`, `counter_arguments`, `legal_opinion`, `administrative_request`, `contract`, `notice`, `power_of_attorney`, `declaration`, `settlement`, `other`.

**Formato de conteúdo:** `html` | `markdown` | `plain_text` | `structured`.

## Versões imutáveis (ADR 086)

- Conteúdo vive em **`legal_document_template_versions`**.
- Status da versão: `draft` → `review` → `approved` → `active` → `deprecated` | `archived`.
- Ativar uma versão aponta `templates.currentVersionId` para o id da versão ativa.
- Versões já publicadas **não** são reescritas in-place; correção = nova versão.

## Motor de variáveis (ADR 087)

Substituição apenas via `TemplateVariableResolver` (`@verasjuris/ai` / `template-variables.ts`):

- Expressões `{{path.to.value}}` com **whitelist** de caminhos.
- Sem `eval`, `Function`, acesso a `__proto__` / `prototype` / `constructor`, colchetes ou chamadas.
- Variável ausente → marcador `⟦MISSING_VARIABLE:…⟧` (não inventar valor).
- Expressões bloqueadas permanecem literais no texto.

## Distinções

| Conceito | Papel |
| --- | --- |
| Template | Modelo versionado |
| Draft (minuta) | Trabalho editável + workflow — `docs/LEGAL_DRAFTING.md` |
| Document | Binário versionado no storage — `docs/DOCUMENTS.md` |

## Limites honestos

- Export PDF/DOCX de template/minuta: **`NOT_CONFIGURED`** (HTML sanitizado pode existir).
- Sem marketplace de modelos externos nem sync com Word online.

## Relacionado

- `docs/LEGAL_DRAFTING.md`, `docs/LEGAL_DOCUMENT_WORKFLOW.md`
- ADRs 085, 086, 087
