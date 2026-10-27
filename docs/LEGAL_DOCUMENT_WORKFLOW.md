# Workflow de minuta / protocolo (Prompt 15)

## Objetivo

Máquina de estados **central** para o ciclo de vida da minuta até confirmação de protocolo. Implementação: `packages/auth/src/legal-draft-state.ts` + serviço em `apps/api/src/modules/legal-drafts/`. Histórico: `legal_document_workflow_history`.

## Transições permitidas (ADR 090)

| De | Para (permitidos) |
| --- | --- |
| `draft` | `ai_assisted`, `human_review`, `cancelled`, `archived`, `failed` |
| `ai_assisted` | `human_review`, `draft`, `cancelled`, `archived`, `failed` |
| `human_review` | `approved`, `rejected`, `draft`, `cancelled`, `archived`, `failed` |
| `approved` | `ready_to_file`, `human_review`, `cancelled`, `archived` |
| `ready_to_file` | `filed`, `human_review`, `cancelled`, `archived` |
| `filed` | `confirmed`, `archived` |
| `confirmed` | `archived` |
| `rejected` | `draft`, `archived`, `cancelled` |
| `cancelled` | `archived`, `draft` |
| `failed` | `draft`, `archived`, `cancelled` |
| `archived` | — |

## Guards de negócio

Além do grafo:

| Destino | Exigência |
| --- | --- |
| `approved` | `approvedByMembershipId` (aprovador humano) |
| `ready_to_file` | Sem checklist bloqueado; críticos concluídos; sem `{{…}}` / missing vars sem justificativa |
| `filed` | `filedAt` + `filingMethod` |
| `confirmed` | `confirmationEvidenceDocumentId` |

## AI-assisted ≠ approved (ADR 091)

Passar por `ai_assisted` **não** dispensa `human_review` / `approved`. A IA não preenche aprovador.

## Filed manual ≠ provider confirmed (ADR 092)

- `filed` com método manual = registro interno de que o usuário informou protocolo.
- **Não** significa confirmação pelo tribunal, PJe, e-SAJ ou qualquer provider.
- `confirmed` só com evidência documental anexada (ainda assim interpretação operacional interna — sem webhook oficial nesta etapa).

## Fora do escopo

Peticionamento eletrônico real, carimbo de tempo ICP-Brasil, sync com tribunal.
