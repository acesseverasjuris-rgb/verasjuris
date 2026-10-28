# Agenda (Etapa 5.1)

## Modelo

`calendar_events` é o centro da agenda. Audiências judiciais permanecem SSOT em `judicial_hearings`; a agenda **projeta** via `judicialHearingId` (único), sem duplicar o hearing.

## Capacidades

Criar/atualizar eventos, participantes, conflito de horário do responsável (**aviso**, não bloqueio), reagendar/cancelar (state machine), `POST …/calendar/link-hearing`.

## Fuso

Timezone **IANA** (padrão `America/Sao_Paulo`).

## Sync externo

`externalSync: NOT_CONFIGURED`. Não há Google Calendar, Outlook nem fake sync.

## Distinções (Prompts 15–16)

Evento de agenda ≠ prazo central ≠ audiência SSOT (`judicial_hearings`) ≠ data de protocolo de minuta (`filedAt`). Workflow de peça: `docs/LEGAL_DOCUMENT_WORKFLOW.md`.

Perícias e avaliações sociais previdenciárias (`previdentiary_medical_exams` / `previdentiary_social_assessments`) são SSOT do exame; podem projetar na agenda via `calendarEventId` opcional — sem duplicar o exame como hearing judicial. Ver `docs/PREVIDENTIARY_ADMIN_REQUESTS.md`.

## UI

`/app/agenda` — visualizações dia/semana/mês/lista.

## Permissões

`calendar.read|create|update|delete|manage_team`.

## Portal e consultas online (Etapas 14–16)

- Portal lista eventos com visibilidade ao cliente (`staffPatchCalendarClientVisible` + leitura portal).
- Consulta online pode criar/vincular `calendarEventId` ao agendar (`scheduleOnlineConsultation`).
- Lembrete assíncrono reservado ao job `CONSULTATION_REMINDER` (stub local). Ver `docs/ONLINE_CONSULTATIONS.md`.
