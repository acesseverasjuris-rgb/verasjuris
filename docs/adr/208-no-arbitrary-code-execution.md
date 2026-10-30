# ADR 208 — No arbitrary code execution

## Status

Accepted

## Context

Scripts em workflow quebram isolamento.

## Decision

Proibido JS/Python arbitrário; só DSL + ações registradas.

## Consequences

webhook_external e call_internal_service com allowlist/timeouts.
