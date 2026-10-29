# Monetização de API

## Modelo

`api_clients` → `api_credentials` → scopes (`api_scopes` / `api_client_scopes`) → `api_usage_records`. Billing de uso gera charge/invoice via fluxo de finance — não inventa paid (ADR 189).

## Credenciais (ADR 188)

Somente `secretHash` (+ `prefix`, `credentialId`) persistidos. Segredo em claro só no momento da criação. Revogação via `revokedAt`.

## Usage

Registros idempotentes por `(apiClientId, idempotencyKey)`. Metering alimenta entitlements/limites e faturamento; sem provider/billing real o status de cobrança permanece honesto (`not_configured` / pending).

## Relacionado

`docs/MONETIZATION.md`, `docs/ENTITLEMENTS.md`, `docs/BILLING.md`, ADRs 187–189.
