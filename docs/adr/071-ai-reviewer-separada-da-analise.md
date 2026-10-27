# ADR 071 — IA revisora separada da análise jurídica

## Status

Aceito (Etapa 6.3).

## Contexto

Análise estruturada (`legal_ai_analyses`) extrai fatos, pedidos e provas. Revisão assistida precisa apontar vícios, lacunas e riscos sem misturar agregados, permissões nem schemas.

## Decisão

- Domínio **Legal Review** (`legal_review_sets`, `legal_ai_reviews`, feature gateway `legal_review`) é distinto de **Legal AI Analysis**.
- Docs e UI tratam os fluxos em separado (`docs/AI_REVIEW.md` vs `docs/LEGAL_AI_ANALYSIS.md`).
- Ambos são assistivos e `requires_review`; nenhum muta domínio crítico sozinho (ADR 065).

## Consequências

Evolução de prompts/seções de revisão não altera o versionamento de análises (ADR 067).
