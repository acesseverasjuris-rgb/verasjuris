# Diligências (Etapa 18)

Correspondentes: catálogo `diligence_types`, solicitações, propostas, aceite exclusivo (unique em `diligence_assignments`), eventos, evidências (`authenticityClaim=unverified`), conclusão sem simular pagamento.

API: `/v1/organizations/:orgId/diligence/*`.

Disputas via marketplace exigem `engagementId` — integração diligence↔marketplace pendente de extensão de schema.

Pagamento/taxa de diligência no domínio é operacional; taxas de plataforma, split→payables→payout e ledger SaaS: `docs/PLATFORM_FEES.md`, `docs/SPLIT.md`, `docs/PAYOUTS.md`, `docs/FINANCE.md`, `docs/PAYMENTS.md` (`PaymentProvider` / `PayoutProvider` default `not_configured`). Disputa de serviço ≠ chargeback: `docs/FINANCIAL_DISPUTES.md`.
