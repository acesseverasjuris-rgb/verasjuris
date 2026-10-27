# ADR 064 — OCR somente quando necessário

## Status

Aceito (Etapa 6).

## Decisão

- Ordem: extração nativa (texto/PDF com camada) → só então `ocrRequired`.
- OCR chama **`OCRProvider`**; com `OCR_PROVIDER=not_configured`, run termina `not_configured` / `OCR_PROVIDER_NOT_CONFIGURED`.
- **Proibido** inventar texto quando OCR não está disponível.

## Motivo

Custo, privacidade e honestidade operacional em PDFs escaneados.
