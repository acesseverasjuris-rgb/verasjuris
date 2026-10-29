# Licenciamento de software

## Princípio

Domínio próprio de `software_licenses` (ADR 190): tipo (`subscription` | `term` | `perpetual` | `enterprise` | `white_label` | `custom`), seats, vigência, vínculo opcional a contrato/assinatura. Status: `draft` | `active` | `expired` | `suspended` | `cancelled`.

## ≠ entitlements

Licença comercial ≠ feature gate. Ativação de features continua via `EntitlementService` / plano. Licença documenta direito contratual.

## Provider

`LicenseProvider` (se presente) default `not_configured` — sem inventar ativação externa.

## Relacionado

`docs/MONETIZATION.md`, `docs/CONTRACTS.md`, `docs/SUBSCRIPTIONS.md`, ADR 190.
