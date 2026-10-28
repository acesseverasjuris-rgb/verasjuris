# Eleitoral (Etapas 11–13)

## Princípio

Módulo `ELECTORAL` — contencioso eleitoral com confidencialidade reforçada quando aplicável.

Schema: `electoral_cases`. API: `…/electoral-cases`. Features: `electoral_case`, `electoral_data_provider`.

Provider: `ElectoralDataProvider` (`NOT_CONFIGURED`).

## Segurança

Dados de campanha/coleta sensíveis; controle de acesso estrito (ADR 127). Sem scraping TSE.

## NOT_CONFIGURED

Consulta candidaturas/registros oficiais; projeção de votos automática.

## Relacionado

`docs/LEGAL_AREAS.md`, `docs/SECURITY.md`, ADR 127
