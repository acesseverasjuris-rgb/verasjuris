# ADR 109 — Histórico de EmploymentContract

## Status

Aceito (Prompt 16).

## Decisão

- `employment_contracts` guarda o estado corrente; mudanças relevantes vão para `employment_contract_history` (`kind`, vigência, `previousValue` / `newValue`).
- Não sobrescrever silenciosamente salário, cargo ou datas sem evento de histórico quando a mutação é histórica.
- Fonte padrão `manual`; eSocial futuro via provider `NOT_CONFIGURED`.

## Motivo

Rescisão e liquidação dependem da trajetória contratual. Histórico append-friendly preserva evidência sem versionamento binário do contrato inteiro.

## Relacionado

`docs/LABOR.md`, ADR 108
