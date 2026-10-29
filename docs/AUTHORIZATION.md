# Autorização — VerasJuris

## Modelo

```
User
 → OrganizationMember (Membership)
   → MembershipRole
     → Role (system: owner | administrator | member)
       → RolePermission
         → Permission
```

Membership = `organization_members`. Não há tabela `Membership` separada.

## Fluxo

1. `authenticate` — sessão válida + usuário `active` + e-mail verificado  
2. `resolveMembership` — participação no tenant do recurso  
3. `authorize(permission)` — `authorizeAccess` / `policyRequirePermission`  
4. Policy específica — last owner, convite com papel, atribuição de roles, sessão própria  
5. Ação + auditoria na mesma transação

A organização ativa (cookie) é só contexto de navegação. Nunca autoriza sozinha.

## Permissions atuais

| Permission | Owner | Administrator | Member |
| --- | --- | --- | --- |
| organization.read | sim | sim | sim |
| organization.update | sim | sim | não |
| member.read | sim | sim | sim |
| member.manage | sim | sim | não |
| member.invite | sim | sim | não |
| role.read | sim | sim | não |
| role.assign | sim | não | não |
| audit.read | sim | sim | não |
| profiles.read | sim | sim | não |
| profiles.update_self | sim | sim | sim |
| profiles.manage | sim | sim | não |
| crm.read | sim | sim | sim |
| crm.create | sim | sim | sim |
| crm.update | sim | sim | sim |
| crm.delete | sim | sim | não |
| crm.assign | sim | sim | não |
| crm.manage_tags | sim | sim | não |
| crm.manage_sources | sim | sim | não |
| crm.manage_channels | sim | sim | não |
| crm.read_notes | sim | sim | sim |
| crm.write_notes | sim | sim | sim |
| intake.read | sim | sim | sim |
| intake.create | sim | sim | sim |
| intake.update | sim | sim | sim |
| intake.assign | sim | sim | não |
| intake.close | sim | sim | não |
| intake.convert | sim | sim | não |
| triage.read | sim | sim | sim |
| triage.create | sim | sim | sim |
| triage.update | sim | sim | sim |
| triage.review | sim | sim | não |
| legal_area.manage | sim | sim | não |
| document_initial.read | sim | sim | sim |
| document_initial.upload | sim | sim | não |
| pipeline.read | sim | sim | sim |
| pipeline.manage | sim | sim | não |
| pipeline.move | sim | sim | sim |
| analysis.read | sim | sim | sim |
| analysis.manage | sim | sim | sim |
| proposal.read | sim | sim | sim |
| proposal.create | sim | sim | sim |
| proposal.approve | sim | sim | não |
| proposal.send | sim | sim | não |
| engagement.read | sim | sim | sim |
| engagement.manage | sim | sim | não |
| matter.read | sim | sim | sim |
| matter.create | sim | sim | sim |
| matter.update | sim | sim | sim |
| matter.assign | sim | sim | sim |
| matter.manage_team | sim | sim | não |
| matter.manage_parties | sim | sim | sim |
| matter.manage_fees | sim | sim | não |
| matter.manage_tags | sim | sim | sim |
| matter.close | sim | sim | não |
| matter.archive | sim | sim | não |
| judicial_process.read | sim | sim | sim |
| judicial_process.create | sim | sim | sim |
| judicial_process.update | sim | sim | sim |
| judicial_process.manage_parties | sim | sim | sim |
| judicial_process.manage_lawyers | sim | sim | sim |
| judicial_process.manage_phase | sim | sim | sim |
| judicial_process.manage_movements | sim | sim | sim |
| judicial_process.manage_hearings | sim | sim | sim |
| judicial_process.manage_decisions | sim | sim | sim |
| judicial_process.manage_appeals | sim | sim | sim |
| judicial_process.manage_enforcement | sim | sim | sim |
| judicial_process.close | sim | sim | não |
| judicial_process.reopen | sim | sim | não |
| judicial_catalog.manage | sim | sim | não |
| administrative_process.read | sim | sim | sim |
| administrative_process.create | sim | sim | sim |
| administrative_process.update | sim | sim | sim |
| administrative_process.assign | sim | sim | não |
| administrative_process.manage_requests | sim | sim | sim |
| administrative_process.manage_requirements | sim | sim | sim |
| administrative_process.manage_deadlines | sim | sim | sim |
| administrative_process.manage_decisions | sim | sim | sim |
| administrative_process.manage_appeals | sim | sim | sim |
| administrative_process.close | sim | sim | não |
| administrative_process.reopen | sim | sim | não |
| administrative_catalog.manage | sim | sim | não |
| document.read | sim | sim | sim |
| document.create | sim | sim | sim |
| document.update | sim | sim | sim |
| document.upload_version | sim | sim | sim |
| document.download | sim | sim | sim |
| document.manage_acl | sim | sim | não |
| document.archive | sim | sim | não |
| document.restore | sim | sim | não |
| document_category.manage | sim | sim | não |
| document_folder.manage | sim | sim | não |

Fonte: `packages/types/src/permissions.ts` (`ROLE_PERMISSIONS`).

### Perfis (`profiles.*`)

- `profiles.update_self`: titular atualiza advogado, parceiro e próprio colaborador; exige membership ativa em alguma organização com essa permissão (papel `member`).
- `profiles.read`: listar colaboradores da organização (`GET …/profiles/employees`).
- `profiles.manage`: administradores e proprietários; mesma família de rotas de gestão ampliada.

Atualização de `verificationStatus` para `verified` é sempre negada até existir provedor real (`policyProfessionalVerificationStatus`).

### CRM (`crm.*`)

- Leitura geral (`crm.read`): overview, leads, clientes, contatos, catálogo, timeline de interações.
- Escrita operacional (`crm.create`, `crm.update`): membros podem criar e editar; exclusão/arquivamento amplo reservado a papéis elevados (`crm.delete` só owner/administrator).
- Atribuição (`crm.assign`), tags (`crm.manage_tags`), origens (`crm.manage_sources`) e canais (`crm.manage_channels`): owner e administrator.
- Anotações: leitura na timeline com `crm.read_notes`; criação com `crm.write_notes` (todos os papéis ativos na matriz atual).

Policies dedicadas: `policyProfiles`, `policyCrm` em `@verasjuris/auth/crm-policies.ts`.

### Atendimento e triagem (`intake.*`, `triage.*`)

- Leitura/criação/atualização operacional: member+ (ver matriz).
- Atribuição de responsável distinto, encerramento e conversão: owner/administrator (`intake.assign`, `intake.close`, `intake.convert`).
- Revisão de triagem (`triage.review`) e gestão de áreas (`legal_area.manage`): owner/administrator.
- Upload de documento inicial: owner/administrator; leitura: member+.
- Policies: `policyIntake`, `policyTriage`, `policyLegalArea`, `policyInitialDocument`. Transições: `assertIntakeTransition`, `assertTriageTransition`.

### Pipeline (`pipeline.*`, `proposal.*`)

- Leitura e move operacional: member+ (`pipeline.read`, `pipeline.move`).
- Perda/arquivo/restauração e manage: owner/administrator (`pipeline.manage`).
- Aprovar/enviar proposta e gerir engajamento: owner/administrator.
- Criar proposta e análise: member+.
- Policies: `policyPipeline`, `policyAnalysis`, `policyProposal`, `policyEngagement`. Stages: `assertOpportunityStageTransition`.

### LegalMatter (`matter.*`)

- Leitura/criação/atualização e partes/tags: member+.
- Equipe, honorários, encerramento e arquivo: owner/administrator.
- Policies e transições no módulo de matters.

### Processos judiciais (`judicial_process.*`)

- Operação processual (partes, fases, movimentações, etc.): member+.
- Close/reopen e catálogo: owner/administrator.
- Policies: família `policyJudicial*` / transições `assertJudicial*`.

### Processos administrativos (`administrative_process.*`)

- Leitura/criação/atualização e subrecursos (requests, requirements, deadlines, decisions, appeals): member+.
- Atribuição, close/reopen e `administrative_catalog.manage`: owner/administrator.
- Policies: `policyAdministrativeProcess`, `policyAdministrativeRequest`, etc. Transições: `assertAdministrative*Transition`.

### Documentos (`document.*`)

- Leitura, criação, atualização de metadados, upload de versão e download: member+.
- ACL, arquivo/restauração, categorias e pastas: owner/administrator.
- Confidencialidade `confidential`: exige papel elevado ou ACL explícita de leitura, além de `document.read`.
- Policies: `policyDocument`, `policyDocumentVersion`, `policyDocumentFolder`, `policyDocumentACL`, `policyDocumentConfidentiality`.

### Dossiê (`dossier.*`)

- Leitura e vínculos: member+ (`dossier.read`, `dossier.manage_links`).
- Policy: `policyDossier`.

### Tarefas (`task.*`, `sla.manage`)

- Operação de tarefas (CRUD, comentário, checklist, dependências, complete): member+.
- Arquivo e `sla.manage`: owner/administrator.
- Policies: `policyTask`, `policySla`. Transições: `assertTaskTransition`.

### Agenda (`calendar.*`)

- Leitura/criação/atualização: member+.
- Delete e `calendar.manage_team`: owner/administrator.
- Policy: `policyCalendar`. Transições: `assertCalendarEventTransition`.

### Prazos (`deadline.*`)

- Leitura/criação/atualização/cálculo/confirmação/atribuição/complete: member+.
- Cancel, alertas e escalonamento: owner/administrator.
- Policy: `policyDeadline`. Transições: `assertDeadlineTransition` / `assertDeadlineMutable`.

### Portal do cliente (`client_portal.*`)

- Vínculo User↔cliente CRM: `client_portal.link_user`.
- Operar solicitações/timeline/agenda visível: `client_portal.manage_requests`.
- Ledger de pagamentos do cliente: `client_portal.manage_payments`.
- Rotas `/portal/*` usam `ClientPortalContext` + `portalAuthorizeScope` (404 fora do escopo).
- Policies: `policyClientPortal`, `policyClientCase`, `policyClientDocument`, `policyClientContract`, `policyClientPayment`, `policyClientMessage`.

### Comunicação (`communication.*`)

- Leitura/envio: `communication.read`, `communication.send`.
- Templates/preferências/consent/admin: `manage_templates`, `manage_preferences`, `manage_consents`, `admin`.
- Policies: `policyCommunication`, `policyCommunicationTemplate`, `policyCommunicationPreference`, `policyCommunicationConsent`.

### Advogado online (`online_lawyer.*`)

- Solicitar atendimento: `online_lawyer.request`.
- Ofertas/match: `match.read`, `match.respond`.
- Consultas: `consultation.read`, `consultation.manage`.
- Disponibilidade: `availability.manage`.
- Moderação de reviews: `review.moderate`.
- Policies: `policyOnlineLegalRequest`, `policyOnlineMatchCandidate`, `policyOnlineConsultation`, `policyLawyerAvailability`.

### Educação (`education.*`)

- Leitura: `education.read`.
- Cursos: `education.course.create` | `update` | `publish`.
- Aulas/trilhas/biblioteca: `lesson.manage` | `track.manage` | `library.manage`.
- Matrículas: `enrollment.manage`.
- Certificados: `certificate.issue` | `certificate.revoke`.
- Policies: `policyEducationAccess`, `policyEducationCourseManage`, `policyLesson`, `policyLibraryItem`, `policyEnrollment`, `policyCertificate` (`education-policies.ts`).

### Financeiro (`finance.*`)

- Leitura geral / pagamentos / ledger: `finance.read` | `finance.payment.read` | `finance.ledger.read`.
- Planos/assinaturas/créditos/taxas/custos/conciliação: `plan.manage` | `subscription.manage` | `credit.manage` | `fee.manage` | `cost.manage` | `reconcile`.
- Invoices: `invoice.create` | `invoice.update`.
- Ledger: `ledger.post` | `ledger.reverse` | `ledger.export`.
- Pagamentos: `payment.record_manual` | `refund`.
- Policies: `policyFinanceRead`, `policyFinanceManage`, `policyInvoice`, `policyPaymentIntent`, `policyPayment`, `policyRefund`, … (`finance-policies.ts`).
- Pagamentos de portal/consulta/leilão usam permissões dos respectivos domínios — ≠ `finance.*` do ledger SaaS (`docs/FINANCE.md`, `docs/PAYMENT_PROVIDER.md`).

## Policies (`@verasjuris/auth`)

- `policyRequirePermission` — permission no tenant  
- `policyInviteWithRole` — `member.invite` + papel convidável (`member` / `administrator`; nunca `owner`)  
- `policyAssignRoles` — `role.assign` + `actorCanGrantRole` (somente owner concede owner)  
- `wouldRemoveLastOwner` — invariante do último proprietário  
- `policyOwnSession` — sessão só do próprio usuário  

## Códigos de resposta

- Sem membership / recurso de outro tenant → **404**  
- Membership ativa sem permission → **403**  
- Membership suspensa → **403**  

## Convites

Status derivado: `pending` | `accepted` | `revoked` | `expired` via `acceptedAt` / `revokedAt` / `expiresAt` (sem coluna `status` separada).

## MFA / Passkeys (futuro)

Não implementar agora. Modelo planejado:

- `AuthenticationCredential` (password / passkey / future SSO)  
- `MfaMethod`, `MfaChallenge`, `RecoveryCode`  

`passwordHash` no User não é a única forma futura de autenticação. `mfaEnabled` permanece placeholder.
