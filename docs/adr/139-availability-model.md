# ADR 139 — Modelo de disponibilidade

## Status

Aceito (Etapas 14–16).

## Decisão

- `lawyer_profiles.availability_status` (available/busy/away/offline) para elegibilidade imediata.
- Janelas recorrentes `lawyer_availability` + bloqueios `lawyer_availability_overrides`.
- Matching exige `onlineServiceEnabled`, `availabilityStatus=available` e UF compatível.

## Motivo

Separar marketing de perfil da capacidade operacional real.

## Relacionado

`docs/ONLINE_LAWYER.md`, ADR 137
