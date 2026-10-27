# Processos administrativos (Etapa 3.2)

## Princípio

**LegalMatter ≠ AdministrativeProcess ≠ JudicialProcess.**

Um caso (`legal_matters`) pode ter **0..N** processos administrativos (`administrative_processes`), em paralelo a processos judiciais. Dados administrativos **não** ficam na tabela do matter nem na do processo judicial.

Não há integração com órgãos (INSS, RFB, Procon, etc.). O conceito de provedor do órgão (`body_provider`) permanece **`NOT_CONFIGURED`**: não há captura, scraping, API oficial nem confirmação externa de protocolo.

## Modelo

Agregado tenant-bound ao LegalMatter:

- órgão administrativo (catálogo global de referência);
- número do processo (formatado + normalizado — **não** é CNJ);
- protocolo manual (número, data, origem, referência);
- assunto, descrição, prioridade, fase textual;
- responsável (`OrganizationMember`);
- requerimentos (`administrative_requests`);
- exigências (`administrative_requirements`);
- prazos administrativos (`administrative_deadlines`);
- decisões (`administrative_decisions`);
- recursos administrativos (`administrative_appeals`);
- histórico de status + timeline processual;
- baixa/reabertura.

## Órgãos (`administrative_bodies`)

Catálogo **global** de referência (não tenant-specific), com seed mínimo `source=seed_dev` (INSS, RFB, Procon-SP, etc.):

- tipos: federal, estadual, municipal, autarquia, conselho, regulador, tribunal administrativo, outro;
- hierarquia opcional via `parentBodyId`;
- **não** é catálogo oficial sincronizado com órgãos.

Leitura: `GET /v1/organizations/:organizationId/administrative-bodies`.

Não existe adapter operacional de órgão. Qualquer fluxo que sugira sincronização automática deve falhar ou permanecer indisponível com **`NOT_CONFIGURED`**.

## Número administrativo (≠ CNJ)

Normalização: remover caracteres não alfanuméricos e converter para maiúsculas (`normalizeAdministrativeNumber`).

- Não há dígito verificador CNJ.
- Unicidade: `(organization_id, normalized_number)` quando o número está preenchido.
- Mensagem correta: número cadastrado/normalizado no tenant — **não** afirmar existência no órgão.

## Protocolo: manual ≠ confirmado

Campos de protocolo no processo (`protocolNumber`, `protocolDate`, `protocolSource`, `protocolReference`) e nos requerimentos/recursos são **registro humano**.

| Estado | Significado |
| --- | --- |
| `submitted` / protocolo informado | Declaração interna de envio; exige `submittedAt` e protocolo **ou** justificativa |
| `confirmed` | Confirmação operacional **interna** (não há retorno do órgão) |

Sem integração, `source` de envio permanece `manual`. A UI não deve apresentar protocolo como “confirmado pelo órgão”.

## Requerimentos, exigências, prazos, decisões e recursos

- **Requerimentos** — pedido ao órgão; máquina de status até `submitted` → `confirmed` (ou rejeição/cancelamento).
- **Exigências** — pendências abertas pelo órgão (registradas manualmente).
- **Prazos** — `suggested` → `pending_confirmation` → `confirmed` → `completed`; cálculo `manual` (sem calendário oficial do órgão).
- **Decisões** — registro de ato administrativo; não encerra o LegalMatter automaticamente.
- **Recursos** — `filed` / `confirmed` com protocolo manual; sem peticionamento eletrônico.

Transições centralizadas em `@verasjuris/auth` (`assertAdministrative*Transition`).

## Máquina de status do processo

`draft` → `active` → estados operacionais (`waiting_body`, `waiting_client`, `requirement_open`, `under_analysis`, `decided`, `appeal`, `suspended`) → `closed` → `archived`.

- Encerramento/reabertura com permissões dedicadas e auditoria.
- Encerrado/arquivado não edita subrecursos sem reabrir.
- Baixa ≠ exclusão.

## Timeline

- Timeline própria do processo (`administrative_process_timeline_events`), com data do evento ≠ data de inserção quando informada.
- Eventos relevantes (criação, protocolo, mudança de status, encerramento/reabertura) podem ser **projetados** na timeline do LegalMatter — sem duplicar o conteúdo integral dos subrecursos.

## RBAC

Permissões `administrative_process.*` e `administrative_catalog.manage`. Ver `docs/AUTHORIZATION.md`.

Policies: `policyAdministrativeProcess`, `policyAdministrativeRequest`, etc.

## Integração com LegalMatter

- Criação exige matter da mesma organização.
- API aninhada: `/v1/organizations/:organizationId/matters/:matterId/administrative-processes`
- Acesso direto por processo: `/v1/organizations/:organizationId/administrative-processes/:processId` (+ subrecursos).
- Processo de outro matter/tenant → **404**.

## API (resumo)

| Recurso | Caminho |
| --- | --- |
| Catálogo de órgãos | `…/administrative-bodies` |
| Processos no matter | `…/matters/:matterId/administrative-processes` |
| Processo | `…/administrative-processes/:processId` |
| Close / reopen | `…/:processId/close`, `…/:processId/reopen` |
| Timeline | `…/:processId/timeline` |
| Requests / requirements / deadlines / decisions / appeals | subrecursos sob `…/:processId/…` |

## Previdenciário (Prompt 16)

Requerimentos previdenciários (`previdentiary_requests`) **especializam** um `AdministrativeProcess` existente (FK obrigatória) — não o substituem. Benefício previdenciário (`social_security_benefits`) é entidade **separada** do processo (ADR 101–102). Ver `docs/PREVIDENTIARY.md`, `docs/PREVIDENTIARY_ADMIN_REQUESTS.md`. `SocialSecurityProvider` / `body_provider` permanecem **`NOT_CONFIGURED`**.

## Fora do escopo

Integração com órgãos, `body_provider` operacional, protocolo eletrônico real, scraping, prazos oficiais automatizados, IA que decida deferimento administrativo.
