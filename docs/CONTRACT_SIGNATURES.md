# Assinaturas de contrato (Etapas 11–13)

## Princípio

Assinatura pode ser **`provider`** (eletrônica externa), **`manual`** ou **`wet_ink`** — nunca simulada como concluída sem evidência (ADR 124–125).

## Entidades

| Entidade | Papel |
| --- | --- |
| `signature_requests` | Envelope lógico (`status`, incl. `not_configured`) |
| `signature_signers` | Signatários e ordem |
| `manual_signature_records` | Evidência de assinatura manual com referência documental |

Versão assinada: `contract_versions.status = signed` — conteúdo **imutável** (ADR 122). Cláusulas congeladas em `contract_clause_instances` (ADR 123).

## Fluxo provider

1. `POST …/signature-requests` — cria pedido; com provider default, status honesto `not_configured`.
2. Envio/sync — **somente** com adapter `SignatureProvider` configurado.
3. `SIGNATURE_STATUS_SYNC` (worker local): stub que falha com `SIGNATURE_PROVIDER_NOT_CONFIGURED` se não houver adapter.

## Fluxo manual

`POST …/manual-signatures` com permissão `contract.record_signature`; método `manual` | `wet_ink`. Não passa por provider (ADR 125).

## Segurança

Evidências em storage privado; download autenticado. Cross-tenant → 404.

## NOT_CONFIGURED

DocuSign/Clicksign/etc.; ICP-Brasil em nuvem; carimbo de tempo qualificado.

## Relacionado

`docs/CONTRACTS.md`, `docs/SIGNATURE_PROVIDERS.md`, ADRs 122–125
