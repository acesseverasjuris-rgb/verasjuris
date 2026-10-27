# Motor de citação (Etapa 7.1)

## Objetivo

Formatar e validar citações jurídicas com **status de verificação explícito**. O motor **nunca** promove sozinho uma fonte a `verified`. Jurisprudência incompleta ou sem URL https não pode ser tratada como julgado real.

Implementação: `@verasjuris/ai` (`CitationEngine` / `citation.ts`). Persistência: `packages/database/src/schema/legal-citations.ts` (`legal_citations`, `source_verifications`).

## Tipos de fonte

`legislation` | `case_law` | `summary` | `theme` | `precedent` | `doctrine` | `internal_document`

## Status de verificação

| Status | Significado |
| --- | --- |
| `unverified` | Ainda não validada |
| `source_available` | Metadados/URL mínimos presentes; não implica autenticidade oficial |
| `verified` | Só após verificação real (humana/processo dedicado); motor não auto-promove |
| `source_unavailable` | Fonte inacessível |
| `invalid` | Incompleta, URL inválida ou rejeitada — label *“Fonte não verificada.”* |
| `stale` | Desatualizada / invalidada |

## Anti-alucinação

- Case law sem tribunal / número / URL https → `invalid` + `UNVERIFIED_SOURCE_LABEL`.
- URL não-https → rejeição.
- Create com payload incompleto/invalid → `VALIDATION_ERROR`.
- `verify` com `ResearchGateway` `not_configured` → resposta `not_configured`; citação permanece não verificada.
- Sem checagem remota real neste repositório: integração oficial futura não está ligada (ADR 070, 075–077).
- Inserção automática em minutas: stub `NotImplementedCitationInsertionService` → **`NOT_CONFIGURED`** — **ainda stub** (Prompt 15 não implementou inserção). Minutas usam source set com IDs de citação verificáveis; não há auto-insert no texto.

## Badges / apresentação

Não há objeto `badge` dedicado como em leilões. A UI usa:

- `verificationStatus`
- `formattedCitation` / texto de cópia
- Label *“Fonte não verificada.”* quando inválida
- Kinds de metadado (ex.: citação documental vs. externa)

Nunca exibir status `verified` sem trilha de verificação persistida.

## Permissões e API

- `citation.read` | `create` | `verify`

Prefixo: `/v1/organizations/:organizationId/citations`

| Método | Ação |
| --- | --- |
| GET/POST | Listar / criar |
| GET `…/:citationId` | Detalhe |
| POST `…/:citationId/verify` | Verificar (honesto com `NOT_CONFIGURED`) |

## Relacionado

- `docs/LEGAL_RESEARCH.md`
- `docs/LEGAL_SOURCE_PROVIDERS.md`
- `docs/LEGAL_DRAFTING.md` (source set; inserção ainda stub)
- ADRs 075, 076, 077, 078, 089
