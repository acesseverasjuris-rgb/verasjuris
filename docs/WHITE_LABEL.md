# White-label

## Princípio

**Limitado a branding** (ADR 191): nome, logo, cores, domínio custom (quando provider permitir), `supportBranding`. Não reescreve permissões, ledger, identidade multi-tenant nem “instância isolada” falsa.

Tabela: `white_label_configs`. Status: `draft` | `pending_domain` | `active` | `suspended` | `disabled`.

## Domínio custom

`CustomDomainProvider` default `not_configured`. Branding pode ser salvo; attach DNS / `customDomainVerified=true` exige provider real (`CUSTOM_DOMAIN_PROVIDER_NOT_CONFIGURED`).

## Entitlement

Habilitação do produto white-label passa por plano/`EntitlementService` — não por flag solta no front.

## Relacionado

`docs/MONETIZATION.md`, `docs/ENTITLEMENTS.md`, ADR 191.
