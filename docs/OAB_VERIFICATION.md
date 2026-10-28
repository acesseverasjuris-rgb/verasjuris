# Verificação OAB (Etapas 1.2 + 16)

## Contrato

`OABVerificationProvider` em `@verasjuris/ai` (`oab-verification-provider.ts`):

- `verify({ oabNumber, oabUf, professionalName? })` → `OABVerificationResult`
- Default: `NotConfiguredOABVerificationProvider` → erro `OAB_VERIFICATION_PROVIDER_NOT_CONFIGURED`

## Estado no perfil

`lawyer_profiles.oab_verification_status`:

`informed` | `pending_verification` | `verified` | `rejected` | `expired` | `not_configured`

**Informado ≠ verificado** (ADR 138 / ADR 022). Cliente/API não pode forçar `verified` sem provider.

## Uso no matching

Bônus +5 pontos se `verified`; advogado apenas `informed` continua na fila.

## Job assíncrono

`OAB_VERIFICATION` registrado no worker (`online-lawyer-handlers.ts`) — falha honesta sem provider; não altera status sozinho.

## Relacionado

`docs/PROFILES.md`, `docs/ONLINE_LAWYER_MATCHING.md`, ADR 138
