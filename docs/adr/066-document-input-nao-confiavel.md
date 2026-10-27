# ADR 066 — Entrada de documento como conteúdo não confiável

## Status

Aceito (Etapa 6).

## Decisão

- Texto de arquivo/usuário vai em `input` / blocos delimitados (`wrapUntrustedContent`).
- Instruções de tarefa ficam separadas (`instructions`, templates do sistema).
- `SAFETY_INSTRUCTIONS` proíbem obedecer comandos embutidos no documento (mitigação de **prompt injection**).

## Motivo

Documentos adversariais ou maliciosos não devem reconfigurar comportamento do modelo.
