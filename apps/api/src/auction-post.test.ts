import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { seedReferenceData } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import { createMalwareScanner, LocalPrivateStorageProvider } from "@verasjuris/storage";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { bootstrapEtapa6, createDocumentWithFile, type Etapa6Setup } from "./etapa6.fixtures.js";
import { calculateCommissionCents } from "./modules/auction-post/service.js";
import { call } from "./test-helpers.js";

describe("Prompt 15 — pós-leilão", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let storageRoot: string;
  let s: Etapa6Setup;
  let auctionId: string;
  let lotId: string;
  let docId: string;

  const root = (org = s.orgA) => `/v1/organizations/${org}`;

  beforeAll(async () => {
    database = await started;
    await seedReferenceData(database.db);
    storageRoot = await mkdtemp(path.join(tmpdir(), "vj-auction-post-"));
    app = await buildApp({
      db: database.db,
      logger: false,
      webOrigin: "http://127.0.0.1:3000",
      isProduction: false,
      email,
      storage: new LocalPrivateStorageProvider(storageRoot),
      malwareScanner: createMalwareScanner(),
    });
    s = await bootstrapEtapa6(app, email, "apost");
    const auction = await call(
      app,
      "POST",
      `${root()}/auctions`,
      { title: "Leilão pós-venda", auctionType: "judicial", status: "open" },
      s.ownerA,
    );
    expect(auction.statusCode).toBe(201);
    auctionId = auction.json<{ auction: { id: string } }>().auction.id;
    const lot = await call(
      app,
      "POST",
      `${root()}/auctions/${auctionId}/lots`,
      {
        lotNumber: "1",
        title: "Imóvel teste pós-leilão",
        assetType: "real_estate",
        appraisalValueCents: 100_000_00,
        firstMinimumBidCents: 70_000_00,
        commissionBasisPoints: 500,
      },
      s.ownerA,
    );
    expect(lot.statusCode).toBe(201);
    lotId = lot.json<{ lot: { id: string } }>().lot.id;
    const file = await createDocumentWithFile(app, s.ownerA, s.orgA, s.matterAId, {
      title: "Auto de arrematação",
      fileName: "auto.txt",
      content: Buffer.from("auto", "utf8"),
      mime: "text/plain",
    });
    docId = file.documentId;
  });

  afterAll(async () => {
    await app.close();
    await database.close();
    await rm(storageRoot, { recursive: true, force: true });
  });

  it("calcula comissão em centavos/bps sem float", () => {
    expect(calculateCommissionCents(100_000_00, 500)).toBe(500_000);
    expect(calculateCommissionCents(100, 1)).toBe(0);
  });

  it("participation → manual bid → result → award → payment → delivery → transfer → events → docs", async () => {
    const participation = await call(
      app,
      "POST",
      `${root()}/auction-participations`,
      {
        auctionId,
        lotId,
        status: "registered_manually",
        registrationStatus: "confirmed_manually",
        qualificationStatus: "qualified_manually",
      },
      s.ownerA,
    );
    expect(participation.statusCode).toBe(201);
    const participationId = participation.json<{ participation: { id: string; status: string } }>()
      .participation.id;
    expect(participation.json().participation.status).toBe("registered_manually");

    const bid = await call(
      app,
      "POST",
      `${root()}/auction-bids`,
      {
        participationId,
        amountCents: 80_000_00,
        source: "manual",
      },
      s.ownerA,
    );
    expect(bid.statusCode).toBe(201);
    expect(bid.json<{ bid: { amountCents: number; source: string } }>().bid).toMatchObject({
      amountCents: 80_000_00,
      source: "manual",
    });

    const live = await call(app, "POST", `${root()}/auction-bids/live`, {}, s.ownerA);
    expect(live.statusCode).toBe(503);
    expect(live.json<{ error: { code: string } }>().error.code).toBe(
      "AUCTION_BID_PROVIDER_NOT_CONFIGURED",
    );

    const result = await call(
      app,
      "POST",
      `${root()}/auction-results`,
      {
        auctionId,
        lotId,
        status: "sold",
        winningBidCents: 80_000_00,
        source: "manual",
      },
      s.ownerA,
    );
    expect(result.statusCode).toBe(201);
    const resultId = result.json<{ result: { id: string } }>().result.id;

    const award = await call(
      app,
      "POST",
      `${root()}/auction-awards`,
      {
        auctionId,
        lotId,
        participationId,
        resultId,
        winningBidCents: 80_000_00,
        commissionBasisPoints: 500,
        commissionBaseAmountCents: 80_000_00,
        feesCents: 10_000,
        source: "manual",
      },
      s.ownerA,
    );
    expect(award.statusCode).toBe(201);
    const awardBody = award.json<{
      award: {
        id: string;
        calculatedCommissionCents: number | null;
        totalKnownCostCents: number;
      };
    }>().award;
    expect(awardBody.calculatedCommissionCents).toBe(400_000);
    expect(awardBody.totalKnownCostCents).toBe(80_000_00 + 400_000 + 10_000);
    const awardId = awardBody.id;

    const payment = await call(
      app,
      "POST",
      `${root()}/auction-awards/${awardId}/payments`,
      {
        awardId,
        paymentType: "bid_price",
        amountCents: 40_000_00,
        status: "partially_paid",
        dueAt: new Date(Date.now() - 86_400_000).toISOString(),
      },
      s.ownerA,
    );
    expect(payment.statusCode).toBe(201);
    expect(
      payment.json<{ payment: { status: string; amountCents: number } }>().payment,
    ).toMatchObject({
      amountCents: 40_000_00,
      status: "overdue",
    });

    const delivery = await call(
      app,
      "POST",
      `${root()}/auction-awards/${awardId}/delivery`,
      {
        awardId,
        deliveryType: "possession",
        status: "scheduled",
        possessionStatus: "requested",
      },
      s.ownerA,
    );
    expect(delivery.statusCode).toBe(201);
    expect(
      delivery.json<{ delivery: { possessionStatus: string } }>().delivery.possessionStatus,
    ).toBe("requested");

    const transfer = await call(
      app,
      "POST",
      `${root()}/auction-awards/${awardId}/transfers`,
      {
        awardId,
        transferType: "real_estate_registration",
        status: "in_progress",
        protocol: "PROT-1",
      },
      s.ownerA,
    );
    expect(transfer.statusCode).toBe(201);

    const cancel = await call(
      app,
      "POST",
      `${root()}/auction-awards/${awardId}/events`,
      { awardId, eventType: "cancelled", reason: "desistência" },
      s.ownerA,
    );
    expect(cancel.statusCode).toBe(201);

    const reverseAward = await call(
      app,
      "POST",
      `${root()}/auction-awards`,
      {
        auctionId,
        lotId,
        winningBidCents: 1_000,
        source: "manual",
      },
      s.ownerA,
    );
    const reverseId = reverseAward.json<{ award: { id: string } }>().award.id;
    const reverse = await call(
      app,
      "POST",
      `${root()}/auction-awards/${reverseId}/events`,
      { awardId: reverseId, eventType: "reversed", reason: "anulação" },
      s.ownerA,
    );
    expect(reverse.statusCode).toBe(201);
    const after = await call(
      app,
      "GET",
      `${root()}/auction-awards/${reverseId}`,
      undefined,
      s.ownerA,
    );
    expect(after.json<{ award: { awardStatus: string } }>().award.awardStatus).toBe("reversed");

    const link = await call(
      app,
      "POST",
      `${root()}/auction-awards/${awardId}/documents`,
      { documentId: docId, linkType: "award_deed" },
      s.ownerA,
    );
    expect(link.statusCode).toBe(201);

    const regularization = await call(
      app,
      "GET",
      `${root()}/auction-awards/${awardId}/regularization`,
      undefined,
      s.ownerA,
    );
    expect(regularization.statusCode).toBe(200);
    expect(regularization.json<{ items: unknown[] }>().items.length).toBeGreaterThan(0);

    const timeline = await call(
      app,
      "GET",
      `${root()}/auction-awards/${awardId}/timeline`,
      undefined,
      s.ownerA,
    );
    expect(timeline.statusCode).toBe(200);
    expect(timeline.json<{ timeline: unknown[] }>().timeline.length).toBeGreaterThan(1);
  });

  it("cross-tenant award 404", async () => {
    const list = await call(app, "GET", `${root()}/auction-awards`, undefined, s.ownerA);
    const id = list.json<{ items: Array<{ id: string }> }>().items[0]?.id;
    expect(id).toBeTruthy();
    const foreign = await call(
      app,
      "GET",
      `${root(s.orgB)}/auction-awards/${id}`,
      undefined,
      s.ownerB,
    );
    expect(foreign.statusCode).toBe(404);
  });
});
