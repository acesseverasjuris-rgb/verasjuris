# Provedores previdenciários (Prompt 16)

## Princípio

Integrações externas **só** via contratos; default honesto **`not_configured`**. Cadastro e importação manual funcionam sem provider (ADR 112).

Pacote: `@verasjuris/ai` (`social-security-provider.ts`, `cnis-provider.ts`). Health: `GET …/previdentiary/providers/health`.

## Contratos

| Contrato | Responsabilidade | Erro default |
| --- | --- | --- |
| `SocialSecurityProvider` | Benefícios, requerimentos, exigências, decisões, exames, snapshot CNIS | `SOCIAL_SECURITY_PROVIDER_NOT_CONFIGURED` |
| `CNISProvider` | Fetch CNIS externo (≠ parser/import local) | `CNIS_PROVIDER_NOT_CONFIGURED` |

Implementações: `NotConfiguredSocialSecurityProvider`, `NotConfiguredCNISProvider`.

`healthCheck()` devolve `status: "not_configured"` — nunca inventa vínculos ou NBs.

## Separação CNIS

- **Import local** (`cnis_imports`) — operacional hoje com revisão humana (`docs/CNIS.md`).
- **CNISProvider** — API futura; não confundir com o parser/lote interno.

## Sem scraping

Não há cliente Meu INSS, Dataprev, portal de exigências nem captura de perícia. Feature flags de integração externa não ligam adapters inexistentes.

## Relacionado

`docs/PREVIDENTIARY.md`, `docs/CNIS.md`, `docs/LABOR_PROVIDERS.md`, ADR 070 / 105 / 112
