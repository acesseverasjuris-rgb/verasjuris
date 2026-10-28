# Consentimento e preferências (Etapa 15)

## Preferências (`communication_preferences`)

Por `(organizationId, userId, channel, category)`:

- `enabled`, quiet hours, idioma (`pt-BR` default).
- Gerenciadas com `communication.manage_preferences`.

## Consentimentos (`communication_consents`)

Subject polimórfico (`subject_type`, `subject_id`), canal, categoria, status:

`unknown` | `opted_in` | `opted_out` | `required` | `not_applicable`.

Campos de evidência: `source`, `grantedAt`, `revokedAt`, `evidence` — **append-friendly** (ADR 135).

## Marketing (ADR 134)

Envios com categoria `marketing` bloqueados sem consent `opted_in` vigente.

Transacionais (`transactional`, `security`, `system`, updates de caso) seguem regras por categoria; `required` pode bypass opt-out onde permitido por policy.

## RBAC

`communication.manage_consents` para gravação staff; leitura via `communication.read`.

## Relacionado

`docs/COMMUNICATION.md`, ADRs 134–135, `docs/SECURITY.md`
