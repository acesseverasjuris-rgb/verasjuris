# Pesquisa jurídica (Etapa 7)

## Objetivo

Pesquisar e organizar fontes jurídicas **verificáveis** (legislação, jurisprudência, súmulas, temas, precedentes, doutrina). A IA **não** “lembra” jurisprudência: todo resultado externo passa por **`LegalSourceProvider` → `ResearchGateway` → catálogo local / CitationEngine**.

Schema: `packages/database/src/schema/legal-research.ts`. Contratos: `@verasjuris/ai` (`research.ts`).

## ResearchGateway (obrigatório)

Domínios e rotas usam somente `ResearchGateway` — nunca SDK ou HTTP direto a tribunais na API.

| Estado | Comportamento |
| --- | --- |
| `LEGAL_SOURCE_PROVIDER=not_configured` (padrão) | Health `not_configured`; busca externa rejeitada/ausente; **busca local** no catálogo do tenant/global |
| Provider real (futuro) | `search` / `fetchById` com proveniência; resultados só entram na UX se mapearem a IDs do catálogo local |

Mensagem típica: *“Nenhum provedor de fontes jurídicas está configurado. Nenhum resultado de pesquisa foi inventado.”*

Erro: `LEGAL_SOURCE_PROVIDER_NOT_CONFIGURED`.

Detalhe do contrato de capacidades: `docs/LEGAL_SOURCE_PROVIDERS.md`. ADRs 073, 074.

## Catálogo local

Tabelas (org e/ou global conforme modelo):

- `legal_sources`
- `case_law_records`
- `legal_summaries`
- `repetitive_themes` / `general_repercussion_themes`
- `legal_precedents`
- `doctrine_sources`
- `legal_research_queries` / `legal_research_results`
- `saved_researches`
- `legal_matter_research_links`

Cadastro manual exige proveniência (`sourceUrl` https quando aplicável). Status de registro de jurisprudência: `draft`, `available`, `verified`, `unavailable`, `stale`, `not_configured`.

## Empty states e anti-alucinação

| Situação | Status / UX |
| --- | --- |
| Catálogo vazio + provider `not_configured` | Lista vazia; `not_configured`; nada inventado |
| Busca sem hits locais | `empty` |
| Provider devolve itens sem IDs locais mapeáveis | `empty` (não inventa IDs) |
| Doutrina sem licença | Só referência bibliográfica; `fullTextAvailable: false` |

**Nunca** inventar ementa, número de processo, URL ou trecho de julgado.

## Doutrina

Campo `licensed` no catálogo. Sem licença: metadados bibliográficos apenas — sem texto integral fictício (ADR 078).

## Permissões e API

- `legal_research.read` | `execute` | `save` | `manage`

Prefixo: `/v1/organizations/:organizationId/legal-research`

Recursos típicos: `provider/status`, pesquisa, listagens (`legislation`, `case-law`, `summaries`, `themes`, `precedents`, `doctrine`), `saved`, detalhe `/:sourceType/:sourceId`, links em matter (`legal-matter-research-links`).

Status de query: `pending`, `running`, `succeeded`, `failed`, `empty`, `not_configured`.

## Relacionado

- `docs/CITATION_ENGINE.md` — citação e verificação
- `docs/LEGAL_SOURCE_PROVIDERS.md`
- `docs/AI_CORE.md`
- ADRs 073–078

## Teses tributárias e multi-área (Etapas 11–13)

- **`tax_legal_theses`** e links em casos tributários são catálogo **interno** de teses — distinto de resultado de `ResearchGateway`; não substituem pesquisa verificável.
- Extensões de área podem referenciar documentos e análises; pesquisa jurídica continua ancorada no catálogo local + provider `not_configured`.
- Job `AREA_DOCUMENT_ANALYSIS` (worker local): stub — análise documental por área não roda em background até handler real existir.
