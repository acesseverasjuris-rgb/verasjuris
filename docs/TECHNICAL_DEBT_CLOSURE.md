# Technical debt closure (Prompt 15)

Registro honesto do que foi fechado, do que permanece aberto e do que **não** deve ser “corrigido” com inventário falso.

## Drizzle snapshots 0001–0007

**Não reconstruímos** snapshots intermediários (`meta/0001_snapshot.json` … `meta/0007_snapshot.json`).

Estado atual do diretório `packages/database/drizzle/meta/`: snapshots reais em `0000`, `0008`–`0012` (+ `_journal.json`). Lacuna `0001`–`0007` permanece.

### Por que é inseguro inventar

1. O journal lista tags `0001`–`0007`, mas não há JSON estrutural da época.
2. Snapshots Drizzle Kit são hashes do schema naquele ponto. Recriá-los “de memória” ou a partir do SQL atual **não** reproduz o intermediário verdadeiro e pode quebrar diffs futuros do `drizzle-kit`.
3. Alterar metadados históricos sem o schema exato da revisão corrompe a cadeia para ambientes que já aplicaram `0001`–`0007`.

### Procedimento recomendado

1. Em banco limpo, aplicar migrações **até** a tag alvo a partir dos SQL versionados (checkout do commit da época).
2. Só então introspect/generate, se a política do time permitir regenerar metadados.
3. Preferir manter a lacuna documentada e continuar gerando a partir de `0008` em diante.
4. **Nunca** fabricar JSON de snapshot.

## Biome

Lint/formatação continuam no Biome (ADR 009). Fechamentos Prompt 15 não reintroduzem ESLint/Prettier paralelos.

## Non-null assertions

`matters/service.ts`: `clientId!` substituído por narrowing + `AppError`. Demais `!` em testes/or-clauses de query **não** foram forçados a zero — mudanças inseguras evitadas.

## PDF page mapping — `PAGE_MAPPING_NOT_AVAILABLE`

Extração local (`packages/ai/src/text-extraction.ts`):

- Form-feed → páginas 1-indexadas honestas quando o delimitador existe.
- PDF sem mapeamento nativo confiável → `pages: []` + `page_mapping_unavailable` / código **`PAGE_MAPPING_NOT_AVAILABLE`**.
- **Nunca** inventar números de página a partir do binário.

## OCR usage — `OCR_USAGE`

`ai_usage` **não** tem coluna `usageKind` / `metadata` dedicada. Para evitar migração `0013`, custos de OCR usam `feature = "OCR_USAGE"` (discriminador vs LLM). Sem `costMicros` / `providerReportedCostMicros` do provedor, nada é inventado. OCR em si permanece `OCR_PROVIDER=not_configured` por padrão.

## LocalInProcessQueue — opt-in (ADR 098)

- Default de produção: `NotConfiguredJobQueue` (ADR 006).
- `LocalInProcessQueueProvider` **somente** com `FEATURE_LOCAL_QUEUE=true|1` ou `LOCAL_QUEUE=enabled`.
- Mesmo processo; `processNext()` local — **não** é fila distribuída (Redis/SQS).
- Worker registra handlers locais quando a flag está ativa (`apps/worker/src/main.ts`).

## Storage reconciliation — detect-only (ADR 099)

Job `STORAGE_RECONCILIATION` + endpoint com `document.manage_acl`:

- Findings: `version_without_object`, `incomplete_upload`, etc.
- **`autoDelete: false` sempre** — só detecta; não apaga objetos nem linhas.
- Worker: `apps/worker/src/jobs/storage-reconciliation.ts`.

## Multipart — hash progressivo + buffer residual

- SHA-256 atualizado por chunk no multipart (`createSha256Hasher` + `upload.ts`).
- Dívida residual: scanner de malware síncrono ainda exige **corpo completo em memória** até `DOCUMENT_MAX_UPLOAD_MB`. Documentado em `docs/SECURE_UPLOAD.md`.

## Alert jobs (local)

Com fila local opt-in: handlers `DEADLINE_ALERT_DISPATCH` e `AUCTION_ALERT_CHECK` criam notificações **in-app** (`apps/worker/src/jobs/alert-handlers.ts`). Canais externos (e-mail/WhatsApp/SMS/push) permanecem **`NOT_CONFIGURED`**.

## Browser smoke

**NÃO HOMOLOGADO.** Não há suite de smoke/e2e de browser dedicada e homologada neste repositório. Cobertura Prompt 15 = testes Vitest de API/pacotes (`technical-debt`, `legal-templates`, `legal-drafts`, `legal-comparisons`, `auction-post`, etc.).

## PostgreSQL externo

**NÃO HOMOLOGADO** como alvo de CI/homologação contínua neste ciclo.

- Dev API: PostgreSQL 16 via `DATABASE_URL` / `docker-compose` (ADR 002) quando o ambiente tiver Docker.
- Testes: PGlite in-process aplicando as mesmas migrations.
- Homologar migrations no PostgreSQL 16 externo permanece item de roteiro — não afirmado como feito.

## Relacionado

- `docs/SECURE_UPLOAD.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`
- ADRs 006, 098, 099
