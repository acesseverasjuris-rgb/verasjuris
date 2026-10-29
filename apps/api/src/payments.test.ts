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
import { NotConfiguredPaymentProvider } from "@verasjuris/ai";
import { ledgerTransactions, payments, seedReferenceData } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import { createMalwareScanner, LocalPrivateStorageProvider } from "@verasjuris/storage";
import { CSRF_HEADER, SESSION_COOKIE } from "@verasjuris/security";
import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { mkdtemp, rm } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { bootstrapEtapa6, createDocumentWithFile, type Etapa6Setup } from "./etapa6.fixtures.js";
import { PaymentService } from "./modules/finance/payment-service.js";
import { call } from "./test-helpers.js";

/** Fake PSP for tests — production default remains NotConfigured. */
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

  getPaymentStatus(externalPaymentId: string, signal?: AbortSignal): Promise<PaymentRecord> {
    void signal;
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

  cancelPayment(externalPaymentId: string, signal?: AbortSignal): Promise<PaymentRecord> {
    void signal;
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

  refundPayment(
    externalPaymentId: string,
    amountCents?: number,
    signal?: AbortSignal,
  ): Promise<PaymentRecord> {
    void signal;
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
    const body = JSON.parse(raw) as PaymentWebhookEvent;
    return Promise.resolve(body);
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

describe("Etapa 21 — Payments API", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  const fake = new FakePaymentProvider();
  let app: FastifyInstance;
  let appNotConfigured: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let s: Etapa6Setup;
  let storageRoot: string;
  let evidenceDocId: string;
  let payerId: string;

  const root = (org = s?.orgA) => `/v1/organizations/${org}`;

  async function webhook(
    body: Record<string, unknown>,
    signature = fake.secret,
    provider = "stripe",
  ) {
    return app.inject({
      method: "POST",
      url: `/v1/webhooks/payments/${provider}`,
      payload: JSON.stringify(body),
      headers: {
        "content-type": "application/json",
        "x-signature": signature,
      },
    });
  }

  beforeAll(async () => {
    database = await started;
    await seedReferenceData(database.db);
    storageRoot = await mkdtemp(path.join(tmpdir(), "vj-payments-"));
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
    appNotConfigured = await buildApp({
      db: database.db,
      logger: false,
      webOrigin: "http://127.0.0.1:3000",
      isProduction: false,
      email,
      paymentProvider: new NotConfiguredPaymentProvider(),
    });
    s = await bootstrapEtapa6(app, email, "payments");
    payerId = (await call(app, "GET", "/v1/auth/session", undefined, s.ownerA)).json<{
      account: { user: { id: string } };
    }>().account.user.id;

    const doc = await createDocumentWithFile(app, s.ownerA, s.orgA, s.matterAId, {
      title: "Comprovante",
      fileName: "comprovante.txt",
      content: Buffer.from("pago", "utf8"),
      mime: "text/plain",
      confidentialityLevel: "confidential",
    });
    evidenceDocId = doc.documentId;
  });

  afterAll(async () => {
    await app?.close();
    await appNotConfigured?.close();
    await database?.close();
    if (storageRoot) await rm(storageRoot, { recursive: true, force: true });
  });

  it("provider status NOT_CONFIGURED honesto no app default", async () => {
    // Bootstrap a separate session on not-configured app is heavy; check via inject after login on shared users won't work.
    // Direct health via new PaymentService:
    const svc = new PaymentService(database.db, new NotConfiguredPaymentProvider());
    const health = await svc.providerStatus();
    expect(health.status).toBe("not_configured");

    const status = await call(
      app,
      "GET",
      `${root()}/payments/provider-status`,
      undefined,
      s.ownerA,
    );
    expect(status.statusCode).toBe(200);
    expect(status.json<{ provider: { status: string } }>().provider.status).toBe("ok");
  });

  it("create intent; duplicate idempotency returns same; invalid amount rejected", async () => {
    const idem = `intent-idem-${Date.now()}`;
    const first = await call(
      app,
      "POST",
      `${root()}/payments/intents`,
      {
        payerType: "user",
        payerId,
        referenceType: "test",
        referenceId: s.matterAId,
        amountCents: 15000,
        currency: "BRL",
        paymentMethod: "pix",
        idempotencyKey: idem,
      },
      s.ownerA,
    );
    expect(first.statusCode).toBe(201);
    const intent = first.json<{
      paymentIntent: { id: string; status: string; externalIntentId: string | null };
      alreadyExists?: boolean;
    }>();
    expect(intent.paymentIntent.status).toBe("created");
    expect(intent.paymentIntent.externalIntentId).toBeTruthy();

    const second = await call(
      app,
      "POST",
      `${root()}/payments/intents`,
      {
        payerType: "user",
        payerId,
        referenceType: "test",
        referenceId: s.matterAId,
        amountCents: 15000,
        currency: "BRL",
        paymentMethod: "pix",
        idempotencyKey: idem,
      },
      s.ownerA,
    );
    expect(second.statusCode).toBe(200);
    expect(
      second.json<{ paymentIntent: { id: string }; alreadyExists: boolean }>().alreadyExists,
    ).toBe(true);
    expect(second.json<{ paymentIntent: { id: string } }>().paymentIntent.id).toBe(
      intent.paymentIntent.id,
    );

    const invalid = await call(
      app,
      "POST",
      `${root()}/payments/intents`,
      {
        payerType: "user",
        payerId,
        referenceType: "test",
        referenceId: s.matterAId,
        amountCents: 0,
        currency: "BRL",
        paymentMethod: "pix",
        idempotencyKey: `bad-${Date.now()}`,
      },
      s.ownerA,
    );
    expect(invalid.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("checkout unavailable when not configured — never approved", async () => {
    // Login on not-configured app with same credentials
    const login = await call(appNotConfigured, "POST", "/v1/auth/login", {
      email: "owner.a.payments@exemplo.com",
      password: "senha-local-12",
    });
    expect(login.statusCode).toBe(200);
    const raw = login.headers["set-cookie"];
    const cookieValue = Array.isArray(raw) ? raw.join(";") : String(raw);
    const match = cookieValue.match(/vj_session=([^;]+)/);
    const cookie = match?.[1];
    expect(cookie).toBeTruthy();

    const checkout = await appNotConfigured.inject({
      method: "POST",
      url: `${root()}/payments/checkout`,
      payload: {
        payerType: "user",
        payerId,
        referenceType: "test",
        referenceId: s.matterAId,
        amountCents: 5000,
        currency: "BRL",
        paymentMethod: "pix",
        successUrl: "https://example.com/ok",
        cancelUrl: "https://example.com/cancel",
        idempotencyKey: `checkout-nc-${Date.now()}`,
      },
      headers: {
        [CSRF_HEADER]: "1",
        "content-type": "application/json",
        cookie: `${SESSION_COOKIE}=${cookie}`,
      },
    });
    expect(checkout.statusCode).toBeLessThan(300);
    const body = checkout.json<{
      unavailable: boolean;
      paymentIntent: { status: string };
      checkout: { checkoutUrl?: string } | null;
      message: string | null;
    }>();
    expect(body.unavailable).toBe(true);
    expect(body.paymentIntent.status).toBe("not_configured");
    expect(body.checkout?.checkoutUrl ?? null).toBeNull();
    expect(body.message).toMatch(/não configurado/i);
  });

  it("frontend-style GET does NOT confirm payment", async () => {
    const created = await call(
      app,
      "POST",
      `${root()}/payments/intents`,
      {
        payerType: "user",
        payerId,
        referenceType: "test",
        referenceId: s.matterAId,
        amountCents: 2200,
        currency: "BRL",
        paymentMethod: "pix",
        idempotencyKey: `get-no-confirm-${Date.now()}`,
      },
      s.ownerA,
    );
    const intentId = created.json<{ paymentIntent: { id: string; status: string } }>().paymentIntent
      .id;

    const get1 = await call(
      app,
      "GET",
      `${root()}/payments/intents/${intentId}`,
      undefined,
      s.ownerA,
    );
    expect(get1.statusCode).toBe(200);
    expect(get1.json<{ paymentIntent: { status: string } }>().paymentIntent.status).toBe("created");

    const get2 = await call(app, "GET", `/v1/payments/intents/${intentId}`, undefined, s.ownerA);
    expect(get2.statusCode).toBe(200);
    expect(get2.json<{ paymentIntent: { status: string } }>().paymentIntent.status).toBe("created");

    const paymentRows = await database.db.query.payments.findMany({
      where: eq(payments.paymentIntentId, intentId),
    });
    expect(paymentRows).toHaveLength(0);
  });

  it("webhook invalid signature rejected; duplicate event idempotent", async () => {
    const created = await call(
      app,
      "POST",
      `${root()}/payments/intents`,
      {
        payerType: "user",
        payerId,
        referenceType: "test",
        referenceId: s.matterAId,
        amountCents: 8800,
        currency: "BRL",
        paymentMethod: "pix",
        idempotencyKey: `wh-sig-${Date.now()}`,
      },
      s.ownerA,
    );
    const intent = created.json<{
      paymentIntent: { id: string; externalIntentId: string };
    }>().paymentIntent;

    const forged = await webhook(
      {
        type: "payment.paid",
        externalIntentId: intent.externalIntentId,
        externalPaymentId: `pay_forged_${Date.now()}`,
        amountCents: 8800,
        status: "paid",
      },
      "wrong-signature",
    );
    expect(forged.statusCode).toBeGreaterThanOrEqual(400);
    expect(forged.json<{ error: { code: string } }>().error.code).toBe("AUTHORIZATION_ERROR");

    const eventId = `evt_dup_${Date.now()}`;
    const payload = {
      type: "payment.paid",
      externalIntentId: intent.externalIntentId,
      externalPaymentId: eventId,
      amountCents: 8800,
      status: "paid",
    };
    const first = await webhook(payload);
    expect(first.statusCode).toBe(200);
    expect(first.json<{ status: string }>().status).toBe("processed");

    const second = await webhook(payload);
    expect(second.statusCode).toBe(200);
    expect(second.json<{ status: string }>().status).toBe("already_processed");

    const confirmed = await database.db.query.payments.findMany({
      where: and(eq(payments.paymentIntentId, intent.id), eq(payments.status, "confirmed")),
    });
    expect(confirmed).toHaveLength(1);
    expect(confirmed[0]!.ledgerTransactionId).toBeTruthy();
  });

  it("confirmed payment posts ledger exactly once; failed payment no cash ledger; concurrency", async () => {
    const created = await call(
      app,
      "POST",
      `${root()}/payments/intents`,
      {
        payerType: "user",
        payerId,
        referenceType: "test",
        referenceId: s.matterAId,
        amountCents: 4500,
        currency: "BRL",
        paymentMethod: "pix",
        idempotencyKey: `confirm-once-${Date.now()}`,
      },
      s.ownerA,
    );
    const intent = created.json<{
      paymentIntent: { id: string; externalIntentId: string };
    }>().paymentIntent;

    const svc = new PaymentService(database.db, fake);
    const [a, b] = await Promise.all([
      svc.confirmPayment({
        paymentIntentId: intent.id,
        organizationId: s.orgA,
        amountCents: 4500,
        currency: "BRL",
        providerKey: "stripe",
        externalPaymentId: `pay_conc_${intent.id}`,
      }),
      svc.confirmPayment({
        paymentIntentId: intent.id,
        organizationId: s.orgA,
        amountCents: 4500,
        currency: "BRL",
        providerKey: "stripe",
        externalPaymentId: `pay_conc_${intent.id}`,
      }),
    ]);
    expect(a.payment.id).toBe(b.payment.id);
    expect(a.payment.ledgerTransactionId).toBeTruthy();
    expect(b.payment.ledgerTransactionId).toBe(a.payment.ledgerTransactionId);

    const ledgerRows = await database.db.query.ledgerTransactions.findMany({
      where: and(
        eq(ledgerTransactions.organizationId, s.orgA),
        eq(ledgerTransactions.referenceType, "payment"),
        eq(ledgerTransactions.referenceId, a.payment.id),
      ),
    });
    expect(ledgerRows.filter((t) => t.transactionType === "payment_received")).toHaveLength(1);

    const failedIntent = await call(
      app,
      "POST",
      `${root()}/payments/intents`,
      {
        payerType: "user",
        payerId,
        referenceType: "test",
        referenceId: s.matterAId,
        amountCents: 1200,
        currency: "BRL",
        paymentMethod: "pix",
        idempotencyKey: `fail-${Date.now()}`,
      },
      s.ownerA,
    );
    const failed = failedIntent.json<{
      paymentIntent: { id: string; externalIntentId: string };
    }>().paymentIntent;

    const failWh = await webhook({
      type: "payment.failed",
      externalIntentId: failed.externalIntentId,
      externalPaymentId: `pay_fail_${Date.now()}`,
      amountCents: 1200,
      status: "failed",
    });
    expect(failWh.statusCode).toBe(200);

    const failedPayment = await database.db.query.payments.findFirst({
      where: eq(payments.paymentIntentId, failed.id),
    });
    expect(failedPayment?.status).toBe("failed");
    expect(failedPayment?.ledgerTransactionId).toBeNull();

    const cashPosts = await database.db.query.ledgerTransactions.findMany({
      where: and(
        eq(ledgerTransactions.organizationId, s.orgA),
        eq(ledgerTransactions.referenceType, "payment"),
        eq(ledgerTransactions.referenceId, failedPayment!.id),
      ),
    });
    expect(cashPosts).toHaveLength(0);
  });

  it("refund confirmed → new ledger posting; manual payment requires evidence", async () => {
    const manualIntent = await call(
      app,
      "POST",
      `${root()}/payments/intents`,
      {
        payerType: "user",
        payerId,
        referenceType: "test",
        referenceId: s.matterAId,
        amountCents: 3300,
        currency: "BRL",
        paymentMethod: "manual",
        idempotencyKey: `manual-ev-${Date.now()}`,
      },
      s.ownerA,
    );
    const manualIntentId = manualIntent.json<{ paymentIntent: { id: string } }>().paymentIntent.id;

    const manualNoEvidence = await call(
      app,
      "POST",
      `${root()}/payments/manual`,
      {
        paymentIntentId: manualIntentId,
        amountCents: 3300,
        currency: "BRL",
      },
      s.ownerA,
    );
    expect(manualNoEvidence.statusCode).toBeGreaterThanOrEqual(400);

    const manual = await call(
      app,
      "POST",
      `${root()}/payments/manual`,
      {
        paymentIntentId: manualIntentId,
        amountCents: 3300,
        currency: "BRL",
        evidenceDocumentId: evidenceDocId,
      },
      s.ownerA,
    );
    expect(manual.statusCode).toBe(201);
    expect(manual.json<{ payment: { isManual: boolean; status: string } }>().payment.isManual).toBe(
      true,
    );
    expect(manual.json<{ payment: { status: string } }>().payment.status).toBe("confirmed");

    const created = await call(
      app,
      "POST",
      `${root()}/payments/intents`,
      {
        payerType: "user",
        payerId,
        referenceType: "test",
        referenceId: s.matterAId,
        amountCents: 9900,
        currency: "BRL",
        paymentMethod: "pix",
        idempotencyKey: `refund-${Date.now()}`,
      },
      s.ownerA,
    );
    const intent = created.json<{
      paymentIntent: { id: string; externalIntentId: string; providerKey: string };
    }>().paymentIntent;
    expect(intent.providerKey).toBe("stripe");

    const externalPaymentId = `pay_refund_${Date.now()}`;
    const paid = await webhook({
      type: "payment.paid",
      externalIntentId: intent.externalIntentId,
      externalPaymentId,
      amountCents: 9900,
      status: "paid",
    });
    expect(paid.statusCode).toBe(200);
    const payment = paid.json<{
      payment: { id: string; ledgerTransactionId: string | null };
    }>().payment;
    expect(payment.ledgerTransactionId).toBeTruthy();

    const refund = await call(
      app,
      "POST",
      `${root()}/payments/${payment.id}/refunds`,
      {
        amountCents: 9900,
        currency: "BRL",
        reason: "Estorno solicitado pelo cliente",
      },
      s.ownerA,
    );
    expect(refund.statusCode).toBe(201);
    const refundRow = refund.json<{
      refund: { id: string; status: string; ledgerTransactionId: string | null };
    }>().refund;
    expect(refundRow.status).toBe("confirmed");
    expect(refundRow.ledgerTransactionId).toBeTruthy();
    expect(refundRow.ledgerTransactionId).not.toBe(payment.ledgerTransactionId);

    const refundTx = await database.db.query.ledgerTransactions.findFirst({
      where: eq(ledgerTransactions.id, refundRow.ledgerTransactionId!),
    });
    expect(refundTx?.transactionType).toBe("refund");
  });

  it("cross-tenant payment IDOR → 404", async () => {
    const created = await call(
      app,
      "POST",
      `${root()}/payments/intents`,
      {
        payerType: "user",
        payerId,
        referenceType: "test",
        referenceId: s.matterAId,
        amountCents: 1000,
        currency: "BRL",
        paymentMethod: "pix",
        idempotencyKey: `idor-${Date.now()}`,
      },
      s.ownerA,
    );
    const intentId = created.json<{ paymentIntent: { id: string } }>().paymentIntent.id;

    const cross = await call(
      app,
      "GET",
      `${root(s.orgB)}/payments/intents/${intentId}`,
      undefined,
      s.ownerB,
    );
    expect(cross.statusCode).toBe(404);

    const outsider = await call(
      app,
      "GET",
      `${root()}/payments/intents/${intentId}`,
      undefined,
      s.outsider,
    );
    expect(outsider.statusCode).toBeGreaterThanOrEqual(400);
  });
});
