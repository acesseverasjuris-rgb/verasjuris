# Núcleo de IA (Etapa 6)

## Objetivo

Infraestrutura **assistiva** para processamento documental, classificação, metadados, análise jurídica estruturada, **revisão de peças**, **pesquisa/citação**, **assistência a leilões**, **minutas**, **comparações** e sugestões operacionais em previdenciário/trabalhista. Toda saída de modelo exige revisão humana antes de qualquer uso operacional ou jurídico. A IA **não** altera status de processos, prazos, partes, honorários nem outros domínios críticos automaticamente; a revisora **não** auto-edita documentos; assistência a minuta **não** aprova nem protocola; **cálculos previdenciários/trabalhistas** vivem em `@verasjuris/calculations` (ADR 103) — não no LLM.

## Pacote `@verasjuris/ai`

Contratos compartilhados (gateway, OCR, oportunidades públicas, `ResearchGateway` / `LegalSourceProvider`, `CitationEngine` + stub de inserção, `AuctionProvider` / bid / mapa, `SocialSecurityProvider` / `CNISProvider` / `ESocialProvider` / `FGTSProvider` / `LaborCourtProvider`, variáveis de template seguras, extração de texto / page mapping, schemas Zod incl. comparação). Módulos da API importam esses contratos — nunca SDK de fornecedor.

Provedores determinísticos para testes ficam em `@verasjuris/ai/testing` e **não** entram em produção.

## Configuração padrão (honesta)

| Variável | Valor permitido hoje | Efeito |
| --- | --- | --- |
| `AI_PROVIDER` | `not_configured` (único valor no schema) | Gateway recusa chamadas de rede; status `not_configured` |
| `OCR_PROVIDER` | `not_configured` | OCR indisponível; PDF escaneado não inventa texto |
| `PUBLIC_OPPORTUNITY_PROVIDER` | `not_configured` | Busca/sincronização externa indisponível |
| `LEGAL_SOURCE_PROVIDER` | `not_configured` | Sem fontes oficiais; pesquisa local / empty |
| `FEATURE_AI` | `1` para expor rotas/UI de IA | Flag de produto; não substitui provedor real |
| `FEATURE_EXTERNAL_INTEGRATIONS` | `1` futuro | Integrações externas genéricas; hoje sem adapters reais |

Providers de leilão (`AuctionProvider`, bid, mapa) e previdenciário/trabalhista (`SocialSecurityProvider`, `CNISProvider`, `ESocialProvider`, `FGTSProvider`, `LaborCourtProvider`) também default **`not_configured`** (factory no pacote AI / API).

**Não há** integração OpenAI, Anthropic, Azure, PNCP, tribunais oficiais, lance eletrônico, Meu INSS, eSocial ou FGTS oficial implementada neste repositório.

## Persistência (`packages/database/src/schema/ai.ts`)

- **`ai_models`** — catálogo global de modelos; preços de referência em micros (ver `docs/AI_COSTS.md`).
- **`ai_prompts` / `ai_prompt_versions`** — versionamento imutável de templates (ver `docs/AI_PROMPTS.md`).
- **`ai_requests`** — tentativa de chamada (status, feature, provedor, `promptVersionId`, idempotência).
- **`ai_responses`** — resultado estruturado ligado 1:1 ao request (quando há sucesso).
- **`ai_usage`** — tokens e custos **separados** do request (1 linha por request). OCR usa `feature = "OCR_USAGE"` (sem coluna `usageKind` — ver `docs/TECHNICAL_DEBT_CLOSURE.md`).
- **`ai_result_sources`** — proveniência (documento, versão, página, offsets). Página ausente no PDF → `PAGE_MAPPING_NOT_AVAILABLE` (não inventar).
- **`ai_jobs`** — trabalho assíncrono (`local_in_process` nos testes; fila genérica default `not_configured`; `LocalInProcessQueueProvider` opt-in — ADR 098).
- **`ai_budgets`** — limites soft/hard por organização em micros.

## API (`apps/api/src/modules/ai/`)

Prefixo: `/v1/organizations/:organizationId/ai`

| Recurso | Permissões típicas |
| --- | --- |
| `GET …/status` | `ai.use` |
| `GET …/models`, `…/prompts`, `…/requests`, `…/usage`, `…/jobs` | `ai.usage.read` / `ai.prompts.read` / `ai.jobs.read` |
| `POST …/prompts`, ativar versão | `ai.prompts.manage` |
| Orçamentos | `ai.config.manage` |

O runner (`runner.ts`) centraliza: registro de request, chamada ao gateway, validação Zod, persistência de response/usage/sources, auditoria (`ai.requested`, `ai.completed`, `ai.failed`).

## Features além do núcleo (Etapas 6.3 / 7 / 8 / Prompts 15–16)

| Feature / contrato | Papel | Doc |
| --- | --- | --- |
| `legal_review` | IA revisora de conjuntos documentais | `docs/AI_REVIEW.md` |
| `ResearchGateway` | Única porta para fontes jurídicas externas | `docs/LEGAL_RESEARCH.md` |
| `CitationEngine` | Formatação + status de verificação | `docs/CITATION_ENGINE.md` |
| `CitationInsertionService` | Inserção em minutas — **stub `NOT_CONFIGURED`** | `docs/CITATION_ENGINE.md` |
| `auction.notice_analysis` / `risk_extraction` / `document_summary` / `due_diligence_assist` | Assistência a editais e checklist | `docs/AUCTIONS.md`, `docs/AUCTION_DUE_DILIGENCE.md` |
| Assistência a minuta / comparação | Não aprova; proveniência obrigatória | `docs/LEGAL_DRAFTING.md`, `docs/LEGAL_COMPARISON.md` |
| `TemplateVariableResolver` | Variáveis `{{…}}` com whitelist | `docs/LEGAL_DOCUMENT_TEMPLATES.md` |
| Providers previdenciário/trabalhista | Contratos `NOT_CONFIGURED`; ≠ motores de cálculo | `docs/SOCIAL_SECURITY_PROVIDERS.md`, `docs/LABOR_PROVIDERS.md` |
| `@verasjuris/calculations` | Cálculo determinístico (fora do LLM) | `docs/PREVIDENTIARY_CALCULATIONS.md`, `docs/LABOR_CALCULATIONS.md` |

`ResearchGateway` é **companheiro** do `AIGateway`: pesquisa de fontes não passa pelo LLM como “memória”; o modelo, quando usado, não substitui o catálogo verificável.

## Worker

`apps/worker/src/ai-jobs.ts` processa jobs de IA quando registrados (incl. `legal_review`, análises de leilão e stub `CNIS_IMPORT`). Sem handler para o `jobType`, o job termina em `not_configured` (`AI_JOB_HANDLER_NOT_REGISTERED`) — nada é simulado como sucesso; CNIS não é inventado.

## UI

Shell em `/app/ia` (status, uso, jobs, análises). Mensagens explícitas quando provedor não está configurado (sem conteúdo inventado).

## Documentos relacionados

- `docs/AI_PROVIDERS.md` — contratos e stubs
- `docs/AI_PROMPTS.md` — prompts e ciclo de vida
- `docs/AI_COSTS.md` — micros e orçamento
- `docs/DOCUMENT_INTELLIGENCE.md` — extração, OCR, classificação
- `docs/LEGAL_AI_ANALYSIS.md` — análise jurídica estruturada
- `docs/AI_REVIEW.md` — IA revisora (separada da análise)
- `docs/LEGAL_RESEARCH.md` / `docs/LEGAL_SOURCE_PROVIDERS.md` / `docs/CITATION_ENGINE.md`
- `docs/PUBLIC_OPPORTUNITIES.md` — oportunidades públicas (≠ leilões)
- `docs/AUCTIONS.md` / `docs/AUCTION_DUE_DILIGENCE.md` / `docs/AUCTION_POST_SALE.md`
- `docs/LEGAL_DOCUMENT_TEMPLATES.md` / `docs/LEGAL_DRAFTING.md` / `docs/LEGAL_COMPARISON.md`
- `docs/PREVIDENTIARY.md` / `docs/LABOR.md` / `docs/CNIS.md` / providers Prompt 16
- `docs/TECHNICAL_DEBT_CLOSURE.md`
- ADRs 058–112 em `docs/adr/`
- Etapas 11–13: `docs/TAX.md`, `docs/TAX_PROVIDERS.md`, `docs/LEGAL_AREAS.md`, `docs/CONTRACTS.md`, `docs/SIGNATURE_PROVIDERS.md` — providers fiscais/assinatura/registro/ambiental/eleitoral default `not_configured`; ADRs 113–127

## Worker (Etapas 11–13)

`apps/worker/src/jobs/tax-contract-handlers.ts` registra handlers locais para `TAX_CALCULATION`, `TAX_IMPORT`, `TAX_PROVIDER_SYNC`, `CONTRACT_ALERT`, `CONTRACT_RENEWAL_ALERT`, `SIGNATURE_STATUS_SYNC`, `CONTRACT_AI_REVIEW`, `AREA_DOCUMENT_ANALYSIS` — sync externo falha explícita; demais stubs no-op idempotentes. Tipos espelhados em `AI_JOB_TYPES` (`ai-jobs.ts`) sem handler ⇒ `not_configured` no executor de `ai_jobs`.

## Fora do escopo destas etapas

Embeddings em produção, visão multimodal real, RAG com índice vetorial externo, e-filing real, export PDF/DOCX, sync oficial de jurisprudência/leilão/INSS/eSocial/Fisco, lance eletrônico, inserção automática de citação, alteração automática de domínio jurídico, cálculo de benefício/rescisão/lançamento fiscal via LLM, assinatura eletrônica simulada.


## AI × Assistant / i18n / a11y

Assistant usa AIGateway quando configurado; fallback FAQ se NOT_CONFIGURED. Modo legal: nunca se apresentar como advogado. TranslationProvider separado do AI core.
