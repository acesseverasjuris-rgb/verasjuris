# ADR 092 — Filed manual ≠ provider confirmed

## Status

Aceito (Prompt 15).

## Decisão

- `filed` com registro manual = usuário informou protocolo (`filedAt` + `filingMethod`).
- Não implica confirmação de tribunal/e-filing.
- `confirmed` exige evidência documental; ainda sem webhook oficial nesta etapa.
- Métodos `electronic` / `provider` existem no enum; adapters reais = `NOT_CONFIGURED`.

## Motivo

Honestidade operacional: protocolo informado ≠ carimbo do órgão.

## Relacionado

`docs/LEGAL_DOCUMENT_WORKFLOW.md`, `docs/ADMINISTRATIVE_PROCESSES.md` (análogo protocolo manual)
