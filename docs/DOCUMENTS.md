# Documentos (Etapa 4)

## Princípio

**Document ≠ DocumentVersion.**

- `documents` — entidade lógica (título, dono, categoria, pasta, confidencialidade, status, versão corrente).
- `document_versions` — arquivo imutável versionado (bytes no storage, MIME, hash, estado de upload/scan).

Não há exclusão física (hard delete) nesta etapa. Arquivamento é soft (`status=archived` + `archivedAt`).

## Categorias e pastas

- **Categorias** (`document_categories`) — por organização; seed idempotente (contrato, petição, procuração, prova, protocolo, decisão, outros).
- **Pastas** (`document_folders`) — hierarquia opcional (`parentFolderId`), sempre vinculadas ao mesmo `ownerType`/`ownerId` do contexto.

## Vínculo de dono (`ownerType` / `ownerId`)

Tipos: `organization` | `legal_matter` | `judicial_process` | `administrative_process` | `client` | `intake`.

O serviço valida que o recurso dono existe **na mesma organização** antes de criar documento ou pasta. Documento sem dono válido é rejeitado.

## ACL + RBAC

Acesso exige **os dois níveis**, nesta ordem conceitual:

1. **RBAC** — membership ativa com permissão (`document.read`, `document.download`, `document.upload_version`, etc.).
2. **Confidencialidade** — `normal` / `restricted` liberam com `document.read`; `confidential` exige papel elevado (`owner`/`administrator`) **ou** entrada ACL explícita de leitura.
3. **ACL** (`document_acl_entries`) — concessões por principal (`user`, `membership`, `role`, `organization`) e permissão documental (`read`, `download`, `upload_version`, `update_metadata`, `share`, `archive`, `delete`).

Sem membership → **404**. Membership sem permissão → **403**. Documento confidencial sem elevação/ACL → negado.

Gestão de ACL: `document.manage_acl` (owner/administrator).

## Confidencialidade

Campo `confidentialityLevel` no documento lógico. Não substitui RBAC nem criptografia em repouso do provider (local DEV não é vault).

## Hash SHA-256

Cada versão persiste `sha256` (hex) do conteúdo. Serve para integridade e deduplicação operacional.

**Não** é assinatura digital, ICP-Brasil, PAdES nem prova legal de autoria.

## Versionamento e concorrência

- `versionNumber` sequencial por documento; índice único `(documentId, versionNumber)`.
- Upload gera novo `versionId` e chave de storage `organizationId/documentId/versionId`.
- Versão `available` atualiza `documents.currentVersionId`.
- Conflito de versão ou chave de idempotência → **409**.
- Cabeçalhos `Idempotency-Key` / `X-Idempotency-Key` reutilizam a versão já criada.

## Histórico

`document_timeline_events` registra criação, upload de versão e alterações relevantes. Distinto de `audit_events` (compliance técnico).

## Arquivo (sem hard delete)

- Status: `draft` | `active` | `archived`.
- Documento arquivado não é editado até restauração (permissões `document.archive` / `document.restore`).
- Bytes e metadados de versão permanecem; não há `DELETE` destrutivo da entidade.

## Retenção e legal hold (preparados)

Campos `retentionUntil` e `legalHold` são persistidos e editáveis em metadados.

**Não há** job de purga, bloqueio automático por hold nem política LGPD automatizada nesta etapa.

## API (resumo)

| Recurso | Caminho |
| --- | --- |
| Categorias | `GET …/document-categories` |
| Documentos | `GET/POST …/documents`, `GET/PATCH …/documents/:id` |
| Versões | `POST …/documents/:id/versions` (multipart) |
| Download privado | `GET …/documents/:id/download`, `…/versions/:versionId/download` |
| Pastas | `POST …/document-folders` |
| ACL | `POST …/documents/:id/acl` |

`storageKey` **não** é exposto nas respostas JSON.

## Upload seguro

Detalhes de storage, MIME, limites, quarentena e consistência: `docs/SECURE_UPLOAD.md`.

## Inteligência documental (Etapa 6)

Sobre versões já armazenadas: extração de texto, páginas, classificação assistida, metadados e busca em segmentos. Requer permissões `document_intelligence.*` além de `document.read`.

- Processamento: `POST …/documents/:id/versions/:versionId/process`
- OCR: **`OCR_PROVIDER=not_configured`** por padrão — PDF escaneado não gera texto fictício
- Classificação/metadados IA: **`AI_PROVIDER=not_configured`** por padrão — sugestões só com provedor real ou ambiente de teste

Documentação completa: `docs/DOCUMENT_INTELLIGENCE.md`.

## `document_links` — leilões, revisão, previdenciário e trabalhista

Além dos vínculos de dossiê (`docs/DOSSIER.md`, ADR 050):

| `targetType` | Uso | `linkType` (exemplos) |
| --- | --- | --- |
| `auction` / `auction_lot` | Documentos de leilão (edital, matrícula, etc.) | `auction_notice`, `appraisal`, `registry`, `certificate`, `photo`, `court_decision`, `terms`, `other` |
| `public_opportunity` | Já existente (Etapa 6) | conforme oportunidades públicas |
| `previdentiary_case` (+ alvos de benefício/CNIS/request conforme API) | Peças previdenciárias via rotas `previdentiary-document-links` | conforme serviço previdenciário |
| `labor_case` | Peças trabalhistas | conforme serviço trabalhista |

A **IA revisora** referencia documentos via **review set** (`legal_review_set_documents`), não precisa de `linkType` próprio em `document_links` para a geração. Sugestões de correção **não** alteram versões do documento (`autoEdit: false` — `docs/AI_REVIEW.md`). Docs: `docs/PREVIDENTIARY.md`, `docs/LABOR.md`.

## Draft ≠ Document (Prompt 15)

Minutas (`legal_document_drafts`) **não** são linhas de `documents`. Evidência de protocolo / confirmação pode apontar para um `documentId` existente. Detalhe: `docs/LEGAL_DRAFTING.md`, ADR 088.

## Reconciliação de storage (Prompt 15)

Job/endpoint `STORAGE_RECONCILIATION`: detecta versão sem objeto e upload incompleto. **`autoDelete: false`** — sem exclusão automática (ADR 099). Ver `docs/TECHNICAL_DEBT_CLOSURE.md`, `docs/SECURE_UPLOAD.md`.

## Fora do escopo

Assinatura eletrônica, compartilhamento externo público, S3/GCS em produção, antivírus real, retenção automatizada, índice full-text externo (Elasticsearch), remediação automática de órfãos. OCR/LLM comerciais exigem adapters — não inclusos nesta etapa. Auto-aplicação de correções da revisora ao binário. Export PDF/DOCX de minuta: `NOT_CONFIGURED`.
