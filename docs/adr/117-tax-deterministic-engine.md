# ADR 117 — Motor determinístico tributário

## Status

Aceito (Etapas 11–13).

## Decisão

- `TaxCalculationEngine` e funções em `packages/calculations/src/tax/` — sem DB/IA/Fastify.
- `tax_cases` agregado separado de LegalMatter; processos admin/judiciais reutilizados por vínculo.
- Providers fiscais (`FederalTaxProvider`, etc.) default `not_configured` — sem sync inventado.

## Motivo

Mesmo padrão prev/trabalhista: domínio + motor + providers honestos.

## Relacionado

`docs/TAX.md`, `docs/TAX_PROVIDERS.md`, ADR 103, 112
