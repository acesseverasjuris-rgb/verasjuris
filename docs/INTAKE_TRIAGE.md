# Atendimento e Triagem (Etapa 2.1)

Camada operacional sobre o CRM existente. Não substitui Lead, Client ou Contact.

## Conceitos

| Conceito | Entidade | Papel |
|---|---|---|
| Atendimento | `crm_intakes` | Caso de entrada/acompanhamento |
| Triagem | `crm_triages` | Classificação inicial (1:1 com intake) |
| Área jurídica | `legal_areas` | Catálogo por organização |
| Documento inicial | `crm_intake_documents` | Metadados; upload real depende de storage |

Um atendimento aponta opcionalmente para `leadId`, `clientId` e/ou `contactId`. Não há tabela alternativa de “pessoa atendida”.

## Separação de conceitos

- **Origem / canal** (`crm_sources` / `crm_channels`): de onde veio o contato.
- **Forma de atendimento** (`serviceMode`): como o atendimento ocorre (online, presencial, telefone, vídeo, mensagem, outro).
- **Urgência**: classificação informada na triagem — não confirma prazo processual.

## State machines

### Atendimento (`crm_intake_status`)

`open` → `triage` | `waiting_client` | `under_review` | `not_qualified` | `closed` | `archived`  
Transições centralizadas em `assertIntakeTransition` (`@verasjuris/auth`).

Estados finais operacionais: `converted`, `closed`, `archived`.

### Triagem (`crm_triage_status`)

`draft` → `in_progress` | `waiting_information` | `ready_for_analysis` | `closed`  
`reviewed` exige permission `triage.review`.

## Conversão

Se houver `leadId` e ainda não houver `clientId`, a conversão reutiliza `convertLead` do CRM e marca o atendimento como `converted`. Não cria segundo mecanismo. Cliente cadastrado ≠ contrato assinado (Etapa 2.2).

## Documentos iniciais

Registros `pending` / `unavailable` / `rejected` sem storage. Status `received` com upload real → `NOT_CONFIGURED` até haver object storage.

## Permissions

`intake.*`, `triage.*`, `legal_area.manage`, `document_initial.*` — ver `docs/AUTHORIZATION.md` e `ROLE_PERMISSIONS`.

## API

Prefixo: `/v1/organizations/:organizationId/`

- `legal-areas`
- `intakes` (+ `:intakeId`, `/triage`, `/documents`, `/convert`, `/timeline`)

Notes/interactions reutilizam `crm_notes` / `crm_interactions` com `resourceType=intake`.

## Frontend

- `/app/atendimentos`
- `/app/atendimentos/novo`
- `/app/atendimentos/[id]`
