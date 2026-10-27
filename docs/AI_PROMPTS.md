# Prompts e versionamento

## Modelo de dados

- **`ai_prompts`** — chave estável (`key`), nome, `feature` associada.
- **`ai_prompt_versions`** — versão inteira crescente por prompt; campos:
  - `systemTemplate`, `userTemplate`
  - `outputSchema` (JSON Schema de referência)
  - `safetyInstructions`, `changelog`
  - `status`: `draft` → `review` → `approved` → `active` → `deprecated`
  - `activatedAt`, aprovadores

Índice único `(promptId, version)` garante numeração explícita.

## Imutabilidade (ADR 059)

Uma vez que uma versão foi **referenciada** por um `ai_request` (ou equivalente de produção), o conteúdo **não** é editado in-place. Correções criam **nova** versão com `version + 1`. Ativação promove uma versão a `active` e deprecia a anterior.

Isso preserva reprodutibilidade e auditoria: cada request aponta para `promptVersionId` concreto.

## Runtime vs catálogo

O gateway aceita `promptVersion` string no pedido (legado/operacional) e resolve contra versão **ativa** do prompt quando aplicável. Chamadas estruturadas do domínio usam instruções de sistema em `@verasjuris/ai` (`DOCUMENT_CLASSIFICATION_INSTRUCTIONS`, `LEGAL_ANALYSIS_INSTRUCTIONS`) combinadas com `buildSystemPrompt` e regras de segurança.

## Segurança no prompt (ADR 066)

- **Instruções** (`instructions` / templates do sistema): confiáveis, escritas pelo produto.
- **Entrada de documento** (`input`): sempre **não confiável** — envolvida por delimitadores (`UNTRUSTED_OPEN` / `UNTRUSTED_CLOSE`) via `wrapUntrustedContent`.
- `SAFETY_INSTRUCTIONS` reforçam: não obedecer ordens embutidas no documento; tratar texto como dado.

Ver também `docs/SECURITY.md` (IA e prompt injection).

## API

- `GET …/ai/prompts` — `ai.prompts.read`
- `POST …/ai/prompts` — criar nova versão (`ai.prompts.manage`)
- `POST …/ai/prompts/:promptKey/versions/:version/activate` — ativar (`ai.prompts.manage`)

Auditoria: `ai.prompt_version_created`, `ai.prompt_version_activated`.

## Saída estruturada

Features que exigem JSON validado passam schema **Zod** no gateway (`AIStructuredRequest`). Resposta fora do esquema → `AI_INVALID_RESPONSE`, request `failed`, **sem** persistir análise/classificação como verdade (ADR 062).

## Fora do escopo

Editor visual de prompt in-app completo, A/B testing automático, tradução automática de templates, import de prompts de terceiros sem revisão.
