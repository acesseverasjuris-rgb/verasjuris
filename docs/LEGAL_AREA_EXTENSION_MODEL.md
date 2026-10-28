# Modelo de extensão por área (Etapas 11–13)

## Objetivo

Permitir dados especializados por ramo do direito **sem** inflar `legal_matters` nem criar um CRM paralelo de partes.

## Camadas

1. **LegalMatter** — referência humana, cliente principal, equipe, status operacional.
2. **Binding** — `legal_matter_area_bindings` declara quais módulos (`legal_area_module_key`) se aplicam e o nível de confidencialidade (`standard` | `confidential` | `highly_restricted`).
3. **Extensão** — tabelas `*_cases`, `civil_*`, `estate_*`, etc., sempre com `organizationId` + `legalMatterId` (e FKs adicionais quando necessário).
4. **Agregados pesados** — `tax_cases`, `previdentiary_cases`, `labor_cases` seguem o mesmo padrão “≠ matter” quando o volume de entidades justifica domínio dedicado.

## Partes e papéis

| Conceito | Onde vive |
| --- | --- |
| Tipo jurídico da parte | `legal_matter_parties.personType` (4 valores + `other`) |
| Papel processual genérico | `legal_matter_parties.position` |
| Papel sucessório (herdeiro, inventariante) | `estate_heirs` + metadata; link opcional a `clientId` |
| Árbitro / mediador | `arbitration_cases` / `mediation_cases` metadata; parte no matter como `third_party` ou `other` |
| Parte contratual | `contract_parties` (`contract_party_role`) — domínio Contratos |

**Não** criar linha duplicada em `crm_clients` só para rotular papel; usar junction + metadata.

## Features

`LEGAL_AREA_FEATURES` (registry in-memory) espelha seeds em `legal_area_feature_config`. UI e API consultam features ativas — código evita ramificações por string solta.

## Cálculos por área

Motores específicos ficam em `@verasjuris/calculations` quando existem (tax, previdenciário, trabalhista). Demais áreas usam `versioned_rule_sets` + campos monetários inteiros nas extensões (ADR 116).

## Confidencialidade

Áreas penal, médica, tributária e eleitoral devem usar `confidentiality` elevada no binding e RBAC documental existente. ADR 127.

## NOT_CONFIGURED

Provider de registro/ambiental/eleitoral; workflows por área sem checklist seed permanecem vazios até configuração.

## Relacionado

`docs/LEGAL_AREAS.md`, `docs/LEGAL_MATTERS.md`, ADRs 113–116, 127
