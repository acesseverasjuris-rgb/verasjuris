# Marketplace jurídico (Etapa 17)

Camada de contratação estruturada de serviços. **Distinto** do Advogado Online (consulta rápida/matching). Ver ADR 144.

## Domínio

- Perfil: reutiliza `lawyer_profiles` (+ campos marketplace).
- Categorias: `marketplace_service_categories` (hierárquicas; vínculo opcional a área jurídica).
- Serviços: `professional_services` (pricing em centavos; modelos FIXED/STARTING_AT/HOURLY/QUOTE_REQUIRED/CUSTOM).
- Solicitações → propostas (versionadas) → engagement → entregas/revisões → conclusão → review.
- Disputas: `marketplace_disputes` (também `sourceType` para diligência).

## Regras

- Sem self-proposal; sem proposta duplicada ativa; sem edição silenciosa após aceite.
- Review só após `COMPLETED`; sem self-review.
- Pagamento: `PaymentProvider` — default `NOT_CONFIGURED`; evidência manual permitida.
- Documentos: safe preview antes do aceite (ADR 149).
- Ranking: `MarketplaceRankingService` determinístico — não declara “melhor” sem critério.

## APIs

Prefixo típico: `/v1/organizations/:organizationId/marketplace/...`

## Providers externos

Payment, OAB, filas: **NOT_CONFIGURED** salvo configuração real.
