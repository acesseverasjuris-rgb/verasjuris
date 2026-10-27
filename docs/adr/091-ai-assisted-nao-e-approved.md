# ADR 091 — AI-assisted ≠ approved

## Status

Aceito (Prompt 15).

## Decisão

- Status `ai_assisted` registra assistência; não aprova.
- Aprovação exige aprovador humano (`approvedByMembershipId`).
- Com provedor `not_configured`, não se finge conteúdo gerado nem se avança o workflow como sucesso de IA.

## Motivo

Alinhamento ao ADR 065 (IA não executa ato jurídico crítico).

## Relacionado

`docs/LEGAL_DRAFTING.md`, `docs/LEGAL_DOCUMENT_WORKFLOW.md`
