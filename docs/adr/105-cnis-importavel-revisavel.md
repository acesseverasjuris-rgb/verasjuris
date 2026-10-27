# ADR 105 — CNIS importável e revisável

## Status

Aceito (Prompt 16).

## Decisão

- Importação local estruturada (`cnis_imports` + `cnis_entries` + `cnis_warnings`) com revisão por entrada (`unreviewed` → `accepted` / `rejected` / `corrected`).
- `CNISProvider` externo é contrato separado; default `NotConfiguredCNISProvider` (`CNIS_PROVIDER_NOT_CONFIGURED`).
- Importação assíncrona via job `CNIS_IMPORT` permanece stub honesto — sem inventar vínculos/contribuições.
- Dados importados **não** entram automaticamente como períodos/contribuições validados sem revisão humana.

## Motivo

CNIS é evidência sensível e frequentemente inconsistente. Parser/API externos não podem silenciar lacunas nem marcar competência como oficial sem revisão.

## Relacionado

`docs/CNIS.md`, `docs/SOCIAL_SECURITY_PROVIDERS.md`, ADR 112
