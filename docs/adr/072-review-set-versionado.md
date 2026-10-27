# ADR 072 — Review set versionado / imutável na geração

## Status

Aceito (Etapa 6.3).

## Contexto

A revisão compara documentos com papéis distintos. Se o conjunto mudar sem rastreio, achados perdem sentido.

## Decisão

- Revisões referenciam um **`legal_review_set`** (documentos + papéis) no momento da geração.
- Alterar o set para nova revisão cria/usa conjunto coerente; não reescreve silenciosamente o input de uma revisão já gerada.
- Saída estruturada + itens de revisão humana ficam ligados ao registro da revisão (e ao `aiRequestId` quando houver).

## Motivo

Reprodutibilidade e auditoria da conferência humana.
