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
import { payables, seedReferenceData, splitRules } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { bootstrapEtapa6, type Etapa6Setup } from "./etapa6.fixtures.js";
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

describe("Etapa 21.3 — Split / Payables / Payouts API", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  const fake = new FakePaymentProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let s: Etapa6Setup;
  let payerId: string;
  let professionalId: string;

  const root = (org = s?.orgA) => `/v1/organizations/${org}`;
  const fin = (org = s?.orgA) => `${root(org)}/finance`;

  async function confirmedPayment(amountCents: number, currency = "BRL") {
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
        currency,
        paymentMethod: "pix",
        idempotencyKey: `split-pay-${Date.now()}-${randomBytes(3).toString("hex")}`,
      },
      s.ownerA,
    );
    expect(intent.statusCode).toBe(201);
    const paymentIntent = intent.json<{ paymentIntent: { id: string } }>().paymentIntent;
    const payments = new PaymentService(database.db, fake);
    const confirmed = await payments.confirmPayment({
      paymentIntentId: paymentIntent.id,
      organizationId: s.orgA,
      amountCents,
      currency,
      providerKey: "stripe",
      externalPaymentId: `pay_split_${randomBytes(4).toString("hex")}`,
    });
    return confirmed.payment;
  }

  async function createRule(body: Record<string, unknown>) {
    const res = await call(app, "POST", `${fin()}/split-rules`, body, s.ownerA);
    expect(res.statusCode).toBe(201);
    return res.json<{ splitRule: { id: string; key: string; version: number } }>().splitRule;
  }

  beforeAll(async () => {
    database = await started;
    await seedReferenceData(database.db);
    app = await buildApp({
      db: database.db,
      logger: false,
      webOrigin: "http://127.0.0.1:3000",
      isProduction: false,
      email,
      paymentProvider: fake,
    });
    s = await bootstrapEtapa6(app, email, "split");
    payerId = (await call(app, "GET", "/v1/auth/session", undefined, s.ownerA)).json<{
      account: { user: { id: string } };
    }>().account.user.id;
    professionalId = (await call(app, "GET", "/v1/auth/session", undefined, s.memberA)).json<{
      account: { user: { id: string } };
    }>().account.user.id;
  });

  afterAll(async () => {
    await app?.close();
    await database?.close();
  });

  it("percentage / fixed / percentage_plus_fixed / remainder + multiple beneficiaries", async () => {
    const productType = `svc_calc_${Date.now()}`;
    await createRule({
      key: "platform_pct",
      productType,
      beneficiaryType: "platform",
      calculationType: "percentage",
      percentageBps: 1000,
      priority: 10,
    });
    await createRule({
      key: "tech_fixed",
      productType,
      beneficiaryType: "platform",
      calculationType: "fixed",
      fixedAmountCents: 500,
      priority: 20,
    });
    await createRule({
      key: "partner_combo",
      productType,
      beneficiaryType: "partner",
      calculationType: "percentage_plus_fixed",
      percentageBps: 500,
      fixedAmountCents: 200,
      priority: 30,
    });
    await createRule({
      key: "pro_remainder",
      productType,
      beneficiaryType: "professional",
      calculationType: "remainder",
      priority: 100,
    });

    const payment = await confirmedPayment(10_000);
    const allocated = await call(
      app,
      "POST",
      `${fin()}/allocations`,
      {
        paymentId: payment.id,
        productType,
        beneficiaryIds: {
          partner_combo: professionalId,
          pro_remainder: professionalId,
        },
      },
      s.ownerA,
    );
    expect(allocated.statusCode).toBe(201);
    const body = allocated.json<{
      allocations: Array<{
        beneficiaryType: string;
        grossCents: number;
        ruleSnapshotJson: { calculationType?: string; key?: string };
      }>;
      payables: Array<{ amountCents: number; beneficiaryId: string }>;
    }>();

    const byKey = Object.fromEntries(
      body.allocations.map((a) => [a.ruleSnapshotJson.key, a.grossCents]),
    );
    // 10% of 10000 = 1000; fixed 500; 5%+200 = 700; remainder = 10000-2200 = 7800
    expect(byKey.platform_pct).toBe(1000);
    expect(byKey.tech_fixed).toBe(500);
    expect(byKey.partner_combo).toBe(700);
    expect(byKey.pro_remainder).toBe(7800);
    expect(body.allocations.length).toBe(4);
    expect(body.payables.length).toBeGreaterThanOrEqual(2);
    expect(body.payables.every((p) => p.beneficiaryId === professionalId)).toBe(true);
  });

  it("over-allocation blocked", async () => {
    const productType = `svc_over_${Date.now()}`;
    await createRule({
      key: "a_pct",
      productType,
      beneficiaryType: "platform",
      calculationType: "percentage",
      percentageBps: 6000,
      priority: 10,
    });
    await createRule({
      key: "b_pct",
      productType,
      beneficiaryType: "platform",
      calculationType: "percentage",
      percentageBps: 6000,
      priority: 20,
    });

    const payment = await confirmedPayment(10_000);
    const allocated = await call(
      app,
      "POST",
      `${fin()}/allocations`,
      { paymentId: payment.id, productType },
      s.ownerA,
    );
    expect(allocated.statusCode).toBeGreaterThanOrEqual(400);
    expect(allocated.json<{ error: { message: string } }>().error.message).toMatch(/excede/i);
  });

  it("currency mismatch blocked", async () => {
    const productType = `svc_fx_${Date.now()}`;
    await createRule({
      key: "usd_only",
      productType,
      beneficiaryType: "platform",
      calculationType: "percentage",
      percentageBps: 10000,
      priority: 10,
      snapshotJson: { currency: "USD" },
    });

    const payment = await confirmedPayment(5_000, "BRL");
    const allocated = await call(
      app,
      "POST",
      `${fin()}/allocations`,
      { paymentId: payment.id, productType },
      s.ownerA,
    );
    expect(allocated.statusCode).toBeGreaterThanOrEqual(400);
    expect(allocated.json<{ error: { message: string } }>().error.message).toMatch(
      /moeda|currency/i,
    );

    // Mixed payable currencies also blocked at payout creation.
    const productB = `svc_fx_pay_${Date.now()}`;
    await createRule({
      key: "platform_all",
      productType: productB,
      beneficiaryType: "platform",
      calculationType: "percentage",
      percentageBps: 1000,
      priority: 10,
    });
    await createRule({
      key: "pro_rest",
      productType: productB,
      beneficiaryType: "professional",
      calculationType: "remainder",
      priority: 20,
    });
    const pay = await confirmedPayment(8_000);
    const alloc = await call(
      app,
      "POST",
      `${fin()}/allocations`,
      {
        paymentId: pay.id,
        productType: productB,
        beneficiaryIds: { pro_rest: professionalId },
      },
      s.ownerA,
    );
    expect(alloc.statusCode).toBe(201);
    const payableId = alloc.json<{ payables: Array<{ id: string }> }>().payables[0]!.id;
    await database.db.update(payables).set({ currency: "USD" }).where(eq(payables.id, payableId));

    // Create a second BRL payable via another payment so we can attempt mixed payout.
    const pay2 = await confirmedPayment(4_000);
    const alloc2 = await call(
      app,
      "POST",
      `${fin()}/allocations`,
      {
        paymentId: pay2.id,
        productType: productB,
        beneficiaryIds: { pro_rest: professionalId },
      },
      s.ownerA,
    );
    const payable2 = alloc2.json<{ payables: Array<{ id: string }> }>().payables[0]!.id;
    const payout = await call(
      app,
      "POST",
      `${fin()}/payouts`,
      {
        payableIds: [payableId, payable2],
        idempotencyKey: `mixed-fx-${Date.now()}`,
      },
      s.ownerA,
    );
    expect(payout.statusCode).toBeGreaterThanOrEqual(400);
    expect(payout.json<{ error: { message: string } }>().error.message).toMatch(/moeda/i);
  });

  it("rule version snapshot preserved on allocation", async () => {
    const productType = `svc_snap_${Date.now()}`;
    const key = "snap_fee";
    const v1 = await createRule({
      key,
      productType,
      beneficiaryType: "platform",
      calculationType: "percentage",
      percentageBps: 1500,
      priority: 10,
    });
    expect(v1.version).toBe(1);

    const payment = await confirmedPayment(10_000);
    const allocated = await call(
      app,
      "POST",
      `${fin()}/allocations`,
      { paymentId: payment.id, productType },
      s.ownerA,
    );
    expect(allocated.statusCode).toBe(201);
    const allocation = allocated.json<{
      allocations: Array<{
        ruleVersionId: string;
        ruleSnapshotJson: { version?: number; percentageBps?: number };
        grossCents: number;
      }>;
    }>().allocations[0]!;
    expect(allocation.ruleVersionId).toBe(v1.id);
    expect(allocation.ruleSnapshotJson.version).toBe(1);
    expect(allocation.ruleSnapshotJson.percentageBps).toBe(1500);
    expect(allocation.grossCents).toBe(1500);

    const v2 = await createRule({
      key,
      productType,
      beneficiaryType: "platform",
      calculationType: "percentage",
      percentageBps: 2500,
      priority: 10,
    });
    expect(v2.version).toBe(2);

    // Previous allocation snapshot unchanged in DB / response listing.
    const listed = await call(
      app,
      "GET",
      `${fin()}/allocations?paymentId=${payment.id}`,
      undefined,
      s.ownerA,
    );
    const snap = listed.json<{
      items: Array<{ ruleSnapshotJson: { version?: number; percentageBps?: number } }>;
    }>().items[0]!.ruleSnapshotJson;
    expect(snap.version).toBe(1);
    expect(snap.percentageBps).toBe(1500);

    const latest = await database.db.query.splitRules.findFirst({
      where: eq(splitRules.id, v2.id),
    });
    expect(latest?.percentageBps).toBe(2500);
  });

  it("retention with explicit source; payable created before payout; process → NOT_CONFIGURED", async () => {
    const productType = `svc_ret_${Date.now()}`;
    await createRule({
      key: "platform_fee",
      productType,
      beneficiaryType: "platform",
      calculationType: "percentage",
      percentageBps: 1000,
      priority: 10,
    });
    await createRule({
      key: "pro_share",
      productType,
      beneficiaryType: "professional",
      calculationType: "remainder",
      priority: 20,
    });

    const payment = await confirmedPayment(10_000);
    const allocated = await call(
      app,
      "POST",
      `${fin()}/allocations`,
      {
        paymentId: payment.id,
        productType,
        beneficiaryIds: { pro_share: professionalId },
        retentions: [
          {
            ruleKey: "pro_share",
            type: "tax_withholding",
            amountCents: 300,
            source: "manual",
          },
        ],
      },
      s.ownerA,
    );
    expect(allocated.statusCode).toBe(201);
    const body = allocated.json<{
      retentions: Array<{ source: string; amountCents: number; type: string }>;
      payables: Array<{ id: string; amountCents: number; status: string }>;
      allocations: Array<{ retentionAmountCents: number; netCents: number }>;
    }>();
    expect(body.retentions).toHaveLength(1);
    expect(body.retentions[0]!.source).toBe("manual");
    expect(body.retentions[0]!.amountCents).toBe(300);
    expect(body.payables).toHaveLength(1);
    // remainder 9000 - retention 300 = 8700
    expect(body.payables[0]!.amountCents).toBe(8700);
    expect(body.payables[0]!.status).toBe("available");

    const payableId = body.payables[0]!.id;
    const created = await call(
      app,
      "POST",
      `${fin()}/payouts`,
      {
        payableIds: [payableId],
        idempotencyKey: `payout-nc-${Date.now()}`,
      },
      s.ownerA,
    );
    expect(created.statusCode).toBe(201);
    const payout = created.json<{
      payout: { id: string; status: string; payableId: string | null };
    }>().payout;
    expect(payout.payableId).toBe(payableId);
    expect(payout.status).not.toBe("paid");
    expect(["not_configured", "pending"].includes(payout.status)).toBe(true);

    const processed = await call(
      app,
      "POST",
      `${fin()}/payouts/${payout.id}/process`,
      {},
      s.ownerA,
    );
    expect(processed.statusCode).toBe(200);
    const after = processed.json<{ payout: { status: string } }>().payout;
    expect(after.status).toBe("not_configured");
    expect(after.status).not.toBe("paid");
  });

  it("hold/release payable and payout; duplicate payout idempotency", async () => {
    const productType = `svc_hold_${Date.now()}`;
    await createRule({
      key: "platform_h",
      productType,
      beneficiaryType: "platform",
      calculationType: "percentage",
      percentageBps: 1000,
      priority: 10,
    });
    await createRule({
      key: "pro_h",
      productType,
      beneficiaryType: "professional",
      calculationType: "remainder",
      priority: 20,
    });

    const payment = await confirmedPayment(6_000);
    const allocated = await call(
      app,
      "POST",
      `${fin()}/allocations`,
      {
        paymentId: payment.id,
        productType,
        beneficiaryIds: { pro_h: professionalId },
      },
      s.ownerA,
    );
    const payableId = allocated.json<{ payables: Array<{ id: string }> }>().payables[0]!.id;

    const held = await call(
      app,
      "POST",
      `${fin()}/payables/${payableId}/hold`,
      { holdReason: "Disputa em análise" },
      s.ownerA,
    );
    expect(held.statusCode).toBe(200);
    expect(held.json<{ payable: { status: string; holdReason: string } }>().payable.status).toBe(
      "held",
    );

    const released = await call(
      app,
      "POST",
      `${fin()}/payables/${payableId}/release`,
      { note: "Liberado" },
      s.ownerA,
    );
    expect(released.statusCode).toBe(200);
    expect(released.json<{ payable: { status: string } }>().payable.status).toBe("available");

    const idem = `payout-idem-${Date.now()}`;
    const first = await call(
      app,
      "POST",
      `${fin()}/payouts`,
      { payableIds: [payableId], idempotencyKey: idem },
      s.ownerA,
    );
    expect(first.statusCode).toBe(201);
    const payoutId = first.json<{ payout: { id: string } }>().payout.id;

    const second = await call(
      app,
      "POST",
      `${fin()}/payouts`,
      { payableIds: [payableId], idempotencyKey: idem },
      s.ownerA,
    );
    expect(second.statusCode).toBe(200);
    expect(second.json<{ alreadyExists: boolean; payout: { id: string } }>().alreadyExists).toBe(
      true,
    );
    expect(second.json<{ payout: { id: string } }>().payout.id).toBe(payoutId);

    const holdPayout = await call(
      app,
      "POST",
      `${fin()}/payouts/${payoutId}/hold`,
      { holdReason: "Compliance review" },
      s.ownerA,
    );
    expect(holdPayout.statusCode).toBe(200);
    expect(holdPayout.json<{ payout: { status: string } }>().payout.status).toBe("held");

    const releasePayout = await call(
      app,
      "POST",
      `${fin()}/payouts/${payoutId}/release`,
      {},
      s.ownerA,
    );
    expect(releasePayout.statusCode).toBe(200);
    expect(releasePayout.json<{ payout: { status: string } }>().payout.status).not.toBe("held");
  });

  it("cross-tenant split/payout IDOR → 404", async () => {
    const productType = `svc_idor_${Date.now()}`;
    await createRule({
      key: "platform_i",
      productType,
      beneficiaryType: "platform",
      calculationType: "percentage",
      percentageBps: 1000,
      priority: 10,
    });
    await createRule({
      key: "pro_i",
      productType,
      beneficiaryType: "professional",
      calculationType: "remainder",
      priority: 20,
    });
    const payment = await confirmedPayment(3_000);
    const allocated = await call(
      app,
      "POST",
      `${fin()}/allocations`,
      {
        paymentId: payment.id,
        productType,
        beneficiaryIds: { pro_i: professionalId },
      },
      s.ownerA,
    );
    const payableId = allocated.json<{ payables: Array<{ id: string }> }>().payables[0]!.id;

    const crossHold = await call(
      app,
      "POST",
      `${fin(s.orgB)}/payables/${payableId}/hold`,
      { holdReason: "IDOR" },
      s.ownerB,
    );
    expect(crossHold.statusCode).toBe(404);

    const crossAlloc = await call(
      app,
      "POST",
      `${fin(s.orgB)}/allocations`,
      {
        paymentId: payment.id,
        productType,
        beneficiaryIds: { pro_i: professionalId },
      },
      s.ownerB,
    );
    expect(crossAlloc.statusCode).toBe(404);

    const outsider = await call(app, "GET", `${fin()}/payables`, undefined, s.outsider);
    expect(outsider.statusCode).toBeGreaterThanOrEqual(400);
  });
});
