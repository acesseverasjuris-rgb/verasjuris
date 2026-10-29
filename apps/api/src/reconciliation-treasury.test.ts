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
import { invoices, ledgerTransactions, seedReferenceData } from "@verasjuris/database";
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

describe("Etapa 21.4 — Reconciliation / Treasury API", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  const fake = new FakePaymentProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let s: Etapa6Setup;
  let payerId: string;
  let clientId: string;

  const root = (org = s?.orgA) => `/v1/organizations/${org}`;
  const fin = (org = s?.orgA) => `${root(org)}/finance`;

  async function confirmedPayment(amountCents: number, externalId?: string) {
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
        idempotencyKey: `recon-pay-${Date.now()}-${randomBytes(3).toString("hex")}`,
      },
      s.ownerA,
    );
    expect(intent.statusCode).toBe(201);
    const paymentIntent = intent.json<{ paymentIntent: { id: string } }>().paymentIntent;
    const ext = externalId ?? `ext_${randomBytes(6).toString("hex")}`;
    const svc = new PaymentService(database.db, fake);
    return (
      await svc.confirmPayment({
        paymentIntentId: paymentIntent.id,
        organizationId: s.orgA,
        amountCents,
        currency: "BRL",
        providerKey: "stripe",
        externalPaymentId: ext,
      })
    ).payment;
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
    s = await bootstrapEtapa6(app, email, "recon");
    payerId = (await call(app, "GET", "/v1/auth/session", undefined, s.ownerA)).json<{
      account: { user: { id: string } };
    }>().account.user.id;
    const matter = await call(app, "GET", `${root()}/matters/${s.matterAId}`, undefined, s.ownerA);
    clientId = matter.json<{ matter: { clientId: string } }>().matter.clientId;
  });

  afterAll(async () => {
    await app?.close();
    await database?.close();
  });

  it("exact match / amount mismatch / missing sides; resolve without ledger mutation", async () => {
    const now = new Date();
    const periodStart = new Date(now.getTime() - 7 * 86_400_000).toISOString();
    const periodEnd = new Date(now.getTime() + 86_400_000).toISOString();
    const occurredAt = now.toISOString();

    const matchExt = `match_${Date.now()}`;
    const mismatchExt = `mm_${Date.now()}`;
    const paymentMatch = await confirmedPayment(5_000, matchExt);
    const paymentMismatch = await confirmedPayment(8_000, mismatchExt);
    expect(paymentMatch.ledgerTransactionId).toBeTruthy();
    expect(paymentMismatch.ledgerTransactionId).toBeTruthy();

    // Bank side: exact match
    const importMatch = await call(
      app,
      "POST",
      `${fin()}/reconciliation/imports`,
      {
        sourceType: "bank",
        importSource: "manual",
        externalId: matchExt,
        occurredAt,
        amountCents: 5_000,
        currency: "BRL",
        direction: "inflow",
        description: "Match exato",
      },
      s.ownerA,
    );
    expect(importMatch.statusCode).toBe(201);

    // Bank side: amount mismatch (same externalId+currency)
    const importMismatch = await call(
      app,
      "POST",
      `${fin()}/reconciliation/imports`,
      {
        sourceType: "bank",
        importSource: "manual",
        externalId: mismatchExt,
        occurredAt,
        amountCents: 7_500,
        currency: "BRL",
        direction: "inflow",
        description: "Valor divergente",
      },
      s.ownerA,
    );
    expect(importMismatch.statusCode).toBe(201);

    // Bank-only row → missing_left on payment_provider side when matching payment_provider vs bank
    const bankOnly = await call(
      app,
      "POST",
      `${fin()}/reconciliation/imports`,
      {
        sourceType: "bank",
        importSource: "manual",
        externalId: `bank_only_${Date.now()}`,
        occurredAt,
        amountCents: 1_200,
        currency: "BRL",
        direction: "inflow",
        description: "Só no banco",
      },
      s.ownerA,
    );
    expect(bankOnly.statusCode).toBe(201);

    // Payment without bank counterpart → missing_right
    await confirmedPayment(3_300, `orphan_${Date.now()}`);

    const run = await call(
      app,
      "POST",
      `${fin()}/reconciliation/runs`,
      {
        sourceA: "payment_provider",
        sourceB: "bank",
        periodStart,
        periodEnd,
      },
      s.ownerA,
    );
    expect(run.statusCode).toBe(201);
    const runBody = run.json<{
      run: { id: string; status: string; summary: Record<string, number> | null };
      items?: Array<{ status: string; id: string }>;
    }>();
    expect(runBody.run.status).toBe("completed");

    const items = await call(
      app,
      "GET",
      `${fin()}/reconciliation/items?runId=${runBody.run.id}`,
      undefined,
      s.ownerA,
    );
    expect(items.statusCode).toBe(200);
    const itemList = items.json<{ items: Array<{ id: string; status: string }> }>().items;
    const statuses = new Set(itemList.map((i) => i.status));
    expect(statuses.has("matched")).toBe(true);
    expect(statuses.has("amount_mismatch")).toBe(true);
    expect(statuses.has("missing_left") || statuses.has("missing_right")).toBe(true);

    const mismatchItem = itemList.find((i) => i.status === "amount_mismatch");
    expect(mismatchItem).toBeTruthy();

    const ledgerBefore = await database.db.query.ledgerTransactions.findMany({
      where: eq(ledgerTransactions.organizationId, s.orgA),
    });
    const ledgerCountBefore = ledgerBefore.length;

    const resolved = await call(
      app,
      "POST",
      `${fin()}/reconciliation/items/${mismatchItem!.id}/resolve`,
      {
        status: "resolved",
        resolution: "Diferença de taxa — corrigir via reverse+post, não aqui",
      },
      s.ownerA,
    );
    expect(resolved.statusCode).toBe(200);
    expect(resolved.json<{ ledgerMutated: boolean }>().ledgerMutated).toBe(false);

    const ledgerAfter = await database.db.query.ledgerTransactions.findMany({
      where: eq(ledgerTransactions.organizationId, s.orgA),
    });
    expect(ledgerAfter.length).toBe(ledgerCountBefore);
  });

  it("receivable from invoice; AP create/approve; overdue → delinquency", async () => {
    const draft = await call(
      app,
      "POST",
      `${root()}/billing/invoices`,
      {
        currency: "BRL",
        status: "draft",
        clientId,
        dueAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
        lines: [
          {
            type: "service",
            description: "Honorários atrasados",
            quantity: 1,
            unitAmountCents: 12_000,
            totalAmountCents: 12_000,
          },
        ],
      },
      s.ownerA,
    );
    expect(draft.statusCode).toBe(201);
    const invoiceId = draft.json<{ invoice: { id: string } }>().invoice.id;
    await call(app, "POST", `${root()}/billing/invoices/${invoiceId}/issue`, {}, s.ownerA);
    await database.db
      .update(invoices)
      .set({ status: "past_due", dueAt: new Date(Date.now() - 5 * 86_400_000) })
      .where(eq(invoices.id, invoiceId));

    const syncRecv = await call(app, "POST", `${fin()}/treasury/receivables/sync`, {}, s.ownerA);
    expect(syncRecv.statusCode).toBe(200);

    const receivables = await call(
      app,
      "GET",
      `${fin()}/treasury/receivables?sync=true`,
      undefined,
      s.ownerA,
    );
    expect(receivables.statusCode).toBe(200);
    expect(
      receivables
        .json<{ items: Array<{ sourceId: string; sourceType: string }> }>()
        .items.some((r) => r.sourceId === invoiceId),
    ).toBe(true);

    const ap = await call(
      app,
      "POST",
      `${fin()}/treasury/payables`,
      {
        vendorName: "Cartório Central",
        category: "court",
        description: "Custas processuais",
        amountCents: 4500,
        currency: "BRL",
        status: "draft",
        dueAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      },
      s.ownerA,
    );
    expect(ap.statusCode).toBe(201);
    const payableId = ap.json<{ payable: { id: string; status: string } }>().payable.id;
    expect(ap.json<{ payable: { status: string } }>().payable.status).toBe("draft");

    const approved = await call(
      app,
      "POST",
      `${fin()}/treasury/payables/${payableId}/approve`,
      { note: "OK financeiro" },
      s.ownerA,
    );
    expect(approved.statusCode).toBe(200);
    expect(approved.json<{ payable: { status: string } }>().payable.status).toBe("approved");

    const delinquency = await call(app, "POST", `${fin()}/treasury/delinquency/sync`, {}, s.ownerA);
    expect(delinquency.statusCode).toBe(200);
    const cases = delinquency.json<{ items: Array<{ daysOverdue: number; stage: string }> }>();
    expect(cases.items.length).toBeGreaterThanOrEqual(1);
    expect(cases.items.some((c) => c.daysOverdue > 0)).toBe(true);
  });

  it("cash position derived; forecast versioned with actual vs projected", async () => {
    await confirmedPayment(9_900);

    const cash = await call(app, "GET", `${fin()}/treasury/cash?currency=BRL`, undefined, s.ownerA);
    expect(cash.statusCode).toBe(200);
    const cashBody = cash.json<{
      isActual: boolean;
      isForecast: boolean;
      derivedFrom: string;
      balanceCents: number;
      notBankBalance: boolean;
    }>();
    expect(cashBody.isActual).toBe(true);
    expect(cashBody.isForecast).toBe(false);
    expect(cashBody.derivedFrom).toBe("ledger");
    expect(cashBody.notBankBalance).toBe(true);
    expect(typeof cashBody.balanceCents).toBe("number");

    const periodStart = new Date().toISOString();
    const periodEnd = new Date(Date.now() + 30 * 86_400_000).toISOString();
    const forecast = await call(
      app,
      "POST",
      `${fin()}/treasury/forecast`,
      {
        name: "Base 30d",
        scenario: "base",
        currency: "BRL",
        periodStart,
        periodEnd,
      },
      s.ownerA,
    );
    expect(forecast.statusCode).toBe(201);
    const created = forecast.json<{
      forecast: { id: string; currentVersionId: string | null };
      currentVersion: { id: string; version: number };
      projected: { closingBalanceCents: number; inflowsCents: number };
      actual: { openingBalanceCents: number | null; inflowsCents: number | null };
      isForecast: boolean;
      isActual: boolean;
    }>();
    expect(created.isForecast).toBe(true);
    expect(created.isActual).toBe(false);
    expect(created.projected).toBeTruthy();
    expect(created.actual).toBeTruthy();
    expect(created.currentVersion.version).toBe(1);

    const refreshed = await call(
      app,
      "POST",
      `${fin()}/treasury/forecast/${created.forecast.id}/refresh`,
      {},
      s.ownerA,
    );
    expect(refreshed.statusCode).toBe(201);
    const v2 = refreshed.json<{
      currentVersion: { version: number; id: string };
      projected: unknown;
      actual: unknown;
      isForecast: boolean;
    }>();
    expect(v2.currentVersion.version).toBe(2);
    expect(v2.currentVersion.id).not.toBe(created.currentVersion.id);
    expect(v2.isForecast).toBe(true);

    const got = await call(
      app,
      "GET",
      `${fin()}/treasury/forecast/${created.forecast.id}`,
      undefined,
      s.ownerA,
    );
    expect(got.statusCode).toBe(200);
    const detail = got.json<{
      versions: unknown[];
      projected: { closingBalanceCents: number } | null;
      actual: { inflowsCents: number | null } | null;
      isForecast: boolean;
      isActual: boolean;
    }>();
    expect(detail.versions.length).toBeGreaterThanOrEqual(2);
    expect(detail.isForecast).toBe(true);
    expect(detail.isActual).toBe(false);
    expect(detail.projected).toBeTruthy();
    expect(detail.actual).toBeTruthy();
  });
});
