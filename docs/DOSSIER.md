# Dossiê eletrônico (Etapa 4.2)

O dossiê **não é uma entidade persistida**. É uma **projeção** de documentos já existentes (owner binding + `document_links`), com classificação tipada (`documentKind`, `legalContext`, `evidentiaryRole`).

## Projeções

| Rota | Escopo |
| --- | --- |
| `GET …/matters/:id/dossier` | Documentos do matter + processos judiciais/administrativos + links `targetType=legal_matter` |
| `GET …/crm/clients/:id/dossier` | Documentos `ownerType=client` |
| `GET …/judicial-processes/:id/dossier` | Documentos do processo + links |
| `GET …/administrative-processes/:id/dossier` | Idem administrativo |

## Vínculos

`document_links` funciona como *document resource links*:

- `linkType` ≡ `relationType`
- `targetType` ≡ `resourceType`
- `targetId` ≡ `resourceId`

Rotas: `POST/DELETE …/dossier/links`. Permissões: `dossier.read`, `dossier.manage_links`.

## Classificação

`POST …/documents/:id/classify` atualiza kind/context/role sem alterar o binário.

## UI

- `/app/casos/[id]/dossie`
- `/app/crm/clientes/[id]/documentos`
- Documentos de processo: `/app/casos/[id]/processos/[processId]/documentos` e administrativos equivalentes

## Limites

Sem pasta espelhada automática, sem sincronização com tribunal, sem hard delete.
