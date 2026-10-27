# Inteligência documental (Etapa 6)

## Escopo

Pipeline sobre **`document_versions`** já armazenadas (requer `StorageProvider` funcional — local DEV ou futuro cloud). Não substitui upload nem ACL; exige `document.read` + permissões de inteligência.

Schema: `packages/database/src/schema/document-intelligence.ts` (migration `0010_etapa6_ai_document_legal_public.sql`).

## Entidades

| Tabela | Papel |
| --- | --- |
| `document_processing_runs` | Execução por versão (estratégia, OCR, hashes, contagem) |
| `document_pages` | Texto por página + proveniência |
| `document_segments` | Trechos indexáveis para busca |
| `document_classifications` | Tipo/kind sugerido ou manual |
| `document_extracted_metadata` | Metadados extraídos (revisáveis) |

Status de run: `pending` … `succeeded` | `failed` | `not_configured` | `cancelled`.

## Fluxo `process`

1. Validar org, documento, versão, tamanho (até 50 MiB processável).
2. **Extração de texto** (`extractDocumentText` em `@verasjuris/ai`):
   - Texto plano / camada PDF nativa primeiro
   - Se insuficiente e PDF imagem → marcar `ocrRequired`
3. **OCR** somente se `ocrRequired` e provedor configurado; com `OCR_PROVIDER=not_configured` → run `not_configured`, código `OCR_PROVIDER_NOT_CONFIGURED`, **sem** texto inventado (ADR 064).
4. Persistir páginas/segmentos com hash de texto para idempotência.
5. Classificação/metadados via IA (`document_classification`, `document_metadata_extraction`) passam pelo `AIGateway` + Zod; com IA não configurada → `not_configured` / falha honesta.

## Proveniência (ADR 063)

Cada trecho relevante pode gerar linha em **`ai_result_sources`** (request de classificação) e campos de página em `document_pages` (`pageNumber`, offsets). UI deve citar página ao exibir sugestão.

## Permissões

- `document_intelligence.read` — consulta, busca, páginas
- `document_intelligence.process` — disparar processamento/classificação sugerida
- `document_intelligence.review` — aceitar/corrigir/rejeitar classificação e metadados

RBAC documental (`document.read`, confidencialidade, ACL) continua valendo antes de qualquer processamento.

## API (resumo)

| Método | Caminho |
| --- | --- |
| GET | `…/document-intelligence/search?q=` — busca em segmentos (tenant) |
| GET | `…/documents/:id/intelligence` — visão agregada |
| POST | `…/documents/:id/versions/:versionId/process` |
| GET | `…/documents/:id/versions/:versionId/pages` |
| POST | `…/classifications/suggest`, review, manual |
| POST | `…/metadata`, review |

Idempotência via corpo/cabeçalhos conforme schemas em `@verasjuris/validation`.

## Busca

Busca textual opera sobre segmentos persistidos — **não** é Elasticsearch/OpenSearch. Sem índice externo nesta etapa.

## UI

Componente `document-processing` na web: distingue OCR ausente vs IA ausente; não mostra classificação “concluída” quando status é `not_configured`.

## Relacionado

- `docs/DOCUMENTS.md`, `docs/SECURE_UPLOAD.md`
- `docs/AI_CORE.md`, `docs/AI_PROVIDERS.md`
