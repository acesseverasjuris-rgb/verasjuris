# Sucessões (Etapas 11–13)

## Princípio

Módulo `SUCCESSION` — inventário e quinhões sem duplicar Client.

Schema: `estate_cases`, `estate_assets`, `estate_heirs`, `estate_shares`. API: `…/estate-cases` (+ assets/heirs/shares). Features: `estate_case`, `estate_inventory`, `estate_shares`.

## Herdeiros

`estate_heirs` registra papel sucessório; herdeiro pode referenciar `clientId` opcional. Enum `personType` do matter **não** inclui “heir” — usar extensão + `position`/`metadata` (ADR 114).

## Núcleo comum

Matter central; processos judiciais/administrativos de inventário via domínios existentes.

## NOT_CONFIGURED

Sync cartório de imóveis (`RegistryProvider`); partilha automática homologada.

## Relacionado

`docs/LEGAL_AREAS.md`, `docs/FAMILY.md`, ADR 114
