# ADR 121 — Template de contrato reutiliza motor seguro

## Status

Aceito (Etapas 11–13).

## Decisão

- `contract_templates` usam o mesmo motor de variáveis com whitelist (`TemplateVariableResolver`, ADR 087).
- Distinto de `legal_document_templates`, mas mesma regra de segurança (sem eval/proto).

## Motivo

Evitar segundo motor de merge inseguro para contratos.

## Relacionado

`docs/CONTRACTS.md`, `docs/LEGAL_DOCUMENT_TEMPLATES.md`, ADR 087
