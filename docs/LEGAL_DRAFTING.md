# Minutas jurídicas (Prompt 15)

## Objetivo

Agregado de **minuta** (`legal_document_drafts`) com versões de conteúdo, source set, checklist e histórico de workflow. Assistência de IA é opcional e **não** aprova nem protocola.

Schema: `packages/database/src/schema/legal-drafts.ts`.  
API: `apps/api/src/modules/legal-drafts/`.  
Estado: `packages/auth/src/legal-draft-state.ts`.

## Draft ≠ Document (ADR 088)

| Entidade | Significado |
| --- | --- |
| **Draft** | Peça em elaboração; status de workflow; pode ter várias versões de texto |
| **Document** | Arquivo lógico + versões binárias no storage (`documents` / `document_versions`) |

Protocolar ou anexar evidência pode **referenciar** um `documentId` / versão; isso não transforma a minuta em documento de storage automaticamente. Export PDF/DOCX: **`NOT_CONFIGURED`**.

## Source set (ADR 089)

`legal_draft_source_sets` + itens tipados: `document`, `analysis`, `research`, `citation`, `fact`, `evidence`, `instruction`.

- Conjunto versionado das fontes usadas na geração/assistência.
- Citações sugeridas pela IA só a partir de IDs **já presentes** no source set (sem inventar jurisprudência).
- `CitationInsertionService` permanece stub `NOT_CONFIGURED` — ver `docs/CITATION_ENGINE.md`.

## Status (resumo)

`draft` → `ai_assisted` → `human_review` → `approved` → `ready_to_file` → `filed` → `confirmed`  
(+ `rejected` | `cancelled` | `archived` | `failed`).

Máquina completa e guards: `docs/LEGAL_DOCUMENT_WORKFLOW.md` (ADR 090–092).

## Assistência IA (ADR 091)

- Feature de assistência marca o fluxo como assistido; `appliedToDomain: false`.
- Com `AI_PROVIDER=not_configured`: erro `AI_PROVIDER_NOT_CONFIGURED`; **status da minuta não avança** como se houvesse conteúdo gerado.
- Assistido ≠ aprovado ≠ protocolado.

## Filing

Métodos: `manual` | `electronic` | `provider` | `not_configured`.  
Nesta etapa o protocolo efetivo é **manual** (“Protocolo informado manualmente”). E-filing / provider real: **não ligados**.

`filed` ≠ `confirmed` (ADR 092): confirmação exige documento de evidência (`confirmationEvidenceDocumentId`).

## Checklist

Itens com status `pending` | `done` | `not_applicable` | `blocked`. Itens bloqueadores / críticos incompletos impedem `ready_to_file`.

## Relacionado

- `docs/LEGAL_DOCUMENT_TEMPLATES.md`
- `docs/LEGAL_DOCUMENT_WORKFLOW.md`
- `docs/CITATION_ENGINE.md`
- ADRs 088–092
