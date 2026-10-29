# ADR 183 — Deterministic treasury forecast

## Status

Accepted

## Context

Forecast “inteligente” opaco dificulta auditoria e convida números inventados sem dados bancários reais.

## Decision

- Cenários com multiplicadores fixos em basis points (`pessimistic` / `base` / `favorable`).
- Inputs: AR/AP/ledger snapshot + regras explícitas; versões append-only.
- Sem ML e sem inventar saldo de banco (`BankingProvider` not_configured).

## Consequences

Mesmos inputs → mesmos projected totals. Doc: `docs/FORECAST.md`.
