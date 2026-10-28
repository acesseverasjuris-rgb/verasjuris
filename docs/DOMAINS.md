# Domínios

Implementado nesta fase: identidade, organizações, autorização, auditoria, perfis profissionais, CRM, atendimento/triagem, pipeline, LegalMatter, processos judiciais e administrativos, documentos com upload seguro, dossiê (projeção), tarefas/SLA, agenda, prazos centrais com notificações in-app, núcleo de IA (persistência + gateway), inteligência documental, análise jurídica assistida, oportunidades públicas (cadastro manual), IA revisora, pesquisa jurídica (catálogo local + ResearchGateway), motor de citação, leilões (cadastro/interesses/due diligence), **modelos e minutas com workflow**, **comparações jurídicas**, **pós-leilão**, fechamento parcial de dívida técnica (fila local opt-in, reconciliação detect-only), **previdenciário** (casos, benefícios, CNIS, cálculos), **trabalhista** (casos, contratos, cálculos, liquidação), **tributário** (casos, cálculos, providers), **núcleo jurídico multi-área** (bindings, extensões por ramo) e **contratos/assinatura** (CLM interno, provider `not_configured`).

Os demais domínios estão previstos. Nenhum deles tem tabela, rota ou tela que simule funcionamento além do descrito abaixo. Provedores externos de IA, fontes jurídicas, leilão/lance, e-filing, INSS/CNIS, eSocial/FGTS e tribunal trabalhista permanecem `not_configured` até adapter real.

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
| PaymentProvider (consulta/portal) | Manual + adapter PSP; ≠ billing SaaS | Contrato (Etapas 14–16) |
| OABVerificationProvider | Verificação inscrição; default `not_configured` | Contrato (Etapas 14–16) |
| Marketplace, Correspondents | Marketplace amplo / correspondentes | Não implementado |
| Payments, Billing, Ledger, Payouts, Refunds, Disputes | Dinheiro e contestação de plataforma (≠ `auction_payments` / ledger portal / consulta) | Não implementado |
| Education, Courses | Estudos | Não implementado |
| Notary | Cartórios | Não implementado |
| Support | Atendimento ao usuário da plataforma | Não implementado |
| Compliance, HR, Suppliers, InternalOperations | Operação interna da Café Platine | Não implementado |
| Analytics, Integrations | Indicadores e conectores | Não implementado |

## Dependências permitidas

Identidade não depende de processo ou pagamento. Organização depende de identidade. Auditoria pode ser chamada por qualquer módulo que já exista, sem ler segredo. Integração futura entra por adaptador (`PaymentProvider`, `AIProvider`, `OCRProvider`, `PublicOpportunityProvider`, `LegalSourceProvider`, `AuctionProvider`, `AuctionBidProvider`, `MapProvider`, `StorageProvider`, `MalwareScannerProvider`, `CourtProvider`, `BodyProvider`, `IdentityProvider`, `NotificationProvider`, `HolidayCalendarProvider`, `SignatureProvider`, `DocumentExportProvider`, `SocialSecurityProvider`, `CNISProvider`, `ESocialProvider`, `FGTSProvider`, `LaborCourtProvider`, `FederalTaxProvider`, `StateTaxProvider`, `MunicipalTaxProvider`, `TaxDebtProvider`, `TaxFilingProvider`, `RegistryProvider`, `EnvironmentalDataProvider`, `ElectoralDataProvider`, `EmailProvider`, `SmsProvider`, `WhatsAppProvider`, `PushProvider`, `OABVerificationProvider`, `ConflictCheckProvider`, `VideoConferenceProvider`, `JobQueue`) e deve nascer como `NOT_CONFIGURED` / `not_configured` quando a API oficial não existir. `AIGateway`, `OCRProvider`, `PublicOpportunityProvider`, `ResearchGateway`/`LegalSourceProvider`, providers de leilão e providers previdenciário/trabalhista existem mas default **not_configured** (sem OpenAI/PNCP/tribunais/lance/INSS/eSocial). `StorageProvider`, `MalwareScannerProvider`, `NotificationProvider` (in-app) e `HolidayCalendarProvider` (`NOT_CONFIGURED`) já existem como contrato. Cálculos jurídicos usam `@verasjuris/calculations` (determinístico, sem LLM). `JobQueue` default `not_configured`; `LocalInProcessQueueProvider` só opt-in (ADR 098).

Um módulo novo não consulta a tabela de outro domínio se puder receber um identificador e autorizar pelo contexto da organização.
