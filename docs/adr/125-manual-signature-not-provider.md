# ADR 125 — Assinatura manual ≠ provider

## Status

Aceito (Etapas 11–13).

## Decisão

- `manual_signature_records` com métodos `manual` | `wet_ink` registram evidência **sem** chamar `SignatureProvider`.
- Permissão dedicada `contract.record_signature`; distinto de `contract.request_signature`.

## Motivo

Escritórios registram contrato físico assinado sem falsificar envelope eletrônico.

## Relacionado

`docs/CONTRACT_SIGNATURES.md`, ADR 124
