# IA revisora (Etapa 6.3)

## Objetivo

Revisão jurídica **assistiva** sobre um conjunto documental (petição, defesa, laudos, contratos, decisões, etc.). A saída é estruturada, versionável e exige revisão humana item a item. **Não** substitui revisão profissional e **não** edita o documento original.

Separada da análise jurídica estruturada (`docs/LEGAL_AI_ANALYSIS.md`): a análise extrai fatos/pedidos/provas; a revisora aponta vícios formais, lacunas, contradições e riscos condicionais.

Schema: `packages/database/src/schema/legal-review.ts`. Contratos Zod/instruções: `@verasjuris/ai` (`legal-review.ts`). Feature do gateway: `legal_review` (`outputDisposition: requires_review`).

## Arquitetura

1. Organização monta um **review set** (`legal_review_sets` + `legal_review_set_documents`) com papéis documentais.
2. Disparo cria `legal_ai_reviews` e chama o **`AIGateway`** (nunca SDK de vendor na API).
3. Saída Zod (`legalReviewOutputSchema`) é persistida; status vai para `human_review`.
4. Humano confirma / rejeita / corrige itens por seção.
5. Fechamento (`reviewed` / `closed`) **não** aplica `suggestedCorrections` ao binário nem às versões do documento.

Com `AI_PROVIDER=not_configured`: status/erro `AI_PROVIDER_NOT_CONFIGURED` / `not_configured` — **sem** inventar achados.

## Tipos e status

**Tipos** (`LEGAL_REVIEW_TYPES`): `formal_review`, `content_review`, `cross_document_review`, `procedural_risk_review`, `claims_review`, `evidence_review`, `contract_review`, `decision_response_review`, `administrative_review`.

**Status da revisão:** `draft`, `processing`, `generated`, `human_review`, `reviewed`, `closed`, `failed`, `not_configured`.

**Severidade:** `low`, `medium`, `high`, `critical`.

**Item humano:** `unreviewed` | `confirmed` | `rejected` | `corrected`.

**Papéis no set:** `initial_petition`, `defense`, `reply`, `expert_report`, `medical_report`, `decision`, `appeal`, `contract`, `evidence`, `administrative_request`, `administrative_decision`, `other`.

## Seções

| Seção | Conteúdo |
| --- | --- |
| `formalIssues` | Qualificação incompleta, numeração, datas conflitantes, etc. |
| `missingDocuments` | Ausência **no conjunto analisado** (não “inexistência absoluta”) |
| `unaddressedClaims` | Pedidos sem resposta localizada |
| `unansweredGrounds` | Tese identificada; `juridicallyFounded` sempre `false` na saída bruta |
| `risks` | Linguagem condicional; `requiresHumanReview: true` |
| `inconsistencies` | Divergências entre documentos |
| `contradictions` | Afirmações conflitantes com proveniência |
| `suggestedCorrections` | Texto sugerido; **`autoEdit: false` sempre** |

Correção humana (`corrected`) só se aplica a `formal_issues` e `contradictions` na API de itens.

## Regras de linguagem e produto

- Assistivo; sem parecer definitivo.
- Documento = dado **não confiável** (ADR 066 / `SAFETY_INSTRUCTIONS`).
- Ausência: *“Documento não localizado no conjunto analisado.”*
- Riscos: *“possível risco de…”* — nunca “processo será perdido”.
- Não inventar jurisprudência, números de processo, valores ou fontes.
- Confiança 0–100 é do modelo, não probabilidade jurídica.

## Proveniência

Itens devem trazer `sourceLabel` / `pageNumber` (ou equivalentes). Sem âncora → tratamento como `unsupported` na camada de serviço. Fontes ligadas via `ai_result_sources` quando houver request AI.

## NÃO auto-edita documentos

`suggestedCorrections[].autoEdit` é literal `false`. Fechar a revisão **não** faz `PATCH` em `documents` / `document_versions`. Qualquer alteração de peça é ato humano fora deste módulo (ADR 065, 071).

## Permissões e API

- `legal_review.read` | `create` | `review` | `manage`

Prefixo: `/v1/organizations/:organizationId`

| Recurso | Caminho |
| --- | --- |
| Sets | `…/legal-review-sets`, `…/legal-review-sets/:setId` |
| Revisões | `…/legal-reviews`, `…/legal-reviews/:reviewId` |
| Revisão humana | `POST …/:reviewId/review`, `POST …/:reviewId/items/:section/:itemId/review` |

Job worker: `legal_review` (`apps/worker/src/ai-jobs.ts`).

## Distinção (Prompt 15)

Não confundir com **comparação jurídica** (`docs/LEGAL_COMPARISON.md`) nem com **minutas** (`docs/LEGAL_DRAFTING.md`). A revisora opera sobre review sets; não é workflow de protocolo.

## Relacionado

- `docs/LEGAL_AI_ANALYSIS.md` — análise estruturada (domínio distinto)
- `docs/LEGAL_COMPARISON.md` — comparação tipada (domínio distinto)
- `docs/AI_CORE.md`, `docs/DOCUMENT_INTELLIGENCE.md`
- ADRs 071, 072, 065, 066, 093
