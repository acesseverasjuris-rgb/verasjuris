# Provedores trabalhistas (Prompt 16)

## Princípio

Contratos em `@verasjuris/ai`; defaults **`not_configured`**. Operação manual (contrato, ponto, FGTS informado, rescisão) não depende de provider (ADR 111, 112).

Status: `GET …/labor-providers/status`.

## Contratos

| Contrato | Uso futuro | Erro default |
| --- | --- | --- |
| `ESocialProvider` | Vínculos, remuneração, rescisão, eventos eSocial | `ESOCIAL_PROVIDER_NOT_CONFIGURED` |
| `FGTSProvider` | Saldo / extrato oficial | `FGTS_PROVIDER_NOT_CONFIGURED` |
| `LaborCourtProvider` | Processo, movimentações, audiências, decisões trabalhistas | `LABOR_COURT_PROVIDER_NOT_CONFIGURED` |

Implementações: `NotConfiguredESocialProvider`, `NotConfiguredFGTSProvider`, `NotConfiguredLaborCourtProvider`.

## FGTS

Sem provider: apenas estimativa (`calculateFgtsEstimate`) e `fgts_records` informados. Nunca rotular como saldo Caixa/FGTS oficial.

## Tribunal trabalhista

Processo judicial no VerasJuris continua via domínio `judicial_processes` (cadastro manual). `LaborCourtProvider` não faz scraping PJe-JT / TRT.

## Sem scraping

Não há cliente eSocial Gov.br, app FGTS ou tribunal neste repositório.

## Relacionado

`docs/LABOR.md`, `docs/LABOR_CALCULATIONS.md`, `docs/SOCIAL_SECURITY_PROVIDERS.md`, ADR 112
