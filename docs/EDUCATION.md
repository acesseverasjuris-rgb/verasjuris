# Educação Jurídica (Etapa 20)

## Princípio

Domínio próprio de cursos, trilhas, matrículas, progresso, quizzes e certificados. Reutiliza `User`/`Profile`/`ProfessionalProfile`, `Document` e `AIGateway`. **Não** é marketplace, advogado online nem LegalMatter.

Schema: `packages/database/src/schema/education.ts`. API: `apps/api/src/modules/education/`. Policies: `packages/auth/src/education-policies.ts`.

## Entidades

| Entidade | Papel |
| --- | --- |
| `education_categories` | Taxonomia (opcionalmente ligada a `legal_area_modules`) |
| `education_instructors` | Educador ligado a `profiles` |
| `education_courses` | Curso (status, visibilidade, preço em centavos) |
| `course_modules` / `course_lessons` | Estrutura pedagógica |
| `lesson_contents` + `lesson_content_versions` | Conteúdo versionado (ADR 154) |
| `learning_tracks` + `learning_track_courses` | Trilhas com pré-requisitos |
| `course_enrollments` | Matrícula (fonte free/purchase/subscription/…) |
| `lesson_progress` | Progresso por aula |
| `education_quizzes` / questions / options / attempts / answers | Avaliação |
| `education_certificates` | Certificado de conclusão (≠ ICP-Brasil) |
| `education_library_items` | Biblioteca (docs/links) |

## Ciclo do curso

`draft` → `under_review` → `published` → `unpublished` / `archived`. Visibilidade: `public` | `authenticated` | `organization_only` | `private` | `paid`.

## Matrícula e acesso

Curso pago (`visibility=paid` ou `priceCents > 0`) com fonte não gratuita fica `pending_payment` até confirmação real via Finance/Payments. Fontes `free` / `admin` / `organization` / `promotion` liberam acesso sem inventar pagamento. Detalhe: `docs/EDUCATION_ACCESS.md`.

## Providers (honestos)

| Provider | Default |
| --- | --- |
| `EducationMediaProvider` | `not_configured` — sem URL de playback inventada |
| `LiveClassProvider` | `not_configured` — sem join URL fictícia (≠ `VideoConferenceProvider`) |
| `PaymentProvider` | mesmo contrato de plataforma (`docs/PAYMENT_PROVIDER.md`) |
| `AIGateway` | assistivo; default `AI_PROVIDER=not_configured` |

## UI

Staff: `/app/educacao/*`. Aluno/público: `/educacao/*`.

## Distinções

- Certificado educacional ≠ certificado ICP-Brasil (`docs/EDUCATION_CERTIFICATES.md`, ADR 155).
- Cobrança de curso usa Invoice/PaymentIntent/Payment de plataforma — não `client_payment_records` nem `online_consultation_payments`.
- Honorários de LegalMatter e taxas de marketplace/diligência/extrajudicial são registros operacionais de domínio; o ledger de plataforma é `docs/LEDGER.md`.
- Curso pago pode alimentar split/instructor payable (`docs/SPLIT.md`, `docs/PAYABLES.md`); refunds/disputas seguem finance de plataforma.
- Acesso a features/limites de plano via `EntitlementService` (`docs/ENTITLEMENTS.md`); créditos de IA educacional ≠ tokens do provider (`docs/AI_CREDITS.md`).

## Relacionado

`docs/EDUCATION_CONTENT.md`, `docs/EDUCATION_AI.md`, `docs/EDUCATION_CERTIFICATES.md`, `docs/EDUCATION_ACCESS.md`, `docs/FINANCE.md`, `docs/PAYMENTS.md`, `docs/MONETIZATION.md`, ADRs 153–156, 171+.
