# Disaster Recovery

## Objetivo

Preparar recuperação ante falha grave de plataforma, com RTO/RPO honestos.

## Placeholders (ainda NÃO homologados)

| Serviço | RTO alvo | RPO alvo | Status |
| --- | --- | --- | --- |
| API / Web | TBD (ex.: 4h) | TBD (ex.: 1h) | PLACEHOLDER |
| PostgreSQL | TBD | TBD | PLACEHOLDER — backup provider pode ser NOT_CONFIGURED |
| Object storage | TBD | TBD | PLACEHOLDER |
| Filas/jobs | TBD | TBD | PLACEHOLDER |

## Princípios

- Nunca marcar backup como healthy sem teste de restore.
- DR runbook versionado; exercícios registrados.
- Failover multi-região só quando infraestrutura real existir.

## Relacionados

`BACKUPS.md`, `OBSERVABILITY.md`, ADR DR strategy.
