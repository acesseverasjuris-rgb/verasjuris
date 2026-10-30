# Domínios

Implementado nesta fase: identidade, organizações, autorização, auditoria, perfis profissionais, CRM, atendimento/triagem, pipeline, LegalMatter, processos judiciais e administrativos, documentos com upload seguro, dossiê (projeção), tarefas/SLA, agenda, prazos centrais com notificações in-app, núcleo de IA (persistência + gateway), inteligência documental, análise jurídica assistida, oportunidades públicas (cadastro manual), IA revisora, pesquisa jurídica (catálogo local + ResearchGateway), motor de citação, leilões (cadastro/interesses/due diligence), **modelos e minutas com workflow**, **comparações jurídicas**, **pós-leilão**, fechamento parcial de dívida técnica (fila local opt-in, reconciliação detect-only), **previdenciário** (casos, benefícios, CNIS, cálculos), **trabalhista** (casos, contratos, cálculos, liquidação), **tributário** (casos, cálculos, providers), **núcleo jurídico multi-área** (bindings, extensões por ramo), **contratos/assinatura** (CLM interno, provider `not_configured`), **portal/comunicação/advogado online**, **marketplace/diligências/extrajudicial**, **educação jurídica** e **financeiro/ledger/pagamentos/split/tesouraria/monetização** (providers externos default `not_configured`).

Os demais domínios estão previstos. Nenhum deles tem tabela, rota ou tela que simule funcionamento além do descrito abaixo. Provedores externos de IA, fontes jurídicas, leilão/lance, e-filing, INSS/CNIS, eSocial/FGTS, tribunal trabalhista e PSP permanecem `not_configured` até adapter real.

| Domínio | Responsabilidade | Estado |
| --- | --- | --- |
| Identity | Conta, perfil, sessão, verificação de e-mail, recuperação | Implementado (etapa 1) |
| Profiles | Perfis profissionais acumulativos (advogado, parceiro, colaborador), verificação declarada, vínculo opcional User↔cliente comercial | Implementado (etapa 1.2) |
| Organizations | Organização, membership, convites, troca de contexto, papéis | Implementado (etapa 1) |
| CRM | Leads, clientes PF/PJ, contatos, tags, origens, canais, anotações, interações, timeline | Implementado (etapa 2) |
| Intake / Triage | Atendimentos, triagem, áreas jurídicas, urgência informada, documentos iniciais (storage stub) | Implementado (etapa 2.1) |
| Pipeline | Oportunidades, análise, proposta, contratação comercial, perda/arquivo | Implementado (etapa 2.2) |
| LegalMatter (Casos) | Unidade jurídica de trabalho: partes, equipe, honorários contratuais, timeline, catálogos | Implementado (etapa 3) |
| JudicialProcesses | Processos judiciais manuais vinculados ao LegalMatter (CNJ, partes, fases, movimentações, etc.) | Implementado (etapa 3.1) |
| AdministrativeProcesses | Processos administrativos manuais vinculados ao LegalMatter (órgãos, protocolo manual, exigências, prazos, etc.) | Implementado (etapa 3.2) |
| Documents | Documento lógico ≠ versão; categorias, pastas, ACL, confidencialidade, hash, arquivamento soft | Implementado (etapa 4) |
| SecureUpload / Storage | `StorageProvider`, local DEV, MIME/magic bytes, limites, download privado; malware `NOT_CONFIGURED` | Implementado (etapa 4.1) |
| Dossier | Projeção documental + classificação + links tipados | Implementado (etapa 4.2) |
| Tasks / SLA | Tarefas operacionais e SLA (≠ prazo jurídico) | Implementado (etapa 5) |
| Calendar | Agenda central; hearing projetado; sync externo `NOT_CONFIGURED` | Implementado (etapa 5.1) |
| Deadlines | Prazos centrais sugeridos/confirmados; feriados `NOT_CONFIGURED` | Implementado (etapa 5.2) |
| Notifications | In-app ready; e-mail/WhatsApp/SMS/push `NOT_CONFIGURED` | Implementado (etapa 5.2, in-app) |
| AI Core | Gateway, prompts, requests/usage/jobs, orçamentos; `AI_PROVIDER=not_configured` | Implementado (etapa 6) |
| DocumentIntelligence | Extração, páginas, classificação, metadados; OCR `not_configured` | Implementado (etapa 6) |
| LegalAIAnalysis | Análise estruturada + revisão; não altera processo/prazo automaticamente | Implementado (etapa 6) |
| PublicOpportunities | Manual + modelo global; `PUBLIC_OPPORTUNITY_PROVIDER=not_configured` (sem PNCP). Distinto de Auctions | Implementado (etapa 6) |
| AIReview (Legal Review) | Revisão assistida de conjuntos documentais; revisão humana; não auto-edita peças; `AI_PROVIDER=not_configured` | Implementado (etapa 6.3) |
| LegalResearch | Catálogo local + ResearchGateway; `LEGAL_SOURCE_PROVIDER=not_configured` (sem tribunais oficiais) | Implementado (etapa 7) |
| Citations | CitationEngine + status de verificação; sem auto-`verified` | Implementado (etapa 7.1) |
| Auctions | Leilões (≠ PublicOpportunity ≠ marketplace); centavos/bp; lance `not_configured` | Implementado (etapa 8) |
| AuctionDueDiligence | Checklist assistivo; não é parecer nem decisão automática | Implementado (etapa 8) |
| LegalDocumentTemplates | Modelos system/org versionados; variáveis com whitelist | Implementado (Prompt 15) |
| LegalDrafting | Minutas + source set; Draft ≠ Document; export PDF/DOCX `NOT_CONFIGURED` | Implementado (Prompt 15) |
| LegalDocumentWorkflow | Máquina draft→…→confirmed; filed manual ≠ provider | Implementado (Prompt 15) |
| LegalComparison | Comparação tipada com proveniência; distinta de análise/revisão | Implementado (Prompt 15) |
| AuctionPostSale | Participação, bid record, award, pagamentos manuais, entrega/transferência | Implementado (Prompt 15) |
| Previdentiary | Casos previdenciários, benefícios, períodos, CNIS revisável, requerimentos, perícias | Implementado (Prompt 16) |
| PrevidentiaryCalculations | Motores determinísticos (carência, qualidade, RMI, atrasados, cenários) em `@verasjuris/calculations` | Implementado (Prompt 16) |
| Labor | Casos trabalhistas, contratos/histórico, jornada, remuneração, FGTS informado, rescisão, pedidos | Implementado (Prompt 16) |
| LaborCalculations / Liquidation | Jornada, férias, FGTS estimado, rescisão, liquidação determinística | Implementado (Prompt 16) |
| SocialSecurity / Labor providers | Contratos INSS/CNIS/eSocial/FGTS/LaborCourt; default `not_configured` | Contrato (Prompt 16) |
| Tax | Casos tributários, obrigações, créditos, cálculos determinísticos | Implementado (Etapas 11–13) |
| TaxCalculations | Motores em `@verasjuris/calculations` (`TaxCalculationEngine`) | Implementado (Etapas 11–13) |
| Tax providers | Federal/State/Municipal/Debt/Filing; default `not_configured` | Contrato (Etapas 11–13) |
| LegalAreaCore | Módulos, features, checklists, bindings, extensões por ramo | Implementado (Etapas 11–13) |
| Contracts (CLM) | Contratos, versões, cláusulas, aprovação, renovação/rescisão | Implementado (Etapas 11–13) |
| ContractSignatures | Manual/wet ink + `SignatureProvider` default `not_configured` | Implementado (Etapas 11–13) |
| Area providers | Registry / Environmental / Electoral; default `not_configured` | Contrato (Etapas 11–13) |
| Audit | Trilha persistente das ações já existentes | Implementado |
| Security | Senha, sessão, limite e redação | Implementado |
| e-filing | Peticionamento real junto a tribunais | Não implementado (minutas/workflow internos: Prompt 15) |
| ClientPortal | Projection layer — vínculo User↔CRM, solicitações, conversas, ledger cliente | Implementado (Etapas 14–16) |
| Communication | Templates, preferências, consent, outbox omnichannel | Implementado (Etapas 14–16) |
| OnlineLawyer | Solicitação, match determinístico, consulta, review (≠ marketplace honorários) | Implementado (Etapas 14–16) |
| CommunicationProviders | Email/SMS/WhatsApp/Push via `@verasjuris/ai`; default `not_configured` | Contrato (Etapas 14–16) |
| PaymentProvider (consulta/portal/plataforma) | Manual + adapter PSP único; ledger SaaS em Finance | Contrato + uso (Etapas 14–16 + 21) |
| OABVerificationProvider | Verificação inscrição; default `not_configured` | Contrato (Etapas 14–16) |
| Marketplace, Correspondents / Diligences / Extrajudicial | Contratação, correspondentes, cartórios orquestrados | Implementado (Etapas 17–19; providers externos `not_configured`) |
| Education | Cursos, trilhas, matrículas, certificados (≠ ICP); media `not_configured` | Implementado (Etapa 20) |
| Finance / Billing / Subscriptions / Invoices | Planos, assinaturas, faturas, créditos comerciais, honorários/taxas/custos | Implementado (Etapa 21) |
| Ledger (double-entry) | Contas, transações, entries; saldo derivado; reversão | Implementado (Etapa 21.1) |
| Payments / Refunds / Payouts / Webhooks | Intents, payments, exactly-once→ledger; ≠ registros operacionais de domínio | Implementado (Etapa 21.2) |
| Split / Retentions / Payables | Regras versionadas → allocations → retentions → payables → payouts; ≠ PSP split | Implementado (Etapa 21.3) |
| Financial disputes / Chargebacks | Service ≠ payment dispute; hold; PaymentDisputeProvider not_configured | Implementado (Etapa 21.4) |
| Reconciliation / Treasury | Gateway≠Ledger≠Bank; AR/AP/delinquency; forecast deterministic ≠ actual | Implementado (Etapa 21.4) |
| Monetization | Products/prices, usage, AI credits≠tokens, API hash-only, licenses, WL branding | Implementado (Etapas 21.5 / 22) |
| Notary (integração ONR real) | Protocolo/cartório oficial | Não implementado (extrajudicial manual: Etapa 19) |
| Support | Atendimento ao usuário da plataforma | Não implementado |
| VerasJuris Control (Director/HR/Finance/Legal/Compliance/Vendors/Product) | Operação interna da organização | Schema + UI frontend (API em pouso); ADRs 192–199 |
| Analytics | Read model / dashboards / exports | Schema + UI; ADRs 200–203 |
| Workflows | Motor central de automações | Schema + UI; ADRs 204–211 |
| Integrations | Conectores externos genéricos | Não implementado |

## Dependências permitidas

Identidade não depende de processo ou pagamento. Organização depende de identidade. Auditoria pode ser chamada por qualquer módulo que já exista, sem ler segredo. Integração futura entra por adaptador (`PaymentProvider`, `PayoutProvider`, `PaymentDisputeProvider`, `BillingProvider`, `AIProvider`, `OCRProvider`, `PublicOpportunityProvider`, `LegalSourceProvider`, `AuctionProvider`, `AuctionBidProvider`, `MapProvider`, `StorageProvider`, `MalwareScannerProvider`, `CourtProvider`, `BodyProvider`, `IdentityProvider`, `NotificationProvider`, `HolidayCalendarProvider`, `SignatureProvider`, `DocumentExportProvider`, `SocialSecurityProvider`, `CNISProvider`, `ESocialProvider`, `FGTSProvider`, `LaborCourtProvider`, `FederalTaxProvider`, `StateTaxProvider`, `MunicipalTaxProvider`, `TaxDebtProvider`, `TaxFilingProvider`, `RegistryProvider`, `EnvironmentalDataProvider`, `ElectoralDataProvider`, `EmailProvider`, `SmsProvider`, `WhatsAppProvider`, `PushProvider`, `OABVerificationProvider`, `ConflictCheckProvider`, `VideoConferenceProvider`, `EducationMediaProvider`, `LiveClassProvider`, `FiscalDocumentProvider`, `ReconciliationProvider`, `BankingProvider`, `DebtCollectionProvider`, `TaxWithholdingProvider`, `CustomDomainProvider`, `LicenseProvider`, `JobQueue`) e deve nascer como `NOT_CONFIGURED` / `not_configured` quando a API oficial não existir. `AIGateway`, `OCRProvider`, `PublicOpportunityProvider`, `ResearchGateway`/`LegalSourceProvider`, providers de leilão, previdenciário/trabalhista, PSP/billing/payout/dispute/recon e mídia educacional existem mas default **not_configured** (sem OpenAI/PNCP/tribunais/lance/INSS/eSocial/Stripe). `StorageProvider`, `MalwareScannerProvider`, `NotificationProvider` (in-app) e `HolidayCalendarProvider` (`NOT_CONFIGURED`) já existem como contrato. Cálculos jurídicos usam `@verasjuris/calculations` (determinístico, sem LLM). `JobQueue` default `not_configured`; `LocalInProcessQueueProvider` só opt-in (ADR 098). Registros operacionais de pagamento (portal/consulta/leilão) ≠ ledger de plataforma; alocação interna ≠ split do PSP (`docs/FINANCE.md`, `docs/SPLIT.md`, `docs/LEDGER.md`, `docs/PAYMENT_PROVIDER.md`).

Um módulo novo não consulta a tabela de outro domínio se puder receber um identificador e autorizar pelo contexto da organização.

## VerasJuris Control / Analytics / Workflows

Domínios internos (Etapa 23+): operação da organização (`docs/CONTROL.md` e satélites), analytics como read model (`docs/ANALYTICS.md`) e automações (`docs/WORKFLOWS.md`). ADRs 192–211. UI sob `/app/control/*`. Não confundir com produto cliente nem com financeiro de plataforma (`docs/FINANCE.md`).


## Domínios transversais (Etapas 26–33)

Integrações, security-advanced, privacy_governance, observability/operation, i18n/jurisdictions, accessibility, assistant, institutional policies, enterprise. Não substituem domínios de negócio existentes; reforçam a plataforma.
