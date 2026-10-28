# Saúde / responsabilidade médica (Etapas 11–13)

## Princípio

Módulo `MEDICAL` — planos de saúde e erro médico como extensão confidencial.

Schema: `medical_cases` (`caseKind` default `health_plan_denial`, confidencialidade). API: `…/medical-cases`. Features: `medical_case`, `health_plan_denial`.

## Segurança

Dados clínicos sensíveis (LGPD art. 11); binding `confidential` ou `highly_restricted`. Sem inferência diagnóstica automática como fato (ADR 127).

## Núcleo comum

Partes (operadora, paciente) via matter; laudos via documentos.

## NOT_CONFIGURED

Integração ANS/TISS; perícia médica oficial.

## Relacionado

`docs/LEGAL_AREAS.md`, `docs/SECURITY.md`, ADR 127
