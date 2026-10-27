# Pós-leilão (Prompt 15)

## Objetivo

Ciclo de vida **após** o cadastro/interesse/due diligence do módulo Auctions: participação, registro de lance, resultado, arrematação, pagamentos manuais, entrega/posse, transferência e checklist de regularização.

Schema: `packages/database/src/schema/auction-post-sale.ts`.  
API: `apps/api/src/modules/auction-post/`.  
Cadastro do leilão: `docs/AUCTIONS.md`. Due diligence prévia: `docs/AUCTION_DUE_DILIGENCE.md`.

## Ciclo (ADR 094)

Participação → (lance registrado) → resultado → award → pagamentos / entrega / transferência / regularização.

Status de participação incluem marcadores explícitos `*_manually` (`registered_manually`, `qualified_manually`, `bid_placed_manually`, etc.) — **não** há sync com portal de leilão.

## Lance registrado ≠ lance ao vivo (ADR 095)

| Conceito | Comportamento |
| --- | --- |
| `auction_bid_records` | Registro interno (`source`: `manual` \| `external` \| `import`) |
| Lance ao vivo / provider | `placeLiveBidNotConfigured` → `AUCTION_BID_PROVIDER_NOT_CONFIGURED` |

`source=provider` **não** envia lance ao portal. Continua alinhado ao ADR 083.

## Award / confirmação (ADR 096)

- `auction_awards` com `awardStatus` (`pending_confirmation` → … → `completed` / `cancelled` / `reversed` / `disputed`).
- `verificationStatus` / fontes podem ser `not_configured` ou `unverified`.
- Dinheiro em **centavos**; comissão em **basis points**; `totalKnownCostCents` derivado (sem float) — ADR 082.

Confirmação de arrematação é ato humano/operacional no tenant — **não** confirmação automática do leiloeiro ou tribunal.

## Pagamentos sem gateway (ADR 097)

`auction_payments` registra obrigações e status (`pending`, `paid`, `overdue`, …) por tipo (`bid_price`, `auctioneer_commission`, `court_fee`, `tax`, `transfer_fee`, `other`).

**Não há** Stripe/Pix gateway, ledger de plataforma nem captura de cartão. É domínio operacional de acompanhamento, distinto de Payments/Billing (não implementados).

## Entrega, transferência, regularização

- Entrega/posse: `auction_delivery_processes`
- Transferência: `auction_transfer_processes`
- Eventos de award: `auction_award_events`
- Checklist pós-arrematação: `auction_regularization_checklists` / itens por `itemKey`

## Relacionado

- `docs/AUCTIONS.md`, `docs/AUCTION_DUE_DILIGENCE.md`
- ADRs 082, 083, 094–097
