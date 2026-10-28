# Advogado Online (Etapa 16)

## Princípio

Domínio **OnlineLegalRequest** separado de LegalMatter e marketplace (ADR 136). Reutiliza `lawyer_profiles`, documentos, contratos, agenda, comunicação e `PaymentProvider`.

Schema: `packages/database/src/schema/online-lawyer.ts`. API: `apps/api/src/modules/online-lawyer/`. Matching: `matching.ts` + `OnlineLawyerMatchingService`.

## Fluxo resumido

1. Cliente cria `online_legal_requests` (`online_lawyer.request`).
2. Submit → `matching`; staff/sistema gera candidatos (`generateMatchCandidates`).
3. Advogados veem ofertas (`online_lawyer.match.read` / `respond`) — accept cria `online_consultations` + thread.
4. Pagamento manual ou provider; agenda; conclusão; review (ADR 140–142).

## Perfil advogado

Campos em `lawyer_profiles`: `onlineServiceEnabled`, `availabilityStatus`, `serviceStates`, `consultationModes`, `acceptsUrgent`, `consultationPriceCents`, `oabVerificationStatus`.

Disponibilidade detalhada: `lawyer_availability`, `lawyer_availability_overrides` (ADR 139).

## Providers auxiliares

| Provider | Uso |
| --- | --- |
| `OABVerificationProvider` | Verificação assíncrona (default not_configured) |
| `PaymentProvider` | Cobrança consulta |
| `ConflictCheckProvider` | Checagem no accept |
| `VideoConferenceProvider` | Sala vídeo (not_configured) |

Status agregado: `getOnlineLawyerProvidersStatus`.

## Documentos (ADR 143)

Anexos da solicitação só legíveis ao advogado após match aceito (`grantRequestDocumentsToLawyer`).

## Permissões

`online_lawyer.request` | `match.read` | `match.respond` | `consultation.read` | `consultation.manage` | `availability.manage` | `review.moderate`.

## Worker (stubs locais)

`ONLINE_MATCH_GENERATION`, `ONLINE_MATCH_EXPIRATION`, `CONSULTATION_REMINDER` — noop com `organizationId`. Sync externo: `PAYMENT_STATUS_SYNC`, `OAB_VERIFICATION` → NOT_CONFIGURED.

## Relacionado

`docs/ONLINE_LAWYER_MATCHING.md`, `docs/ONLINE_CONSULTATIONS.md`, `docs/OAB_VERIFICATION.md`, `docs/PAYMENT_PROVIDER.md`, ADRs 136–143
