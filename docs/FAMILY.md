# Família (Etapas 11–13)

## Princípio

Módulo `FAMILY` — guarda, alimentos, divórcio/partilha como extensões N no matter.

Schema: `family_relationships`, `custody_arrangements`, `support_obligations`, `property_divisions`. API: `…/legal-matters/:matterId/family/*`. Features: `custody`, `support`, `divorce`, `property_division`, `family_relationship`.

Checklist seed: `FAMILY_DIVORCE` (registry).

## Partes

Filhos/alimentantes: `legal_matter_parties` (`position`, metadata); vínculos familiares na extensão.

## NOT_CONFIGURED

Cálculo automático de alimentos (sem motor dedicado além de rule sets manuais); integração cartório/registro civil via `RegistryProvider`.

## Relacionado

`docs/LEGAL_AREAS.md`, `docs/SUCCESSION.md`, ADR 114
