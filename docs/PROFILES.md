# Perfis profissionais — VerasJuris

## Escopo

A Etapa 1.2 estende a identidade global com perfis profissionais acumulativos e vínculos opcionais entre conta autenticada e cliente comercial. Não há validação externa de OAB, KYC ou biometria nesta versão.

## Conceitos distintos

| Conceito | Tabela / entidade | Escopo | Papel |
| --- | --- | --- | --- |
| **User** | `users` | Global | Conta de autenticação (e-mail, senha, sessão) |
| **Profile** | `profiles` | Global (1:1 com User) | Apresentação pessoal: nome de exibição, locale, fuso |
| **ProfessionalProfile** | `professional_profiles` | Global (1:1 com User) | Estado de verificação profissional (`verificationStatus`) |
| **LawyerProfile** | `lawyer_profiles` | Global (1:1 com User) | Dados declarados de advogado(a), incluindo OAB informativa |
| **PartnerProfile** | `partner_profiles` | Global (1:1 com User) | Parceiro externo (correspondente, perito, contador, etc.) |
| **EmployeeProfile** | `employee_profiles` | Por organização | Colaborador interno do escritório |
| **OrganizationClientUser** | `organization_client_users` | Por organização | Vínculo opcional User ↔ organização como cliente autenticado |
| **CRM Client** | `crm_clients` | Por organização | Entidade comercial do CRM; pode existir sem conta |

**User ≠ CRM Client.** Uma pessoa com login no VerasJuris não é automaticamente cliente do escritório. O CRM trata leads e clientes comerciais; a conta trata autenticação e participação (`OrganizationMember`).

**Membership ≠ EmployeeProfile.** Participar de uma organização (`organization_members`) concede papéis e permissões. O perfil de colaborador (`employee_profiles`) descreve função interna (cargo, departamento, gestor) e exige participação ativa na mesma organização. São complementares, não equivalentes.

**OrganizationClientUser ≠ CRM Client.** O vínculo em `organization_client_users` liga uma conta autenticada a uma organização no papel de cliente, com referência opcional a `crm_client_id`. O registro comercial em `crm_clients` permanece independente e pode existir sem User.

## Perfis acumulativos

Não há enum exclusivo `user.type`. A mesma identidade pode, ao longo do tempo, possuir:

- um `ProfessionalProfile` (núcleo de verificação);
- um `LawyerProfile` (advogado);
- um `PartnerProfile` (parceiro);
- um ou mais `EmployeeProfile` (um por organização em que atua como colaborador).

Os perfis coexistem. Criar perfil de advogado não impede perfil de parceiro ou de colaborador em outra organização.

## Visibilidade

Perfis de advogado e parceiro expõem `visibility`:

| Valor | Significado |
| --- | --- |
| `public` | Visível fora da organização (quando houver superfície pública) |
| `organization` | Visível aos participantes da organização |
| `private` | Visível apenas ao próprio titular |
| `internal` | Uso interno restrito (parceiros/colaboradores autorizados) |

Padrões: advogado `private`; parceiro `organization`. Colaborador não usa este enum; dados internos ficam em `employee_profiles`.

## Verificação profissional (OAB / identidade / biometria)

Estado em `professional_profiles.verificationStatus`:

| Status | Descrição |
| --- | --- |
| `not_submitted` | Padrão no cadastro; nenhuma submissão |
| `pending` | OAB informada no perfil de advogado; aguardando provedor real |
| `verified` | Reservado a integração futura; **não pode ser definido pelo cliente** |
| `rejected` | Reservado a fluxo de rejeição futuro |

Provedores em `apps/api/src/modules/profiles/verifiers.ts`:

- **OAB** (`professionalLicenseVerifier`) — `NOT_CONFIGURED`, responde 503
- **KYC / identidade** (`identityVerificationProvider`) — `NOT_CONFIGURED`, responde 503
- **Biometria documental** (`biometricDocumentVerifier`) — `NOT_CONFIGURED`, stub apenas; sem persistência de dados biométricos

Campos OAB em `lawyer_profiles` são **declarativos**. A interface não exibe verificação como concluída. Tentativa de forçar `verificationStatus: "verified"` na API é rejeitada (`policyProfessionalVerificationStatus`).

Ao informar número ou UF da OAB, o status passa para `pending` se ainda não estiver `verified` (via integração futura).

## Permissões

| Permission | Uso |
| --- | --- |
| `profiles.read` | Listar colaboradores da organização |
| `profiles.update_self` | Atualizar os próprios perfis (advogado, parceiro, colaborador próprio) |
| `profiles.manage` | Administrar perfis na organização (equivalente ampliado de leitura/gestão) |

Detalhes por papel em `docs/AUTHORIZATION.md`.

## API (Etapa 1.2)

Rotas em `/v1` (`apps/api/src/modules/profiles/`):

| Método | Caminho | Descrição |
| --- | --- | --- |
| GET | `/profiles/me?organizationId=` | Perfis do usuário autenticado; filtra colaborador e vínculo de cliente por org |
| PUT | `/profiles/me/lawyer` | Cria ou atualiza perfil de advogado |
| PUT | `/profiles/me/partner` | Cria ou atualiza perfil de parceiro |
| PUT | `/organizations/:organizationId/profiles/employees/me` | Cria ou atualiza perfil de colaborador na org |
| GET | `/organizations/:organizationId/profiles/employees` | Lista colaboradores (`profiles.read`) |
| POST | `/profiles/me/lawyer/verify` | Stub OAB → 503 `NOT_CONFIGURED` |
| POST | `/profiles/me/identity/verify` | Stub KYC → 503 `NOT_CONFIGURED` |

Mutações relevantes geram auditoria (`profile.lawyer_upserted`, `profile.partner_upserted`, `profile.employee_upserted`, etc.).

## Interface

Tela autenticada em `/app/perfis` (`apps/web/src/app/app/perfis/page.tsx`). Formulários de advogado e parceiro; aviso explícito de que OAB não é validada automaticamente.

## Relação com outros documentos

- Identidade global: `docs/IDENTITY.md`
- Autorização: `docs/AUTHORIZATION.md`
- CRM (cliente comercial): `docs/CRM.md`
- Decisões: ADR 014–022 em `docs/DECISIONS.md` (sequência após ADR 013 da etapa 1.1)
