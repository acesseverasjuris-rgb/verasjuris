import type {
  CheckoutSessionInput,
  CheckoutSessionResult,
  CreatePaymentInput,
  PaymentIntentCreateInput,
  PaymentIntentRecord,
  PaymentProvider,
  PaymentProviderCapability,
  PaymentProviderHealth,
  PaymentRecord,
  PaymentWebhookEvent,
  PaymentWebhookPayload,
  PaymentWebhookResult,
  PaymentWebhookVerificationResult,
  PaymentWebhookVerifyInput,
} from "@verasjuris/ai";
import {
  billingCredits,
  ledgerTransactions,
  payables,
  payments,
  refunds,
  seedReferenceData,
} from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import { createMalwareScanner, LocalPrivateStorageProvider } from "@verasjuris/storage";
import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { bootstrapEtapa6, createDocumentWithFile, type Etapa6Setup } from "./etapa6.fixtures.js";
import { PaymentService } from "./modules/finance/payment-service.js";
import { call } from "./test-helpers.js";

class FakePaymentProvider implements PaymentProvider {
  readonly id = "stripe";
  readonly capabilities: readonly PaymentProviderCapability[] = [
    "webhook",
    "checkout_session",
    "refund",
  ];
  readonly secret = "test-webhook-secret";
  private intentSeq = 0;

  createPayment(input: CreatePaymentInput): Promise<PaymentRecord> {
    return Promise.resolve({
      externalPaymentId: `pay_${randomBytes(6).toString("hex")}`,
      status: "pending",
      providerKey: this.id,
      amountCents: input.amountCents,
    });
  }

  createPaymentIntent(input: PaymentIntentCreateInput): Promise<PaymentIntentRecord> {
    this.intentSeq += 1;
    const externalIntentId = `pi_fake_${this.intentSeq}_${randomBytes(4).toString("hex")}`;
    return Promise.resolve({
      externalIntentId,
      status: "created",
      providerKey: this.id,
      amountCents: input.amountCents,
      currency: input.currency ?? "BRL",
      paymentMethod: input.paymentMethod ?? null,
      clientSecret: `${externalIntentId}_secret`,
      checkoutUrl: null,
      expiresAt: null,
      metadata: input.metadata,
    });
  }

  createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
    return Promise.resolve({
      externalSessionId: `cs_${randomBytes(6).toString("hex")}`,
      status: "open",
      providerKey: this.id,
      checkoutUrl: `https://checkout.example.test/s/${randomBytes(4).toString("hex")}`,
      amountCents: input.amountCents,
      currency: input.currency ?? "BRL",
      expiresAt: null,
    });
  }

  getStatus(externalPaymentId: string): Promise<PaymentRecord> {
    return Promise.resolve({
      externalPaymentId,
      status: "paid",
      providerKey: this.id,
      amountCents: 0,
      paidAt: new Date().toISOString(),
    });
  }

  getPaymentStatus(externalPaymentId: string): Promise<PaymentRecord> {
    return this.getStatus(externalPaymentId);
  }

  cancel(externalPaymentId: string): Promise<PaymentRecord> {
    return Promise.resolve({
      externalPaymentId,
      status: "cancelled",
      providerKey: this.id,
      amountCents: 0,
    });
  }

  cancelPayment(externalPaymentId: string): Promise<PaymentRecord> {
    return this.cancel(externalPaymentId);
  }

  refund(externalPaymentId: string, amountCents?: number): Promise<PaymentRecord> {
    return Promise.resolve({
      externalPaymentId: `re_${randomBytes(6).toString("hex")}`,
      status: "refunded",
      providerKey: this.id,
      amountCents: amountCents ?? 0,
      paidAt: new Date().toISOString(),
    });
  }

  refundPayment(externalPaymentId: string, amountCents?: number): Promise<PaymentRecord> {
    return this.refund(externalPaymentId, amountCents);
  }

  verifyWebhook(
    payload: PaymentWebhookVerifyInput | PaymentWebhookPayload,
  ): Promise<boolean | PaymentWebhookVerificationResult> {
    const headers = payload.headers ?? {};
    const signature =
      ("signature" in payload ? payload.signature : undefined) ??
      headers["x-signature"] ??
      headers["stripe-signature"];
    const valid = signature === this.secret;
    return Promise.resolve({
      valid,
      reason: valid ? undefined : "invalid_signature",
      timestamp: null,
      timestampOutOfTolerance: false,
    });
  }

  parseWebhook(payload: PaymentWebhookPayload): Promise<PaymentWebhookEvent> {
    const raw =
      typeof payload.rawBody === "string"
        ? payload.rawBody
        : Buffer.from(payload.rawBody).toString("utf8");
    return Promise.resolve(JSON.parse(raw) as PaymentWebhookEvent);
  }

  handleWebhook(payload: PaymentWebhookPayload): Promise<PaymentWebhookResult> {
    return this.parseWebhook(payload).then((event) => ({
      externalPaymentId: event.externalPaymentId ?? "unknown",
      status: event.status === "failed" ? "failed" : "paid",
    }));
  }

  healthCheck(): Promise<PaymentProviderHealth> {
    return Promise.resolve({
      status: "ok",
      detail: "FakePaymentProvider ready",
      checkedAt: new Date().toISOString(),
    });
  }
}

describe("Etapa 21.3 — Refunds / Disputes API", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  const fake = new FakePaymentProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let s: Etapa6Setup;
  let payerId: string;
  let professionalId: string;
  let evidenceDocId: string;
  let storageRoot: string;

  const root = (org = s?.orgA) => `/v1/organizations/${org}`;
  const fin = (org = s?.orgA) => `${root(org)}/finance`;

  async function confirmedPayment(amountCents: number) {
    const intent = await call(
      app,
      "POST",
      `${root()}/payments/intents`,
      {
        payerType: "user",
        payerId,
        referenceType: "test",
        referenceId: s.matterAId,
        amountCents,
        currency: "BRL",
        paymentMethod: "pix",
        idempotencyKey: `ref-pay-${Date.now()}-${randomBytes(3).toString("hex")}`,
      },
      s.ownerA,
    );
    expect(intent.statusCode).toBe(201);
    const paymentIntent = intent.json<{ paymentIntent: { id: string } }>().paymentIntent;
    const svc = new PaymentService(database.db, fake);
    const confirmed = await svc.confirmPayment({
      paymentIntentId: paymentIntent.id,
      organizationId: s.orgA,
      amountCents,
      currency: "BRL",
      providerKey: "stripe",
      externalPaymentId: `pay_ref_${randomBytes(4).toString("hex")}`,
    });
    return confirmed.payment;
  }

  async function allocatePro(paymentId: string, productType: string) {
    await call(
      app,
      "POST",
      `${fin()}/split-rules`,
      {
        key: `plat_${productType}`.slice(0, 40).replace(/[^a-z0-9_]/g, "_"),
        productType,
        beneficiaryType: "platform",
        calculationType: "percentage",
        percentageBps: 1000,
        priority: 10,
      },
      s.ownerA,
    );
    await call(
      app,
      "POST",
      `${fin()}/split-rules`,
      {
        key: `pro_${productType}`.slice(0, 40).replace(/[^a-z0-9_]/g, "_"),
        productType,
        beneficiaryType: "professional",
        calculationType: "remainder",
        priority: 20,
      },
      s.ownerA,
    );
    const keyPro = `pro_${productType}`.slice(0, 40).replace(/[^a-z0-9_]/g, "_");
    const allocated = await call(
      app,
      "POST",
      `${fin()}/allocations`,
      {
        paymentId,
        productType,
        beneficiaryIds: { [keyPro]: professionalId },
      },
      s.ownerA,
    );
    expect(allocated.statusCode).toBe(201);
    return allocated.json<{ payables: Array<{ id: string; amountCents: number }> }>();
  }

  beforeAll(async () => {
    database = await started;
    await seedReferenceData(database.db);
    storageRoot = await mkdtemp(path.join(tmpdir(), "vj-refunds-"));
    app = await buildApp({
      db: database.db,
      logger: false,
      webOrigin: "http://127.0.0.1:3000",
      isProduction: false,
      email,
      storage: new LocalPrivateStorageProvider(storageRoot),
      malwareScanner: createMalwareScanner(),
      paymentProvider: fake,
    });
    s = await bootstrapEtapa6(app, email, "refunds");
    payerId = (await call(app, "GET", "/v1/auth/session", undefined, s.ownerA)).json<{
      account: { user: { id: string } };
    }>().account.user.id;
    professionalId = (await call(app, "GET", "/v1/auth/session", undefined, s.memberA)).json<{
      account: { user: { id: string } };
    }>().account.user.id;
    const doc = await createDocumentWithFile(app, s.ownerA, s.orgA, s.matterAId, {
      title: "Evidência disputa",
      fileName: "evidencia.txt",
      content: Buffer.from("prova", "utf8"),
      mime: "text/plain",
      confidentialityLevel: "confidential",
    });
    evidenceDocId = doc.documentId;
  });

  afterAll(async () => {
    await app?.close();
    await database?.close();
    if (storageRoot) await rm(storageRoot, { recursive: true, force: true });
  });

  it("full + partial + multiple partial refunds", async () => {
    const payment = await confirmedPayment(10_000);
    const originalLedgerId = payment.ledgerTransactionId;

    const partial1 = await call(
      app,
      "POST",
      `${fin()}/refunds`,
      {
        paymentId: payment.id,
        refundType: "partial",
        amountCents: 2_000,
        currency: "BRL",
        reason: "Parcial 1",
        idempotencyKey: `partial-1-${Date.now()}`,
      },
      s.ownerA,
    );
    expect(partial1.statusCode).toBe(201);
    expect(partial1.json<{ refund: { status: string; amountCents: number } }>().refund.status).toBe(
      "confirmed",
    );
    expect(partial1.json<{ refund: { amountCents: number } }>().refund.amountCents).toBe(2_000);

    const partial2 = await call(
      app,
      "POST",
      `${fin()}/refunds`,
      {
        paymentId: payment.id,
        refundType: "partial",
        amountCents: 3_000,
        currency: "BRL",
        reason: "Parcial 2",
        idempotencyKey: `partial-2-${Date.now()}`,
      },
      s.ownerA,
    );
    expect(partial2.statusCode).toBe(201);

    const payRow = await database.db.query.payments.findFirst({
      where: eq(payments.id, payment.id),
    });
    expect(payRow?.status).toBe("partially_refunded");

    const fullPayment = await confirmedPayment(5_000);
    const full = await call(
      app,
      "POST",
      `${fin()}/refunds`,
      {
        paymentId: fullPayment.id,
        refundType: "full",
        currency: "BRL",
        reason: "Estorno total",
        idempotencyKey: `full-${Date.now()}`,
      },
      s.ownerA,
    );
    expect(full.statusCode).toBe(201);
    expect(
      full.json<{ refund: { amountCents: number; status: string } }>().refund.amountCents,
    ).toBe(5_000);
    expect(full.json<{ refund: { status: string } }>().refund.status).toBe("confirmed");

    const refunded = await database.db.query.payments.findFirst({
      where: eq(payments.id, fullPayment.id),
    });
    expect(refunded?.status).toBe("refunded");
    void originalLedgerId;
  });

  it("over-refund blocked", async () => {
    const payment = await confirmedPayment(4_000);
    const ok = await call(
      app,
      "POST",
      `${fin()}/refunds`,
      {
        paymentId: payment.id,
        refundType: "partial",
        amountCents: 3_000,
        currency: "BRL",
        reason: "Quase tudo",
        idempotencyKey: `over-ok-${Date.now()}`,
      },
      s.ownerA,
    );
    expect(ok.statusCode).toBe(201);

    const over = await call(
      app,
      "POST",
      `${fin()}/refunds`,
      {
        paymentId: payment.id,
        refundType: "partial",
        amountCents: 2_000,
        currency: "BRL",
        reason: "Excede",
        idempotencyKey: `over-bad-${Date.now()}`,
      },
      s.ownerA,
    );
    expect(over.statusCode).toBeGreaterThanOrEqual(400);
    expect(over.json<{ error: { message: string } }>().error.message).toMatch(
      /excede|over-refund/i,
    );
  });

  it("credit refund → billing credit, not cash ledger as refund-to-bank", async () => {
    const payment = await confirmedPayment(6_000);
    const credit = await call(
      app,
      "POST",
      `${fin()}/refunds`,
      {
        paymentId: payment.id,
        refundType: "credit",
        amountCents: 1_500,
        currency: "BRL",
        reason: "Crédito comercial",
        idempotencyKey: `credit-${Date.now()}`,
      },
      s.ownerA,
    );
    expect(credit.statusCode).toBe(201);
    const refund = credit.json<{
      refund: {
        id: string;
        refundType: string;
        creditId: string | null;
        ledgerTransactionId: string | null;
        status: string;
      };
    }>().refund;
    expect(refund.refundType).toBe("credit");
    expect(refund.creditId).toBeTruthy();
    expect(refund.status).toBe("confirmed");
    expect(refund.ledgerTransactionId).toBeTruthy();

    const creditRow = await database.db.query.billingCredits.findFirst({
      where: eq(billingCredits.id, refund.creditId!),
    });
    expect(creditRow?.source).toBe("refund_credit");
    expect(creditRow?.remainingCents).toBe(1_500);
    expect(creditRow?.amountCents).toBe(1_500);

    const ledgerTx = await database.db.query.ledgerTransactions.findFirst({
      where: eq(ledgerTransactions.id, refund.ledgerTransactionId!),
    });
    expect(ledgerTx?.transactionType).toBe("credit_applied");
    expect(ledgerTx?.transactionType).not.toBe("refund");
  });

  it("refund → new ledger tx (not edit original); refund after payout → payable adjustment", async () => {
    const payment = await confirmedPayment(10_000);
    const originalLedgerId = payment.ledgerTransactionId;
    expect(originalLedgerId).toBeTruthy();

    const productType = `ref_after_${Date.now()}`;
    const alloc = await allocatePro(payment.id, productType);
    const payableId = alloc.payables[0]!.id;

    const payout = await call(
      app,
      "POST",
      `${fin()}/payouts`,
      {
        payableIds: [payableId],
        idempotencyKey: `paid-out-${Date.now()}`,
      },
      s.ownerA,
    );
    expect(payout.statusCode).toBe(201);
    // Simulate payout already paid (ledger clawback path).
    await database.db
      .update(payables)
      .set({ status: "paid", updatedAt: new Date() })
      .where(eq(payables.id, payableId));

    const refund = await call(
      app,
      "POST",
      `${fin()}/refunds`,
      {
        paymentId: payment.id,
        refundType: "partial",
        amountCents: 2_000,
        currency: "BRL",
        reason: "Após payout",
        idempotencyKey: `after-payout-${Date.now()}`,
      },
      s.ownerA,
    );
    expect(refund.statusCode).toBe(201);
    const refundRow = refund.json<{
      refund: { id: string; ledgerTransactionId: string | null };
    }>().refund;
    expect(refundRow.ledgerTransactionId).toBeTruthy();
    expect(refundRow.ledgerTransactionId).not.toBe(originalLedgerId);

    const originalStill = await database.db.query.ledgerTransactions.findFirst({
      where: eq(ledgerTransactions.id, originalLedgerId!),
    });
    expect(originalStill?.id).toBe(originalLedgerId);

    const refundTx = await database.db.query.ledgerTransactions.findFirst({
      where: eq(ledgerTransactions.id, refundRow.ledgerTransactionId!),
    });
    expect(refundTx?.referenceType).toBe("refund");
    expect(refundTx?.transactionType).toBe("refund");

    const adjustments = await database.db.query.payables.findMany({
      where: and(eq(payables.organizationId, s.orgA), eq(payables.status, "reversed")),
    });
    expect(
      adjustments.some(
        (p) =>
          p.holdReason?.includes(refundRow.id) &&
          (p.holdReason?.includes("refund_after_payout") ||
            p.holdReason?.includes("refund_adjustment") ||
            p.holdReason?.includes("refund_partial")),
      ),
    ).toBe(true);
  });

  it("dispute open, evidence, hold, resolve, history; chargeback provider NOT_CONFIGURED", async () => {
    const payment = await confirmedPayment(7_500);
    const productType = `disp_${Date.now()}`;
    const alloc = await allocatePro(payment.id, productType);
    const payableId = alloc.payables[0]!.id;

    const providerStatus = await call(
      app,
      "GET",
      `${fin()}/disputes/provider-status`,
      undefined,
      s.ownerA,
    );
    expect(providerStatus.statusCode).toBe(200);
    expect(providerStatus.json<{ provider: { status: string } }>().provider.status).toBe(
      "not_configured",
    );

    const opened = await call(
      app,
      "POST",
      `${fin()}/disputes`,
      {
        paymentId: payment.id,
        sourceType: "payment",
        sourceId: payment.id,
        disputeType: "chargeback",
        amountCents: 7_500,
        currency: "BRL",
        description: "Chargeback do cartão",
        holdApplied: true,
      },
      s.ownerA,
    );
    expect(opened.statusCode).toBe(201);
    const dispute = opened.json<{
      dispute: { id: string; status: string; holdApplied: boolean; providerKey: string };
    }>().dispute;
    expect(dispute.status).toBe("open");
    expect(dispute.holdApplied).toBe(true);
    expect(dispute.providerKey).toBe("not_configured");

    const payableAfter = await database.db.query.payables.findFirst({
      where: eq(payables.id, payableId),
    });
    expect(payableAfter?.status).toBe("held");

    const evidence = await call(
      app,
      "POST",
      `${fin()}/disputes/${dispute.id}/evidence`,
      { documentId: evidenceDocId, evidenceType: "receipt" },
      s.ownerA,
    );
    expect(evidence.statusCode).toBe(201);

    const detail = await call(app, "GET", `${fin()}/disputes/${dispute.id}`, undefined, s.ownerA);
    expect(detail.statusCode).toBe(200);
    const body = detail.json<{
      dispute: { status: string };
      evidence: unknown[];
      history: Array<{ toStatus: string }>;
    }>();
    expect(body.evidence.length).toBeGreaterThanOrEqual(1);
    expect(body.history.length).toBeGreaterThanOrEqual(1);

    const resolved = await call(
      app,
      "POST",
      `${fin()}/disputes/${dispute.id}/resolve`,
      { status: "won", resolutionNote: "Prova aceita — chargeback improcedente" },
      s.ownerA,
    );
    expect(resolved.statusCode).toBe(200);
    expect(resolved.json<{ dispute: { status: string } }>().dispute.status).toBe("won");

    const afterResolve = await call(
      app,
      "GET",
      `${fin()}/disputes/${dispute.id}`,
      undefined,
      s.ownerA,
    );
    expect(
      afterResolve
        .json<{ history: Array<{ toStatus: string }> }>()
        .history.some((h) => h.toStatus === "won"),
    ).toBe(true);
  });

  it("unauthorized refund 403/404", async () => {
    const payment = await confirmedPayment(2_000);

    const cross = await call(
      app,
      "POST",
      `${fin(s.orgB)}/refunds`,
      {
        paymentId: payment.id,
        refundType: "partial",
        amountCents: 500,
        currency: "BRL",
        reason: "Cross tenant",
        idempotencyKey: `cross-${Date.now()}`,
      },
      s.ownerB,
    );
    expect(cross.statusCode).toBe(404);

    const outsider = await call(
      app,
      "POST",
      `${fin()}/refunds`,
      {
        paymentId: payment.id,
        refundType: "partial",
        amountCents: 500,
        currency: "BRL",
        reason: "Sem acesso",
        idempotencyKey: `out-${Date.now()}`,
      },
      s.outsider,
    );
    expect(outsider.statusCode).toBeGreaterThanOrEqual(400);

    const refund = await call(
      app,
      "POST",
      `${fin()}/refunds`,
      {
        paymentId: payment.id,
        refundType: "partial",
        amountCents: 500,
        currency: "BRL",
        reason: "Ok owner",
        idempotencyKey: `owner-ok-${Date.now()}`,
      },
      s.ownerA,
    );
    expect(refund.statusCode).toBe(201);
    const refundId = refund.json<{ refund: { id: string } }>().refund.id;

    const crossApprove = await call(
      app,
      "POST",
      `${fin(s.orgB)}/refunds/${refundId}/approve`,
      {},
      s.ownerB,
    );
    expect(crossApprove.statusCode).toBe(404);

    const listed = await database.db.query.refunds.findFirst({ where: eq(refunds.id, refundId) });
    expect(listed).toBeTruthy();
  });
});
