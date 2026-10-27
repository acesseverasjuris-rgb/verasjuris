# Processos judiciais (Etapa 3.1)

## Princípio

**LegalMatter ≠ JudicialProcess.**

Um caso (`legal_matters`) pode ter **0..N** processos judiciais (`judicial_processes`). Dados de processo **não** ficam na tabela do matter.

## Modelo

Agregado tenant-bound ao matter:

- identificação CNJ (formatada + normalizada);
- tribunal / unidade / comarca;
- classe e assuntos (N via junction);
- partes processuais e advogados (≠ matter parties / matter team);
- fase atual + histórico;
- movimentações, audiências, decisões, recursos, cumprimento;
- baixa/reabertura;
- timeline processual (data do evento ≠ data de inserção).

## CNJ

Validação estrutural + dígito verificador (Res. CNJ 65/2008).

Mensagem correta: **“Número CNJ válido em formato”**.  
Não afirmar existência do processo no tribunal.

Unicidade: `(organization_id, cnj_number_normalized)`.

## Proveniência

Campos `source` / `sourceReference` / `sourceUpdatedAt` quando pertinente.

Valores: `manual` | `document` | `court_provider` | `import`.

Nesta etapa apenas **manual** é operacional. UI deve mostrar origem e data — nunca “tempo real” sem integração.

## Catálogos

Globais de referência (`courts`, `court_units`, `judicial_districts`, `procedural_classes`, `procedural_subjects`, `judicial_phase_catalog`):

- seed mínimo `seed_dev` (ADR 037);
- **não** são dados oficiais CNJ/TPU sincronizados;
- fallback textual (`court_unit_text`, `district_text`) quando unidade oficial ausente.

## Partes e advogados

- `judicial_process_parties` — composição processual (autor, réu, recorrente, etc.).
- `judicial_process_lawyers` — representação; OAB informada ≠ verificada (`unverified`).
- MatterTeam permanece equipe interna do caso.

## Fases / movimentações / audiências / decisões / recursos / cumprimento

Catálogo genérico de fases (conhecimento, recurso, cumprimento, execução, encerramento).  
Movimentações com `source=manual`.  
Audiências sem videoconferência.  
Decisão **não** encerra o LegalMatter automaticamente.  
Recurso `filed` exige referência de protocolo manual (sem protocolo real).  
Cumprimento/execução sem SISBAJUD/cálculos.

## Baixa

Status: `active` | `suspended` | `closed` | `archived`.  
Baixa ≠ exclusão. Reabertura com permission + auditoria.

## Timeline

Timeline do processo + projeção de eventos relevantes na timeline do LegalMatter (sem duplicar conteúdo integral).

## API

`/v1/organizations/:organizationId/matters/:matterId/judicial-processes`  
+ subrecursos e catálogos de leitura.

## Fora do escopo

Captura automática, scraping, DataJud/PJe/e-SAJ/eproc, protocolo, prazos, IA, jurisprudência, logos de tribunais.
