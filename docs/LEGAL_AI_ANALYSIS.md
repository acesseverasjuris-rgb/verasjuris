# Análise jurídica assistida por IA

## Conceito

Análise **estruturada** sobre documentos e contexto de LegalMatter / processos — fatos, pedidos, fundamentos, provas, contradições, partes, valores, obrigações, lacunas. Produto de **sugestão**; status padrão exige revisão (`requires_review`).

**Não** cria petição/minuta, **não** altera status de matter/processo/prazo, **não** registra decisão judicial.

**Domínios distintos:**
- **IA revisora** (Etapa 6.3): vícios formais / riscos / sugestões **sem** editar a peça — `docs/AI_REVIEW.md`, ADR 071.
- **Comparação** (Prompt 15): confronto tipado lado A × B — `docs/LEGAL_COMPARISON.md`, ADR 093.
- **Minutas** (Prompt 15): elaboração + workflow — `docs/LEGAL_DRAFTING.md`.

Schema: `packages/database/src/schema/legal-analysis.ts`.

## Agregado `legal_ai_analyses`

- Vínculos opcionais: `legalMatterId`, `judicialProcessId`, `administrativeProcessId`, `documentId`
- `analysisType` + **`version`** inteira (ADR 067) — índice único `(organizationId, legalMatterId, analysisType, version)`
- `aiRequestId` → trilha em `ai_requests` / `ai_usage`
- Status: `pending`, `running`, `succeeded`, `failed`, `not_configured`, `requires_review`, `reviewed`, …
- `structuredResult` (JSON) + tabelas normalizadas por seção (`legal_analysis_facts`, `_claims`, `_grounds`, `_evidence_links`, `_contradictions`, `_dates`, `_parties`, `_amounts`, `_obligations`, `_missing_info`)

Itens filhos têm `reviewStatus`: `unreviewed` | `accepted` | `corrected` | `rejected`.

## Schema de saída (Zod)

`legalAnalysisOutputSchema` em `@verasjuris/ai` (`LEGAL_ANALYSIS_SCHEMA_VERSION`). Gateway valida antes de persistir seções. Falha de schema → `AI_INVALID_RESPONSE`, sem criar análise “sucedida” falsa.

Instruções: `LEGAL_ANALYSIS_INSTRUCTIONS` + conteúdo documental em bloco não confiável.

## Permissões

- `legal_analysis.read`
- `legal_analysis.create` — dispara análise (com IA configurada nos testes)
- `legal_analysis.review` — revisão global ou por item

## API

Prefixo: `/v1/organizations/:organizationId/legal-analyses`

| Método | Ação |
| --- | --- |
| POST | Criar (idempotência via body/cabeçalho) |
| GET | Listar / detalhe |
| GET | `…/:id/versions` — histórico de versões do mesmo tipo |
| POST | `…/:id/review` — revisão da análise |
| POST | `…/:id/items/:section/:itemId/review` — item |

Com `AI_PROVIDER=not_configured`: erro `AI_PROVIDER_NOT_CONFIGURED`, request AI em `not_configured`, **sem** fatos inventados.

## Auditoria

Eventos `ai.requested`, `ai.completed`, `ai.failed` no runner; ações específicas de revisão conforme serviço.

## UI

`/app/ia/analises` — estados `not_configured` e `failed` visíveis; revisão explícita antes de tratar como confiável.

## Relacionado

- `docs/AI_REVIEW.md` — revisão assistida (módulo separado)
- `docs/LEGAL_COMPARISON.md` — comparação tipada (módulo separado)
- `docs/LEGAL_DRAFTING.md` — minutas (não geradas automaticamente por esta análise)
- `docs/LEGAL_MATTERS.md`
- `docs/DOCUMENT_INTELLIGENCE.md` (texto fonte)
- `docs/AI_CORE.md`
- `docs/CITATION_ENGINE.md` — citações verificáveis (não inventar jurisprudência na análise)
