# Inadimplência

## Modelo

`delinquency_cases` ligados a `receivables`. Estágios: `reminder` | `notice` | `negotiation` | `collection` | `legal` | `written_off`. Status: `open` | `in_progress` | `resolved` | `written_off` | `cancelled`.

## Provider

`DebtCollectionProvider` default `not_configured`. Sem adapter: estágio/manual interno apenas — não simula cobrança externa nem write-off automático silenciosamente.

## Relacionado

`docs/ACCOUNTS_RECEIVABLE.md`, `docs/TREASURY.md`, `docs/INVOICES.md`.
