# ADR 177 — Partial refund architecture

## Status

Accepted

## Context

Reembolso parcial precisa limitar over-refund e ajustar alocações sem reescrever payouts/payables já liquidados.

## Decision

- `refundType`: `full` | `partial` | `credit`; valor ≤ refundableCents.
- Payment → `partially_refunded` até cobrir o total.
- Ajustes de allocation/payable: offset append-only / cancelamento de unpaid — sem edit in-place de linhas pagas.

## Consequences

Múltiplos refunds parciais são suportados com auditoria em `refund_history`. Doc: `docs/REFUNDS.md`.
