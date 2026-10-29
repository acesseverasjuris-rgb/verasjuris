import { randomBytes } from "node:crypto";
import {
  billingCredits,
  billingPlanVersions,
  courseEnrollments,
  educationCertificates,
  invoices,
  isUniqueViolation,
  paymentWebhookEvents,
  subscriptions,
  type AppDatabase,
} from "@verasjuris/database";
import type { JobHandler, JobRecord } from "@verasjuris/events";
import { and, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";

/* ─── Education ─── */
export const JOB_COURSE_RELEASE = "COURSE_RELEASE" as const;
export const JOB_COURSE_EXPIRATION = "COURSE_EXPIRATION" as const;
export const JOB_CERTIFICATE_GENERATION = "CERTIFICATE_GENERATION" as const;
export const JOB_LEARNING_REMINDER = "LEARNING_REMINDER" as const;
export const JOB_EDUCATION_AI_JOB = "EDUCATION_AI_JOB" as const;

/* ─── Billing ─── */
export const JOB_SUBSCRIPTION_RENEWAL = "SUBSCRIPTION_RENEWAL" as const;
export const JOB_INVOICE_GENERATION = "INVOICE_GENERATION" as const;
export const JOB_INVOICE_DUE_REMINDER = "INVOICE_DUE_REMINDER" as const;
export const JOB_PAST_DUE_CHECK = "PAST_DUE_CHECK" as const;
export const JOB_CREDIT_EXPIRATION = "CREDIT_EXPIRATION" as const;

/* ─── Payments ─── */
export const JOB_PAYMENT_STATUS_SYNC = "PAYMENT_STATUS_SYNC" as const;
export const JOB_REFUND_STATUS_SYNC = "REFUND_STATUS_SYNC" as const;
export const JOB_PAYMENT_WEBHOOK_PROCESS = "PAYMENT_WEBHOOK_PROCESS" as const;
export const JOB_PAYOUT_PROCESS = "PAYOUT_PROCESS" as const;
export const JOB_RECONCILIATION_SYNC = "RECONCILIATION_SYNC" as const;

const PDF_GENERATION_NOT_CONFIGURED = "PDF_GENERATION_NOT_CONFIGURED";

type OrgPayload = {
  organizationId?: string;
  enrollmentId?: string;
  certificateId?: string;
  courseId?: string;
  subscriptionId?: string;
  periodKey?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  currency?: string;
  dueAt?: string;
  webhookEventId?: string;
};

function requireOrganizationId(job: JobRecord): string {
  const payload = job.payload as OrgPayload | null;
  const organizationId = payload?.organizationId?.trim();
  if (!organizationId) {
    throw Object.assign(new Error(`${job.type} exige organizationId`), {
      code: "VALIDATION_ERROR",
    });
  }
  return organizationId;
}

function createNotConfiguredSyncHandler(code: string, message: string): JobHandler {
  return async (job: JobRecord) => {
    requireOrganizationId(job);
    throw Object.assign(new Error(message), { code });
  };
}

function createNoOpHandler(_db: AppDatabase): JobHandler {
  return async (job: JobRecord) => {
    requireOrganizationId(job);
  };
}

function periodKeyFromPayload(payload: OrgPayload): string | null {
  const key = payload.periodKey?.trim();
  return key || null;
}

/** Matrículas ativas com expiresAt passado → expired (idempotente). */
export function createCourseExpirationHandler(db: AppDatabase): JobHandler {
  return async (job: JobRecord) => {
    const organizationId = requireOrganizationId(job);
    const payload = job.payload as OrgPayload;
    const now = new Date();
    const filters = [
      eq(courseEnrollments.organizationId, organizationId),
      eq(courseEnrollments.status, "active"),
      isNotNull(courseEnrollments.expiresAt),
      lt(courseEnrollments.expiresAt, now),
    ];
    if (payload.enrollmentId) {
      filters.push(eq(courseEnrollments.id, payload.enrollmentId));
    }
    if (payload.courseId) {
      filters.push(eq(courseEnrollments.courseId, payload.courseId));
    }
    await db
      .update(courseEnrollments)
      .set({ status: "expired", updatedAt: now })
      .where(and(...filters));
  };
}

/**
 * PDF de certificado: sem gerador configurado, marca PDF_GENERATION_NOT_CONFIGURED.
 * Nunca inventa PDF / documentId.
 */
export function createCertificateGenerationHandler(db: AppDatabase): JobHandler {
  return async (job: JobRecord) => {
    const organizationId = requireOrganizationId(job);
    const payload = job.payload as OrgPayload;
    const now = new Date();

    if (payload.certificateId) {
      const cert = await db.query.educationCertificates.findFirst({
        where: eq(educationCertificates.id, payload.certificateId),
      });
      if (!cert) return;
      const enrollment = await db.query.courseEnrollments.findFirst({
        where: eq(courseEnrollments.id, cert.enrollmentId),
      });
      if (enrollment?.organizationId && enrollment.organizationId !== organizationId) {
        throw Object.assign(new Error("CERTIFICATE_GENERATION: certificado fora da organização"), {
          code: "VALIDATION_ERROR",
        });
      }
      if (cert.pdfGenerationStatus !== PDF_GENERATION_NOT_CONFIGURED) {
        await db
          .update(educationCertificates)
          .set({
            pdfGenerationStatus: PDF_GENERATION_NOT_CONFIGURED,
            documentId: null,
            updatedAt: now,
          })
          .where(eq(educationCertificates.id, cert.id));
      }
      return;
    }

    if (payload.enrollmentId) {
      const enrollment = await db.query.courseEnrollments.findFirst({
        where: and(
          eq(courseEnrollments.id, payload.enrollmentId),
          eq(courseEnrollments.organizationId, organizationId),
        ),
      });
      if (!enrollment || enrollment.status !== "completed") return;

      const existing = await db.query.educationCertificates.findFirst({
        where: eq(educationCertificates.enrollmentId, enrollment.id),
      });
      if (existing) {
        if (existing.pdfGenerationStatus !== PDF_GENERATION_NOT_CONFIGURED || existing.documentId) {
          await db
            .update(educationCertificates)
            .set({
              pdfGenerationStatus: PDF_GENERATION_NOT_CONFIGURED,
              documentId: null,
              updatedAt: now,
            })
            .where(eq(educationCertificates.id, existing.id));
        }
        return;
      }

      try {
        await db.insert(educationCertificates).values({
          enrollmentId: enrollment.id,
          userId: enrollment.userId,
          courseId: enrollment.courseId,
          certificateNumber: `EDU-${randomBytes(6).toString("hex").toUpperCase()}`,
          verificationCode: randomBytes(16).toString("hex"),
          status: "issued",
          pdfGenerationStatus: PDF_GENERATION_NOT_CONFIGURED,
          documentId: null,
        });
      } catch (error) {
        if (isUniqueViolation(error)) return;
        throw error;
      }
    }
    // Sem certificateId/enrollmentId: noop (PDF provider ausente — nada a inventar).
  };
}

/**
 * Renovação: cria invoice open para (subscriptionId, periodKey) se ainda não existir.
 * Não marca paid / não inventa liquidação.
 */
export function createSubscriptionRenewalHandler(db: AppDatabase): JobHandler {
  return async (job: JobRecord) => {
    const organizationId = requireOrganizationId(job);
    const payload = job.payload as OrgPayload;
    const subscriptionId = payload.subscriptionId?.trim();
    const periodKey = periodKeyFromPayload(payload);
    if (!subscriptionId || !periodKey) {
      throw Object.assign(new Error("SUBSCRIPTION_RENEWAL exige subscriptionId e periodKey"), {
        code: "VALIDATION_ERROR",
      });
    }

    const existing = await db.query.invoices.findFirst({
      where: and(eq(invoices.subscriptionId, subscriptionId), eq(invoices.periodKey, periodKey)),
    });
    if (existing) return;

    const subscription = await db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.id, subscriptionId),
        eq(subscriptions.organizationId, organizationId),
      ),
    });
    if (!subscription) {
      throw Object.assign(new Error("SUBSCRIPTION_RENEWAL: assinatura não encontrada"), {
        code: "NOT_FOUND",
      });
    }
    if (subscription.status !== "active" && subscription.status !== "trialing") {
      return;
    }

    const version = await db.query.billingPlanVersions.findFirst({
      where: eq(billingPlanVersions.id, subscription.planVersionId),
    });
    const priceCents = version?.priceCents ?? 0;
    const currency = version?.currency ?? "BRL";
    const invoiceNumber =
      payload.invoiceNumber?.trim() ||
      `INV-REN-${subscriptionId.slice(0, 8).toUpperCase()}-${periodKey}`.slice(0, 80);

    try {
      await db.insert(invoices).values({
        organizationId,
        userId: subscription.userId,
        subscriptionId,
        invoiceNumber,
        currency,
        subtotalCents: priceCents,
        discountCents: 0,
        taxCents: 0,
        totalCents: priceCents,
        amountPaidCents: 0,
        amountDueCents: priceCents,
        status: "open",
        issuedAt: new Date(),
        dueAt: payload.dueAt ? new Date(payload.dueAt) : null,
        periodKey,
        metadata: { source: "SUBSCRIPTION_RENEWAL" },
      });
    } catch (error) {
      if (isUniqueViolation(error)) return;
      throw error;
    }
  };
}

/** Gera invoice idempotente por (subscriptionId, periodKey) ou invoiceNumber. */
export function createInvoiceGenerationHandler(db: AppDatabase): JobHandler {
  return async (job: JobRecord) => {
    const organizationId = requireOrganizationId(job);
    const payload = job.payload as OrgPayload;
    const periodKey = periodKeyFromPayload(payload);
    const subscriptionId = payload.subscriptionId?.trim();

    if (subscriptionId && periodKey) {
      const existing = await db.query.invoices.findFirst({
        where: and(eq(invoices.subscriptionId, subscriptionId), eq(invoices.periodKey, periodKey)),
      });
      if (existing) return;

      const subscription = await db.query.subscriptions.findFirst({
        where: and(
          eq(subscriptions.id, subscriptionId),
          eq(subscriptions.organizationId, organizationId),
        ),
      });
      if (!subscription) return;

      const version = await db.query.billingPlanVersions.findFirst({
        where: eq(billingPlanVersions.id, subscription.planVersionId),
      });
      const priceCents = version?.priceCents ?? 0;
      const currency = payload.currency?.trim() || version?.currency || "BRL";
      const invoiceNumber =
        payload.invoiceNumber?.trim() ||
        `INV-GEN-${subscriptionId.slice(0, 8).toUpperCase()}-${periodKey}`.slice(0, 80);

      try {
        await db.insert(invoices).values({
          organizationId,
          userId: subscription.userId,
          subscriptionId,
          invoiceNumber,
          currency,
          subtotalCents: priceCents,
          discountCents: 0,
          taxCents: 0,
          totalCents: priceCents,
          amountPaidCents: 0,
          amountDueCents: priceCents,
          status: "draft",
          periodKey,
          metadata: { source: "INVOICE_GENERATION" },
        });
      } catch (error) {
        if (isUniqueViolation(error)) return;
        throw error;
      }
      return;
    }

    if (payload.invoiceNumber?.trim()) {
      const existing = await db.query.invoices.findFirst({
        where: eq(invoices.invoiceNumber, payload.invoiceNumber.trim()),
      });
      if (existing) return;
    }

    // Sem chaves de idempotência suficientes: noop seguro (não inventa fatura solta).
  };
}

/** Invoices open/partially_paid com dueAt passado e saldo → past_due. */
export function createPastDueCheckHandler(db: AppDatabase): JobHandler {
  return async (job: JobRecord) => {
    const organizationId = requireOrganizationId(job);
    const payload = job.payload as OrgPayload;
    const now = new Date();
    const filters = [
      eq(invoices.organizationId, organizationId),
      inArray(invoices.status, ["open", "partially_paid"]),
      isNotNull(invoices.dueAt),
      lt(invoices.dueAt, now),
      sql`${invoices.amountDueCents} > 0`,
    ];
    if (payload.invoiceId) {
      filters.push(eq(invoices.id, payload.invoiceId));
    }
    await db
      .update(invoices)
      .set({ status: "past_due", updatedAt: now })
      .where(and(...filters));
  };
}

/** Créditos available com expiresAt passado → expired. */
export function createCreditExpirationHandler(db: AppDatabase): JobHandler {
  return async (job: JobRecord) => {
    const organizationId = requireOrganizationId(job);
    const now = new Date();
    await db
      .update(billingCredits)
      .set({ status: "expired", updatedAt: now })
      .where(
        and(
          eq(billingCredits.organizationId, organizationId),
          eq(billingCredits.status, "available"),
          isNotNull(billingCredits.expiresAt),
          lt(billingCredits.expiresAt, now),
        ),
      );
  };
}

/**
 * Eventos webhook em `received`: sem PSP, marca failed + PAYMENT_PROVIDER_NOT_CONFIGURED.
 * Não confirma pagamento / não inventa liquidação.
 */
export function createPaymentWebhookProcessHandler(db: AppDatabase): JobHandler {
  return async (job: JobRecord) => {
    requireOrganizationId(job);
    const payload = job.payload as OrgPayload;
    const now = new Date();
    const filters = [eq(paymentWebhookEvents.status, "received")];
    if (payload.webhookEventId) {
      filters.push(eq(paymentWebhookEvents.id, payload.webhookEventId));
    }
    await db
      .update(paymentWebhookEvents)
      .set({
        status: "failed",
        errorCode: "PAYMENT_PROVIDER_NOT_CONFIGURED",
        processedAt: now,
      })
      .where(and(...filters));
  };
}

/**
 * Handlers locais (LocalInProcessQueueProvider) — Etapas 20 / 21 / 21.2.
 * Sync externo: NOT_CONFIGURED honesto. Jobs financeiros: idempotentes; sem paid fictício.
 */
export function registerLocalEducationFinanceHandlers(
  queue: {
    status: string;
    registerHandler?: (type: string, handler: JobHandler) => void;
  },
  db: AppDatabase,
): void {
  if (queue.status !== "local_in_process" || typeof queue.registerHandler !== "function") {
    return;
  }

  const noOp = createNoOpHandler(db);

  queue.registerHandler(JOB_COURSE_RELEASE, noOp);
  queue.registerHandler(JOB_COURSE_EXPIRATION, createCourseExpirationHandler(db));
  queue.registerHandler(JOB_CERTIFICATE_GENERATION, createCertificateGenerationHandler(db));
  queue.registerHandler(JOB_LEARNING_REMINDER, noOp);
  queue.registerHandler(JOB_EDUCATION_AI_JOB, noOp);

  queue.registerHandler(JOB_SUBSCRIPTION_RENEWAL, createSubscriptionRenewalHandler(db));
  queue.registerHandler(JOB_INVOICE_GENERATION, createInvoiceGenerationHandler(db));
  queue.registerHandler(JOB_INVOICE_DUE_REMINDER, noOp);
  queue.registerHandler(JOB_PAST_DUE_CHECK, createPastDueCheckHandler(db));
  queue.registerHandler(JOB_CREDIT_EXPIRATION, createCreditExpirationHandler(db));

  // Mesmo código PAYMENT_PROVIDER_NOT_CONFIGURED já usado em online/marketplace — sem fake paid.
  queue.registerHandler(
    JOB_PAYMENT_STATUS_SYNC,
    createNotConfiguredSyncHandler(
      "PAYMENT_PROVIDER_NOT_CONFIGURED",
      "PAYMENT_STATUS_SYNC: nenhum provedor de pagamento configurado.",
    ),
  );
  queue.registerHandler(
    JOB_REFUND_STATUS_SYNC,
    createNotConfiguredSyncHandler(
      "PAYMENT_PROVIDER_NOT_CONFIGURED",
      "REFUND_STATUS_SYNC: nenhum provedor de pagamento configurado.",
    ),
  );
  queue.registerHandler(JOB_PAYMENT_WEBHOOK_PROCESS, createPaymentWebhookProcessHandler(db));
  queue.registerHandler(
    JOB_PAYOUT_PROCESS,
    createNotConfiguredSyncHandler(
      "PAYMENT_PROVIDER_NOT_CONFIGURED",
      "PAYOUT_PROCESS: nenhum provedor de payout/repasse configurado.",
    ),
  );
  queue.registerHandler(
    JOB_RECONCILIATION_SYNC,
    createNotConfiguredSyncHandler(
      "RECONCILIATION_PROVIDER_NOT_CONFIGURED",
      "RECONCILIATION_SYNC: nenhum provedor de conciliação configurado.",
    ),
  );
}
