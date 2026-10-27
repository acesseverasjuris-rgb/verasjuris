# ADR 060 — AI Request e Usage separados

## Status

Aceito (Etapa 6).

## Decisão

- **`ai_requests`**: ciclo de vida da tentativa (status, erro, feature, provedor, timestamps).
- **`ai_responses`**: payload estruturado 1:1 com request bem-sucedido.
- **`ai_usage`**: tokens e custos 1:1 com request, tabela própria.

## Motivo

Separar telemetria/custo de metadados operacionais; facilitar relatórios sem duplicar JSON de resposta.
