# Pipeline comercial/jurídico (Etapa 2.2)

Orquestra a jornada sem substituir Lead, Intake, Triage, Client ou Case.

## Entidade central

`crm_opportunities` — item de pipeline (ADR 029).

Vínculos opcionais: `leadId`, `intakeId`, `triageId`, `clientId`, `caseId` (FK para `legal_matters.id` — LegalMatter).

## Stages

`lead` → `intake` → `triage` → `analysis` → `proposal` → `contracting` → `client` → `case`

Terminais: `lost`, `archived`

Transições em `assertOpportunityStageTransition`. Pré-condições de negócio no service (ex.: intake existente, triagem pronta, proposta aceita).

`status` separado: `active` | `won` | `lost` | `archived`.

## Artefatos

| Entidade | Tabela | Papel |
|---|---|---|
| Análise | `crm_analyses` | Classificação operacional (não parecer definitivo) |
| Proposta | `crm_proposals` | Versões; aceitação ≠ contrato |
| Contratação | `crm_engagements` | Estágio comercial; sem assinatura fake |
| Motivos de perda | `crm_loss_reasons` | Catálogo por org |
| Caso / LegalMatter | `legal_matters` | Agregado jurídico (Etapa 3); ver `docs/LEGAL_MATTERS.md` |

## Dinheiro

Valores em **centavos inteiros** (`priceCents`, `estimatedValueCents`) + `currency` (padrão BRL). Sem float.

## API

Prefixo `/v1/organizations/:organizationId/`:

- `opportunities` (+ board, move, lose, archive, restore, analysis, proposals, engagement, case, timeline)
- `proposals/:id/approve|send|accept|reject`
- `loss-reasons`, `cases`

## Frontend

`/app/pipeline` — Kanban + lista acessível  
`/app/pipeline/[id]` — detalhe e ações  
`/app/pipeline/novo` — criação

## Permissions

`pipeline.*`, `analysis.*`, `proposal.*`, `engagement.*`, `case.*` — ver `docs/AUTHORIZATION.md`.
