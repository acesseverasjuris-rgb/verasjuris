# LegalMatter — Casos jurídicos (Etapa 3)

## Conceito

**LegalMatter** é a unidade jurídica de trabalho de uma organização relacionada a uma demanda concreta.

Não confundir com:

| Conceito | Papel |
| --- | --- |
| Lead | Interesse comercial potencial |
| Client | Parte cliente no CRM |
| Opportunity | Orquestração do pipeline |
| Intake / Triage | Atendimento e triagem |
| JudicialProcess | Processo judicial 0..N no matter (`docs/JUDICIAL_PROCESSES.md`) |
| AdministrativeProcess | Processo administrativo 0..N no matter (`docs/ADMINISTRATIVE_PROCESSES.md`) |
| PrevidentiaryCase | Caso previdenciário 0..N no matter (`docs/PREVIDENTIARY.md`) |
| LaborCase | Caso trabalhista 0..N no matter (`docs/LABOR.md`) |

Produto (UI): **Casos**. Domínio/código: **LegalMatter**.

## Persistência

Tabela `legal_matters` — evolução de `legal_cases` (migration `0006`, rename preservando IDs e FKs).

`crm_opportunities.case_id` continua apontando para `legal_matters.id` (nome de coluna legado do pipeline).

## Campos centrais

- `internalReference` — humana, única por org (`VJ-YYYY-NNNNNN`), gerada com `legal_matter_sequences` + lock transacional
- `clientId`, `organizationId`
- `originatingOpportunityId`, `intakeId` (opcionais)
- `demandTypeId`, `legalAreaId`, `legalSubareaId`
- `status`, `priority`, `responsibleMembershipId`
- `openedAt` / `closedAt` / `archivedAt`

## Catálogos

- **Demand types** — `legal_demand_types` (tenant-aware, seed de referência)
- **Áreas** — reutiliza `legal_areas` (Etapa 2.1)
- **Subáreas** — `legal_subareas` vinculadas à área da mesma organização

## Partes e equipe

- `legal_matter_parties` — 0..N, posição (cliente, parte contrária, etc.), sem modelar só autor/réu
- Parte contrária **não** é um único campo `opposingPartyName`
- `legal_matter_team_members` — N membros; papel de equipe ≠ permissão RBAC
- Responsável = `OrganizationMember` ativo da mesma org

## Honorários

`legal_matter_fee_arrangements` = regra contratual/comercial.

- Dinheiro: inteiros em centavos
- Percentual: basis points
- **Não** é pagamento, saldo, invoice ou cobrança

## Tags

Junction `legal_matter_tags` reutiliza `crm_tags` (tenant-aware). Ver ADR 033.

## Status

`draft` → `open` → `active` → `waiting` | `suspended` → `closed` → `archived` (transições centralizadas).

Sem `WON`/`LOST` no matter (resultado jurídico ≠ estado operacional).

## Timeline ≠ auditoria

- Timeline (`legal_matter_timeline_events`): operacional para o usuário
- `AuditEvent`: compliance técnico (sem PII completa)

## API

- `/v1/organizations/:organizationId/matters`
- Subrecursos: `parties`, `team`, `fees`, `timeline`, tags
- Catálogos: `demand-types`, `legal-subareas` (+ `legal-areas` existente)
- Pipeline: `POST .../opportunities/:id/case` → cria LegalMatter (idempotente)

## Processos judiciais

A partir da Etapa 3.1, um LegalMatter pode agregar **0..N** `judicial_processes`. Ver `docs/JUDICIAL_PROCESSES.md`.

## Processos administrativos

A partir da Etapa 3.2, um LegalMatter pode agregar **0..N** `administrative_processes` (independentes dos judiciais). Ver `docs/ADMINISTRATIVE_PROCESSES.md`. Sem integração com órgãos (`body_provider` = `NOT_CONFIGURED`).

## Previdenciário e trabalhista (Prompt 16)

Um LegalMatter pode agregar **0..N** `previdentiary_cases` e **0..N** `labor_cases` — agregados próprios, não colunas do matter (ADRs 100, 108). Benefícios, CNIS e cálculos previdenciários: `docs/PREVIDENTIARY.md`. Contratos, FGTS estimado e liquidação: `docs/LABOR.md`. Providers oficiais permanecem `NOT_CONFIGURED`.

## Documentos

A partir da Etapa 4, documentos lógicos podem vincular-se ao matter (`ownerType=legal_matter`) ou a processos/cliente/intake. Versões e upload: `docs/DOCUMENTS.md`, `docs/SECURE_UPLOAD.md`.

## Análise jurídica assistida (Etapa 6)

Análises (`legal_ai_analyses`) podem referenciar o matter, processos judiciais/administrativos ou documento. Saída estruturada (fatos, pedidos, fundamentos, etc.) com **revisão humana** — a IA **não** muda `status` do matter nem de processos.

- API: `/v1/organizations/:organizationId/legal-analyses`
- Permissões: `legal_analysis.read`, `legal_analysis.create`, `legal_analysis.review`
- Com `AI_PROVIDER=not_configured`, solicitação registra falha honesta sem conteúdo inventado

Documentação: `docs/LEGAL_AI_ANALYSIS.md`.

## Fora do escopo ainda

Peticionamento eletrônico real, financeiro operacional, comunicações externas, captura automática de tribunal/órgão/INSS/eSocial, assinatura eletrônica, alteração automática de status/prazo por IA, cálculo que defira benefício ou homologue liquidação.
