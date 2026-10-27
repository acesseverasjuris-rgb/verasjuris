# ADR 067 — Versionamento de análise jurídica

## Status

Aceito (Etapa 6).

## Decisão

- `legal_ai_analyses.version` incrementa por `(organizationId, legalMatterId, analysisType)`.
- Nova execução do mesmo tipo cria nova versão; revisões não apagam versões anteriores.
- API `GET …/legal-analyses/:id/versions` expõe histórico.

## Motivo

Comparar evolução da análise conforme documentos/processos mudam.
