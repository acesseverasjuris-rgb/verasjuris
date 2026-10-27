# Comparação jurídica assistida (Prompt 15)

## Objetivo

Domínio próprio para confrontar lados documentais (petição × contestação, prova × alegação, etc.) com itens estruturados, severidade e revisão humana. **Não** substitui análise (`LEGAL_AI_ANALYSIS`) nem revisão formal (`AI_REVIEW`).

Schema: `packages/database/src/schema/legal-comparisons.ts`.  
API: `apps/api/src/modules/legal-comparisons/`.  
Zod: `@verasjuris/ai` (`legal-comparison.ts`).

## Tipos (ADR 093)

- `petition_vs_defense`
- `evidence_vs_allegations`
- `claim_vs_decision`
- `judgment_vs_appeal`
- `admin_process_vs_judicial_action`

Fontes (`legal_comparison_sources`) com papéis: `side_a` / `side_b`, `petition`, `defense`, `evidence`, etc.

## Status

`draft` → `processing` → `generated` / `human_review` → `reviewed` → `closed`  
(+ `failed` | `not_configured`).

Com `AI_PROVIDER=not_configured`: status → `not_configured`; estrutura preservada; **sem** itens inventados.

## Itens

Severidade: `low` | `medium` | `high` | `critical`.  
Revisão: `unreviewed` | `confirmed` | `rejected` | `corrected`.

Saída Zod exige **proveniência** por item (âncora documental / página quando disponível). Sem proveniência adequada → não tratar como fato.

## Limites

- Assistivo; não é parecer nem decisão.
- Não altera minutas, processos ou prazos automaticamente (ADR 065).
- Sem integração com tribunal.

## Relacionado

- `docs/LEGAL_AI_ANALYSIS.md`, `docs/AI_REVIEW.md`, `docs/AI_CORE.md`
- ADR 093
