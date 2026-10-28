# Matching Advogado Online (Etapa 16)

## Motor

`OnlineLawyerMatchingService` em `apps/api/src/modules/online-lawyer/matching.ts` — **determinístico** (ADR 137):

- Sem IA, sem sorteio, sem lance pago.
- Ordenação estável: `totalScore` desc, `lawyerProfileId` asc.

## Elegibilidade

Advogado precisa:

- `onlineServiceEnabled=true`
- `availabilityStatus=available`
- UF da solicitação em `oabUf`, `serviceStates` ou `serviceRegions`
- Se `urgency` ∈ {high, urgent} → `acceptsUrgent=true`
- Se área informada → `practiceAreas` contém nome ou slug da área

## Pontuação (constantes)

| Critério | Pontos |
| --- | ---: |
| areaMatch | 50 |
| stateMatch | 30 |
| onlineServiceEnabled | 20 |
| availabilityAvailable | 15 |
| acceptsUrgent (quando aplicável) | 10 |
| preferredMode | 10 |
| oabVerifiedBonus (`verified`) | 5 |

`informed` permanece elegível; bônus só para `verified` (ADR 138).

## Candidatos

Persistidos em `online_legal_match_candidates`:

- Status: `pending` → `offered` → `accepted` | `declined` | `expired` | `cancelled`
- `offeredAt`, `expiresAt` (TTL padrão 30 min, configurável via `offerTtlMinutes`)
- `scoreBreakdown` JSON auditável

## Jobs

- Geração síncrona na API (`generateMatchCandidates`); job `ONLINE_MATCH_GENERATION` reservado para lote assíncrono (stub local).
- `ONLINE_MATCH_EXPIRATION` — stub para expirar ofertas vencidas.

## Relacionado

`docs/ONLINE_LAWYER.md`, ADRs 137–139
