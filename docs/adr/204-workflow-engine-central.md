# ADR 204 — WorkflowEngine central

## Status

Accepted

## Context

Automações espalhadas por módulo viram inconsistência.

## Decision

Um WorkflowEngine org-scoped para triggers/conditions/actions/runs.

## Consequences

Módulos emitem eventos; engine consome.
