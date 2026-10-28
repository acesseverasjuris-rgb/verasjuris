# Consultas online (Etapa 16)

## Agregado

`online_consultations` — uma consulta por `online_legal_request` após match aceito (unique em `requestId`).

## Status (ADR 140)

`matched` → `awaiting_payment` → `scheduled` → `ready` → `in_progress` → `completed`

Alternativas: `cancelled`, `no_show`, `disputed`.

## Artefatos ligados

| Campo | SSOT |
| --- | --- |
| `conversationThreadId` | Mensagens portal/comunicação |
| `calendarEventId` | Agenda (`calendar_events`) |
| `contractId` | CLM opcional |
| `consultation_terms_acceptances` | Aceite de termos por usuário/versão |
| `online_consultation_payments` | Cobrança manual ou provider |
| `consultation_closures` | Encerramento formal |
| `online_consultation_reviews` | Avaliação pós-`completed` (ADR 142) |

## Pagamento

- Manual: `recordManualConsultationPayment` → `paid_manual`
- Provider: `PaymentProvider` → `paid_provider` ou `not_configured`
- Sync externo: job `PAYMENT_STATUS_SYNC` **NOT_CONFIGURED** sem adapter (ADR 141)

## Vídeo

`VideoConferenceProvider` default `not_configured` — consulta pode operar em modo `text`/`audio` informado.

## Lembrete

Job `CONSULTATION_REMINDER` — stub local (agenda/notificação futura).

## Moderação de reviews

Permissão `online_lawyer.review.moderate`; estados `hidden`, `removed`, `reported`.

## Relacionado

`docs/ONLINE_LAWYER.md`, `docs/CALENDAR.md`, `docs/PAYMENT_PROVIDER.md`, ADRs 140–142
