# ADR 122 — Versão assinada imutável

## Status

Aceito (Etapas 11–13).

## Decisão

- Após `contract_versions.status = signed`, conteúdo e cláusulas snapshot não são editados in-place.
- Alterações exigem nova versão ou aditivo (`contract_amendments`) com fluxo próprio.

## Motivo

Integridade probatória e rastreio de negociação.

## Relacionado

`docs/CONTRACTS.md`, ADR 086
