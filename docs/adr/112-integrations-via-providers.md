# ADR 112 — Integrações previdenciárias/trabalhistas via providers

## Status

Aceito (Prompt 16).

## Decisão

- Integrações externas entram só por contratos em `@verasjuris/ai`:
  - `SocialSecurityProvider`, `CNISProvider`
  - `ESocialProvider`, `FGTSProvider`, `LaborCourtProvider`
- Defaults: `NotConfigured*` com erros dedicados (`*_PROVIDER_NOT_CONFIGURED`) e `healthCheck` honesto.
- Cadastro/importação **manual** continua disponível sem provider; sync/API oficial não é simulada.
- Sem scraping de Meu INSS, eSocial, Caixa ou PJe-JT neste repositório.

## Motivo

Mesmo padrão das Etapas 6–8: contrato primeiro, adapter depois. Evita fake de integração e IDOR/SSRF prematuros.

## Relacionado

`docs/SOCIAL_SECURITY_PROVIDERS.md`, `docs/LABOR_PROVIDERS.md`, ADR 070 / 083 / 105 / 111
