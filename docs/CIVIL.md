# Cível (Etapas 11–13)

## Princípio

Extensões **no LegalMatter** via módulo `CIVIL` — pedidos, danos e obrigações não viram colunas do matter (ADR 114).

Schema: `civil_claim_items`, `civil_damages`, `civil_obligations` em `legal-areas.ts`. API: `…/legal-matters/:matterId/civil/*`. Features: `civil_claim`, `civil_damages`, `civil_obligations`, `versioned_rules`.

## Entidades

| Tabela | Papel |
| --- | --- |
| `civil_claim_items` | Pedidos (`claimKind`, valor centavos, status) |
| `civil_damages` | Danos material/moral/total |
| `civil_obligations` | Obrigações de fazer/pagar |

## Núcleo comum

Partes em `legal_matter_parties`; processos judiciais 0..N em `judicial_processes`. Rule sets: `versioned_rule_sets` (`domain` cível).

## NOT_CONFIGURED

Cálculo automático de juros moratórios cível além dos motores tax/prev/labor genéricos; integração cartorial (`RegistryProvider`).

## Relacionado

`docs/LEGAL_AREAS.md`, `docs/JUDICIAL_PROCESSES.md`, ADR 116
