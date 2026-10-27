# LegalSourceProvider (Etapa 7)

## Objetivo

Contrato único para fontes jurídicas externas ou oficiais. A API e os domínios **não** chamam portais de tribunal diretamente: usam `ResearchGateway`, que seleciona um `LegalSourceProvider`.

Implementação em `@verasjuris/ai` (`research.ts`). Default: **`NotConfiguredLegalSourceProvider`**.

## Interface

```
id, capabilities
search(query) → LegalResearchPage
fetchById(externalId) → NormalizedLegalSourceResult | null
healthCheck() → LegalSourceHealth
```

Health: `ok` | `degraded` | `unavailable` | `not_configured`.

Resultados normalizados exigem proveniência (`provider`, `externalId`, metadados; `sourceUrl` https quando houver; `contentHash` opcional).

## Capacidades declaradas

| Capability | Uso conceitual |
| --- | --- |
| `LEGISLATION` | Legislação |
| `CASE_LAW` | Jurisprudência |
| `SUMULA` | Súmulas |
| `REPETITIVE_THEME` | Temas repetitivos |
| `GENERAL_REPERCUSSION` | Repercussão geral |
| `PRECEDENT` | Precedentes vinculantes / equivalentes |
| `DOCTRINE` | Doutrina (respeitar licença — ADR 078) |

O stub `not_configured` declara **`capabilities = []`**. Pedido de capacidade não oferecida → `NOT_CONFIGURED` (sem inventar resultados).

## Estado atual (honesto)

| Item | Estado |
| --- | --- |
| Env `LEGAL_SOURCE_PROVIDER` | Padrão `not_configured` |
| Adapters STF/STJ/TST/TJ*/Diário/etc. | **Não** implementados |
| Sync oficial | Ausente |
| Pesquisa operacional | Catálogo local + empty/`not_configured` |

Erro: `LEGAL_SOURCE_PROVIDER_NOT_CONFIGURED`.

## Fontes oficiais futuras (conceitual apenas)

Lista **não** implica integração viva. Quando houver adapter real + ADR dedicado, candidatos típicos incluem:

- Tribunais superiores (STF, STJ, TST, TSE, STM) e tribunais regionais / de justiça
- Portais de legislação e diários oficiais
- Bases de súmulas, temas repetitivos e repercussão geral
- Repositórios de doutrina **licenciados**

Até lá: cadastro **manual** / import no catálogo local; CitationEngine trata ausência de verificação de forma explícita.

## Relacionado

- `docs/LEGAL_RESEARCH.md`
- `docs/CITATION_ENGINE.md`
- ADRs 073, 074, 070
