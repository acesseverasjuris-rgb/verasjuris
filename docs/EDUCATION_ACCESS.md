# Acesso a conteúdo educacional

## Regras

- Matrícula `active` / `completed` libera progresso e quizzes.
- `pending_payment` bloqueia conteúdo até confirmação de pagamento (Finance/Payments ou fonte gratuita).
- `expired` / `cancelled` / `suspended` negam acesso.
- Aulas com `previewAllowed` podem ser vistas sem matrícula completa conforme regra do serviço.
- Curso `organization_only` exige membership no tenant; `private` exige autorização explícita.

## Pagamento

Curso pago cria vínculo opcional `invoiceId` / `paymentIntentId` na matrícula. Provider `not_configured` **não** promove para `active` (ADR 141 / 166). Redirect de checkout no frontend **nunca** confirma pagamento.

## Entitlements

Assinatura SaaS com feature de educação passa por `EntitlementService` (`docs/SUBSCRIPTIONS.md`, ADR 169) — não hardcode de plano.

## Relacionado

`docs/EDUCATION.md`, `docs/PAYMENTS.md`, `docs/PAYMENT_WEBHOOKS.md`, ADRs 153, 166, 169.
