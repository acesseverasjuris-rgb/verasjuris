# Provedores tributários (Etapas 11–13)

## Princípio

Contratos em `@verasjuris/ai` (`tax-providers.ts`); defaults **`not_configured`**. Cadastro manual de obrigações, lançamentos e certidões **não** depende de provider (ADR 112, 117).

Status: `GET …/tax-providers/status`.

## Contratos

| Contrato | Uso futuro | Erro default |
| --- | --- | --- |
| `FederalTaxProvider` | Lançamentos / situação federal | `FEDERAL_TAX_PROVIDER_NOT_CONFIGURED` |
| `StateTaxProvider` | ICMS/ITCMD estadual, etc. | `STATE_TAX_PROVIDER_NOT_CONFIGURED` |
| `MunicipalTaxProvider` | ISS/IPTU municipal | `MUNICIPAL_TAX_PROVIDER_NOT_CONFIGURED` |
| `TaxDebtProvider` | CND / dívida ativa | `TAX_DEBT_PROVIDER_NOT_CONFIGURED` |
| `TaxFilingProvider` | Declarações / obrigações acessórias | `TAX_FILING_PROVIDER_NOT_CONFIGURED` |

Implementações: `NotConfiguredFederalTaxProvider`, `NotConfiguredStateTaxProvider`, `NotConfiguredMunicipalTaxProvider`, `NotConfiguredTaxDebtProvider`, `NotConfiguredTaxFilingProvider`.

## Worker

`TAX_PROVIDER_SYNC` e `TAX_IMPORT` registrados só com `LocalInProcessQueueProvider`; sync externo falha com código de provider não configurado — **nada** é inventado.

## Sem scraping

Não há cliente e-CAC, SEFAZ ou prefeitura neste repositório.

## Segurança

Credenciais de certificado digital e tokens fiscais ficam fora do schema público; adapters futuros devem usar vault/secret store. SSRF: fetch oficial só com allowlist quando implementado.

## Relacionado

`docs/TAX.md`, `docs/TAX_CALCULATIONS.md`, ADR 117–118, 127
