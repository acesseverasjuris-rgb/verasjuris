# Due diligence de leilão (Etapa 8)

## Objetivo

Checklist **assistivo** para organizar a verificação documental e operacional de um leilão de interesse da organização. **Não** constitui parecer jurídico, decisão automática nem recomendação de compra (ADR 084).

Persistência: `auction_due_diligence` (sempre `organizationId` preenchido). Análise de edital / assistência por IA usa features `auction.*` do gateway — ver `docs/AUCTIONS.md`.

## Disclaimer (produto)

*“Checklist assistivo para organização da verificação. Não constitui parecer jurídico nem recomendação de compra.”*

Análise de edital: *“Análise assistiva do edital. Exige revisão humana. Não constitui parecer jurídico nem recomendação de compra.”*

## Status do item

`pending` | `in_progress` | `done` | `not_applicable` | `blocked` | `unknown`

Atualização é ato humano (`auction.due_diligence.manage`), auditado (`auction.due_diligence_updated`).

## Checklist padrão (15 itens)

| Chave | Rótulo | Categoria |
| --- | --- | --- |
| `edital` | Edital / aviso | documentacao |
| `matricula` | Matrícula | registro |
| `onus` | Ônus | onus |
| `ocupacao` | Ocupação / posse | ocupacao |
| `avaliacao` | Avaliação | valores |
| `divida` | Dívidas informadas | debitos |
| `localizacao` | Localização | localizacao |
| `visitacao` | Visitação / vistoria | ocupacao |
| `comissao` | Comissão | pagamento |
| `pagamento` | Condições de pagamento | pagamento |
| `prazo` | Prazos | prazos |
| `debitos` | Débitos (IPTU/condomínio/outros) | debitos |
| `processo` | Processo / origem | juridico |
| `decisao` | Decisão / autorização | juridico |
| `restricoes` | Restrições | restricoes |

A assistência por IA (`auction.due_diligence_assist`) só organiza pontos a partir do conteúdo fornecido; lacunas = *ausentes no conjunto analisado* — sem inventar certidões.

## O que não faz

- Não libera lance eletrônico.
- Não conclui viabilidade da aquisição.
- Não altera status do leilão global.
- Não substitui due diligence profissional nem diligência cartorária/registral real.

## API

- `POST/PATCH …/auction-due-diligence` (+ `/:itemId`)
- Permissões: `auction.due_diligence.read` | `auction.due_diligence.manage`

## Relacionado

- `docs/AUCTIONS.md`
- ADR 084
