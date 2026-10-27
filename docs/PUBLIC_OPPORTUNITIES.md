# Oportunidades públicas

## Objetivo

Registrar e acompanhar licitações, editais, chamamentos e afins — **cadastro manual** na organização e modelo para referências **globais** futuras. Não há sincronização com PNCP ou portal oficial nesta etapa.

**Não confundir com leilões:** o módulo de leilões (`docs/AUCTIONS.md`, Etapa 8) é agregado, schema e rotas próprios — bens/arrematação, não contratação pública. Marketplace de honorários advocatícios também está fora deste domínio (ADR 079, 080).

Schema: `packages/database/src/schema/public-opportunities.ts`.

## Escopo de dados (ADR 068)

| Escopo | `organizationId` | Uso |
| --- | --- | --- |
| **Global** | `null` | Referência compartilhada (futuro `public_provider`) |
| **Organização** | UUID | Cadastro manual ou importação tenant-specific |

Sempre **tenant-bound** (interesse, requisitos, documentos vinculados):

- `public_opportunity_interests`
- `public_opportunity_requirements`
- Links em `document_links` (`targetType=public_opportunity`)

## Origem (`sourceProvider`)

- `manual` — cadastro interno; badge **não** oficial
- `import` — importação; não implica fonte governamental
- `public_provider` — reservado para quando `PUBLIC_OPPORTUNITY_PROVIDER` existir; badge “Provedor público” só neste caso

Com **`PUBLIC_OPPORTUNITY_PROVIDER=not_configured`** (padrão):

- Não há busca/sync externa
- API de provider retorna `PUBLIC_OPPORTUNITY_PROVIDER_NOT_CONFIGURED`
- CRUD manual e interesses **continuam** funcionando

**PNCP:** não integrado.

## Valores e datas

- `estimatedValueCents` — inteiros (centavos), como CRM/pipeline
- Prazos com `timezone` IANA (padrão `America/Sao_Paulo`)

## Permissões

- `public_opportunity.read`
- `public_opportunity.create` / `update` / `manage`
- `public_opportunity.save` — interesse da org
- `public_opportunity.manage_requirements` / `manage_documents`

## API

Prefixo: `/v1/organizations/:organizationId/public-opportunities`

Listagem combina oportunidades globais + da org conforme política de leitura. Mutação respeita `editable` (registros globais não editáveis pelo tenant).

Endpoint de **descoberta externa** (quando existir) dependerá de adapter `PublicOpportunityProvider` — hoje stub.

## UI

Deve exibir selo de origem (`source.badge`): manual ≠ oficial. Nunca rotular cadastro manual como publicação oficial do ente.

## Relacionado

- `docs/AUCTIONS.md` — leilões (módulo separado)
- `docs/AI_PROVIDERS.md`
- `docs/ADMINISTRATIVE_PROCESSES.md` (órgãos `seed_dev`)
- ADR 068, 069, 070, 079
