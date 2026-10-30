# ADR 192 — VerasJuris Control as internal-company domain

## Status

Accepted

## Context

A operação da empresa (RH, compliance, vendors, etc.) precisa de modelo próprio sem misturar com produto cliente.

## Decision

Criar domínio Control org-scoped, gated por organization.internalCompany / InternalOrganization, schema control.ts, UI /app/control.

## Consequences

Permissões control.*; docs CONTROL*.md; coexistência com Finance/CRM sem duplicar identidade.
