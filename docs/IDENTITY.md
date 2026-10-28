# Identidade — VerasJuris

## Modelo

Uma pessoa possui uma identidade global (`User`). Dados de apresentação ficam em `Profile` (1:1). Dados profissionais mínimos ficam em `ProfessionalProfile` (ainda `not_submitted` nesta etapa).

A mesma identidade pode participar de várias organizações. Cada participação é um `OrganizationMember` (conceito de domínio: Membership). Não existe tabela `Membership` separada.

Papéis e permissões são contextuais à membership. Nunca há contas separadas por “cliente”, “advogado” ou “administrador”.

## User

Campos principais: `id`, `email` (já normalizado: trim + lowercase), `passwordHash`, `status`, `emailVerifiedAt`, `lastLoginAt`, `createdAt`, `updatedAt`.

O campo `mfaEnabled` permanece apenas como placeholder honesto (`false`). MFA real não está implementado.

### Status

| Status | Login | Sessão existente | Observação |
| --- | --- | --- | --- |
| `pending_verification` | Negado | Negada | Cadastro inicial |
| `active` | Permitido se `emailVerifiedAt` | Permitida | Operação normal |
| `suspended` | Negado | Invalidada | Conta bloqueada temporariamente |
| `disabled` | Negado | Invalidada | Conta encerrada |

Mensagens de login não distinguem motivo para o atacante.

## Organização ativa

Cookie de navegação (`ACTIVE_ORGANIZATION_COOKIE`). Nunca autoriza sozinho. O backend valida sessão + usuário + membership + permissão em cada operação. A troca chama `POST /v1/organizations/:id/switch`.

## Cadastro

Cria `User` + `Profile` + `ProfessionalProfile` em transação, status `pending_verification`, sem sessão e sem organização automática. Resposta anti-enumeração.

## Verificação e recuperação

Tokens opacos (32 bytes), persistidos como SHA-256, single-use, com expiração. Provider de e-mail é abstrato (`not_configured` ou `memory` só em não-produção).

## Convites

Tabela `organization_invitations`. Permissão `member.invite` (owner e administrator). Aceite exige e-mail autenticado igual ao do convite.

## Sessões

Persistidas por hash. `lastUsedAt` atualizado no máximo a cada 5 minutos. Listagem e revogação pelo próprio usuário. Reset de senha revoga todas as sessões. Troca de senha autenticada revoga as demais.

## Autorização

Ver `docs/AUTHORIZATION.md`. Policies em `@verasjuris/auth` além do catálogo RBAC.

## MFA e passkeys (preparação)

Não há TOTP, recovery codes nem WebAuthn. A autenticação atual é por senha + sessão. Evolução futura: credenciais em entidade própria (`AuthenticationCredential`), desafios MFA e WebAuthn sem recriar `User`. Ver ADR 012.

## Portal do cliente (Etapas 14–16)

Mesma conta `User` — não há “login de cliente” separado (ADR 003). Acesso ao portal exige linha em `organization_client_users` ligando `user_id` a `crm_client_id` no tenant. Staff cria vínculo com `client_portal.link_user`. Contexto resolvido por `resolveClientPortalContext`. Ver `docs/CLIENT_PORTAL.md`, ADR 128.
