import {
  billingCredits,
  billingPlanVersions,
  invoices,
  ledgerTransactions,
  seedReferenceData,
} from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { bootstrapEtapa6, type Etapa6Setup } from "./etapa6.fixtures.js";
import { BillingService } from "./modules/finance/billing-service.js";
import { call } from "./test-helpers.js";

describe("Etapa 21 — Billing / Finance API", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let s: Etapa6Setup;
  let clientId: string;
  let ownerUserId: string;

  const root = (org = s?.orgA) => `/v1/organizations/${org}`;

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
    s = await bootstrapEtapa6(app, email, "finance");
    const matter = await call(app, "GET", `${root()}/matters/${s.matterAId}`, undefined, s.ownerA);
    clientId = matter.json<{ matter: { clientId: string } }>().matter.clientId;
    ownerUserId = (await call(app, "GET", "/v1/auth/session", undefined, s.ownerA)).json<{
      account: { user: { id: string } };
    }>().account.user.id;
  });

  afterAll(async () => {
    await app?.close();
    await database?.close();
  });

  it("plano + versão: mudança de preço não altera versão antiga", async () => {
    const created = await call(
      app,
      "POST",
      `${root()}/billing/plans`,
      {
        key: `pro_${Date.now()}`,
        name: "Plano Pro",
        billingInterval: "monthly",
        priceCents: 9900,
        currency: "BRL",
        active: true,
        public: true,
      },
      s.ownerA,
    );
    expect(created.statusCode).toBe(201);
    const { plan, version } = created.json<{
      plan: { id: string; priceCents: number; currentVersionId: string };
      version: { id: string; version: number; priceCents: number };
    }>();
    expect(version.priceCents).toBe(9900);
    const v1Id = version.id;

    const v2 = await call(
      app,
      "POST",
      `${root()}/billing/plans/${plan.id}/versions`,
      { priceCents: 14900, name: "Plano Pro 2026" },
      s.ownerA,
    );
    expect(v2.statusCode).toBe(201);
    const next = v2.json<{
      plan: { priceCents: number; currentVersionId: string };
      version: { id: string; priceCents: number; version: number };
    }>();
    expect(next.plan.priceCents).toBe(14900);
    expect(next.version.priceCents).toBe(14900);
    expect(next.version.id).not.toBe(v1Id);

    const old = await database.db.query.billingPlanVersions.findFirst({
      where: eq(billingPlanVersions.id, v1Id),
    });
    expect(old?.priceCents).toBe(9900);

    const versions = await call(
      app,
      "GET",
      `${root()}/billing/plans/${plan.id}/versions`,
      undefined,
      s.ownerA,
    );
    expect(versions.statusCode).toBe(200);
    expect(versions.json<{ items: unknown[] }>().items.length).toBeGreaterThanOrEqual(2);
  });

  it("EntitlementService via API de feature gate", async () => {
    const created = await call(
      app,
      "POST",
      `${root()}/billing/plans`,
      {
        key: `ent_${Date.now()}`,
        name: "Plano Entitlement",
        priceCents: 5000,
        billingInterval: "monthly",
        currency: "BRL",
        active: true,
        public: false,
      },
      s.ownerA,
    );
    const { plan, version } = created.json<{
      plan: { id: string };
      version: { id: string };
    }>();

    const feature = await call(
      app,
      "POST",
      `${root()}/billing/plans/${plan.id}/features`,
      {
        featureKey: "ai.legal_research",
        limitType: "boolean",
        limitValue: 1,
        planVersionId: version.id,
      },
      s.ownerA,
    );
    expect(feature.statusCode).toBe(201);

    const denied = await call(
      app,
      "GET",
      `${root()}/billing/entitlements/ai.legal_research`,
      undefined,
      s.ownerA,
    );
    expect(denied.statusCode).toBe(200);
    expect(
      denied.json<{ entitlement: { allowed: boolean; reason: string } }>().entitlement.allowed,
    ).toBe(false);

    const sub = await call(
      app,
      "POST",
      `${root()}/billing/subscriptions`,
      {
        planId: plan.id,
        planVersionId: version.id,
        status: "active",
        organizationId: s.orgA,
      },
      s.ownerA,
    );
    expect(sub.statusCode).toBe(201);

    const allowed = await call(
      app,
      "GET",
      `${root()}/billing/entitlements/ai.legal_research`,
      undefined,
      s.ownerA,
    );
    expect(
      allowed.json<{ entitlement: { allowed: boolean; reason: string } }>().entitlement.allowed,
    ).toBe(true);
  });

  it("assinatura create/cancel", async () => {
    const created = await call(
      app,
      "POST",
      `${root()}/billing/plans`,
      {
        key: `sub_${Date.now()}`,
        name: "Plano Sub",
        priceCents: 1000,
        billingInterval: "monthly",
        currency: "BRL",
        active: true,
        public: false,
      },
      s.ownerA,
    );
    const { plan, version } = created.json<{ plan: { id: string }; version: { id: string } }>();

    const sub = await call(
      app,
      "POST",
      `${root()}/billing/subscriptions`,
      { planId: plan.id, planVersionId: version.id, status: "active" },
      s.ownerA,
    );
    expect(sub.statusCode).toBe(201);
    const subscriptionId = sub.json<{ subscription: { id: string; status: string } }>().subscription
      .id;

    const cancelled = await call(
      app,
      "POST",
      `${root()}/billing/subscriptions/${subscriptionId}/cancel`,
      { atPeriodEnd: false },
      s.ownerA,
    );
    expect(cancelled.statusCode).toBe(200);
    expect(
      cancelled.json<{ subscription: { status: string; cancelledAt: string | null } }>()
        .subscription.status,
    ).toBe("cancelled");
  });

  it("invoice totals = lines; parcial; pago; past_due; void", async () => {
    const draft = await call(
      app,
      "POST",
      `${root()}/billing/invoices`,
      {
        currency: "BRL",
        status: "draft",
        clientId,
        lines: [
          {
            type: "service",
            description: "Consulta",
            quantity: 1,
            unitAmountCents: 10000,
            totalAmountCents: 10000,
          },
          {
            type: "service",
            description: "Petição",
            quantity: 1,
            unitAmountCents: 5000,
            totalAmountCents: 5000,
          },
        ],
      },
      s.ownerA,
    );
    expect(draft.statusCode).toBe(201);
    const invoice = draft.json<{
      invoice: {
        id: string;
        subtotalCents: number;
        totalCents: number;
        amountDueCents: number;
        lines: Array<{ totalAmountCents: number }>;
      };
    }>().invoice;
    const linesSum = invoice.lines.reduce((sum, l) => sum + l.totalAmountCents, 0);
    expect(invoice.subtotalCents).toBe(linesSum);
    expect(invoice.totalCents).toBe(15000);
    expect(invoice.amountDueCents).toBe(15000);

    const issued = await call(
      app,
      "POST",
      `${root()}/billing/invoices/${invoice.id}/issue`,
      {},
      s.ownerA,
    );
    expect(issued.statusCode).toBe(200);
    expect(issued.json<{ invoice: { status: string } }>().invoice.status).toBe("open");

    const billing = new BillingService(database.db);
    await billing.applyPaymentToInvoice(s.orgA, invoice.id, 5000);
    let row = await database.db.query.invoices.findFirst({ where: eq(invoices.id, invoice.id) });
    expect(row?.status).toBe("partially_paid");
    expect(row?.amountPaidCents).toBe(5000);
    expect(row?.amountDueCents).toBe(10000);

    await billing.applyPaymentToInvoice(s.orgA, invoice.id, 10000);
    row = await database.db.query.invoices.findFirst({ where: eq(invoices.id, invoice.id) });
    expect(row?.status).toBe("paid");
    expect(row?.amountDueCents).toBe(0);

    const pastDueInvoice = await call(
      app,
      "POST",
      `${root()}/billing/invoices`,
      {
        currency: "BRL",
        status: "open",
        clientId,
        dueAt: new Date(Date.now() - 86400000).toISOString(),
        lines: [
          {
            type: "service",
            description: "Atraso",
            quantity: 1,
            unitAmountCents: 2000,
            totalAmountCents: 2000,
          },
        ],
      },
      s.ownerA,
    );
    expect(pastDueInvoice.statusCode).toBe(201);
    const pastDueId = pastDueInvoice.json<{ invoice: { id: string } }>().invoice.id;
    await database.db
      .update(invoices)
      .set({ status: "past_due" })
      .where(eq(invoices.id, pastDueId));
    const listedPast = await call(
      app,
      "GET",
      `${root()}/billing/invoices?status=past_due`,
      undefined,
      s.ownerA,
    );
    expect(
      listedPast.json<{ items: Array<{ id: string }> }>().items.some((i) => i.id === pastDueId),
    ).toBe(true);

    const toVoid = await call(
      app,
      "POST",
      `${root()}/billing/invoices`,
      {
        currency: "BRL",
        status: "draft",
        lines: [
          {
            type: "other",
            description: "Void me",
            quantity: 1,
            unitAmountCents: 100,
            totalAmountCents: 100,
          },
        ],
      },
      s.ownerA,
    );
    const voidId = toVoid.json<{ invoice: { id: string } }>().invoice.id;
    await call(app, "POST", `${root()}/billing/invoices/${voidId}/issue`, {}, s.ownerA);
    const voided = await call(
      app,
      "POST",
      `${root()}/billing/invoices/${voidId}/void`,
      {},
      s.ownerA,
    );
    expect(voided.statusCode).toBe(200);
    expect(voided.json<{ invoice: { status: string } }>().invoice.status).toBe("void");
  });

  it("créditos são entidade separada do ledger (com vínculo opcional)", async () => {
    const created = await call(
      app,
      "POST",
      `${root()}/billing/credits`,
      {
        amountCents: 3000,
        currency: "BRL",
        reason: "Crédito promocional de teste",
        source: "manual",
        userId: ownerUserId,
      },
      s.ownerA,
    );
    expect(created.statusCode).toBe(201);
    const credit = created.json<{
      credit: { id: string; amountCents: number; remainingCents: number; status: string };
    }>().credit;
    expect(credit.status).toBe("available");
    expect(credit.remainingCents).toBe(3000);

    const listed = await call(app, "GET", `${root()}/billing/credits`, undefined, s.ownerA);
    expect(
      listed.json<{ items: Array<{ id: string }> }>().items.some((c) => c.id === credit.id),
    ).toBe(true);

    const creditRow = await database.db.query.billingCredits.findFirst({
      where: eq(billingCredits.id, credit.id),
    });
    expect(creditRow).toBeTruthy();
    expect(creditRow!.ledgerTransactionId).toBeTruthy();

    const ledgerTx = await database.db.query.ledgerTransactions.findFirst({
      where: eq(ledgerTransactions.id, creditRow!.ledgerTransactionId!),
    });
    expect(ledgerTx?.transactionType).toBe("credit_applied");
    expect(ledgerTx?.referenceType).toBe("billing_credit");
    // Crédito vive em billing_credits; ledger é lançamento contábil derivado, não o saldo do crédito.
    expect(creditRow!.remainingCents).toBe(3000);
  });

  it("honorários fixed + percentage BPS + accrual; custos persistem", async () => {
    const fixed = await call(
      app,
      "POST",
      `${root()}/billing/honorarios`,
      {
        clientId,
        legalMatterId: s.matterAId,
        feeType: "fixed",
        fixedAmountCents: 500000,
        currency: "BRL",
        status: "active",
      },
      s.ownerA,
    );
    expect(fixed.statusCode).toBe(201);
    const fixedId = fixed.json<{ agreement: { id: string; feeType: string } }>().agreement.id;

    const pct = await call(
      app,
      "POST",
      `${root()}/billing/honorarios`,
      {
        clientId,
        legalMatterId: s.matterAId,
        feeType: "percentage",
        percentageBps: 1500,
        currency: "BRL",
        status: "active",
      },
      s.ownerA,
    );
    expect(pct.statusCode).toBe(201);
    expect(pct.json<{ agreement: { percentageBps: number } }>().agreement.percentageBps).toBe(1500);

    const accrual = await call(
      app,
      "POST",
      `${root()}/billing/honorarios/${fixedId}/accruals`,
      {
        amountCents: 100000,
        currency: "BRL",
        description: "Parcela 1",
      },
      s.ownerA,
    );
    expect(accrual.statusCode).toBe(201);
    expect(
      accrual.json<{ accrual: { status: string; amountCents: number } }>().accrual.status,
    ).toBe("accrued");

    const accruals = await call(
      app,
      "GET",
      `${root()}/billing/honorarios/${fixedId}/accruals`,
      undefined,
      s.ownerA,
    );
    expect(accruals.json<{ items: unknown[] }>().items.length).toBeGreaterThanOrEqual(1);

    const cost = await call(
      app,
      "POST",
      `${root()}/billing/costs`,
      {
        category: "court",
        description: "Custas judiciais",
        amountCents: 4500,
        currency: "BRL",
        legalMatterId: s.matterAId,
      },
      s.ownerA,
    );
    expect(cost.statusCode).toBe(201);
    const costId = cost.json<{ cost: { id: string } }>().cost.id;

    const costs = await call(app, "GET", `${root()}/billing/costs`, undefined, s.ownerA);
    expect(costs.statusCode).toBe(200);
    expect(costs.json<{ items: Array<{ id: string }> }>().items.some((c) => c.id === costId)).toBe(
      true,
    );
  });

  it("IDOR / cross-tenant billing → 404", async () => {
    const created = await call(
      app,
      "POST",
      `${root()}/billing/invoices`,
      {
        currency: "BRL",
        status: "draft",
        lines: [
          {
            type: "other",
            description: "Privado",
            quantity: 1,
            unitAmountCents: 100,
            totalAmountCents: 100,
          },
        ],
      },
      s.ownerA,
    );
    const invoiceId = created.json<{ invoice: { id: string } }>().invoice.id;

    const cross = await call(
      app,
      "POST",
      `${root(s.orgB)}/billing/invoices/${invoiceId}/issue`,
      {},
      s.ownerB,
    );
    expect(cross.statusCode).toBe(404);

    const outsider = await call(app, "GET", `${root()}/billing/invoices`, undefined, s.outsider);
    expect(outsider.statusCode).toBeGreaterThanOrEqual(400);
  });
});
