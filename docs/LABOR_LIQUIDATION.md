# Liquidação trabalhista (Prompt 16)

## Princípio

Liquidação (`labor_liquidations`) consolida pedidos/verbas com snapshots de itens e períodos, totais em centavos e status de revisão. Usa `calculateLiquidacao` em `@verasjuris/calculations` quando executada via cálculo; **não** é sentença nem guia oficial de pagamento.

## Modelo

- `calculationId` opcional (vínculo ao cálculo que originou)
- `itemsSnapshot` / `periodsSnapshot`
- `correctionIndex` / `interestRule` (informados — sem sync oficial de índices)
- Totais: `totalPrincipalCents`, `totalCorrectionCents`, `totalInterestCents`, `contributionsCents`, `deductionsCents`, `totalCents`
- `status` (draft → calculated / review / reviewed / … conforme enum)
- Revisão: `reviewedByMembershipId` / `reviewedAt`

## Fluxo API

- `GET/POST …/labor-liquidations`
- Permissão `labor.liquidate` (+ `labor.read` / `labor.review_calculation` conforme operação)

Liquidação pode nascer de um `labor_calculations` do tipo liquidação (`run` no cálculo + persistência).

## Honestidade

- Correção e juros dependem das regras **informadas** no input/rule set — não de Bacen/TRT sync.
- Total liquidado interno ≠ valor homologado em juízo.
- Sem gateway de pagamento de precatório/RPV.

## Relacionado

`docs/LABOR.md`, `docs/LABOR_CALCULATIONS.md`, ADR 110
