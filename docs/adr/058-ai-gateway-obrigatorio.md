# ADR 058 — Gateway de IA obrigatório; sem vendor direto

## Status

Aceito (Etapa 6).

## Contexto

Módulos de documento, análise jurídica e núcleo AI precisam de LLM/OCR sem acoplar a um SDK específico.

## Decisão

- Toda chamada de modelo passa por **`AIGateway`** (`@verasjuris/ai`).
- **`apps/api`**, worker e domínios **proibidos** de importar OpenAI, Anthropic, etc.
- Provedor real implementa **`AIProvider`** e é injetado na factory; padrão **`NotConfiguredAIProvider`**.

## Consequências

- Um adapter futuro concentra retries, idempotência, custos e validação Zod.
- Testes usam `@verasjuris/ai/testing`, não variáveis de produção.

## Relacionado

Suplementa ADR 007 (contrato honesto) com persistência e rotas da Etapa 6.
