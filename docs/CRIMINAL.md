# Penal (Etapas 11–13)

## Princípio

Módulo `CRIMINAL` — defesa criminal com confidencialidade elevada por padrão.

Schema: `criminal_cases` (`confidentiality` default `highly_restricted`), `criminal_charges`, `custodial_measures`, `sentencing_information`. API: `…/criminal-cases` (+ charges, medidas, sentencing). Features: `criminal_case`, `criminal_charges`, `custodial_measures`, `sentencing`.

Checklist seed: `CRIMINAL_DEFENSE`.

## Segurança

Binding recomendado `highly_restricted`. RBAC documental + auditoria; IA assistiva **não** altera medidas custodiais. Minimizar PII em timeline pública (ADR 127).

## Núcleo comum

Processo penal via `judicial_processes`; acusado/vítima como partes do matter.

## NOT_CONFIGURED

Integração BNMP/prisão em tempo real; scraping de tribunais.

## Relacionado

`docs/LEGAL_AREAS.md`, `docs/SECURITY.md`, ADR 127
