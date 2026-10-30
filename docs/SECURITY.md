# Segurança

## Autenticação

A senha é armazenada com scrypt (`N=16384`, `r=8`, `p=1`), com política de 12–128 caracteres. A sessão é um token aleatório de 32 bytes; o banco guarda apenas o SHA-256. O cookie `vj_session` é HttpOnly, `SameSite=Lax` e `Secure` em produção. A duração é de 14 dias. Entrada com conta inexistente, senha errada, pendente, suspensa ou desativada devolve a mesma mensagem. Cadastro, reenvio de verificação e recuperação de senha usam resposta anti-enumeração (mensagem e `emailDelivery` refletem o provider, não a existência da conta). Tokens de verificação, reset e convite são opacos, hashed e single-use. MFA e passkeys estão previstos (ADR 012) e não possuem fluxo nesta versão. A coluna `mfa_enabled` permanece falsa e não é apresentada como um recurso ligado.

Logout revoga a sessão no servidor. Sessão expirada, revogada ou de usuário desativado não autentica. O cookie de organização ativa (`vj_active_organization`) é limpo no fluxo de saída da interface e não autoriza sozinho.

## Autorização

As rotas sensíveis usam permissões (`organization.read`, `member.manage`, `role.assign`, `audit.read`, entre outras). Comparar `role === "admin"` não é o mecanismo do sistema. Sem participação ativa, a API responde 404. Com participação e sem permissão, responde 403. A página pode esconder um link; o servidor decide.

Papéis de sistema (`owner`, `administrator`, `member`) são globais. A tabela permite papéis por organização no futuro. Atribuir o papel de proprietário exige que o autor já seja proprietário. A organização não pode ficar sem um proprietário ativo: a checagem ocorre dentro da transação, com bloqueio das memberships ativas.

## Proteção das mutações

`POST`, `PATCH` e `DELETE` exigem o cabeçalho `x-verasjuris-request: 1`. Quando a requisição traz `Origin` ou `Referer`, o valor precisa coincidir com `WEB_ORIGIN`. Pedidos sem Origin (BFF, testes, clientes server-side) continuam aceitos se o cabeçalho de proteção estiver presente. O cookie `SameSite=Lax` reduz CSRF clássico de formulário cross-site. Isso não é um token CSRF rotativo por sessão.

O limite em memória reduz tentativas de cadastro por IP e de entrada por e-mail. Ele vive no processo da API. Com mais de uma instância, o limite precisa de um armazenamento compartilhado.

A API usa `trustProxy: true` porque o BFF local encaminha pedidos. Em implantação com proxy público, só o hop confiável deve ser aceito; caso contrário, `X-Forwarded-For` pode ser forjado e afetar rate limit e IP de auditoria. Atrás do proxy local, o IP visto pela API pode ser o da aplicação web.

## Segregação

Toda leitura e escrita de organização parte da conta autenticada e do identificador no caminho. Memberships são resolvidas com organização e identificador juntos. Não há filtro apenas no frontend.

LegalMatter (`/matters`, partes, equipe, honorários, tags, timeline) e catálogos jurídicos seguem a mesma regra: recurso de outra organização responde **404** (não 403), inclusive em IDOR por troca de IDs. Estar na equipe de um caso não concede permissões globais — RBAC continua em `permissions`/policies.

Processos judiciais aninhados (`/matters/:matterId/judicial-processes/:processId` e subrecursos) exigem que o processo pertença ao matter **e** à organização do caminho. OAB informada não implica verificação. Proveniência `manual` não deve ser apresentada como dado oficial de tribunal.

Processos administrativos seguem a mesma segregação. Protocolo/`confirmed` são registros internos — sem confirmação do órgão. `body_provider` permanece `NOT_CONFIGURED`.

Documentos: leitura/download exigem RBAC + regras de confidencialidade (e ACL quando aplicável). `storageKey` não aparece nas respostas. Download é stream autenticado; sem URL pública permanente.

## Segredos e logs

Segredos não entram no código. `.env.example` documenta o desenvolvimento. Logs usam Pino com redação de senha, token, cookie, autorização e campos correlatos. A auditoria também passa por redação antes de gravar JSON. Erros não tratados não enviam stack ao cliente.

## Auditoria

Eventos críticos ficam em `audit_events`. Mutações de organização, membership, login bem-sucedido e logout gravam o evento na mesma transação da mudança. Um gatilho impede `UPDATE` e `DELETE`. Isso é proteção append-only no banco, não imutabilidade absoluta de armazenamento. Logs operacionais podem ser rotacionados. A retenção e a proteção adicional da auditoria ainda não têm política de prazo.

## Cabeçalhos

A aplicação web envia `Content-Security-Policy` inicial, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` e `Permissions-Policy`. A CSP atual permite `unsafe-inline` e `unsafe-eval` em scripts para não quebrar o Next.js sem nonce. A API JSON mantém Helmet sem CSP de documento.

## Ameaças consideradas nesta fase

- IDOR entre organizações
- sessão forjada ou reaproveitada depois da saída
- enumeração de senha no login
- enumeração de e-mail no cadastro / recuperação / reenvio (resposta uniforme)
- CSRF em mutação com cookie
- vazamento de segredo em resposta de erro e no healthcheck
- alteração de trilha de auditoria
- permissão decidida só na interface
- rebaixamento concorrente do último proprietário
- spoofing de IP atrás de proxy não confiável

Upload de documentos (Etapa 4.1) usa `@verasjuris/storage`: MIME por magic bytes, limite `DOCUMENT_MAX_UPLOAD_MB`, sanitização de nome, chaves UUID sem traversal, hash SHA-256. Storage local só em desenvolvimento; produção sem provider real responde `NOT_CONFIGURED` (não há S3 nesta etapa). Documentos iniciais do intake (2.1) ainda usam stub próprio `NOT_CONFIGURED`. Ainda não há defesa SSRF de integrações ou replay de webhook.

## Dados sensíveis no CRM, perfis e atendimento (Etapas 1.2–2.1)

**CPF e CNPJ:** persistidos normalizados (`cpf_normalized`, `cnpj_normalized`). Respostas da API expõem apenas `cpfMasked` / `cnpjMasked` (últimos dígitos visíveis). Valores completos não são devolvidos em GET de cliente.

**Logs e auditoria:** metadados de auditoria de CRM (`crm.client_created`, `crm.lead_converted`, etc.) registram identificadores e status — não incluem CPF/CNPJ integral, conteúdo completo de anotações nem corpo de interações. Logs Pino seguem redação de segredos e tokens.

**Tenant:** consulta ou mutação de lead, cliente, atendimento, triagem, documento inicial, perfil de colaborador ou catálogo exige membership na organização do caminho. Recurso inexistente ou de outro tenant responde **404**, não 403, para não revelar existência cross-tenant (mesma regra da fundação). `tagIds`, `sourceId` e `channelId` são validados contra o tenant.

**Verificação profissional:** endpoints `/profiles/me/lawyer/verify` e `/profiles/me/identity/verify` retornam `NOT_CONFIGURED` (503). Nenhum dado biométrico é armazenado; o stub de biometria documental não grava imagens ou templates.

**Atendimento:** urgência é classificação informada — a UI não afirma confirmação de prazo. Auditoria de intake/triage registra status e ids, sem fatos jurídicos completos.

**Pipeline:** valores monetários em centavos inteiros; metadados de auditoria sem PII integral. Aceite de proposta e ativação de engajamento são idempotentes (CONFLICT em repetição). Cross-tenant em opportunity/proposal/case → 404.

## Upload e documentos (Etapas 4 / 4.1)

**Antivírus:** o scanner é `NotConfiguredMalwareScanner`. Não há ClamAV nem engine comercial. Uploads podem ficar `available` com `scanStatus=not_configured`. A interface deve informar a ausência de varredura — não afirmar arquivo “limpo”.

**Object storage:** `LocalPrivateStorageProvider` é DEV (`DEV_LOCAL`), fora de `apps/web/public`. Em produção o padrão é `not_configured`. Não há bucket AWS/GCS implementado.

**Download:** somente via API autenticada com `document.download`. Versões em quarentena/rejeitadas não baixam. URLs temporárias assinadas são opcionais no contrato e não estão ligadas a S3.

**Consistência:** put no storage precede a linha em `document_versions`; falha de DB deve compensar com `deleteObject`. Sem transação distribuída. Job `STORAGE_RECONCILIATION` só **detecta** inconsistências (`autoDelete: false` — ADR 099).

**Hash multipart:** SHA-256 progressivo por chunk; buffer integral residual permanece por causa do scanner síncrono (`docs/SECURE_UPLOAD.md`).

**Confidencialidade e ACL:** documentos `confidential` exigem papel elevado ou ACL explícita, além de `document.read`. Hash SHA-256 é integridade de conteúdo, não assinatura jurídica.

## Produtividade (Etapas 4.2–5.2)

**Comentários de tarefa:** sanitização para texto puro (remove tags HTML/`script`) antes de persistir — mitiga XSS armazenado.

**Prazos:** cálculo com feriados `NOT_CONFIGURED` permanece sugerido; confirmação é ato humano auditado. Alteração de data confirmada exige motivo no histórico.

**Notificações:** apenas canal in-app. E-mail/WhatsApp/SMS/push não são simulados. Com fila local opt-in, jobs `DEADLINE_ALERT_DISPATCH` / `AUCTION_ALERT_CHECK` disparam só in-app.

**Agenda:** conflitos de horário são avisos; sync externo `NOT_CONFIGURED`. Cross-tenant em tarefas/agenda/prazos/dossiê → **404**.

## IA assistiva (Etapa 6)

**Provedores:** `AI_PROVIDER`, `OCR_PROVIDER` e `PUBLIC_OPPORTUNITY_PROVIDER` default **`not_configured`**. Sem chamadas de rede a LLM/OCR/portais oficiais; status e erros (`AI_PROVIDER_NOT_CONFIGURED`, `OCR_PROVIDER_NOT_CONFIGURED`, `PUBLIC_OPPORTUNITY_PROVIDER_NOT_CONFIGURED`) são explícitos — a UI não inventa análise, texto OCR nem edital.

**Gateway obrigatório:** módulos usam `AIGateway`; não há import de SDK de vendor na API (ADR 058).

**Prompt injection:** texto de documento é **não confiável** — delimitadores e `SAFETY_INSTRUCTIONS` separam instruções do sistema do conteúdo do arquivo (ADR 066). Revisão humana antes de tratar saída como fato. O mesmo vale para conjuntos da IA revisora, editais de leilão, minutas assistidas e comparações.

**Variáveis de template:** resolução só com whitelist (`TemplateVariableResolver`); bloqueio de `__proto__` / `constructor` (ADR 087).

**Domínio crítico:** IA não altera status de matter/processo/prazo/pipeline automaticamente (ADR 065). Classificação, análise, revisão, comparação e assistência a minuta exigem permissões dedicadas e RBAC documental. Correções sugeridas pela revisora têm `autoEdit: false` — nunca reescrevem o binário. `ai_assisted` ≠ `approved` (ADR 091).

**Custos e logs:** usage em micros inteiros; auditoria `ai.requested` / `ai.completed` / `ai.failed` sem payload bruto do modelo nem segredos de API. Cross-tenant em análises, runs documentais e oportunidades → **404**.

**Orçamento:** estouro hard (`AI_BUDGET_EXCEEDED`, 402) bloqueia nova chamada na organização.

## Pesquisa, citações e leilões (Etapas 6.3 / 7 / 7.1 / 8)

**Source poisoning:** resultados de pesquisa e citações só entram com proveniência; catálogo local é a âncora de IDs. Provider externo futuro deve mapear a registros locais — itens sem mapeamento → `empty`, não IDs inventados (ADR 073, 077).

**LegalSourceProvider / AuctionProvider:** default `not_configured` (`LEGAL_SOURCE_PROVIDER_NOT_CONFIGURED`, `AUCTION_PROVIDER_NOT_CONFIGURED`). Sem sync oficial nem lance eletrônico real.

**SSRF (futuro):** quando houver fetch de `sourceUrl` / documentos de edital por URL, a implementação deverá usar **allowlist** de hosts e bloquear IPs privados/metadata — ainda não há cliente HTTP de fontes oficiais neste repositório. Até lá, cadastro manual exige URL https validada na entrada, sem fetch server-side genérico.

**Citação e XSS:** trechos (`excerpt`), títulos e `formattedCitation` / `copyText` são dados de usuário/fonte — persistidos e devolvidos como texto; a UI deve escapar HTML (mesmo padrão de comentários de tarefa). Status `verified` nunca é autoatribuído pelo motor (ADR 076).

**Leilões:** mutação de registro global bloqueada; interesses/due diligence tenant-bound. Estimativas monetárias em centavos/bp sem float. Endpoint de bid não afirma execução real. Bid records pós-venda são manuais; lance ao vivo permanece `AUCTION_BID_PROVIDER_NOT_CONFIGURED` (ADR 095). `auction_payments` sem gateway/PSP (ADR 097).

## Minutas, workflow e fila (Prompt 15)

**Protocolo:** `filed` manual ≠ confirmação de tribunal; `confirmed` exige evidência documental interna (ADR 092). Sem e-filing.

**Fila:** default `NotConfiguredJobQueue`. `LocalInProcessQueueProvider` só com flag explícita — não expor como fila de produção (ADR 098).

**Export:** PDF/DOCX `NOT_CONFIGURED`. Inserção automática de citação: stub `NOT_CONFIGURED`.

## Previdenciário e trabalhista (Prompt 16)

**Tenant:** casos, benefícios, CNIS, cálculos, contratos e liquidações seguem 404 cross-org. NIT/PIS mascarados no perfil previdenciário; valores em centavos inteiros.

**Providers:** `SocialSecurityProvider`, `CNISProvider`, `ESocialProvider`, `FGTSProvider`, `LaborCourtProvider` default `not_configured` — sem scraping Meu INSS/eSocial/Caixa/PJe-JT (ADR 112).

**Cálculo:** motores em `@verasjuris/calculations` (determinísticos); IA não executa nem aprova (ADR 103). Revisão humana obrigatória antes de tratar resultado como operacional. FGTS estimado nunca rotulado como saldo oficial (ADR 111). CNIS importado exige revisão por entrada (ADR 105).

**Protocolo previdenciário:** informado/manual ≠ confirmação do órgão (paralelo ADR 047 / 102).

## Tributário, multi-área e contratos (Etapas 11–13)

**Tenant:** casos tributários, extensões de área, contratos e pedidos de assinatura seguem 404 cross-org. Valores fiscais em centavos inteiros.

**Providers:** `FederalTaxProvider`, `StateTaxProvider`, `MunicipalTaxProvider`, `TaxDebtProvider`, `TaxFilingProvider`, `SignatureProvider`, `RegistryProvider`, `EnvironmentalDataProvider`, `ElectoralDataProvider` default `not_configured` — sem scraping Receita/SEFAZ/TSE/cartório.

**Confidencialidade:** bindings e extensões penal/médica/tributária/eleitoral usam `confidential` / `highly_restricted` quando aplicável (ADR 127). IA não reclassifica nem expõe conteúdo restrito.

**Assinatura:** provider não simula `signed`; manual/wet ink exige permissão `contract.record_signature` e evidência documental.

**Cálculo fiscal:** determinístico ≠ lançamento oficial; revisão humana antes de uso operacional (ADR 117–118).

**Worker:** `TAX_PROVIDER_SYNC` / `SIGNATURE_STATUS_SYNC` falham explicitamente sem adapter; fila distribuída default `not_configured` (ADR 098).

## Portal, comunicação e advogado online (Etapas 14–16)

**Portal:** deny-by-default — sem `organization_client_users` → 404; timeline `client_visible=false` até publicação staff; processos `secret` ocultos (ADRs 128–130). Ver `docs/CLIENT_PORTAL_SECURITY.md`.

**Comunicação:** marketing exige consent `opted_in`; providers externos default `not_configured`; outbox não simula entrega (ADRs 132–135). Mensagens `client_visible=false` ocultas do cliente.

**Advogado online:** documentos da solicitação só após match aceito (ADR 143); OAB `informed` ≠ `verified` (ADR 138); pagamento manual ≠ PSP (ADR 141). Jobs `PAYMENT_STATUS_SYNC`, `OAB_VERIFICATION`, `PUSH_DISPATCH` falham sem adapter.

## Educação e financeiro (Etapas 20–22)

**Educação:** matrícula `pending_payment` não libera conteúdo; gabarito (`isCorrect`) não exposto antes da submissão; certificado ≠ ICP (ADR 155); media/live/PDF `not_configured`.

**Pagamentos:** webhook com assinatura + anti-replay; redirect do frontend **nunca** confirma (ADR 166); manual exige `evidenceDocumentId` (ADR 168); Payment→Ledger exactly-once (ADR 167). `PaymentProvider` / `PayoutProvider` / `PaymentDisputeProvider` / `BillingProvider` / `ReconciliationProvider` / `BankingProvider` default `not_configured` — sem inventar paid/matched/won.

**Ledger / conciliação:** postagens imutáveis; correção só por reversão (ADRs 161–162); conciliação nunca muta ledger (ADR 182). Valores em centavos inteiros (ADR 170).

**Split / payout:** payable before payout (ADR 174); retention source explícita (ADR 175); dispute hold bloqueia repasse (ADR 180).

**Monetização:** API credentials só `secretHash` (ADR 188); white-label = branding, domínio via provider real (ADR 191); entitlements centralizados (ADRs 169, 185); AI credits ≠ tokens do provider (ADR 186).

## LGPD

A conta guarda nome, e-mail e hash de senha para autenticação. IP e identificador de navegador podem aparecer em sessão e auditoria para segurança. Não há, nesta versão, exportação, retificação além do nome da organização, anonimização ou exclusão automatizada. Esses direitos precisam de um fluxo próprio antes de tratar dados de processos ou documentos.

## VerasJuris Control / Analytics / Workflows

Domínios internos (Etapa 23+): operação da organização (`docs/CONTROL.md` e satélites), analytics como read model (`docs/ANALYTICS.md`) e automações (`docs/WORKFLOWS.md`). ADRs 192–211. UI sob `/app/control/*`. Não confundir com produto cliente nem com financeiro de plataforma (`docs/FINANCE.md`).


## Segurança avançada (Etapa 27+)

MFA TOTP (recovery hash-only), passkeys, device/session management, field encryption, secrets, WAF/SIEM abstractions, security events/alerts, vulnerability/pentest records. Ver `ADVANCED_SECURITY.md`, `MFA.md`, ADRs 216–221.
