# CRM — VerasJuris

## Escopo e limite de domínio

O módulo **crm** cobre a relação comercial inicial do escritório: prospecção (leads), cadastro de clientes (PF/PJ), contatos associados, tags, origens, canais, anotações e linha do tempo de interações. Pertence ao tenant (`organization_id` em todas as tabelas).

**Fora desta etapa:** processos judiciais, documentos, contratos, cobrança, marketplace, peticionamento e integrações com tribunais. Nenhuma tabela ou rota simula esses fluxos.

## Entidades

### Lead (`crm_leads`)

Prospecto com status operacional:

`new` → `contacted` → `qualifying` → `qualified` | `unqualified` → `converted` | `archived`

Campos principais: `personType` (`person` | `organization`), `name`, `tradeName`, `email`, `phone`, `summary`, `sourceId`, `channelId`, `ownerMembershipId`, `convertedAt`, `convertedClientId`.

Lead convertido permanece no banco com status `converted`; não retorna a status operacional anterior.

### Cliente (`crm_clients`)

Registro comercial PF ou PJ na organização.

**Pessoa física (`personType: person`):** `fullName`, `socialName`, `cpfNormalized`, `birthDate`.

**Pessoa jurídica (`personType: organization`):** `legalName`, `tradeName`, `cnpjNormalized`, `website`.

Campos comuns: `email`, `phone`, `notes`, `status` (`active` | `inactive` | `archived`), origem, canal, responsável, `convertedFromLeadId`.

A composição PF/PJ é por colunas na mesma tabela, discriminada por `personType` — não há subtipos ou tabelas filhas por tipo.

### Contato (`crm_contacts`)

Pessoa de contato vinculada a um lead **ou** a um cliente (`leadId` / `clientId`). Campos: `name`, `email`, `phone`, `jobTitle`, `isPrimary`, `contactPreferences`.

### Catálogo por organização

| Entidade | Tabela | Descrição |
| --- | --- | --- |
| Origem | `crm_sources` | De onde veio o lead/cliente (indicação, site, etc.) |
| Canal | `crm_channels` | Meio de contato (e-mail, WhatsApp, presencial, etc.) |
| Tag | `crm_tags` | Etiqueta livre (`name`, `slug`, `color`) |

Origens e canais são **administráveis** por organização. Na primeira consulta, `ensureCrmCatalog` insere entradas padrão (`DEFAULT_CRM_SOURCES`, `DEFAULT_CRM_CHANNELS`) com `isSystem: true`. Chaves são únicas por `(organization_id, key)`.

### Anotações (`crm_notes`)

Texto livre ligado a lead, cliente ou contato. Visibilidade: `organization`, `internal`, `private`. Autor registrado via `authorMembershipId`.

### Interações (`crm_interactions`)

Eventos da linha do tempo: `note`, `call`, `email`, `meeting`, `message`, `status_change`, `assignment`, `lead_conversion`. Origem: `manual`, `system`, `integration`.

## Responsáveis (owners)

`ownerMembershipId` referencia `organization_members.id` — o responsável comercial é um **OrganizationMember** ativo, não um User solto. A API valida que a membership pertence à mesma organização e está `active`.

## Anotações vs auditoria

| | CRM Notes / Interactions | AuditEvent |
| --- | --- | --- |
| Propósito | Histórico operacional visível no CRM | Trilha de segurança e conformidade |
| Público | Equipe com permissão CRM | Administradores com `audit.read` |
| Conteúdo | Anotações, ligações, conversões | Metadados de ação (`crm.lead_created`, etc.) |
| Linha do tempo | **Sim** — compõe a timeline | **Não** — não alimenta a timeline do CRM |

A timeline (`listTimeline`) une `crm_interactions` e, se o usuário tiver `crm.read_notes`, também `crm_notes`. Não replica o log completo de `audit_events`.

## Conversão de lead

`POST …/crm/leads/:leadId/convert` executa em **transação única**:

1. Bloqueio pessimista do lead (`SELECT … FOR UPDATE`)
2. Criação do cliente com dados do lead
3. Cópia de contatos e tags
4. Lead atualizado para `converted`, com `convertedClientId` e `convertedAt`
5. Interações de conversão no lead e no cliente
6. Auditoria `crm.lead_converted`

Lead convertido não aceita reconversão nem retorno de status operacional.

## Listagem, busca e filtros

Paginação **offset** (`limit` 1–100, padrão 20; `offset` 0–10.000).

Busca textual (`q`): `ilike` em nome, e-mail e telefone (leads); nome, razão social, nome fantasia, e-mail e telefone (clientes).

Filtros aplicados **no servidor**: `status`, `sourceId`, `channelId`, `ownerMembershipId`, `tagId`, `personType`, ordenação (`sort`: `createdAt` | `updatedAt` | `name`; `order`: `asc` | `desc`).

## CPF e CNPJ

- Entrada validada e normalizada (`normalizeCpf`, `normalizeCnpj`)
- Persistência em `cpf_normalized` / `cnpj_normalized`
- Resposta de leitura expõe `cpfMasked` / `cnpjMasked`; valores normalizados **não** são devolvidos na API
- Índices `(organization_id, cpf_normalized)` e `(organization_id, cnpj_normalized)` — **sem** unique global; unicidade é escopo de organização por decisão de produto (ADR 018 em `docs/DECISIONS.md`)

## Permissões

| Permission | Descrição resumida |
| --- | --- |
| `crm.read` | Consultar leads, clientes, contatos, catálogo, timeline |
| `crm.create` | Criar leads e clientes |
| `crm.update` | Atualizar registros e registrar interações |
| `crm.delete` | Reservada; arquivamento via `status` nesta etapa |
| `crm.assign` | Atribuir responsáveis |
| `crm.manage_tags` | CRUD de tags |
| `crm.manage_sources` | Gerenciar origens |
| `crm.manage_channels` | Gerenciar canais |
| `crm.read_notes` | Ler anotações na timeline |
| `crm.write_notes` | Criar anotações |

Matriz por papel em `docs/AUTHORIZATION.md`.

## API (Etapa 2)

Prefixo: `/v1/organizations/:organizationId/crm/` (`apps/api/src/modules/crm/`).

Principais rotas:

| Recurso | Operações |
| --- | --- |
| Overview | GET `/overview` |
| Leads | GET/POST `/leads`, GET/PATCH `/leads/:id`, POST `/leads/:id/convert`, GET `/leads/:id/timeline` |
| Clientes | GET/POST `/clients`, GET/PATCH `/clients/:id`, GET `/clients/:id/timeline` |
| Contatos | GET/POST `/contacts` |
| Tags | GET/POST `/tags` |
| Origens / Canais | GET `/sources`, GET `/channels` |
| Notas / Interações | POST `/notes`, POST `/interactions` |

Todas exigem sessão, membership na organização do caminho e permissão adequada. Recurso de outro tenant → **404**.

## Interface

Shell autenticado com seção CRM (`/app/crm`): leads, clientes, contatos, tags; detalhe com timeline e conversão de lead.

## Relação com perfis

Cliente comercial (`crm_clients`) é independente de `User`. O vínculo opcional conta ↔ cliente comercial está em `organization_client_users` (ver `docs/PROFILES.md`).

## Decisões relacionadas

ADR 014–022 em `docs/DECISIONS.md`. Segurança de documentos sensíveis: `docs/SECURITY.md`.
