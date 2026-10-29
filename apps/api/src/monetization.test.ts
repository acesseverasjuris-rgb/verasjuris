import { apiCredentials, productPrices, seedReferenceData } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { bootstrapEtapa6, type Etapa6Setup } from "./etapa6.fixtures.js";
import { call } from "./test-helpers.js";

describe("Etapa 21.5 — Monetization API", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let s: Etapa6Setup;

  const root = (org = s?.orgA) => `/v1/organizations/${org}`;
  const mon = (org = s?.orgA) => `${root(org)}/monetization`;

  beforeAll(async () => {
    database = await started;
    await seedReferenceData(database.db);
    app = await buildApp({
      db: database.db,
      logger: false,
      webOrigin: "http://127.0.0.1:3000",
      isProduction: false,
      email,
    });
    s = await bootstrapEtapa6(app, email, "monetization");
  });

  afterAll(async () => {
    await app?.close();
    await database?.close();
  });

  it("seed/list plan tiers via products; product price versioning", async () => {
    const created = await call(
      app,
      "POST",
      `${mon()}/products`,
      {
        key: `plan_pro_${Date.now()}`,
        name: "Plano Professional",
        productType: "subscription",
        planTier: "professional",
        planTarget: "organization",
        active: true,
        public: true,
      },
      s.ownerA,
    );
    expect(created.statusCode).toBe(201);
    const product = created.json<{ product: { id: string; planTier: string } }>().product;
    expect(product.planTier).toBe("professional");

    const office = await call(
      app,
      "POST",
      `${mon()}/products`,
      {
        key: `plan_office_${Date.now()}`,
        name: "Plano Office",
        productType: "subscription",
        planTier: "office",
        active: true,
        public: true,
      },
      s.ownerA,
    );
    expect(office.statusCode).toBe(201);

    const listed = await call(app, "GET", `${mon()}/plans`, undefined, s.ownerA);
    expect(listed.statusCode).toBe(200);
    const items = listed.json<{ items: Array<{ planTier: string | null; productType: string }> }>()
      .items;
    expect(items.some((p) => p.planTier === "professional")).toBe(true);
    expect(items.some((p) => p.planTier === "office")).toBe(true);

    const price1 = await call(
      app,
      "POST",
      `${mon()}/prices`,
      {
        productId: product.id,
        amountCents: 9900,
        currency: "BRL",
        interval: "monthly",
        active: true,
      },
      s.ownerA,
    );
    expect(price1.statusCode).toBe(201);
    const v1 = price1.json<{ price: { id: string; version: number; amountCents: number } }>().price;
    expect(v1.version).toBe(1);
    expect(v1.amountCents).toBe(9900);

    const price2 = await call(
      app,
      "POST",
      `${mon()}/prices`,
      {
        productId: product.id,
        amountCents: 12900,
        currency: "BRL",
        interval: "monthly",
        active: true,
      },
      s.ownerA,
    );
    expect(price2.statusCode).toBe(201);
    const v2 = price2.json<{ price: { id: string; version: number; amountCents: number } }>().price;
    expect(v2.version).toBe(2);
    expect(v2.amountCents).toBe(12900);

    const old = await database.db.query.productPrices.findFirst({
      where: eq(productPrices.id, v1.id),
    });
    expect(old?.amountCents).toBe(9900);
    expect(old?.version).toBe(1);
  });

  it("entitlement check via EntitlementService (boolean/count/unlimited)", async () => {
    const created = await call(
      app,
      "POST",
      `${root()}/billing/plans`,
      {
        key: `ent_mon_${Date.now()}`,
        name: "Plano Entitlements",
        priceCents: 5000,
        billingInterval: "monthly",
        currency: "BRL",
        active: true,
        public: false,
      },
      s.ownerA,
    );
    const { plan, version } = created.json<{ plan: { id: string }; version: { id: string } }>();

    for (const feature of [
      { featureKey: "ai.assistant", limitType: "boolean", limitValue: 1 },
      { featureKey: "matters.max", limitType: "count", limitValue: 25 },
      { featureKey: "storage.unlimited", limitType: "unlimited", limitValue: null },
    ] as const) {
      const res = await call(
        app,
        "POST",
        `${root()}/billing/plans/${plan.id}/features`,
        { ...feature, planVersionId: version.id },
        s.ownerA,
      );
      expect(res.statusCode).toBe(201);
    }

    const before = await call(
      app,
      "GET",
      `${root()}/billing/entitlements/ai.assistant`,
      undefined,
      s.ownerA,
    );
    expect(before.json<{ entitlement: { allowed: boolean } }>().entitlement.allowed).toBe(false);

    const sub = await call(
      app,
      "POST",
      `${root()}/billing/subscriptions`,
      { planId: plan.id, planVersionId: version.id, status: "active" },
      s.ownerA,
    );
    expect(sub.statusCode).toBe(201);

    const boolOk = await call(
      app,
      "GET",
      `${root()}/billing/entitlements/ai.assistant`,
      undefined,
      s.ownerA,
    );
    expect(
      boolOk.json<{ entitlement: { allowed: boolean; limitType: string } }>().entitlement,
    ).toMatchObject({ allowed: true, limitType: "boolean" });

    const countOk = await call(
      app,
      "GET",
      `${root()}/billing/entitlements/matters.max`,
      undefined,
      s.ownerA,
    );
    expect(
      countOk.json<{ entitlement: { allowed: boolean; limitType: string; limitValue: number } }>()
        .entitlement,
    ).toMatchObject({ allowed: true, limitType: "count", limitValue: 25 });

    const unlimited = await call(
      app,
      "GET",
      `${root()}/billing/entitlements/storage.unlimited`,
      undefined,
      s.ownerA,
    );
    expect(
      unlimited.json<{ entitlement: { allowed: boolean; limitType: string } }>().entitlement,
    ).toMatchObject({ allowed: true, limitType: "unlimited" });
  });

  it("AI credit grant/consume/insufficient; credits ≠ tokens fields separate", async () => {
    const walletRes = await call(app, "GET", `${mon()}/ai-credits`, undefined, s.ownerA);
    expect(walletRes.statusCode).toBe(200);
    const walletId = walletRes.json<{ wallet: { id: string; balanceCredits: number } }>().wallet.id;

    const grant = await call(
      app,
      "POST",
      `${mon()}/ai-credits/transactions`,
      {
        walletId,
        type: "grant",
        amountCredits: 100,
        reason: "Pacote inicial",
        providerTokens: 50_000,
        providerCostMicros: 1200,
        featureKey: "ai.legal_research",
        idempotencyKey: `grant-${Date.now()}`,
      },
      s.ownerA,
    );
    expect(grant.statusCode).toBe(201);
    const granted = grant.json<{
      transaction: {
        amountCredits: number;
        providerTokens: number | null;
        balanceAfterCredits: number;
      };
      wallet: { balanceCredits: number };
    }>();
    expect(granted.transaction.amountCredits).toBe(100);
    expect(granted.transaction.providerTokens).toBe(50_000);
    expect(granted.transaction.amountCredits).not.toBe(granted.transaction.providerTokens);
    expect(granted.wallet.balanceCredits).toBe(100);

    const consume = await call(
      app,
      "POST",
      `${mon()}/ai-credits/transactions`,
      {
        walletId,
        type: "consumption",
        amountCredits: 40,
        providerTokens: 12_000,
        featureKey: "ai.legal_research",
        idempotencyKey: `consume-${Date.now()}`,
      },
      s.ownerA,
    );
    expect(consume.statusCode).toBe(201);
    expect(
      consume.json<{
        wallet: { balanceCredits: number };
        transaction: { providerTokens: number };
      }>().wallet.balanceCredits,
    ).toBe(60);
    expect(
      consume.json<{ transaction: { amountCredits: number; providerTokens: number } }>().transaction
        .amountCredits,
    ).not.toBe(
      consume.json<{ transaction: { providerTokens: number } }>().transaction.providerTokens,
    );

    const insufficient = await call(
      app,
      "POST",
      `${mon()}/ai-credits/transactions`,
      {
        walletId,
        type: "consumption",
        amountCredits: 999,
        idempotencyKey: `insuff-${Date.now()}`,
      },
      s.ownerA,
    );
    expect(insufficient.statusCode).toBeGreaterThanOrEqual(400);
    expect(insufficient.json<{ error: { message: string } }>().error.message).toMatch(
      /insuficiente/i,
    );
  });

  it("API client credential secret shown once; second fetch no plaintext; usage idempotent + aggregate", async () => {
    const client = await call(
      app,
      "POST",
      `${mon()}/api-clients`,
      { name: `Client ${Date.now()}`, status: "active" },
      s.ownerA,
    );
    expect(client.statusCode).toBe(201);
    const clientId = client.json<{ client: { id: string } }>().client.id;

    const cred = await call(
      app,
      "POST",
      `${mon()}/api-clients/${clientId}/credentials`,
      { prefix: "vj_" },
      s.ownerA,
    );
    expect(cred.statusCode).toBe(201);
    const body = cred.json<{
      secret: string;
      secretReturnedOnce: boolean;
      credential: { id: string; credentialId: string };
    }>();
    expect(body.secret).toBeTruthy();
    expect(body.secretReturnedOnce).toBe(true);
    expect(body.secret.startsWith("vj_")).toBe(true);

    const listed = await call(app, "GET", `${mon()}/api-clients`, undefined, s.ownerA);
    expect(listed.statusCode).toBe(200);
    const listedJson = JSON.stringify(listed.json());
    expect(listedJson).not.toContain(body.secret);
    expect(listedJson).not.toMatch(/"secret"\s*:/);

    const row = await database.db.query.apiCredentials.findFirst({
      where: eq(apiCredentials.id, body.credential.id),
    });
    expect(row?.secretHash).toBeTruthy();
    expect(row?.secretHash).not.toBe(body.secret);

    const usageKey = `usage-${Date.now()}`;
    const usage1 = await call(
      app,
      "POST",
      `${mon()}/api-clients/${clientId}/usage`,
      {
        endpointKey: "matters.list",
        quantity: 3,
        idempotencyKey: usageKey,
      },
      s.ownerA,
    );
    expect(usage1.statusCode).toBe(201);

    const usage2 = await call(
      app,
      "POST",
      `${mon()}/api-clients/${clientId}/usage`,
      {
        endpointKey: "matters.list",
        quantity: 3,
        idempotencyKey: usageKey,
      },
      s.ownerA,
    );
    expect(usage2.statusCode).toBe(200);
    expect(usage2.json<{ alreadyExists: boolean }>().alreadyExists).toBe(true);

    const invoice = await call(
      app,
      "POST",
      `${root()}/billing/invoices`,
      {
        currency: "BRL",
        status: "draft",
        lines: [
          {
            type: "other",
            description: "API usage placeholder",
            quantity: 1,
            unitAmountCents: 0,
            totalAmountCents: 0,
          },
        ],
      },
      s.ownerA,
    );
    expect(invoice.statusCode).toBe(201);
    const invoiceId = invoice.json<{ invoice: { id: string } }>().invoice.id;

    const periodStart = new Date(Date.now() - 86_400_000).toISOString();
    const periodEnd = new Date(Date.now() + 86_400_000).toISOString();
    const periodKey = `2026-10-${Date.now()}`;
    const agg1 = await call(
      app,
      "POST",
      `${mon()}/api-clients/${clientId}/usage/invoice-line`,
      {
        invoiceId,
        periodStart,
        periodEnd,
        unitAmountCents: 10,
        periodKey,
      },
      s.ownerA,
    );
    expect(agg1.statusCode).toBe(201);

    const agg2 = await call(
      app,
      "POST",
      `${mon()}/api-clients/${clientId}/usage/invoice-line`,
      {
        invoiceId,
        periodStart,
        periodEnd,
        unitAmountCents: 10,
        periodKey,
      },
      s.ownerA,
    );
    expect(agg2.statusCode).toBe(200);
    expect(agg2.json<{ alreadyExists: boolean }>().alreadyExists).toBe(true);
  });

  it("license active/expired; white-label branding only", async () => {
    const active = await call(
      app,
      "POST",
      `${mon()}/licenses`,
      {
        product: "VerasJuris Suite",
        licenseType: "subscription",
        status: "active",
        startsAt: new Date(Date.now() - 86_400_000).toISOString(),
        endsAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        seats: 5,
      },
      s.ownerA,
    );
    expect(active.statusCode).toBe(201);
    expect(active.json<{ license: { status: string } }>().license.status).toBe("active");

    const expired = await call(
      app,
      "POST",
      `${mon()}/licenses`,
      {
        product: "Legacy Module",
        licenseType: "term",
        status: "expired",
        startsAt: new Date(Date.now() - 90 * 86_400_000).toISOString(),
        endsAt: new Date(Date.now() - 86_400_000).toISOString(),
      },
      s.ownerA,
    );
    expect(expired.statusCode).toBe(201);
    expect(expired.json<{ license: { status: string } }>().license.status).toBe("expired");

    const listed = await call(app, "GET", `${mon()}/licenses`, undefined, s.ownerA);
    expect(listed.statusCode).toBe(200);
    const statuses = listed.json<{ items: Array<{ status: string }> }>().items.map((l) => l.status);
    expect(statuses).toContain("active");
    expect(statuses).toContain("expired");

    const wl = await call(
      app,
      "PUT",
      `${mon()}/white-label`,
      {
        enabled: true,
        brandName: "Escritório Demo",
        primaryColor: "#1a5f4a",
        secondaryColor: "#0f3d30",
        supportBranding: true,
        status: "draft",
      },
      s.ownerA,
    );
    expect(wl.statusCode).toBe(200);
    const wlBody = wl.json<{
      config: { brandName: string | null; primaryColor: string | null };
      securityUnchanged: boolean;
      auditUnchanged: boolean;
    }>();
    expect(wlBody.config.brandName).toBe("Escritório Demo");
    expect(wlBody.securityUnchanged).toBe(true);
    expect(wlBody.auditUnchanged).toBe(true);

    const got = await call(app, "GET", `${mon()}/white-label`, undefined, s.ownerA);
    expect(got.statusCode).toBe(200);
    expect(got.json<{ securityUnchanged: boolean; auditUnchanged: boolean }>()).toMatchObject({
      securityUnchanged: true,
      auditUnchanged: true,
    });
  });

  it("MRR excludes one-time if dashboard returns breakdown; cross-tenant IDOR 404", async () => {
    const monthly = await call(
      app,
      "POST",
      `${root()}/billing/plans`,
      {
        key: `mrr_month_${Date.now()}`,
        name: "Mensal",
        priceCents: 10_000,
        billingInterval: "monthly",
        currency: "BRL",
        active: true,
      },
      s.ownerA,
    );
    const monthlyPlan = monthly.json<{ plan: { id: string }; version: { id: string } }>();

    const oneTime = await call(
      app,
      "POST",
      `${root()}/billing/plans`,
      {
        key: `mrr_once_${Date.now()}`,
        name: "Avulso",
        priceCents: 50_000,
        billingInterval: "one_time",
        currency: "BRL",
        active: true,
      },
      s.ownerA,
    );
    const oneTimePlan = oneTime.json<{ plan: { id: string }; version: { id: string } }>();

    await call(
      app,
      "POST",
      `${root()}/billing/subscriptions`,
      {
        planId: monthlyPlan.plan.id,
        planVersionId: monthlyPlan.version.id,
        status: "active",
      },
      s.ownerA,
    );
    await call(
      app,
      "POST",
      `${root()}/billing/subscriptions`,
      {
        planId: oneTimePlan.plan.id,
        planVersionId: oneTimePlan.version.id,
        status: "active",
      },
      s.ownerA,
    );

    const dash = await call(app, "GET", `${mon()}/dashboard`, undefined, s.ownerA);
    expect(dash.statusCode).toBe(200);
    const metrics = dash.json<{
      mrrCents: number;
      formulas: { mrr: string };
      arrRunRateCents: number;
    }>();
    expect(metrics.formulas.mrr).toMatch(/one_time/i);
    // Monthly 10000 included; one_time 50000 excluded.
    expect(metrics.mrrCents).toBeGreaterThanOrEqual(10_000);
    expect(metrics.mrrCents).toBeLessThan(60_000);
    expect(metrics.arrRunRateCents).toBe(metrics.mrrCents * 12);

    const product = await call(
      app,
      "POST",
      `${mon()}/products`,
      {
        key: `idor_prod_${Date.now()}`,
        name: "Privado",
        productType: "other",
        active: true,
      },
      s.ownerA,
    );
    const productId = product.json<{ product: { id: string } }>().product.id;

    const crossPrice = await call(
      app,
      "POST",
      `${mon(s.orgB)}/prices`,
      {
        productId,
        amountCents: 100,
        currency: "BRL",
      },
      s.ownerB,
    );
    expect(crossPrice.statusCode).toBe(404);

    const client = await call(
      app,
      "POST",
      `${mon()}/api-clients`,
      { name: "IDOR Client" },
      s.ownerA,
    );
    const clientId = client.json<{ client: { id: string } }>().client.id;
    const crossUsage = await call(
      app,
      "POST",
      `${mon(s.orgB)}/api-clients/${clientId}/usage`,
      {
        endpointKey: "x",
        quantity: 1,
        idempotencyKey: `idor-usage-${Date.now()}`,
      },
      s.ownerB,
    );
    expect(crossUsage.statusCode).toBe(404);

    const outsider = await call(app, "GET", `${mon()}/dashboard`, undefined, s.outsider);
    expect(outsider.statusCode).toBeGreaterThanOrEqual(400);
  });
});
