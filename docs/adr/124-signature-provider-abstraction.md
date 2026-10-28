# ADR 124 — Abstração SignatureProvider

## Status

Aceito (Etapas 11–13).

## Decisão

- Assinatura eletrônica externa só via `SignatureProvider` em `@verasjuris/ai`.
- Default `NotConfiguredSignatureProvider`; `signature_requests` pode refletir `not_configured`.
- Sync de status (`SIGNATURE_STATUS_SYNC`) não simula assinatura concluída.

## Motivo

Mesmo padrão ADR 112 / 083: contrato primeiro, adapter depois.

## Relacionado

`docs/SIGNATURE_PROVIDERS.md`, ADR 112
