# VerasJuris Control

Domínio de **operação interna** da organização (Café Platine / tenant `internalCompany`). Não é produto vendido a clientes do escritório.

## Escopo

| Área | Doc |
| --- | --- |
| Diretoria (metas, KPIs, aprovações) | `CONTROL_DIRECTOR.md` |
| RH | `CONTROL_HR.md` |
| Financeiro interno | `CONTROL_FINANCE.md` |
| Jurídico interno | `CONTROL_LEGAL.md` |
| Compliance | `CONTROL_COMPLIANCE.md` |
| Fornecedores | `CONTROL_VENDORS.md` |
| Produto / tecnologia | `CONTROL_PRODUCT_TECH.md` |
| Analytics (read model) | `ANALYTICS.md` |
| Workflows / automações | `WORKFLOWS.md` |

## Princípios

- Control **≠** produto de cliente (ADR 193).
- Reutiliza Organization, User/Membership, Document, Contract, LegalMatter, Ledger e Treasury — sem duplicar fontes de verdade (ADRs 194–195, 201).
- Acesso org-scoped: `/v1/organizations/:organizationId/control/...`.
- UI: `/app/control/*` (shell autenticado).

## Permissões

`control.read`, `control.director.manage`, `control.approval.manage`, `control.hr.*`, `control.finance.*`, `control.legal.*`, `control.compliance.*`, `control.vendor.*`, `control.product.*` — ver `AUTHORIZATION.md` e `control-policies.ts`.

## Schema / eventos

- Schema: `packages/database/src/schema/control.ts`
- Validação: `packages/validation/src/control.ts`
- Eventos: `packages/events/src/control-events.ts`
- ADRs 192–211.


## Control × platform

Novas áreas: Segurança, Privacidade, Operação, Integrações sob `/app/control/*`. Enterprise em `/app/configuracoes/enterprise`. Distinto do produto cliente.
