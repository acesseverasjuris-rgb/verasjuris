# Arbitragem (Etapas 11–13)

## Princípio

Módulo `ARBITRATION` — procedimento arbitral paralelo ao judicial.

Schema: `arbitration_cases` (câmara, regulação, metadata). API: `…/arbitration-cases`. Features: `arbitration_case`, `arbitration_award`.

Árbitros/partes: matter parties (`third_party`, metadata) + extensão; **não** duplicar Client.

## NOT_CONFIGURED

Integração câmaras (CAM-CCBC, etc.); assinatura de laudo via provider (ver Contratos).

## Relacionado

`docs/LEGAL_AREAS.md`, `docs/MEDIATION.md`, `docs/CONTRACTS.md`, ADR 114
