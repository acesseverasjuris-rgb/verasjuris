# ADR 059 — Versionamento de prompt imutável

## Status

Aceito (Etapa 6).

## Decisão

- Prompts vivem em `ai_prompts` + `ai_prompt_versions` com número sequencial.
- Conteúdo de versão **referenciada** por `ai_requests` não é reescrito; correções geram nova versão.
- Ativação (`active`) deprecia a versão anterior; cada request guarda `promptVersionId`.

## Motivo

Reprodutibilidade, auditoria e comparação de custo/qualidade entre versões.
