# Roteiro

## Fase 1 — Fundação

Conta, organização, RBAC, auditoria, healthcheck, shell, design system inicial e documentação. Sem módulos operacionais.

## Etapa 0.1 — Auditoria da fundação

Revisão hostil da Fase 1: sessão, CSRF/Origin, último proprietário sob concorrência, auditoria na mesma transação, CSP inicial, remoção de dependências mortas e testes de endurecimento. Sem novos domínios de negócio.

## Etapa 1 — Identidade, autenticação e organizações

Verificação de e-mail, recuperação de senha, convites, multi-organização, sessões revogáveis, anti-enumeração e provider de e-mail `not_configured`. MFA e passkeys apenas preparados (ADR 012). Sem domínios jurídicos novos.

## Etapa 1.1 — RBAC e autorização

Policies centralizadas, matriz de permissões testada, profile self-update, reenvio de convites, `sessions.last_used_at`, documentação `docs/AUTHORIZATION.md`. Sem MFA/OAuth reais.

## Etapa 1.2 — Perfis profissionais

Perfis acumulativos (advogado, parceiro, colaborador por organização), visibilidade, estado de verificação profissional, vínculo opcional `organization_client_users`, stubs OAB/KYC/biometria (`NOT_CONFIGURED`). Sem marketplace nem validação externa real. Documentação: `docs/PROFILES.md`.

## Etapa 2 — CRM

Leads, clientes PF/PJ, contatos, tags, origens e canais por organização, anotações, interações, timeline, conversão transacional de lead. Sem processos, documentos ou tribunal. Documentação: `docs/CRM.md`.

## Etapa 2.1 — Atendimento e triagem

Atendimentos (`crm_intakes`), triagem 1:1, áreas jurídicas por organização, urgência informada, forma de atendimento distinta de canal, documentos iniciais com storage `NOT_CONFIGURED`, conversão reutilizando o CRM. Sem contratação/contrato (Etapa 2.2). Documentação: `docs/INTAKE_TRIAGE.md`.

## Etapa 2.2 — Pipeline comercial/jurídico

`crm_opportunities` orquestra Lead→Intake→Triage→Análise→Proposta→Contratação→Client→Case. Propostas versionadas (centavos), engajamento comercial, motivos de perda, núcleo mínimo de `legal_cases`. Sem assinatura digital, pagamentos ou processo judicial. Docs: `docs/PIPELINE.md`, `docs/CASES.md`.

## Etapa 3 — LegalMatter (Casos)

Evolução de `legal_cases` → `legal_matters` (rename seguro). Cadastro e gestão do agregado: referência interna, tipos de demanda, áreas/subáreas, partes, equipe, honorários contratuais (centavos/bps), tags, status, timeline operacional. UI `/app/casos`. Sem processos judiciais, financeiro operacional ou petições. Docs: `docs/LEGAL_MATTERS.md`.

## Etapa 3.1 — Processos judiciais

`judicial_processes` vinculados ao LegalMatter (0..N). CNJ com DV, catálogos globais `seed_dev`, partes/advogados processuais, fases, movimentações manuais, audiências, decisões, recursos, cumprimento, baixa/reabertura, timeline e proveniência. UI `/app/casos/[id]/processos`. Sem captura de tribunal, protocolo real ou prazos. Docs: `docs/JUDICIAL_PROCESSES.md`.

## Etapa 3.2 — Processos administrativos

`administrative_processes` vinculados ao LegalMatter (0..N). Órgãos `seed_dev`, número normalizado (≠ CNJ), protocolo manual ≠ confirmado pelo órgão, requerimentos, exigências, prazos, decisões, recursos, status machine, timeline e projeção no matter. UI `/app/casos/[id]/administrativos`. Sem integração com órgãos (`body_provider` = `NOT_CONFIGURED`). Docs: `docs/ADMINISTRATIVE_PROCESSES.md`.

## Etapa 4 — Documentos

`documents` ≠ `document_versions`. Categorias e pastas por org, vínculo `ownerType`/`ownerId`, ACL + RBAC, confidencialidade, hash SHA-256 (não assinatura), versionamento com idempotência, timeline, arquivamento soft (sem hard delete), campos `retentionUntil`/`legalHold` preparados sem automação. Docs: `docs/DOCUMENTS.md`.

## Etapa 4.1 — Upload seguro

Pacote `@verasjuris/storage`: `StorageProvider`, `LocalPrivateStorage` só em DEV, produção `NOT_CONFIGURED` sem S3, MIME por magic bytes, `DOCUMENT_MAX_UPLOAD_MB`, filename/path safety, hash, malware `NOT_CONFIGURED`, quarentena, download privado autenticado, compensação DB/storage. Docs: `docs/SECURE_UPLOAD.md`.

## Etapa 4.2 — Dossiê eletrônico

Projeção documental (sem entidade Dossier), classificação tipada, `document_links` como vínculos a recursos, UI de dossiê do caso/cliente/processo. Docs: `docs/DOSSIER.md`.

## Etapa 5 — Tarefas e SLA operacional

Tarefas com checklist, comentários sanitizados, dependências com ciclo, histórico, SLA operacional (≠ prazo jurídico). UI `/app/tarefas`. Docs: `docs/TASKS.md`.

## Etapa 5.1 — Agenda

`calendar_events` central, participantes, conflito (aviso), projeção de audiência via `judicialHearingId`, fuso IANA, sync externo `NOT_CONFIGURED`. UI `/app/agenda`. Docs: `docs/CALENDAR.md`.

## Etapa 5.2 — Prazos e notificações in-app

Prazos centrais sugeridos/confirmados, calculadora, alertas/escalonamento in-app, feriados `NOT_CONFIGURED`, vínculo `centralDeadlineId` com prazos administrativos. Pacote `@verasjuris/notifications`. UI `/app/prazos`. Docs: `docs/DEADLINES.md`, `docs/NOTIFICATIONS.md`.

## Etapa 6 — IA assistiva (núcleo, documentos, análise, oportunidades públicas)

Pacote `@verasjuris/ai` com gateway, OCR e oportunidades públicas como contratos. Persistência: requests/responses/usage/jobs/prompts/orçamentos; processamento documental; análise jurídica estruturada com revisão; oportunidades públicas manuais + modelo global.

**Defaults honestos:** `AI_PROVIDER=not_configured`, `OCR_PROVIDER=not_configured`, `PUBLIC_OPPORTUNITY_PROVIDER=not_configured`. Sem OpenAI, sem PNCP. Provedores de teste só em `@verasjuris/ai/testing`.

UI `/app/ia`. Docs: `docs/AI_CORE.md`, `docs/AI_PROVIDERS.md`, `docs/AI_PROMPTS.md`, `docs/AI_COSTS.md`, `docs/DOCUMENT_INTELLIGENCE.md`, `docs/LEGAL_AI_ANALYSIS.md`, `docs/PUBLIC_OPPORTUNITIES.md`. ADRs 058–070 em `docs/adr/`.

## Etapa 6.3 — IA revisora

Review sets, revisão assistida (`legal_review`), seções estruturadas, revisão humana item a item. **Não** auto-edita documentos. Docs: `docs/AI_REVIEW.md`. ADRs 071–072.

## Etapa 7 — Pesquisa jurídica

`ResearchGateway` + `LegalSourceProvider` (default `not_configured`), catálogo local, empty states sem inventar jurisprudência, doutrina só com licença. Docs: `docs/LEGAL_RESEARCH.md`, `docs/LEGAL_SOURCE_PROVIDERS.md`. ADRs 073–074, 077–078.

## Etapa 7.1 — Motor de citação

`CitationEngine`, status de verificação, anti-alucinação, sem auto-`verified`. Docs: `docs/CITATION_ENGINE.md`. ADRs 075–076.

## Etapa 8 — Leilões e due diligence assistiva

Módulo Auction (≠ PublicOpportunity ≠ marketplace de honorários), global vs tenant, centavos/bp, `AuctionProvider`/bid/mapa `not_configured`, checklist de due diligence assistivo. Docs: `docs/AUCTIONS.md`, `docs/AUCTION_DUE_DILIGENCE.md`. ADRs 079–084.

## Prompt 15 — Minutas, comparação, pós-leilão e dívida técnica

Modelos versionados (system/org), minutas com source set e workflow central até confirmação de protocolo **manual**, comparações jurídicas com proveniência, pós-leilão (participação, bid record, award, pagamentos sem gateway), fila local opt-in, reconciliação de storage detect-only, page mapping / OCR_USAGE honestos. Export PDF/DOCX, e-filing, CitationInsertion, browser smoke e PostgreSQL externo de homologação contínua: **não** afirmados. Docs: `docs/LEGAL_DOCUMENT_TEMPLATES.md`, `docs/LEGAL_DRAFTING.md`, `docs/LEGAL_DOCUMENT_WORKFLOW.md`, `docs/LEGAL_COMPARISON.md`, `docs/AUCTION_POST_SALE.md`, `docs/TECHNICAL_DEBT_CLOSURE.md`. ADRs 085–099.

## Prompt 16 — Previdenciário e trabalhista

Casos previdenciários e trabalhistas separados do LegalMatter; benefícios ≠ processo administrativo; requerimentos especializados; CNIS importável/revisável; cálculos determinísticos em `@verasjuris/calculations` com rule sets versionados e input snapshots; comparação de cenários (sem “melhor definitivo”); FGTS estimado ≠ saldo oficial; providers SocialSecurity/CNIS/eSocial/FGTS/LaborCourt **`NOT_CONFIGURED`**. Docs: `docs/PREVIDENTIARY.md`, `docs/PREVIDENTIARY_ADMIN_REQUESTS.md`, `docs/PREVIDENTIARY_CALCULATIONS.md`, `docs/CNIS.md`, `docs/LABOR.md`, `docs/LABOR_CALCULATIONS.md`, `docs/LABOR_LIQUIDATION.md`, `docs/SOCIAL_SECURITY_PROVIDERS.md`, `docs/LABOR_PROVIDERS.md`. ADRs 100–112.

## Etapas 11–13 — Tributário, núcleo multi-área e contratos

**Etapa 11 — Tributário:** `tax_cases`, obrigações/créditos/lançamentos, `TaxCalculationEngine`, `tax_rule_sets`, providers fiscais **`NOT_CONFIGURED`**. Docs: `docs/TAX.md`, `docs/TAX_CALCULATIONS.md`, `docs/TAX_PROVIDERS.md`. ADRs 117–118.

**Etapa 12 — Núcleo jurídico comum:** `legal_area_modules`, features, checklists, bindings, extensões por ramo (cível, penal, família, …), `versioned_rule_sets`. Docs: `docs/LEGAL_AREAS.md`, `docs/LEGAL_AREA_EXTENSION_MODEL.md` + guias por área. ADRs 113–116, 127.

**Etapa 13 — Contratos e assinatura:** CLM (`contracts`), versões imutáveis assinadas, cláusulas snapshot, aprovação, assinatura manual/provider stub, renovação/rescisão. Docs: `docs/CONTRACTS.md`, `docs/CONTRACT_SIGNATURES.md`, `docs/SIGNATURE_PROVIDERS.md`. ADRs 119–126.

Worker: jobs `TAX_*`, `CONTRACT_*`, `SIGNATURE_STATUS_SYNC`, `AREA_DOCUMENT_ANALYSIS` registrados só com `LocalInProcessQueueProvider` (stubs idempotentes).

## Etapas 14–16 — Portal, comunicação e advogado online

**Etapa 14 — Portal do cliente:** projection layer (`organization_client_users`, solicitações, conversas, ledger de pagamentos); leituras filtradas de casos/documentos/contratos/agenda/notificações; timeline `client_visible`. Docs: `docs/CLIENT_PORTAL.md`, `docs/CLIENT_PORTAL_SECURITY.md`. ADRs 128–131.

**Etapa 15 — Comunicação:** templates versionados, preferências, consent, outbox; worker `COMMUNICATION_DISPATCH` / `COMMUNICATION_RETRY`; canais externos **`NOT_CONFIGURED`**. Docs: `docs/COMMUNICATION.md`, `docs/COMMUNICATION_PROVIDERS.md`, `docs/COMMUNICATION_CONSENT.md`. ADRs 132–135.

**Etapa 16 — Advogado online:** `online_legal_requests`, matching determinístico, consultas, pagamento manual/provider stub, reviews pós-conclusão. Docs: `docs/ONLINE_LAWYER.md`, `docs/ONLINE_LAWYER_MATCHING.md`, `docs/ONLINE_CONSULTATIONS.md`, `docs/OAB_VERIFICATION.md`, `docs/PAYMENT_PROVIDER.md`. ADRs 136–143.

**Etapa 17 — Marketplace jurídico:** contratação estruturada (≠ Advogado Online). Categorias, serviços, requests, propostas versionadas, engagements, deliveries, disputes, reviews. Docs: `docs/MARKETPLACE.md`. ADR 144, 149–150.

**Etapa 17.1 — Verificação profissional:** cases OAB/CPF/identity/document/biometric; informed ≠ verified; CPF checksum ≠ identidade; biometria NOT_CONFIGURED; suspensão/revalidação. Docs: `docs/PROFESSIONAL_VERIFICATION.md`, `docs/IDENTITY_VERIFICATION.md`, `docs/BIOMETRIC_VERIFICATION.md`. ADRs 145–148.

**Etapa 18 — Correspondentes/diligências:** request→proposal→race-safe accept→execution→evidence→completion. Docs: `docs/DILIGENCES.md`, `docs/DILIGENCE_EVIDENCE.md`. ADR 151.

**Etapa 19 — Extrajudicial/cartórios:** orquestração sem integração fictícia; cartório manual ≠ verificado; FeeTable/Registry NOT_CONFIGURED. Docs: `docs/EXTRAJUDICIAL.md`, `docs/REGISTRY_PROVIDERS.md`, `docs/EXTRAJUDICIAL_FEES.md`. ADR 152. Migration `0016`.

Worker (LocalInProcess): `COMMUNICATION_*` (dispatch real), `ONLINE_MATCH_*`, `CONSULTATION_REMINDER` (noop), `PAYMENT_STATUS_SYNC`, `OAB_VERIFICATION`, `PUSH_DISPATCH` (sync externo honesto).

## Depois das etapas 6.3 / 7 / 7.1 / 8 / Prompts 15–16 / 11–13 / 14–16

1. Homologar migrations no PostgreSQL 16 via Docker quando o ambiente local tiver Docker disponível (**PostgreSQL externo: NÃO HOMOLOGADO** neste ciclo — ver `TECHNICAL_DEBT_CLOSURE.md`).
2. Object storage de produção (adapter real sobre `StorageProvider`) e scanner antimalware certificado (eliminar buffer integral residual do multipart).
3. Adapter de **assinatura eletrônica real** sobre `SignatureProvider` (CLM interno já existe; provider ainda `not_configured`).
4. MFA real (TOTP + recovery codes) e passkeys/WebAuthn.
5. Provedor de e-mail real (adapter sobre `@verasjuris/email`).
6. Calendário oficial de feriados e canais externos de notificação/comunicação (email/SMS/WhatsApp/push adapters `NOT_CONFIGURED` hoje — ver `docs/COMMUNICATION_PROVIDERS.md`).
7. Adapter de **provedor de IA real** (sobre `AIProvider` / gateway existente), OCR comercial e sync de oportunidades públicas (sobre `PublicOpportunityProvider`) — hoje `not_configured`.
8. Adapter de **fontes jurídicas oficiais** (sobre `LegalSourceProvider` / ResearchGateway), verificação remota de citações e **CitationInsertion** real — hoje stub `NOT_CONFIGURED`.
9. Adapter de **leilões públicos** (sobre `AuctionProvider`) e bid provider certificado — hoje sem lance real; bid records permanecem manuais.
10. E-filing / provider de protocolo real (hoje só protocolo informado manualmente) e export PDF/DOCX.
11. Adapters **INSS/CNIS**, **eSocial**, **FGTS oficial**, **tribunal trabalhista** e **fisco** (Federal/State/Municipal/Debt/Filing) sobre os contratos existentes — hoje `not_configured`.
12. Ledger e pagamentos idempotentes de plataforma, só com provedor oficial (≠ `auction_payments` operacional).
13. Marketplace, correspondentes, estudos e cartórios, cada um com cobertura verificável.
14. Operação interna VerasJuris: demandas, setores, SLAs e RACI.
15. Validação OAB assíncrona real (`OABVerificationProvider` + job `OAB_VERIFICATION`), KYC e biometria documental com provedores certificados (hoje `NOT_CONFIGURED` — ver `docs/OAB_VERIFICATION.md`).
16. Retenção/legal hold automatizados; remediação humana a partir dos findings de reconciliação (sem auto-delete).
17. Browser smoke / e2e homologado (**hoje: NÃO HOMOLOGADO**).
18. Regeneração segura de snapshots Drizzle `0001`–`0007` somente a partir de checkout + DB da época — nunca fabricar JSON.

## Fora do escopo agora

PSP real, ledger SaaS, peticionamento eletrônico real, integrações oficiais de tribunal/leilão/INSS/eSocial/FGTS/ONR, lance eletrônico real, validação OAB/KYC/biometria real, cursos e números de dashboard. **Implementado neste ciclo:** marketplace de contratação, verificação profissional (providers NOT_CONFIGURED), diligências, extrajudicial orquestrado — sem providers externos reais.

## Restrições

Não inventar API externa. Não executar ato jurídico crítico sem aprovação humana. Não criar tabela de módulo futuro só para “reservar lugar”. Não prometer cobertura de tribunais, cartórios ou resultado de causa.
