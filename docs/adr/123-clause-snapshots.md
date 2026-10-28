# ADR 123 — Snapshots de cláusulas

## Status

Aceito (Etapas 11–13).

## Decisão

- Biblioteca: `contract_clauses` (reutilizável).
- Instância congelada por versão: `contract_clause_instances` copia texto/ordem no momento da versão.
- Editar biblioteca **não** altera versões já publicadas/assinadas.

## Motivo

Paralelo às versões imutáveis de template (ADR 086).

## Relacionado

`docs/CONTRACTS.md`, ADR 122
