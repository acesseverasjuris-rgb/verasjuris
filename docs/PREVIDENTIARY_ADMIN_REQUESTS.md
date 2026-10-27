# Requerimentos administrativos previdenciários (Prompt 16)

## Princípio

**PrevidentiaryRequest especializa AdministrativeProcess — não o substitui.**

Todo `previdentiary_requests` exige `administrativeProcessId`. O processo administrativo genérico continua SSOT de órgão, número e protocolo base; o request adiciona tipo previdenciário, DER, espécie pretendida, perícia e avaliação social.

ADR 102. Docs-pai: `docs/PREVIDENTIARY.md`, `docs/ADMINISTRATIVE_PROCESSES.md`.

## Campos centrais

- `requestType`: `initial_request`, `extension`, `reconsideration`, `revision`, `restoration`, `appeal`, `compliance`, `other`
- `der`, `benefitTypeId` (opcional)
- Protocolo: `protocolNumber` / `protocolDate` / `protocolSource` (padrão `manual`)
- `protocolVerificationStatus`: `unverified` | `manual` | `verified` | `source_unavailable` | `not_configured`
- `status`: `draft` → `ready` → `submitted` → `under_analysis` / `requirement_open` → `decided` / `appeal` → `closed` / `cancelled` / `archived`

## Protocolo: manual ≠ órgão

Enquanto `SocialSecurityProvider` estiver **`NOT_CONFIGURED`**, protocolo informado é registro humano. `verified` só faz sentido com evidência interna ou provider real futuro — a UI não deve dizer “confirmado pelo INSS” sem isso (paralelo ao ADR 047).

## Perícia e avaliação social

- `previdentiary_medical_exams` e `previdentiary_social_assessments` ligam-se ao request.
- Podem criar/associar `calendar_events` (`calendarEventId`) — a perícia é SSOT; a agenda projeta.
- Modalidade, local, status e `resultSummary` são manuais até haver provider.

## Documentos e exigências

Exigências genéricas do órgão continuam em `administrative_requirements`. Peças do requerimento usam documentos / `document_links` do caso previdenciário ou do processo administrativo.

## API

- `POST/GET/PATCH …/previdentiary-requests`
- `POST/GET …/previdentiary-requests/:requestId/medical-exams`
- `POST/GET …/previdentiary-requests/:requestId/social-assessments` (quando registrado)

Permissão: `previdentiary.manage_requests` (+ `previdentiary.manage_medical_exam` para perícias).

## Fora do escopo

Protocolo eletrônico INSS, captura de exigências do órgão, perícia remota oficial, decisão automática de deferimento.
