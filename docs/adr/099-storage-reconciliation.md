# ADR 099 — Reconciliação de storage detect-only

## Status

Aceito (Prompt 15).

## Decisão

- Job/endpoint `STORAGE_RECONCILIATION` detecta inconsistências (versão sem objeto, upload incompleto, etc.).
- `autoDelete` é sempre `false` — sem exclusão automática de objetos ou linhas.
- Remediação permanece humana/operacional.

## Motivo

Visibilidade sem risco de apagar evidência ou arquivo válido por falso positivo.

## Relacionado

`docs/TECHNICAL_DEBT_CLOSURE.md`, `docs/SECURE_UPLOAD.md`, `docs/DOCUMENTS.md`
