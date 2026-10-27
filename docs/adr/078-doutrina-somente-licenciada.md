# ADR 078 — Doutrina somente quando licenciada

## Status

Aceito (Etapa 7).

## Decisão

- Catálogo `doctrine_sources` distingue referência bibliográfica de conteúdo integral via flag **`licensed`**.
- Sem licença: metadados apenas (`fullTextAvailable: false`); sem texto integral inventado ou scraped ilegalmente.
- Capability `DOCTRINE` no provider futuro deve respeitar o mesmo limite.

## Motivo

Direitos autorais e honestidade de produto.
