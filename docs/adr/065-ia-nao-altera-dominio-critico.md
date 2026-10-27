# ADR 065 — IA não altera domínio crítico automaticamente

## Status

Aceito (Etapa 6).

## Decisão

- Saídas de IA têm `outputDisposition` (`requires_review` na maioria das features).
- Nenhum endpoint de IA faz `PATCH` automático em LegalMatter, processos, prazos, partes, honorários, pipeline ou CRM.
- Classificação/metadados/análise só entram no domínio após ação explícita de revisão humana (ou cadastro manual).

## Motivo

Ato jurídico e dado processual exigem responsabilidade humana auditável.
