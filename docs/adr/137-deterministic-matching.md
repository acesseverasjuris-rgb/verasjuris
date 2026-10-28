# ADR 137 — Matching determinístico

## Status

Aceito (Etapas 14–16).

## Decisão

- `OnlineLawyerMatchingService` — pontuação fixa, sem IA, sem aleatoriedade, sem lance pago.
- Ordenação: `totalScore` desc, `lawyerProfileId` asc.
- Candidatos `offered` com `expiresAt` (TTL configurável, padrão +30 min).

## Motivo

Reprodutibilidade e auditoria do ranking.

## Relacionado

`docs/ONLINE_LAWYER_MATCHING.md`, ADR 138
