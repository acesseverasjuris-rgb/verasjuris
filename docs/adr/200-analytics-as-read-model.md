# ADR 200 — Analytics as read model

## Status

Accepted

## Context

Dashboards não podem virar fonte de verdade.

## Decision

Analytics calcula/materializa snapshots; escrita só em domínio-fonte.

## Consequences

UI deixa claro “read model”; exports são jobs.
