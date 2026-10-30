# ADR 203 — CAC/LTV insufficient-data behavior

## Status

Accepted

## Context

CAC/LTV com amostra incompleta induz decisão errada.

## Decision

Retornar status insufficient_data e omitir valor inventado.

## Consequences

UI mostra “Dados insuficientes” + nota; charts usam padrão visual distinto.
