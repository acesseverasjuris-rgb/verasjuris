# ADR 116 — Cálculos específicos por área

## Status

Aceito (Etapas 11–13).

## Decisão

- Motores numéricos ficam em `@verasjuris/calculations` quando implementados (tax, prev, labor).
- Demais áreas usam `versioned_rule_sets` + campos monetários inteiros nas extensões até motor dedicado existir.
- IA não executa cálculo determinístico (ADR 103).

## Motivo

Reutilizar padrão de rule sets e snapshots sem prometer motor por área antes da implementação.

## Relacionado

`docs/TAX_CALCULATIONS.md`, ADR 104, 110
