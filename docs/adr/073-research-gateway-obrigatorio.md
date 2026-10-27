# ADR 073 — ResearchGateway obrigatório para fontes externas

## Status

Aceito (Etapa 7).

## Contexto

Jurisprudência e legislação externas não podem ser “lembradas” pelo LLM nem buscadas ad hoc na API.

## Decisão

- Toda consulta a fonte jurídica externa passa por **`ResearchGateway`**.
- Domínios e rotas **proibidos** de HTTP direto a tribunais/portais ou de inventar ementas.
- Sem provider: `not_configured` + busca local no catálogo; nada inventado.

## Relacionado

`docs/LEGAL_RESEARCH.md`, ADR 074, 070.
