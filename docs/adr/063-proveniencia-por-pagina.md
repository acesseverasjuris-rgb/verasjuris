# ADR 063 — Proveniência por página

## Status

Aceito (Etapa 6).

## Decisão

- Texto extraído persiste em **`document_pages`** (por versão).
- Citações de IA registram **`ai_result_sources`** com `documentVersionId`, `pageNumber`, offsets quando aplicável.
- UI de sugestão deve permitir rastrear página/fonte.

## Motivo

Revisão humana exige saber **de onde** veio a afirmação, não apenas o resumo.
