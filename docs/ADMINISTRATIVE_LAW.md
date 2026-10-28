# Administrativo (contencioso) (Etapas 11–13)

## Princípio

Módulo `ADMINISTRATIVE` — contencioso administrativo **distinto** de `administrative_processes` genérico: extensão `administrative_law_cases` liga matter a processo admin opcional.

Schema: `administrative_law_cases` (`administrativeProcessId`, `caseKind`). API: `…/administrative-law-cases`. Features: `administrative_law_case`, `admin_process_link`.

## Núcleo comum

Reutiliza `administrative_processes` (Etapa 3.2); órgãos e protocolo manual honesto (`body_provider` NOT_CONFIGURED).

## NOT_CONFIGURED

Sync com órgãos; peticionamento eletrônico admin.

## Relacionado

`docs/ADMINISTRATIVE_PROCESSES.md`, `docs/LEGAL_AREAS.md`, ADR 114
