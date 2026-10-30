# ADR 211 — Dry-run safety

## Status

Accepted

## Context

Simulação que escreve dados reais.

## Decision

dryRun=true não muta domínios externos; só registra run marcado.

## Consequences

UI botão “Simular (dry-run)” separado de executar.
