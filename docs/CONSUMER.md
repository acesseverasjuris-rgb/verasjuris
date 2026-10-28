# Consumidor (Etapas 11–13)

## Princípio

Módulo `CONSUMER` — relação de consumo registrada como extensão 1:1 opcional por matter.

Schema: `consumer_cases` (`clientId`, status, metadata). API: `…/legal-matters/:matterId/consumer-cases`. Features: `consumer_case`, `cdc_checklist`.

## Núcleo comum

Fornecedor/consumidor via partes do matter + cliente CRM; documentos via `document_links`.

## NOT_CONFIGURED

Integração PROCON/SINDEC eletrônica; checklist CDC só com seed/config ativa.

## Relacionado

`docs/LEGAL_AREAS.md`, ADR 114
