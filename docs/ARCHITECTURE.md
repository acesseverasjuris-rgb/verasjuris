# Arquitetura

O VerasJuris nasce como monólito modular em TypeScript, organizado em monorepo pnpm. Aplicações e pacotes compartilham contratos, mas cada domínio entra no código quando houver persistência e comportamento reais.

## Aplicações

- `apps/web`: Next.js com App Router. Páginas públicas e o shell autenticado. O navegador fala com `/api/v1`, e um proxy da aplicação web encaminha para a API, preservando o cookie de sessão.
- `apps/api`: Fastify em `/v1` e healthcheck em `/health` e `/v1/health`. Autenticação, verificação de e-mail, recuperação, sessões, organizações, convites, auditoria, **perfis** (`modules/profiles`), **CRM** (`modules/crm`), **atendimento/triagem** (`modules/intake`), **pipeline** (`modules/pipeline`), **casos** (`modules/matters`), **processos judiciais** (`modules/judicial`), **processos administrativos** (`modules/administrative`), **documentos** (`modules/documents`), **dossiê** (`modules/dossier`), **tarefas** (`modules/tasks`), **agenda** (`modules/calendar`), **prazos** (`modules/deadlines`), **IA** (`modules/ai`), **inteligência documental** (`modules/document-intelligence`), **análise jurídica assistida** (`modules/legal-analysis`), **oportunidades públicas** (`modules/public-opportunities`), **IA revisora** (`modules/legal-review`), **pesquisa jurídica** (`modules/legal-research`), **citações** (`modules/citations`), **leilões** (`modules/auctions`), **modelos** (`modules/legal-templates`), **minutas** (`modules/legal-drafts`), **comparações** (`modules/legal-comparisons`), **pós-leilão** (`modules/auction-post`), **previdenciário** (`modules/previdentiary`), **trabalhista** (`modules/labor`), **tributário** (`modules/tax`), **contratos** (`modules/contracts`), **módulos de área** (`modules/legal-areas`), **portal do cliente** (`modules/client-portal`), **comunicação** (`modules/communication`), **advogado online** (`modules/online-lawyer`), **educação** (`modules/education`) e **financeiro/ledger/pagamentos/split/tesouraria/monetização** (`modules/finance`).
- `apps/worker`: processo separado com healthcheck; fila genérica `not_configured` por padrão; `LocalInProcessQueueProvider` **opt-in** (`FEATURE_LOCAL_QUEUE` / `LOCAL_QUEUE=enabled` — ADR 098); handlers de IA (`ai-jobs.ts`), alertas in-app, reconciliação de storage (detect-only), stubs prev/tax/contrato (`tax-contract-handlers.ts`), outbox de comunicação (`communication-handlers.ts`), jobs advogado online (`online-lawyer-handlers.ts`) e handlers educação/financeiro (`education-finance-handlers.ts`) quando registrados.

## Pacotes

- `packages/database`: schema Drizzle, migrations, cliente PostgreSQL e seed.
- `packages/auth`: leitura de sessão e decisões de autorização.
- `packages/audit`: gravação do evento, com redação de campos sensíveis.
- `packages/email`: provider de e-mail (`not_configured` | `memory`); sem integração comercial nesta etapa.
- `packages/security`: senha, token de sessão, tokens opacos, limite em memória e redação.
- `packages/storage`: `StorageProvider`, storage local privado (DEV), hasher SHA-256, MIME/magic bytes e scanner de malware `NOT_CONFIGURED`. Sem S3/GCS.
- `packages/notifications`: `NotificationProvider` (in-app), feriados `NOT_CONFIGURED`, calculadora de prazos.
- `packages/validation`: schemas de entrada.
- `packages/types`: erros e catálogo de permissões.
- `packages/config`: ambiente (inclui `DOCUMENT_MAX_UPLOAD_MB`, `STORAGE_PROVIDER`), logs, health e feature flags.
- `packages/events`: barramento em processo e contrato de fila (`NotConfiguredJobQueue` | `LocalInProcessQueueProvider` opt-in). A API publica eventos após o commit; assinantes de produção ainda não são o caminho padrão.
- `packages/ai`: `AIGateway`, OCR, oportunidades públicas, `ResearchGateway` / `LegalSourceProvider`, `CitationEngine` (+ stub `CitationInsertion`), contratos de leilão (`AuctionProvider` / bid / mapa), providers previdenciários/trabalhistas (`SocialSecurityProvider`, `CNISProvider`, `ESocialProvider`, `FGTSProvider`, `LaborCourtProvider`), providers tributários (`FederalTaxProvider`, …), assinatura (`SignatureProvider`), registro/ambiental/eleitoral (`RegistryProvider`, `EnvironmentalDataProvider`, `ElectoralDataProvider`), **comunicação** (`EmailProvider`, `SmsProvider`, `WhatsAppProvider`, `PushProvider` + channel adapters), **advogado online / PSP** (`PaymentProvider`, `OABVerificationProvider`, `ConflictCheckProvider`, `VideoConferenceProvider`), **educação** (`EducationMediaProvider`, `LiveClassProvider`), **financeiro** (`BillingProvider`, `FiscalDocumentProvider`, `ReconciliationProvider`, `PayoutProvider`, `PaymentDisputeProvider`, `BankingProvider`, `DebtCollectionProvider`, `TaxWithholdingProvider`, `CustomDomainProvider`, `LicenseProvider`), motor seguro de variáveis de template, extração de texto (page mapping honesto), schemas Zod (classificação, análise, revisão, comparação, leilão). Padrão `AI_PROVIDER` / `LEGAL_SOURCE_PROVIDER` / providers externos = `not_configured`. API e testes importam o pacote; produção não instancia OpenAI/PNCP/tribunais/INSS/eSocial/Receita/DocuSign/PSP/OAB.
- `packages/calculations`: motores determinísticos previdenciários, trabalhistas e tributários (centavos, rule sets versionados, snapshots); sem DB/IA/Fastify.
- `packages/ui`: tokens e componentes alinhados ao Manual da Marca.

Marketplace, tribunais e e-filing seguem limites em `docs/DOMAINS.md`. Financeiro/ledger/pagamentos/split/tesouraria/monetização e educação estão em `modules/finance` e `modules/education` (schemas `finance.ts` / `monetization.ts` / `education.ts`) — distintos dos registros operacionais de portal/consulta/leilão (`docs/FINANCE.md`, `docs/PAYMENT_PROVIDER.md`).

## Fluxo

1. O navegador envia o pedido ao Next em `/api/v1`.
2. O proxy repassa método, corpo, cookie e cabeçalho `x-verasjuris-request`.
3. A API valida o corpo, reconhece a sessão pelo hash do cookie e autoriza pela participação na organização do caminho.
4. A mutação e o evento de auditoria entram na mesma transação.
5. Depois do commit, um evento em memória pode notificar código futuro. Ele não substitui a auditoria.

Consultas do servidor Next falam direto com `API_INTERNAL_URL`.

## Módulos de negócio (Etapas 1.2–8 + Prompts 15–16)

- **Perfis** (`apps/api/src/modules/profiles/`): advogado, parceiro, colaborador por organização, estado de verificação profissional e stubs OAB/KYC/biometria (`NOT_CONFIGURED`). Schema em `packages/database/src/schema/profiles.ts`. Documentação: `docs/PROFILES.md`.
- **CRM** (`apps/api/src/modules/crm/`): leads, clientes PF/PJ, contatos, tags, origens, canais, anotações, interações e timeline. Schema em `packages/database/src/schema/crm.ts`. Catálogo padrão semeado por organização em `catalog.ts`. Documentação: `docs/CRM.md`.
- **Atendimento / triagem** (`apps/api/src/modules/intake/`): `crm_intakes`, `crm_triages`, `legal_areas`, documentos iniciais com storage stub. Schema em `packages/database/src/schema/intake.ts`. Documentação: `docs/INTAKE_TRIAGE.md`.
- **Pipeline** (`apps/api/src/modules/pipeline/`): `crm_opportunities`, análises, propostas, engajamentos, motivos de perda; vínculo opcional a LegalMatter via `case_id`. Docs: `docs/PIPELINE.md`.
- **LegalMatter / Casos** (`apps/api/src/modules/matters/`): agregado central de trabalho jurídico (`legal_matters`, partes, equipe, honorários contratuais, timeline, catálogos de demanda/subárea). Schema em `packages/database/src/schema/matters.ts`. Docs: `docs/LEGAL_MATTERS.md`.
- **Processos judiciais** (`apps/api/src/modules/judicial/`): `judicial_processes` 0..N por matter; CNJ, catálogos globais `seed_dev`, partes/advogados processuais, fases, movimentações, audiências, decisões, recursos, cumprimento, timeline. Schema em `packages/database/src/schema/judicial.ts`. Docs: `docs/JUDICIAL_PROCESSES.md`. Sem integração com tribunais.
- **Processos administrativos** (`apps/api/src/modules/administrative/`): `administrative_processes` 0..N por matter; órgãos `seed_dev`, número normalizado (≠ CNJ), protocolo manual, requerimentos, exigências, prazos, decisões, recursos, timeline. Schema em `packages/database/src/schema/administrative.ts`. Docs: `docs/ADMINISTRATIVE_PROCESSES.md`. Sem integração com órgãos (`body_provider` = `NOT_CONFIGURED`).
- **Documentos** (`apps/api/src/modules/documents/`): `documents` ≠ `document_versions`; categorias, pastas, ACL, confidencialidade, hash SHA-256, download privado. Schema em `packages/database/src/schema/documents.ts`. Docs: `docs/DOCUMENTS.md`, `docs/SECURE_UPLOAD.md`.
- **Dossiê** (`apps/api/src/modules/dossier/`): projeção documental + classificação + `document_links`. Docs: `docs/DOSSIER.md`.
- **Tarefas** (`apps/api/src/modules/tasks/`): tarefas, checklist, comentários, dependências, SLA operacional. Schema em `packages/database/src/schema/productivity.ts`. Docs: `docs/TASKS.md`.
- **Agenda** (`apps/api/src/modules/calendar/`): `calendar_events`, conflitos (aviso), projeção de audiência. Docs: `docs/CALENDAR.md`.
- **Prazos** (`apps/api/src/modules/deadlines/`): prazos centrais sugeridos/confirmados, alertas in-app, feriados `NOT_CONFIGURED`. Docs: `docs/DEADLINES.md`, `docs/NOTIFICATIONS.md`.
- **IA** (`apps/api/src/modules/ai/`): status, prompts versionados, requests/usage/jobs, orçamentos em micros. Schema `packages/database/src/schema/ai.ts`. Docs: `docs/AI_CORE.md`, `docs/AI_PROVIDERS.md`, `docs/AI_PROMPTS.md`, `docs/AI_COSTS.md`.
- **Inteligência documental** (`modules/document-intelligence/`): runs de processamento, páginas, classificação, metadados, busca em segmentos. Schema `document-intelligence.ts`. Doc: `docs/DOCUMENT_INTELLIGENCE.md`. OCR `OCR_PROVIDER=not_configured` por padrão.
- **Análise jurídica assistida** (`modules/legal-analysis/`): `legal_ai_analyses` + seções normalizadas, revisão humana. Doc: `docs/LEGAL_AI_ANALYSIS.md`.
- **Oportunidades públicas** (`modules/public-opportunities/`): cadastro manual, interesses tenant; provider externo `PUBLIC_OPPORTUNITY_PROVIDER=not_configured`. Doc: `docs/PUBLIC_OPPORTUNITIES.md`. Distinto de leilões.
- **IA revisora** (`modules/legal-review/`): review sets, revisão assistida, revisão humana; **não** auto-edita documentos. Doc: `docs/AI_REVIEW.md`.
- **Pesquisa jurídica** (`modules/legal-research/`): catálogo local + `ResearchGateway`; `LEGAL_SOURCE_PROVIDER=not_configured` por padrão. Doc: `docs/LEGAL_RESEARCH.md`, `docs/LEGAL_SOURCE_PROVIDERS.md`.
- **Citações** (`modules/citations/`): `CitationEngine`, status de verificação; sem auto-`verified`. Doc: `docs/CITATION_ENGINE.md`.
- **Leilões** (`modules/auctions/`): cadastro/interesses/due diligence; `AuctionProvider` e lance `not_configured`. Docs: `docs/AUCTIONS.md`, `docs/AUCTION_DUE_DILIGENCE.md`.
- **Modelos jurídicos** (`modules/legal-templates/`): templates system/org versionados; variáveis com whitelist. Doc: `docs/LEGAL_DOCUMENT_TEMPLATES.md`.
- **Minutas** (`modules/legal-drafts/`): drafts, source set, checklist, workflow até confirmação de protocolo manual. Docs: `docs/LEGAL_DRAFTING.md`, `docs/LEGAL_DOCUMENT_WORKFLOW.md`.
- **Comparações** (`modules/legal-comparisons/`): confronto tipado com proveniência; distinta de análise/revisão. Doc: `docs/LEGAL_COMPARISON.md`.
- **Pós-leilão** (`modules/auction-post/`): participação, bid record, award, pagamentos manuais, entrega/transferência. Doc: `docs/AUCTION_POST_SALE.md`.
- **Previdenciário** (`modules/previdentiary/`): `previdentiary_cases`, benefícios, períodos, CNIS revisável, requerimentos sobre processo administrativo, perícias, cálculos determinísticos. Schema `previdentiary.ts`. Docs: `docs/PREVIDENTIARY.md`, `docs/CNIS.md`, `docs/PREVIDENTIARY_CALCULATIONS.md`, `docs/SOCIAL_SECURITY_PROVIDERS.md`. Providers INSS/CNIS = `not_configured`.
- **Trabalhista** (`modules/labor/`): `labor_cases`, contratos/histórico, jornada, remuneração, FGTS informado, rescisão, pedidos, liquidação. Schema `labor.ts`. Docs: `docs/LABOR.md`, `docs/LABOR_CALCULATIONS.md`, `docs/LABOR_LIQUIDATION.md`, `docs/LABOR_PROVIDERS.md`. eSocial/FGTS/tribunal = `not_configured`.
- **Tributário** (`modules/tax/`): `tax_cases`, obrigações, créditos, lançamentos, cálculos determinísticos. Schema `tax.ts`. Docs: `docs/TAX.md`, `docs/TAX_CALCULATIONS.md`, `docs/TAX_PROVIDERS.md`. Providers fiscais = `not_configured`.
- **Contratos** (`modules/contracts/`): ciclo CLM, cláusulas, aprovação, assinatura manual/provider, renovação/rescisão. Schema `contracts.ts`. Docs: `docs/CONTRACTS.md`, `docs/CONTRACT_SIGNATURES.md`, `docs/SIGNATURE_PROVIDERS.md`.
- **Módulos de área** (`modules/legal-areas/`): núcleo comum + extensões cível/consumidor/família/… Schema `legal-areas.ts`. Docs: `docs/LEGAL_AREAS.md` e guias por ramo. ADRs 113–127.
- **Portal do cliente** (`modules/client-portal/`): projection layer — solicitações, documentos, conversas, pagamentos do cliente, leituras filtradas de matter/document/contract/agenda/notificação. Schema `client-portal.ts`. Docs: `docs/CLIENT_PORTAL.md`, `docs/CLIENT_PORTAL_SECURITY.md`. ADRs 128–131.
- **Comunicação** (`modules/communication/`): templates, preferências, consent, outbox + dispatch. Schema `communication.ts`. Docs: `docs/COMMUNICATION.md`, `docs/COMMUNICATION_PROVIDERS.md`, `docs/COMMUNICATION_CONSENT.md`. ADRs 132–135.
- **Advogado online** (`modules/online-lawyer/`): solicitação, match determinístico, consulta, pagamento manual/provider stub. Schema `online-lawyer.ts`. Docs: `docs/ONLINE_LAWYER.md`, `docs/ONLINE_LAWYER_MATCHING.md`, `docs/ONLINE_CONSULTATIONS.md`, `docs/OAB_VERIFICATION.md`, `docs/PAYMENT_PROVIDER.md`. ADRs 136–143.
- **Educação** (`modules/education/`): cursos, trilhas, matrículas, progresso, quizzes, certificados (≠ ICP), biblioteca. Schema `education.ts`. Media/live/PDF default `not_configured`. Docs: `docs/EDUCATION.md` e satélites. ADRs 153–156.
- **Financeiro / Ledger / Pagamentos / Split / Tesouraria / Monetização** (`modules/finance/`): planos, assinaturas, invoices, créditos, honorários/taxas/custos, ledger double-entry, payments/webhooks/refunds, split rules→allocations→retentions→payables→payouts, disputas/chargebacks, conciliação (gateway≠ledger≠bank), tesouraria (AR/AP/delinquency/forecast), monetização (usage, AI credits, API hash-only, licenses, white-label branding). Schemas `finance.ts` + `monetization.ts`. Providers PSP/billing/payout/dispute/recon/bank/domain default `not_configured`. Docs: `docs/FINANCE.md`, `docs/SPLIT.md`, `docs/TREASURY.md`, `docs/MONETIZATION.md`, … ADRs 157–191.

Módulos respeitam o tenant no caminho (`/organizations/:organizationId/…` quando aplicável), autorização por permissão e auditoria nas mutações críticas. IA **não** muta domínio crítico automaticamente (ADR 065); cálculos jurídicos usam `@verasjuris/calculations` (ADR 103). Dívida técnica e limites honestos: `docs/TECHNICAL_DEBT_CLOSURE.md`.

## Banco

PostgreSQL é a fonte de verdade. O ORM é o Drizzle. As migrations ficam em `packages/database/drizzle` e são a única forma prevista de mudar a estrutura.

## Multi-organização

Uma pessoa tem uma conta. A participação (`organization_members`, conceito Membership) liga a conta a uma organização e carrega papéis. Papéis de sistema são globais; a permissão só vale dentro da participação. A organização ativa no cookie é só contexto de navegação; autorização sempre revalida membership no servidor. Detalhes em `docs/IDENTITY.md`.

## Escalabilidade

Fila, armazenamento e provedores externos entram por contratos (`JobQueue`, `AIGateway`, `OCRProvider`, `PublicOpportunityProvider`, `ResearchGateway`/`LegalSourceProvider`, `AuctionProvider`, `AuctionBidProvider`, `MapProvider`, `StorageProvider`, `MalwareScannerProvider`, `SocialSecurityProvider`, `CNISProvider`, `ESocialProvider`, `FGTSProvider`, `LaborCourtProvider`, `PaymentProvider`, `PayoutProvider`, `PaymentDisputeProvider`, `BillingProvider`, `EducationMediaProvider`, `LiveClassProvider`, `FiscalDocumentProvider`, `ReconciliationProvider`, `BankingProvider`, `DebtCollectionProvider`, `TaxWithholdingProvider`, `CustomDomainProvider`, `LicenseProvider`). IA/OCR/oportunidades/fontes jurídicas/leilões/previdenciário-trabalhista/PSP/billing/payout/dispute/recon/bank/domínio/mídia educacional default `not_configured` (sem OpenAI/PNCP/tribunais/lance real/INSS/eSocial/FGTS oficial/Stripe). Fila default `not_configured`; fila in-process só com flag explícita (ADR 098) — **não** é broker. Object storage local é só desenvolvimento; produção sem provider real permanece `NOT_CONFIGURED`. Reconciliação DB↔storage é detect-only (ADR 099); conciliação financeira de ledger é contrato separado e **não muta** ledger (`docs/FINANCIAL_RECONCILIATION.md`, ADRs 181–182). Separar um serviço no futuro não exige outro modelo de identidade. Até lá, o worker permanece no mesmo repositório.
