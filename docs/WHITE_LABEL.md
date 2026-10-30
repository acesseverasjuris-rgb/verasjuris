# White-label

## Princípio

**Limitado a branding** (ADR 191): nome, logo, cores, domínio custom (quando provider permitir), `supportBranding`. Não reescreve permissões, ledger, identidade multi-tenant nem “instância isolada” falsa.

Tabela: `white_label_configs`. Status: `draft` | `pending_domain` | `active` | `suspended` | `disabled`.

## Domínio custom

`CustomDomainProvider` default `not_configured`. Branding pode ser salvo; attach DNS / `customDomainVerified=true` exige provider real (`CUSTOM_DOMAIN_PROVIDER_NOT_CONFIGURED`).

## Entitlement

Habilitação do produto white-label passa por plano/`EntitlementService` — não por flag solta no front.

## Enterprise / Etapas 26–33

SSO/SCIM/domínio/branding continuam em providers (`SSOProvider`, `SCIMProvider`, `CustomDomainProvider`). Sem JS custom arbitrário no white-label (ADR 234). UI: `/app/configuracoes/enterprise/*`.

## Relacionado

`docs/MONETIZATION.md`, `docs/ENTITLEMENTS.md`, `docs/ENTERPRISE.md`, ADR 191, ADR 234.
