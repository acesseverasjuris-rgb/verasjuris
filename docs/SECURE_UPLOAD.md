# Upload seguro (Etapa 4.1)

## Princípio

Arquivos privados entram apenas pela API autenticada, via contrato `StorageProvider` em `@verasjuris/storage`. **Nunca** sob `apps/web/public` nem como asset estático do Next.

Documentos iniciais do intake (Etapa 2.1) continuam com stub próprio `NOT_CONFIGURED` até migrarem para este fluxo.

## StorageProvider

Interface: `putObject`, `getObject`, `objectExists`, `deleteObject`, opcionalmente `headObject` e `createTemporaryDownloadUrl`.

Factory `createStorageProvider(env)`:

| `STORAGE_PROVIDER` | Comportamento |
| --- | --- |
| `not_configured` (padrão) | `NotConfiguredStorageProvider` — put/get lançam **`NOT_CONFIGURED`** (503) |
| `local` | `LocalPrivateStorageProvider` — **somente desenvolvimento** |
| outro | rejeitado como não implementado (`NOT_CONFIGURED`) |

**Não há** adapter AWS S3, GCS ou Azure nesta etapa.

## LocalPrivateStorage — só DEV

- Tag explícita `DEV_LOCAL`.
- Raiz em `LOCAL_STORAGE_PATH`; proibido apontar para `apps/web/public`.
- Em `NODE_ENV=production`, `local` é recusado salvo `ALLOW_LOCAL_STORAGE_IN_PRODUCTION=1` (escape hatch de emergência, não operação normal).
- Chaves apenas com segmentos UUID (`org/doc/version`); bloqueio de path traversal (`..`, absolutos, `\`).

## Produção sem provider

Ambiente de produção sem object storage real deve usar `not_configured`. Upload e download falham de forma honesta — sem fingir bucket remoto.

## MIME e magic bytes

Tipos permitidos: `application/pdf`, `image/jpeg`, `image/png`, `text/plain`.

- Declaração do cliente é confrontada com detecção por magic bytes (PDF/`%PDF`, JPEG, PNG) ou heurística de texto.
- Divergência declarado × detectado → rejeição.
- Extensão do nome **não** autoriza o tipo sozinha.

## Limites

`DOCUMENT_MAX_UPLOAD_MB` (config, padrão 10, máx. 100). A rota multipart e o parser respeitam o limite em bytes.

## Nome de arquivo

- `sanitizeOriginalFilename` — remove path e controles.
- `safeDisplayFilename` — nome seguro para UI/`Content-Disposition`.
- Nomes com `..` ou vazios após sanitização → rejeição.

## Path traversal

Validação na chave de storage (`assertSafeStorageKey`) e resolução sob a raiz (`resolveObjectPath`). Escape do diretório raiz é erro de validação.

## Hash em streaming

`createSha256Hasher` permite atualização por chunks. Em `readMultipartFile`, o SHA-256 é atualizado **progressivamente** a cada chunk enquanto o buffer é montado; o digest final é reutilizado em `processDocumentUpload` quando já calculado.

### Dívida residual (malware scan)

O scanner síncrono atual (`MalwareScannerProvider.scan`) ainda exige o **corpo completo em memória**. Por isso o multipart continua sendo bufferizado até o limite `DOCUMENT_MAX_UPLOAD_MB` — não há pipe puro stream→storage→scan sem buffer. Quando houver scanner streaming (ou scan assíncrono pós-put), o buffer integral pode ser eliminado. Limites de tamanho, cleanup de streams interrompidos e backpressure do parser multipart já se aplicam.

## Malware — NOT_CONFIGURED

`createMalwareScanner` devolve `NotConfiguredMalwareScanner`.

- `scan()` retorna status `NOT_CONFIGURED`.
- Nesta etapa o arquivo pode ficar `available` com `scanStatus=not_configured`.
- **Não** há ClamAV, VirusTotal nem engine embutido.
- A UI/API devem informar que a verificação antimalware **não está configurada**.

## Estados de quarentena (versão)

| `document_versions.status` | Uso |
| --- | --- |
| `uploading` | Em andamento |
| `quarantined` | Scan pendente ou infectado (quando houver scanner) |
| `available` | Download permitido |
| `rejected` / `failed` | Indisponível |

Download só para `available`. Versão em quarentena/rejeitada → **409**.

## Download privado

`GET …/documents/:id/download` (e por `versionId`) exige sessão + `document.download` + regras de confidencialidade/ACL.

- Stream autenticado pela API (`Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`).
- Sem URL pública permanente.

## URLs temporárias

`createTemporaryDownloadUrl` é **opcional** no contrato. O adapter local pode omitir; o download padrão é o proxy autenticado da API. Não há signed URL S3 nesta etapa.

## Idempotência

Cabeçalho `Idempotency-Key` / `X-Idempotency-Key` no upload de versão: mesma chave + documento + org reutiliza a versão existente (sem segundo put lógico).

## Consistência DB ↔ object storage

Ordem operacional:

1. Validar MIME/tamanho/nome.
2. `putObject` no storage.
3. Persistir `document_versions` (+ atualizar `currentVersionId`) na transação com auditoria/timeline.

Se a etapa 3 falhar após o put, o contrato prevê **compensação** via `deleteObject` para evitar objeto órfão. Não há transação distribuída nem two-phase commit.

Falha de storage antes do DB → erro ao cliente, sem linha de versão.

### Reconciliação detect-only (Prompt 15 / ADR 099)

Job `STORAGE_RECONCILIATION` e endpoint com `document.manage_acl` listam findings (`version_without_object`, `incomplete_upload`, …). **`autoDelete` é sempre `false`** — não apaga objetos nem linhas. Remediação é humana. Detalhe: `docs/TECHNICAL_DEBT_CLOSURE.md`.

## Proibições

- Servir binários privados de `/public`.
- Expor `storageKey` em JSON de API.
- Afirmar antivírus ativo ou bucket cloud inexistente.
- Aceitar MIME só pela extensão ou pelo `Content-Type` declarado.
