# Leilões (Etapa 8)

## Objetivo

Cadastro, acompanhamento e assistência (edital, riscos, estimativa de custo, due diligence) a **leilões públicos e afins**. Módulo **separado** de oportunidades públicas (`PublicOpportunity`) e **sem relação** com marketplace de honorários advocatícios / OnlineLawyer (não implementados).

Schema e rotas: `packages/database/src/schema` (auctions), `apps/api/src/modules/auctions/`. Contratos: `@verasjuris/ai` (`auction.ts`).

## Separação de domínio

| Domínio | Escopo |
| --- | --- |
| **Auctions** | Leilão judicial/extrajudicial/administrativo, lotes, ônus, interesses, alertas, due diligence |
| **PublicOpportunity** | Licitações, editais de contratação, chamamentos (Etapa 6) |
| **Marketplace / OnlineLawyer** | Fora do escopo; não misturar tipos, rotas nem dinheiro |

Não há FK obrigatória entre auction e public opportunity. Docs: `docs/PUBLIC_OPPORTUNITIES.md`. ADRs 079, 080.

## Tipos e status

**Tipos** (`auction_type`): `judicial`, `extrajudicial`, `administrative`, `public_asset`, `seized_asset`, `tax`, `bank`, `insolvency`, `bankruptcy`, `other`.

**Origem** (`auction_source`): `manual`, `public_provider`, `import`, `not_configured`.

**Status:** `draft`, `published`, `open`, `closed`, `cancelled`, `archived`, `not_configured`.

Há ainda enums de lote, evento, ocupação, sync, leiloeiro, interesse — ver schema.

## Global vs tenant (ADR 081)

| Escopo | `organizationId` | Mutação |
| --- | --- | --- |
| **Global** | `null` | Somente leitura para o tenant |
| **Organização** | UUID | CRUD conforme permissões |

**Sempre tenant-bound:** interesses, alertas, due diligence, documentos vinculados via `document_links`.

Serialize: `scope: "global" | "organization"`; `editable` só se a org for dona.

## Dinheiro: centavos e basis points (ADR 082)

- Valores (`appraisalCents`, `minimumBidCents`, lances estimados, taxas): **inteiros em centavos**.
- Comissão: **basis points** (100 bp = 1%).
- `estimateAuctionCost`: truncamento inteiro; label *“Estimativa com base nos valores informados.”* — não é custo final nem recomendação de compra.

## Providers e lance real (ADR 083)

| Contrato | Default | Erro |
| --- | --- | --- |
| `AuctionProvider` | `NotConfiguredAuctionProvider` | `AUCTION_PROVIDER_NOT_CONFIGURED` |
| `AuctionBidProvider` | stub | `AUCTION_BID_PROVIDER_NOT_CONFIGURED` |
| `MapProvider` | stub | `MAP_PROVIDER_NOT_CONFIGURED` |

- Sync externo / descoberta: **não** inventa leilões.
- Detalhe expõe `bidding: { available: false, status: "not_configured" }`.
- `POST …/bid` permanece stub — a API **nunca** afirma lance eletrônico real.

Badge de origem: `official: true` **somente** com `sourceProvider=public_provider` (e provedor real no futuro). Manual/import/`not_configured` → `official: false`.

## Features de IA (assistivas)

Via `AIGateway`, todas `requires_review`:

- `auction.notice_analysis`
- `auction.risk_extraction`
- `auction.document_summary`
- `auction.due_diligence_assist`

Com `AI_PROVIDER=not_configured`: nada inventado. Riscos: linguagem condicional; nunca “Compra segura.”

Due diligence detalhada: `docs/AUCTION_DUE_DILIGENCE.md`.

## Pós-leilão (Prompt 15)

Participação, bid records manuais, resultado, award, pagamentos sem gateway, entrega/transferência e checklist de regularização: módulo `auction-post` — `docs/AUCTION_POST_SALE.md`. ADRs 094–097. Lance ao vivo continua `NOT_CONFIGURED` (ADR 083 / 095).

## Documentos

`document_links` com `targetType` `auction` | `auction_lot` e `linkType` entre: `auction_notice`, `appraisal`, `registry`, `certificate`, `photo`, `court_decision`, `terms`, `other`. Ver `docs/DOCUMENTS.md`.

## Permissões e API

- `auction.read` | `create` | `update` | `manage` | `save`
- `auction.alert.manage`
- `auction.due_diligence.read` | `auction.due_diligence.manage`
- `auction.documents.manage` | `auction.ai.analyze`

Prefixo: `/v1/organizations/:organizationId`

Recursos: `auction-provider/status|sync`, `auctions`, `compare`, `estimate-cost`, `analyze-notice`, eventos/lotes/regras/interesse/documentos/bid, `auction-interests`, `auction-alerts`, `auction-due-diligence`, `auctioneers`.

## Relacionado

- `docs/AUCTION_DUE_DILIGENCE.md`
- `docs/AUCTION_POST_SALE.md`
- `docs/PUBLIC_OPPORTUNITIES.md` (módulo distinto)
- `docs/AI_CORE.md`
- ADRs 079–084, 094–097
