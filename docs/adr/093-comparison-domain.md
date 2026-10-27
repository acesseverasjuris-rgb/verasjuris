# ADR 093 — Domínio de comparação jurídica

## Status

Aceito (Prompt 15).

## Decisão

- Comparações (`legal_comparisons`) são domínio separado de análise e de revisão formal.
- Tipos explícitos (petição×defesa, prova×alegação, etc.).
- Itens exigem proveniência; status `not_configured` quando a IA não está ligada.

## Motivo

Evitar sobrecarregar análise/revisão e manter revisão humana item a item.

## Relacionado

`docs/LEGAL_COMPARISON.md`, `docs/LEGAL_AI_ANALYSIS.md`, `docs/AI_REVIEW.md`
