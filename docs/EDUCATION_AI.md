# IA na Educação

## Princípio

Assistência via `AIGateway` existente (`@verasjuris/ai`). Sem gateway/provedor configurado → `AI_PROVIDER_NOT_CONFIGURED` / equivalente; não inventa resumo, quiz nem avaliação (ADR 156).

## Uso previsto

Sugestão de descrição, outline, questões — sempre revisão humana antes de publicar. IA **não** altera progresso, matrícula, certificado ou pagamento automaticamente (paralelo ADR 065).

## Dependência

`EducationModuleDeps.aiGateway` opcional em `apps/api/src/modules/education/service.ts`.

## Relacionado

`docs/AI_CORE.md`, `docs/AI_PROVIDERS.md`, `docs/EDUCATION.md`, ADR 156.
