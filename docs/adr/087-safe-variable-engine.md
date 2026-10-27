# ADR 087 — Motor seguro de variáveis de template

## Status

Aceito (Prompt 15).

## Decisão

- Substituição apenas via `TemplateVariableResolver` com whitelist de caminhos `{{path.to.value}}`.
- Proibido: `eval`, `Function`, `__proto__` / `prototype` / `constructor`, colchetes, chamadas.
- Ausência → marcador explícito; nunca inventar valor.

## Motivo

Mitigar prototype pollution e injeção ao renderizar modelos HTML/markdown.

## Relacionado

`docs/LEGAL_DOCUMENT_TEMPLATES.md`, `packages/ai/src/template-variables.ts`
