# Provedores de assinatura (Etapas 11–13)

## Princípio

Contrato `SignatureProvider` em `@verasjuris/ai` (`signature-provider.ts`); default **`not_configured`**. Nunca marcar envelope como `signed` sem retorno real do adapter (ADR 124).

Status: `GET …/signature-providers/status`.

## Interface (resumo)

| Método | Uso |
| --- | --- |
| `createEnvelope` | Cria envelope externo |
| `addSigner` | Signatários |
| `send` | Dispara fluxo |
| `getStatus` | Polling / webhook futuro |
| `cancel` | Cancelamento |
| `downloadEvidence` | Pacote de evidências |
| `healthCheck` | Diagnóstico |

Implementação default: `NotConfiguredSignatureProvider` → `SIGNATURE_PROVIDER_NOT_CONFIGURED`.

## Contract management

Tipos auxiliares (`SyncExternalContractInput`, etc.) preparam sync futuro de CLM — **não** implementado.

## Worker

`SIGNATURE_STATUS_SYNC` registrado apenas em `LocalInProcessQueueProvider`; idempotente, falha explícita sem adapter.

## Relacionado

`docs/CONTRACT_SIGNATURES.md`, `docs/CONTRACTS.md`, ADR 124–125
