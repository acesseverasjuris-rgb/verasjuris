# CNIS (Prompt 16)

## Princípio

CNIS é **importável e revisável**. Entradas não viram períodos/contribuições validados sem revisão humana. Provider externo é opcional e default **`NOT_CONFIGURED`** (ADR 105, 112).

## Modelo

| Tabela | Papel |
| --- | --- |
| `cnis_imports` | Lote de importação (caso, cliente, documento fonte, formato, status) |
| `cnis_entries` | Competências / vínculos importados (remuneração/contribuição em centavos) |
| `cnis_warnings` | Lacunas, duplicidades e alertas do lote |

Status do lote: `draft` | `pending_review` | `reviewed` | `rejected` | `failed` | `not_configured`.

Revisão por entrada: `unreviewed` | `accepted` | `rejected` | `corrected` | `needs_review`.

## Fluxos

1. **Manual / estruturado local** — `POST …/cnis-imports` com entradas; revisão em `POST …/cnis-entries/:entryId/review`.
2. **Provider externo** — `CNISProvider.fetchCNIS` em `@verasjuris/ai`; implementação padrão `NotConfiguredCNISProvider` → `CNIS_PROVIDER_NOT_CONFIGURED`.
3. **Job assíncrono** — `CNIS_IMPORT` no worker é stub honesto: sem inventar CNIS quando o provider/fila não está configurado.

## O que não afirmar

- Importação ≠ extrato oficial Meu INSS.
- Competência aceita na revisão interna ≠ validação Dataprev.
- Parser local de PDF/XML oficial completo: fora do escopo se não implementado; não fingir sync.

## Permissões e API

- `previdentiary.manage_cnis` (+ `previdentiary.read` para consulta)
- `GET/POST …/cnis-imports`
- `GET …/cnis-imports/:importId`
- `POST …/cnis-entries/:entryId/review`

## Relacionado

`docs/PREVIDENTIARY.md`, `docs/SOCIAL_SECURITY_PROVIDERS.md`, `docs/PREVIDENTIARY_CALCULATIONS.md`
