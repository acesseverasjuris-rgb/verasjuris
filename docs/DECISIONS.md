# Decisões

## ADR 001 — Monólito modular

Um repositório pnpm com web, API e worker. Sem microserviços, Kubernetes ou broker. A separação em pacotes preserva o limite para um serviço futuro.

## ADR 002 — Drizzle e PostgreSQL

Um único ORM, Drizzle, com migrations SQL versionadas. PostgreSQL é a fonte de verdade. Os testes usam PGlite para aplicar as mesmas migrations sem exigir Docker na CI. O desenvolvimento da API usa um PostgreSQL 16 descrito no `docker-compose.yml`.

## ADR 003 — Sessão própria

A autenticação não usa um fornecedor de identidade nesta fase. Senha com scrypt da biblioteca padrão do Node e sessão persistida por hash. MFA e passkeys ficam para uma fase posterior, sem fluxo visual que sugira que já funcionam. O desenho de papéis não separa “login de cliente” e “login de advogado”: há uma conta e várias participações.

## ADR 004 — Autorização por permissão

Papéis de sistema (`owner`, `administrator`, `member`) carregam permissões. A checagem é `authorizeAccess`. O índice único de papéis aceita, no futuro, papéis por organização sem impedir a chave dos papéis de sistema. O papel de proprietário só pode ser concedido por quem já é proprietário.

Acesso sem participação responde 404. Acesso com participação e sem permissão responde 403.

## ADR 005 — Auditoria na transação

O evento crítico é gravado na mesma transação da mudança. O barramento em processo só corre depois do commit e não é a trilha oficial. Um gatilho PostgreSQL impede atualização e exclusão de `audit_events`.

## ADR 006 — Fila não configurada

O contrato `JobQueue` existe. A implementação retorna `not_configured` e o healthcheck do worker mostra isso. Não há Redis, SQS ou fila falsa que pareça processar trabalho.

## ADR 007 — IA somente como contrato (fase 1)

`AiGateway` valida o pedido, não chama rede e devolve estado `not_configured`. **Etapa 6** adicionou persistência, rotas e domínios assistivos mantendo provedor default `not_configured` — ver ADR 058–070 e `docs/AI_CORE.md`.

## ADR 008 — Frontend e marca

Next.js App Router, componentes no pacote `ui`, tokens de cor do Manual da Marca. Aptos não é incorporada: não há licença para distribuir o arquivo. A alternativa web é Source Sans 3 para texto e IBM Plex Mono para dado técnico. Ícones Lucide, em 16, 20 e 24 px.

A borda institucional `#D9D9D9` permanece para divisões. Controles usam `#667085`, porque a borda clara não atinge 3:1 sobre branco.

O logotipo oficial não foi redesenhado. Sem o arquivo mestre, a interface mostra o nome em uma cor só e documenta a pendência.

## ADR 009 — Ferramentas

Biome faz lint e formatação, para não manter ESLint e Prettier ao mesmo tempo. Vitest executa unidade e integração. A API e o worker de produção são empacotados com tsup, incluindo os pacotes `@verasjuris`.

## ADR 010 — Proxy da sessão

O cookie de sessão é definido pela API e chega ao navegador pelo proxy do Next em `/api/v1`. Assim a origem do cookie e a das páginas é a mesma.

## ADR 011 — Auditoria da fundação (etapa 0.1)

A etapa 0.1 endureceu a fundação sem abrir domínios novos.

- Papéis de sistema são globais (`organization_id` nulo). A tabela `roles` já admite papéis por organização no futuro, sem mudar o modelo de membership.
- A leitura de sessão usa consultas separadas, em vez de um único `with` profundo do Drizzle, para não gerar aliases SQL acima do limite de 63 caracteres do PostgreSQL.
- Mutações exigem o cabeçalho `x-verasjuris-request` e, quando `Origin` ou `Referer` estão presentes, devem coincidir com `WEB_ORIGIN`. Ausência de Origin continua permitida para o BFF e para testes server-side. O cookie permanece `SameSite=Lax`.
- A remoção ou rebaixamento do último proprietário ativo é reavaliada dentro da mesma transação, com `SELECT … FOR UPDATE` nas memberships ativas da organização.
- Login e logout gravam sessão e auditoria na mesma transação. A atualização de organização também.
- CSP no Next usa política inicial com `script-src` e `style-src` compatíveis com o App Router atual (`unsafe-inline` / `unsafe-eval` no script). Nonce/hash fica para uma etapa posterior.
- `@verasjuris/ai`, o worker e o barramento em processo permanecem como contratos honestos (`not_configured` / sem assinantes). Não foram removidos porque já documentam o limite de processo e de integração.
- Constantes de cookie/CSRF ficam em `@verasjuris/security/constants`, para o cliente Next não importar `node:crypto`.

## ADR 012 — Identidade e autenticação (etapa 1)

- **Membership = `OrganizationMember`**. Não há tabela `Membership` duplicada. O termo “membership” é o conceito de domínio.
- O e-mail é normalizado com trim + lowercase e armazenado em `users.email` (unicidade no banco). Não há coluna `normalizedEmail` separada e não há remoção de pontos do Gmail.
- Cadastro cria identidade em `pending_verification`, sem sessão e sem organização automática. Organização nasce só quando o usuário cria uma.
- Login exige `status = active` e `emailVerifiedAt` preenchido. Sessões de usuário suspenso/desativado/pendente são rejeitadas em `findSession`.
- Respostas de cadastro, reenvio de verificação e recuperação de senha são anti-enumeração.
- Tokens de verificação, reset e convite: bytes aleatórios, hash SHA-256, expiração, single-use, nunca logados.
- Provider de e-mail (`@verasjuris/email`): `not_configured` (padrão) ou `memory` (somente não-produção / testes). Nenhum SendGrid/Resend/SES nesta etapa.
- Permissão `member.invite` para convites. Papéis convidáveis: `administrator` e `member` (não `owner`).
- Política de senha: mínimo 12, máximo 128, sem exigências artificiais de símbolo/maiúscula, sem truncamento silencioso.
- Reset de senha revoga todas as sessões. Troca autenticada revoga as demais sessões.
- MFA/passkeys: sem implementação falsa. Futuro: entidade de credencial/desafio separada do `User`, sem recriar identidade.

## ADR 013 — Policies e autorização (etapa 1.1)

- Camada formal em `@verasjuris/auth` (`policies.ts`): permissions + invariantes (last owner, invite role, assign roles, sessão própria).
- Status de convite continua derivado de `acceptedAt` / `revokedAt` / `expiresAt` (sem coluna `status`).
- Snapshot Drizzle `0001` não foi regenerado via drizzle-kit para não reescrever migration já aplicada; journal inclui `0002_etapa1_1_sessions_profile` (`sessions.last_used_at`). Dívida de snapshot documentada e aceita até próximo ciclo seguro de tooling.
- Profile: o usuário autenticado atualiza o próprio perfil via `PATCH /v1/account/profile` com auditoria `profile.updated`.
- Reenvio de convite: `POST …/invitations/:id/resend` rotaciona token hash, TTL e dispara o EmailProvider.

## ADR 014 — User ≠ CRM Client (etapa 1.2 / 2)

Conta autenticada (`users`) e cliente comercial (`crm_clients`) são entidades distintas. O CRM pode registrar pessoas e empresas sem login. Participação na organização (`organization_members`) concede permissões internas; não cria cliente comercial automaticamente. Vínculo opcional conta↔cliente comercial em `organization_client_users`, com referência opcional a `crm_client_id`.

## ADR 015 — Membership ≠ EmployeeProfile (etapa 1.2)

`organization_members` (Membership) define acesso e papéis na organização. `employee_profiles` descreve função interna (cargo, departamento, gestor) e é escopado por `(organization_id, user_id)`. Exigir membership ativa para upsert de colaborador. Um usuário pode ser membro sem perfil de colaborador, e vice-versa só com membership.

## ADR 016 — Perfis profissionais acumulativos (etapa 1.2)

Não há `user.type` exclusivo. Lawyer, Partner e Employee coexistem na mesma identidade. `professional_profiles` centraliza `verificationStatus`. Perfis globais (advogado, parceiro) usam `user_id` como chave; colaborador é por organização.

## ADR 017 — Composição PF/PJ em `crm_clients` (etapa 2)

Um único registro `crm_clients` discrimina tipo por `personType` (`person` | `organization`). Colunas PF (`fullName`, `cpfNormalized`, …) e PJ (`legalName`, `cnpjNormalized`, …) convivem na mesma tabela; validação de entrada exige campos mínimos conforme o tipo.

## ADR 018 — CPF/CNPJ: índice por organização, sem unique global (etapa 2)

`cpf_normalized` e `cnpj_normalized` são indexados com `organization_id`. Não há constraint UNIQUE global — a unicidade comercial é deliberadamente escopada ao tenant; política de duplicidade pode evoluir sem migration destrutiva cross-tenant.

## ADR 019 — Conversão de lead transacional (etapa 2)

`convertLead` roda em transação com bloqueio do lead, cria cliente, copia contatos e tags, marca lead como `converted` (registro preservado), registra interações e auditoria. Lead convertido não reconverte nem reverte status operacional.

## ADR 020 — Catálogo Source/Channel por organização (etapa 2)

Origens e canais são tabelas administráveis (`crm_sources`, `crm_channels`) com seed idempotente (`ensureCrmCatalog`) das constantes `DEFAULT_CRM_*` por organização. Chave única `(organization_id, key)`. Entradas `isSystem: true` podem ser estendidas pela organização.

## ADR 021 — Timeline CRM ≠ audit log completo (etapa 2)

A linha do tempo do CRM monta `crm_interactions` e, com `crm.read_notes`, `crm_notes`. Eventos de `audit_events` não são replicados na timeline operacional. Auditoria continua append-only para segurança; notes/interactions servem ao time comercial.

## ADR 022 — Stubs OAB, KYC e biometria `NOT_CONFIGURED` (etapa 1.2)

Provedores em `verifiers.ts` recusam com 503. Campos OAB são declarativos; `verificationStatus: verified` não pode ser imposto pelo cliente (`policyProfessionalVerificationStatus`). Biometria documental não persiste dados nesta etapa. Integração real exige ADR próprio e provedor certificado.

## ADR 023 — Atendimento sobre o CRM, sem segundo CRM (etapa 2.1)

`crm_intakes` referencia Lead/Client/Contact existentes. Não há entidade paralela de “pessoa atendida”. Conversão de atendimento com lead reutiliza `convertLead`. Cliente CRM ≠ contrato assinado (Etapa 2.2).

## ADR 024 — Triagem 1:1 e state machines centralizadas (etapa 2.1)

Uma triagem por atendimento (`crm_triages.intake_id` unique). Transições de status de atendimento e triagem vivem em `assertIntakeTransition` / `assertTriageTransition`; endpoints não espalham `if status ===`.

## ADR 025 — Urgência informada ≠ prazo confirmado (etapa 2.1)

Urgência (`normal|attention|urgent|critical`) é classificação operacional auditável. A interface usa “urgência informada na triagem” e não afirma confirmação de prazo processual.

## ADR 026 — Canal de origem ≠ forma de atendimento (etapa 2.1)

`sourceId`/`channelId` reutilizam o catálogo CRM. `serviceMode` descreve como o atendimento ocorre. Conceitos distintos no modelo e na UX.

## ADR 027 — Documentos iniciais com storage `NOT_CONFIGURED` (etapa 2.1)

`crm_intake_documents` persiste metadados e status (`pending`/`unavailable`/…). Upload binário real passa por adapter que responde `NOT_CONFIGURED` até haver object storage. Não se finge URL privada permanente.

## ADR 028 — tagIds/source/channel tenant-bound (correção etapa 2)

Antes de ampliar o CRM com intake, `tagIds`, `sourceId` e `channelId` passaram a ser validados contra a organização ativa. Atribuição de responsável distinto do ator exige `crm.assign` / `intake.assign`.

## ADR 029 — `crm_opportunities` orquestra o pipeline (etapa 2.2)

A jornada não é um único `lead.status`. `crm_opportunities` referencia Lead/Intake/Triage/Client/Case sem duplicá-los. Stages e status são distintos; pré-condições de transição vivem no service + `assertOpportunityStageTransition`.

## ADR 030 — Proposta ≠ contrato; dinheiro em centavos (etapa 2.2)

`crm_proposals` versionadas; aceitação habilita `contracting`, não cria contrato assinado. Valores em inteiros (`priceCents` / `estimatedValueCents`) + `currency`. `crm_engagements` representa estágio comercial, não assinatura eletrônica.

## ADR 031 — Client ≠ Case; cases em domínio separado (etapa 2.2)

`legal_cases` é o núcleo mínimo do agregador jurídico futuro. Um cliente tem 0..N casos. Sem campos de caso em `crm_clients`. Processos/prazos/petições ficam para etapas posteriores.

## ADR 032 — Motivos de perda configuráveis (etapa 2.2)

`crm_loss_reasons` por organização com seed `DEFAULT_LOSS_REASONS`. Perda exige motivo + timestamp; não apaga histórico.

## ADR 033 — Tags de LegalMatter reutilizam `crm_tags` (etapa 3)

`crm_tags` é tecnicamente genérica (org + name/slug/color). Em vez de duplicar `legal_tags`, a junction `legal_matter_tags` reutiliza o catálogo. Renomeação futura da tabela (`org_tags`) fica em aberto; sem acoplamento semântico ao CRM além do nome legado.

## ADR 034 — `legal_cases` → `legal_matters` por rename (etapa 3)

**Estratégia B:** migration `0006` renomeia `legal_cases` → `legal_matters` e evolui colunas/enums, preservando IDs e a FK `crm_opportunities.case_id`. Motivo: o domínio passou a ser LegalMatter (agregado central); manter o nome físico `legal_cases` geraria dívida sem benefício. Não há segunda tabela paralela. Alias Drizzle `legalCases = legalMatters` só para transição de código.

## ADR 035 — FeeArrangement ≠ financeiro (etapa 3)

`legal_matter_fee_arrangements` modela regra comercial (fixo/êxito/%/hora/etc.) em centavos e basis points. Pagamento, ledger, invoice e saldo ficam para o domínio financeiro futuro.

## ADR 036 — Timeline operacional ≠ AuditEvent (etapa 3)

Timeline do matter é para o usuário jurídico. AuditEvent permanece trilha técnica; a UI de casos não expõe metadata de auditoria integral.

## ADR 037 — Catálogos judiciais globais + seed_dev (etapa 3.1)

Tribunais, unidades, comarcas, classes, assuntos e fases genéricas são **globais de referência**, não tenant-specific. Customização organizacional futura fica em tabelas separadas. O seed atual é `source=seed_dev` — fixture de desenvolvimento, **não** sincronização oficial CNJ/TPU. Fallback textual no processo (`court_unit_text`, `district_text`) cobre lacunas do catálogo.

## ADR 038 — LegalMatter ≠ JudicialProcess (etapa 3.1)

Processo judicial é entidade própria (`judicial_processes`) 0..N por matter. Partes/advogados processuais não substituem matter parties/team. Decisão/baixa do processo não altera automaticamente o status do LegalMatter.

## ADR 039 — Document ≠ DocumentVersion (etapa 4)

O documento lógico (`documents`) concentra metadados, dono, confidencialidade e ponteiro `currentVersionId`. Cada arquivo imutável é uma `document_versions` com número sequencial, storage, MIME e hash. Substituir o binário cria nova versão — não sobrescreve a anterior. Hard delete fica fora do escopo; arquivamento é soft.

## ADR 040 — Abstração StorageProvider (etapa 4.1)

Object storage entra só por `StorageProvider` em `@verasjuris/storage` (`putObject` / `getObject` / `deleteObject` / …). A API de documentos depende do contrato, não de um fornecedor. Factory: `not_configured` (padrão) ou `local` (DEV). Não há implementação AWS S3, GCS ou Azure nesta etapa.

## ADR 041 — Storage local apenas em desenvolvimento (etapa 4.1)

`LocalPrivateStorageProvider` (`DEV_LOCAL`) grava sob `LOCAL_STORAGE_PATH`, fora de `apps/web/public`, com chaves UUID. Em `NODE_ENV=production`, `STORAGE_PROVIDER=local` é recusado (salvo escape hatch explícito). Produção sem provider real permanece `NOT_CONFIGURED` — sem fingir bucket cloud.

## ADR 042 — ownerType / ownerId (binding de dono) (etapa 4)

Todo documento e pasta exige `ownerType` + `ownerId` validado na mesma organização (`organization`, `legal_matter`, `judicial_process`, `administrative_process`, `client`, `intake`). O binding impede documentos “soltos” e reutiliza autorização pelo tenant do recurso dono, sem duplicar o agregado dono dentro da tabela de documentos.

## ADR 043 — ACL + RBAC documental (etapa 4)

Acesso documental exige membership com permissão RBAC (`document.*`) e, para `confidential`, papel elevado **ou** entrada em `document_acl_entries`. ACL refina (share/download/etc.); não substitui a ausência de membership. Cross-tenant continua 404.

## ADR 044 — Hash SHA-256 de conteúdo (etapa 4 / 4.1)

Cada versão persiste `sha256` do binário (hasher streaming em `@verasjuris/storage`). Serve a integridade e auditoria operacional. **Não** é assinatura digital, carimbo de tempo ICP-Brasil nem prova de autoria jurídica.

## ADR 045 — Scanner de malware `NOT_CONFIGURED` (etapa 4.1)

`MalwareScannerProvider` existe; a factory devolve stub que responde `NOT_CONFIGURED`. Estados de quarentena estão no modelo. Não há ClamAV nem serviço externo. Upload pode marcar `scanStatus=not_configured` e versão `available` — a UI deve declarar a ausência de varredura, nunca “arquivo limpo”.

## ADR 046 — AdministrativeProcess ≠ JudicialProcess (etapa 3.2)

Processo administrativo é agregado próprio (`administrative_processes`) 0..N por LegalMatter, paralelo ao judicial. Número normalizado alfanumérico (≠ CNJ). Catálogo de órgãos é `seed_dev`, sem sincronização oficial. Não há integração com órgãos; `body_provider` permanece `NOT_CONFIGURED`.

## ADR 047 — Protocolo manual ≠ confirmado pelo órgão (etapa 3.2)

`submitted` / protocolo informado e `confirmed` são estados **internos**. Envio exige data e protocolo ou justificativa, com `source=manual` enquanto não houver integração. A confirmação operacional não implica retorno do órgão nem protocolo eletrônico real.

## ADR 048 — Consistência DB / object storage (etapa 4.1)

Ordem: validar → `putObject` → transação com `document_versions` (e `currentVersionId`). Não há two-phase commit. Se a persistência falhar após o put, compensar com `deleteObject`. Idempotência de upload evita put lógico duplicado. Reconciliação de órfãos permanece para etapa futura.

## ADR 049 — Dossiê como projeção (etapa 4.2)

Não há tabela `dossiers`. O dossiê é consulta/projeção sobre `documents` (owner binding) e `document_links`. UI e API devolvem listas tipadas; classificação vive nas colunas do documento.

## ADR 050 — `document_links` como resource links (etapa 4.2)

`document_links.linkType` / `targetType` / `targetId` equivalem semanticamente a `relationType` / `resourceType` / `resourceId`. Evita segunda tabela semântica para o mesmo vínculo tipado.

## ADR 051 — Task ≠ Deadline; SLA ≠ prazo legal (etapa 5)

Tarefas e SLA operacional (`task_sla`) medem trabalho interno. Prazos jurídicos/operacionais centrais ficam em `deadlines`. SLA pausa em `waiting`/`blocked` e não substitui conferência de prazo legal.

## ADR 052 — CalendarEvent central; hearing via `judicialHearingId` (etapa 5.1)

`calendar_events` concentra a agenda. Audiência judicial permanece SSOT em `judicial_hearings`; a agenda projeta com `judicialHearingId` único, sem duplicar o hearing.

## ADR 053 — Prazos centrais + vínculo administrativo (etapa 5.2)

Domínio central `deadlines`. `administrative_deadlines.centralDeadlineId` + `sourceType=administrative_deadline` espelham prazo administrativo no central (hook na criação/atualização administrativa).

## ADR 054 — Sugerido × confirmado (etapa 5.2)

Cálculo nunca confirma sozinho. Status `suggested` / `pending_confirmation` exigem `deadline.confirm`. Alteração de data confirmada exige histórico e motivo.

## ADR 055 — HolidayCalendar `NOT_CONFIGURED` (etapa 5.2)

Sem calendário oficial de feriados. `business_days` exclui sáb/dom; resultado permanece sugerido. UI e API declaram `NOT_CONFIGURED`.

## ADR 056 — NotificationProvider; in-app only (etapa 5.2)

Contrato `NotificationProvider` em `@verasjuris/notifications`. Implementação pronta: in-app. E-mail/WhatsApp/SMS/push permanecem `NOT_CONFIGURED`. Sem envio fake.

## ADR 057 — Timezone IANA (etapa 5.1 / 5.2)

Agenda e prazos usam timezone IANA (padrão `America/Sao_Paulo`). Timestamps persistidos com `timestamptz`.

## ADR 058 — Gateway de IA obrigatório (etapa 6)

Domínios chamam **`AIGateway`**; proibido SDK de vendor na API. Detalhe: `docs/adr/058-ai-gateway-obrigatorio.md`.

## ADR 059 — Prompt versioning imutável (etapa 6)

Versões referenciadas por requests não são reescritas; nova versão numérica. Detalhe: `docs/adr/059-prompt-versioning-imutavel.md`.

## ADR 060 — AI Request / Usage separados (etapa 6)

`ai_requests`, `ai_responses` e `ai_usage` em papéis distintos. Detalhe: `docs/adr/060-ai-request-usage-separados.md`.

## ADR 061 — Custos em micros (etapa 6)

1 unidade = 1_000_000 micros; `estimatedCostMicros` ≠ `providerReportedCostMicros`. Detalhe: `docs/adr/061-custos-em-micros.md`, `docs/AI_COSTS.md`.

## ADR 062 — Structured outputs Zod (etapa 6)

JSON de modelo validado antes de persistir domínio. Detalhe: `docs/adr/062-structured-outputs-zod.md`.

## ADR 063 — Proveniência por página (etapa 6)

`document_pages` + `ai_result_sources`. Detalhe: `docs/adr/063-proveniencia-por-pagina.md`.

## ADR 064 — OCR somente quando necessário (etapa 6)

Texto nativo primeiro; OCR stub `not_configured` sem texto inventado. Detalhe: `docs/adr/064-ocr-somente-quando-necessario.md`.

## ADR 065 — IA não altera domínio crítico (etapa 6)

Saída assistiva; mutações jurídicas só por humano. Detalhe: `docs/adr/065-ia-nao-altera-dominio-critico.md`.

## ADR 066 — Document input não confiável (etapa 6)

Mitigação de prompt injection. Detalhe: `docs/adr/066-document-input-nao-confiavel.md`.

## ADR 067 — Analysis versioning (etapa 6)

`legal_ai_analyses.version` por tipo/matter. Detalhe: `docs/adr/067-analysis-versioning.md`.

## ADR 068 — PublicOpportunity global vs tenant (etapa 6)

`organizationId` nulo vs interesses tenant. Detalhe: `docs/adr/068-public-opportunity-global-vs-tenant.md`.

## ADR 069 — Provider oportunidades NOT_CONFIGURED (etapa 6)

Sem PNCP/sync; manual OK. Detalhe: `docs/adr/069-public-opportunity-provider-not-configured.md`.

## ADR 070 — Integração externa NOT_CONFIGURED (etapa 6)

`FEATURE_EXTERNAL_INTEGRATIONS` sem adapters reais. Detalhe: `docs/adr/070-integracao-externa-not-configured.md`.

## ADR 071 — IA revisora separada da análise (etapa 6.3)

Legal Review ≠ Legal AI Analysis. Detalhe: `docs/adr/071-ai-reviewer-separada-da-analise.md`, `docs/AI_REVIEW.md`.

## ADR 072 — Review set versionado (etapa 6.3)

Conjunto documental da geração não é reescrito silenciosamente. Detalhe: `docs/adr/072-review-set-versionado.md`.

## ADR 073 — ResearchGateway obrigatório (etapa 7)

Fontes externas só via gateway; sem inventar jurisprudência. Detalhe: `docs/adr/073-research-gateway-obrigatorio.md`, `docs/LEGAL_RESEARCH.md`.

## ADR 074 — Contrato LegalSourceProvider (etapa 7)

Capabilities + default `not_configured`. Detalhe: `docs/adr/074-legal-source-provider-contract.md`, `docs/LEGAL_SOURCE_PROVIDERS.md`.

## ADR 075 — Fonte verificável para citações (etapa 7.1)

Metadados mínimos / https; incompleto → invalid. Detalhe: `docs/adr/075-fonte-verificavel-para-citacoes.md`.

## ADR 076 — CitationEngine (etapa 7.1)

Formatação e status; nunca auto-`verified`. Detalhe: `docs/adr/076-citation-engine.md`, `docs/CITATION_ENGINE.md`.

## ADR 077 — Jurisprudência não verificável (etapa 7 / 7.1)

Não citar como real sem fonte verificável. Detalhe: `docs/adr/077-jurisprudencia-nao-verificavel.md`.

## ADR 078 — Doutrina somente licenciada (etapa 7)

Sem licença: só referência bibliográfica. Detalhe: `docs/adr/078-doutrina-somente-licenciada.md`.

## ADR 079 — Auction ≠ PublicOpportunity (etapa 8)

Módulos e schemas separados. Detalhe: `docs/adr/079-auction-separado-de-public-opportunity.md`, `docs/AUCTIONS.md`.

## ADR 080 — Leilão público ≠ leilão de honorários (etapa 8)

Sem misturar com marketplace advocatício. Detalhe: `docs/adr/080-leilao-publico-nao-e-leilao-de-honorarios.md`.

## ADR 081 — Auction global vs tenant (etapa 8)

`organizationId` nulo vs interesses tenant. Detalhe: `docs/adr/081-auction-global-vs-tenant.md`.

## ADR 082 — Auction: centavos / basis points (etapa 8)

Dinheiro inteiro; comissão em bp. Detalhe: `docs/adr/082-auction-money-cents-bp.md`.

## ADR 083 — AuctionProvider / sem lance real (etapa 8)

Providers `not_configured`; bid stub. Detalhe: `docs/adr/083-auction-provider-sem-lance-real.md`.

## ADR 084 — Due diligence assistida (etapa 8)

Checklist ≠ parecer ≠ decisão automática. Detalhe: `docs/adr/084-due-diligence-assistida.md`, `docs/AUCTION_DUE_DILIGENCE.md`.

## ADR 085 — Template system vs organization (Prompt 15)

`scope=system` (`organizationId` nulo) vs `organization`. Detalhe: `docs/adr/085-template-system-vs-organization.md`, `docs/LEGAL_DOCUMENT_TEMPLATES.md`.

## ADR 086 — Versões de template imutáveis (Prompt 15)

Conteúdo em versões; ativação via `currentVersionId`. Detalhe: `docs/adr/086-immutable-template-versions.md`.

## ADR 087 — Motor seguro de variáveis (Prompt 15)

Whitelist `{{path}}`; sem eval/proto. Detalhe: `docs/adr/087-safe-variable-engine.md`.

## ADR 088 — Draft ≠ Document (Prompt 15)

Minuta ≠ binário de storage. Detalhe: `docs/adr/088-draft-nao-e-document.md`, `docs/LEGAL_DRAFTING.md`.

## ADR 089 — Draft source set (Prompt 15)

Fontes versionadas; citações só de IDs do set. Detalhe: `docs/adr/089-draft-source-set.md`.

## ADR 090 — Workflow legal central (Prompt 15)

Grafo + guards em `legal-draft-state`. Detalhe: `docs/adr/090-workflow-legal-central.md`, `docs/LEGAL_DOCUMENT_WORKFLOW.md`.

## ADR 091 — AI-assisted ≠ approved (Prompt 15)

Assistência não aprova; aprovador humano obrigatório. Detalhe: `docs/adr/091-ai-assisted-nao-e-approved.md`.

## ADR 092 — Filed manual ≠ provider confirmed (Prompt 15)

Protocolo informado ≠ confirmação de tribunal. Detalhe: `docs/adr/092-filed-manual-nao-e-provider-confirmed.md`.

## ADR 093 — Domínio de comparação (Prompt 15)

Comparações ≠ análise ≠ revisão formal. Detalhe: `docs/adr/093-comparison-domain.md`, `docs/LEGAL_COMPARISON.md`.

## ADR 094 — Ciclo pós-leilão (Prompt 15)

Participação → award → pagamento/entrega/transferência. Detalhe: `docs/adr/094-post-auction-lifecycle.md`, `docs/AUCTION_POST_SALE.md`.

## ADR 095 — Bid record ≠ live bid (Prompt 15)

Registro interno; lance ao vivo `NOT_CONFIGURED`. Detalhe: `docs/adr/095-manual-bid-record-nao-e-live-bid.md`.

## ADR 096 — Confirmação de award (Prompt 15)

Award humano; verificationStatus honesto. Detalhe: `docs/adr/096-award-confirmation.md`.

## ADR 097 — Pagamento pós-leilão sem gateway (Prompt 15)

Acompanhamento operacional; sem PSP. Detalhe: `docs/adr/097-payment-domain-without-gateway.md`.

## ADR 098 — LocalInProcessQueue opt-in (Prompt 15)

Só com `FEATURE_LOCAL_QUEUE` / `LOCAL_QUEUE=enabled`. Detalhe: `docs/adr/098-local-queue-provider.md`, `docs/TECHNICAL_DEBT_CLOSURE.md`.

## ADR 099 — Storage reconciliation detect-only (Prompt 15)

Findings sem `autoDelete`. Detalhe: `docs/adr/099-storage-reconciliation.md`.

## ADR 100 — PrevidentiaryCase ≠ LegalMatter (Prompt 16)

Agregado previdenciário próprio com FK ao matter. Detalhe: `docs/adr/100-previdentiary-case-separado-de-legal-matter.md`, `docs/PREVIDENTIARY.md`.

## ADR 101 — Benefit ≠ AdministrativeProcess (Prompt 16)

Benefício com NB/espécie/status próprios; vínculo opcional ao processo. Detalhe: `docs/adr/101-benefit-separado-de-administrative-process.md`.

## ADR 102 — Request previdenciário sobre AdministrativeProcess (Prompt 16)

`previdentiary_requests` especializa o fluxo; protocolo manual honesto. Detalhe: `docs/adr/102-request-especializado-sobre-administrative-process.md`, `docs/PREVIDENTIARY_ADMIN_REQUESTS.md`.

## ADR 103 — Cálculo determinístico ≠ IA (Prompt 16)

Motores em `@verasjuris/calculations`; IA não executa nem confirma. Detalhe: `docs/adr/103-calculo-deterministico-separado-de-ia.md`.

## ADR 104 — Rule sets versionados (Prompt 16)

`(key, version)` + lock após uso em cálculo. Detalhe: `docs/adr/104-rule-sets-versionados.md`.

## ADR 105 — CNIS importável/revisável (Prompt 16)

Import local + revisão; `CNISProvider` default `not_configured`. Detalhe: `docs/adr/105-cnis-importavel-revisavel.md`, `docs/CNIS.md`.

## ADR 106 — Cálculo reprodutível por input snapshot (Prompt 16)

`inputSnapshot` / `resultSnapshot` + envelope com memória. Detalhe: `docs/adr/106-calculo-reproduzivel-por-input-snapshot.md`.

## ADR 107 — Comparação de cenários de benefício (Prompt 16)

Maior RMI estimada ≠ “melhor benefício definitivo”. Detalhe: `docs/adr/107-benefit-scenario-comparison.md`.

## ADR 108 — LaborCase ≠ LegalMatter (Prompt 16)

Agregado trabalhista próprio com FK ao matter. Detalhe: `docs/adr/108-labor-case-separado-de-legal-matter.md`, `docs/LABOR.md`.

## ADR 109 — Histórico de EmploymentContract (Prompt 16)

Estado corrente + `employment_contract_history`. Detalhe: `docs/adr/109-employment-contract-history.md`.

## ADR 110 — LaborCalculationEngine (Prompt 16)

Jornada, remuneração, férias, FGTS estimado, rescisão, liquidação. Detalhe: `docs/adr/110-labor-calculation-engine.md`, `docs/LABOR_CALCULATIONS.md`.

## ADR 111 — FGTS estimado ≠ saldo oficial (Prompt 16)

Label fixa de estimativa; `FGTSProvider` `not_configured`. Detalhe: `docs/adr/111-fgts-estimado-nao-e-saldo-oficial.md`.

## ADR 112 — Integrações via providers (Prompt 16)

SocialSecurity / CNIS / eSocial / FGTS / LaborCourt — defaults `NOT_CONFIGURED`. Detalhe: `docs/adr/112-integrations-via-providers.md`, `docs/SOCIAL_SECURITY_PROVIDERS.md`, `docs/LABOR_PROVIDERS.md`.

## ADR 113 — Núcleo jurídico comum (Etapas 11–13)

Módulos de área, bindings, checklists, rule sets transversais. Detalhe: `docs/adr/113-common-legal-core.md`, `docs/LEGAL_AREAS.md`.

## ADR 114 — Arquitetura de extensão por área (Etapas 11–13)

Extensões no matter; papéis via position + metadata. Detalhe: `docs/adr/114-area-extension-architecture.md`, `docs/LEGAL_AREA_EXTENSION_MODEL.md`.

## ADR 115 — Registry de features por área (Etapas 11–13)

`LEGAL_AREA_FEATURES` + `legal_area_feature_config`. Detalhe: `docs/adr/115-legal-area-feature-registry.md`.

## ADR 116 — Cálculos específicos por área (Etapas 11–13)

Motores em `@verasjuris/calculations` ou `versioned_rule_sets`. Detalhe: `docs/adr/116-area-specific-calculations.md`.

## ADR 117 — Motor determinístico tributário (Etapas 11–13)

`TaxCase` + `TaxCalculationEngine`; providers fiscais `not_configured`. Detalhe: `docs/adr/117-tax-deterministic-engine.md`, `docs/TAX.md`, `docs/TAX_CALCULATIONS.md`.

## ADR 118 — Versionamento de regras tributárias (Etapas 11–13)

`tax_rule_sets` + snapshots. Detalhe: `docs/adr/118-tax-rule-versioning.md`, `docs/TAX_CALCULATIONS.md`.

## ADR 119 — Contract ≠ Document (Etapas 11–13)

Agregado `contracts` distinto de storage. Detalhe: `docs/adr/119-contract-not-document.md`, `docs/CONTRACTS.md`.

## ADR 120 — Contract ≠ LegalDraft (Etapas 11–13)

CLM ≠ minuta processual. Detalhe: `docs/adr/120-contract-not-legal-draft.md`, `docs/LEGAL_DRAFTING.md`.

## ADR 121 — Template de contrato reutiliza motor seguro (Etapas 11–13)

Whitelist de variáveis (ADR 087). Detalhe: `docs/adr/121-contract-template-reuses-engine.md`, `docs/LEGAL_DOCUMENT_TEMPLATES.md`.

## ADR 122 — Versão assinada imutável (Etapas 11–13)

`contract_versions` assinadas não editáveis in-place. Detalhe: `docs/adr/122-signed-contract-version-immutable.md`.

## ADR 123 — Snapshots de cláusulas (Etapas 11–13)

`contract_clause_instances` congelam biblioteca por versão. Detalhe: `docs/adr/123-clause-snapshots.md`.

## ADR 124 — Abstração SignatureProvider (Etapas 11–13)

Assinatura externa só via provider; default `not_configured`. Detalhe: `docs/adr/124-signature-provider-abstraction.md`, `docs/SIGNATURE_PROVIDERS.md`.

## ADR 125 — Assinatura manual ≠ provider (Etapas 11–13)

`manual_signature_records` sem simular envelope. Detalhe: `docs/adr/125-manual-signature-not-provider.md`, `docs/CONTRACT_SIGNATURES.md`.

## ADR 126 — Ciclo renovação e rescisão (Etapas 11–13)

Renewals/terminations explícitos; alertas stub. Detalhe: `docs/adr/126-renewal-termination-lifecycle.md`, `docs/CONTRACTS.md`.

## ADR 127 — Confidencialidade penal, saúde, tributário e eleitoral (Etapas 11–13)

Bindings e defaults restritos; IA não expõe dados sensíveis. Detalhe: `docs/adr/127-confidentiality-criminal-medical-tax.md`, `docs/SECURITY.md`.

## ADR 128 — Portal como camada de projeção (Etapas 14–16)

Portal não duplica matter/document/contract/agenda. Detalhe: `docs/adr/128-portal-as-projection-layer.md`, `docs/CLIENT_PORTAL.md`.

## ADR 129 — Portal deny-by-default (Etapas 14–16)

Vínculo obrigatório; timeline e sigilo explícitos. Detalhe: `docs/adr/129-client-portal-deny-by-default.md`, `docs/CLIENT_PORTAL_SECURITY.md`.

## ADR 130 — Timeline visível ao cliente (Etapas 14–16)

`client_visible` em eventos do matter. Detalhe: `docs/adr/130-client-visible-timeline.md`, `docs/CLIENT_PORTAL.md`.

## ADR 131 — Modelo de conversa compartilhado (Etapas 14–16)

Threads portal + outbox omnichannel + consulta online. Detalhe: `docs/adr/131-shared-conversation-model.md`, `docs/COMMUNICATION.md`.

## ADR 132 — Outbox de comunicação (Etapas 14–16)

Despacho assíncrono `COMMUNICATION_*`. Detalhe: `docs/adr/132-communication-outbox.md`, `docs/COMMUNICATION.md`.

## ADR 133 — Abstração canal/provider (Etapas 14–16)

Adapters email/sms/whatsapp/push em `@verasjuris/ai`. Detalhe: `docs/adr/133-channel-provider-abstraction.md`, `docs/COMMUNICATION_PROVIDERS.md`.

## ADR 134 — Transacional vs marketing (Etapas 14–16)

Categorias e opt-in marketing. Detalhe: `docs/adr/134-transactional-vs-marketing.md`, `docs/COMMUNICATION_CONSENT.md`.

## ADR 135 — Histórico de consentimento (Etapas 14–16)

`communication_consents` append-friendly. Detalhe: `docs/adr/135-consent-history.md`, `docs/COMMUNICATION_CONSENT.md`.

## ADR 136 — Domínio OnlineLegalRequest (Etapas 14–16)

Solicitação online separada de LegalMatter. Detalhe: `docs/adr/136-online-lawyer-request-domain.md`, `docs/ONLINE_LAWYER.md`.

## ADR 137 — Matching determinístico (Etapas 14–16)

Score fixo, sem IA/lance. Detalhe: `docs/adr/137-deterministic-matching.md`, `docs/ONLINE_LAWYER_MATCHING.md`.

## ADR 138 — OAB informada ≠ verificada (Etapas 14–16)

Bônus de score; provider not_configured. Detalhe: `docs/adr/138-oab-informed-not-verified.md`, `docs/OAB_VERIFICATION.md`.

## ADR 139 — Modelo de disponibilidade (Etapas 14–16)

Status + janelas + overrides. Detalhe: `docs/adr/139-availability-model.md`, `docs/ONLINE_LAWYER.md`.

## ADR 140 — Ciclo de vida da consulta (Etapas 14–16)

Estados pagamento/agenda/conclusão. Detalhe: `docs/adr/140-consultation-lifecycle.md`, `docs/ONLINE_CONSULTATIONS.md`.

## ADR 141 — Pagamento manual ≠ provider (Etapas 14–16)

Manual vs PSP; sync honesto. Detalhe: `docs/adr/141-manual-payment-not-provider.md`, `docs/PAYMENT_PROVIDER.md`.

## ADR 142 — Avaliação só após concluída (Etapas 14–16)

Reviews pós-`completed`. Detalhe: `docs/adr/142-review-only-after-completed.md`, `docs/ONLINE_CONSULTATIONS.md`.

## ADR 143 — Documentos após match aceito (Etapas 14–16)

ACL ao advogado no accept. Detalhe: `docs/adr/143-document-access-after-accepted-match.md`, `docs/ONLINE_LAWYER.md`.

## ADR 144 — Marketplace ≠ Advogado Online (Etapas 17–19)

Contratação estruturada vs consulta/matching. Detalhe: `docs/adr/144-marketplace-not-online-lawyer.md`, `docs/MARKETPLACE.md`.

## ADR 145 — Perfil ≠ verificação profissional (Etapa 17.1)

`lawyer_profiles` ≠ `professional_verification_cases`. Detalhe: `docs/adr/145-profile-not-verification.md`.

## ADR 146 — OAB informada ≠ verificada no marketplace (Etapa 17.1)

Sem auto-VERIFIED. Detalhe: `docs/adr/146-oab-informed-not-verified-marketplace.md`.

## ADR 147 — CPF checksum ≠ identidade (Etapa 17.1)

Format validation ≠ bureau. Detalhe: `docs/adr/147-cpf-checksum-not-identity.md`.

## ADR 148 — Biometria via provider + minimização (Etapa 17.1)

NOT_CONFIGURED; sem template bruto. Detalhe: `docs/adr/148-biometrics-via-provider.md`.

## ADR 149 — Divulgação documental no marketplace (Etapa 17)

Safe preview pré-aceite. Detalhe: `docs/adr/149-marketplace-document-disclosure.md`.

## ADR 150 — Disputa e review compartilhados (Etapas 17–18)

`marketplace_disputes` + `service_reviews`. Detalhe: `docs/adr/150-shared-dispute-and-review.md`.

## ADR 151 — Diligência como workflow especializado (Etapa 18)

Race-safe accept + evidência. Detalhe: `docs/adr/151-diligence-specialized-workflow.md`.

## ADR 152 — Cartório manual ≠ verificado; fees via provider (Etapa 19)

Sem integração fictícia. Detalhe: `docs/adr/152-registry-manual-not-verified.md`.
