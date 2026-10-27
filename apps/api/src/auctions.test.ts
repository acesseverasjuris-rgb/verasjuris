import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { auditEvents, auctions, seedReferenceData } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import { createMalwareScanner, LocalPrivateStorageProvider } from "@verasjuris/storage";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { bootstrapEtapa6, createDocumentWithFile, type Etapa6Setup } from "./etapa6.fixtures.js";
import { call } from "./test-helpers.js";

type Auction = {
  id: string;
  scope: string;
  editable: boolean;
  title: string;
  status: string;
  source: {
    provider: string;
    badge: { kind: string; label: string; official: boolean };
  };
};

type Lot = {
  id: string;
  lotNumber: string;
  appraisalValueCents: number | null;
  firstMinimumBidCents: number | null;
  commissionBasisPoints: number | null;
  assetType: string;
};

describe("Etapa 7 — leilões (cadastro manual, sem lance real)", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let storageRoot: string;
  let s: Etapa6Setup;

  const root = (org = s.orgA) => `/v1/organizations/${org}`;
  const list = (org = s.orgA) => `${root(org)}/auctions`;

  async function createAuction(cookie: string, body: Record<string, unknown>, org = s.orgA) {
    return call(app, "POST", list(org), body, cookie);
  }

  beforeAll(async () => {
    database = await started;
    await seedReferenceData(database.db);
    storageRoot = await mkdtemp(path.join(tmpdir(), "vj-auction-"));
    app = await buildApp({
      db: database.db,
      logger: false,
      webOrigin: "http://127.0.0.1:3000",
      isProduction: false,
      email,
      storage: new LocalPrivateStorageProvider(storageRoot),
      malwareScanner: createMalwareScanner(),
    });
    s = await bootstrapEtapa6(app, email, "auction");
  });

  afterAll(async () => {
    await app.close();
    await database.close();
    await rm(storageRoot, { recursive: true, force: true });
  });

  it("provedor: status NOT_CONFIGURED; sync não inventa leilões; bid retorna NOT_CONFIGURED", async () => {
    const status = await call(app, "GET", `${root()}/auction-provider/status`, undefined, s.ownerA);
    expect(status.statusCode).toBe(200);
    expect(
      status.json<{
        status: string;
        manualEntryAvailable: boolean;
        bidProvider: { placeBidAvailable: boolean; status: string };
      }>(),
    ).toMatchObject({
      status: "not_configured",
      manualEntryAvailable: true,
      bidProvider: { placeBidAvailable: false, status: "not_configured" },
    });

    const sync = await call(app, "POST", `${root()}/auction-provider/sync`, {}, s.ownerA);
    expect(sync.statusCode).toBe(200);
    expect(sync.json<{ status: string; syncRun: { recordsUpserted: number } }>()).toMatchObject({
      status: "not_configured",
      syncRun: { recordsUpserted: 0 },
    });
    expect(sync.payload).not.toMatch(/oficial/i);

    const created = await createAuction(s.ownerA, {
      title: "Leilão judicial imóvel SP",
      auctionType: "judicial",
      status: "open",
    });
    const auctionId = created.json<{ auction: Auction }>().auction.id;
    const bid = await call(app, "POST", `${list()}/${auctionId}/bid`, { bidCents: 100 }, s.ownerA);
    expect(bid.statusCode).toBe(503);
    expect(bid.json<{ error: { code: string } }>().error.code).toBe(
      "AUCTION_BID_PROVIDER_NOT_CONFIGURED",
    );
    expect(bid.payload).not.toMatch(/lance aceito|você está dando lance/i);
  });

  it("cadastro manual + evento + lote + avaliação + lance mínimo + comissão (centavos/bp)", async () => {
    const created = await createAuction(s.ownerA, {
      title: "Leilão extrajudicial veículo",
      auctionType: "extrajudicial",
      status: "published",
      firstEventAt: "2026-11-10T14:00:00-03:00",
      sourceUrl: "https://exemplo.com/edital/1",
    });
    expect(created.statusCode).toBe(201);
    const auction = created.json<{ auction: Auction }>().auction;
    expect(auction.scope).toBe("organization");
    expect(auction.editable).toBe(true);
    expect(auction.source.provider).toBe("manual");
    expect(auction.source.badge.official).toBe(false);
    expect(created.payload).not.toMatch(/compra segura|lucro garantido|fonte oficial/i);

    const event = await call(
      app,
      "POST",
      `${list()}/${auction.id}/events`,
      {
        eventType: "first_session",
        startsAt: "2026-11-10T14:00:00-03:00",
        minimumRule: "avaliação",
      },
      s.ownerA,
    );
    expect(event.statusCode).toBe(201);
    expect(event.json<{ event: { eventType: string } }>().event.eventType).toBe("first_session");

    const lotRes = await call(
      app,
      "POST",
      `${list()}/${auction.id}/lots`,
      {
        lotNumber: "1",
        title: "Apartamento centro",
        assetType: "real_estate",
        appraisalValueCents: 500_000_00,
        firstMinimumBidCents: 350_000_00,
        commissionBasisPoints: 500,
        stateCode: "sp",
        municipality: "São Paulo",
        occupancyStatus: "vacant",
        realEstate: {
          propertyType: "apartamento",
          registryNumber: "12345",
          area: "72m²",
          address: "Rua Exemplo, 100",
        },
      },
      s.ownerA,
    );
    expect(lotRes.statusCode).toBe(201);
    const lot = lotRes.json<{ lot: Lot }>().lot;
    expect(lot.appraisalValueCents).toBe(50_000_000);
    expect(lot.firstMinimumBidCents).toBe(35_000_000);
    expect(lot.commissionBasisPoints).toBe(500);

    const negative = await call(
      app,
      "POST",
      `${list()}/${auction.id}/lots`,
      {
        lotNumber: "2",
        title: "Valor negativo",
        appraisalValueCents: -1,
      },
      s.ownerA,
    );
    expect(negative.statusCode).toBe(400);

    const fractional = await call(
      app,
      "POST",
      `${list()}/${auction.id}/lots`,
      {
        lotNumber: "3",
        title: "Valor quebrado",
        appraisalValueCents: 10.5,
      },
      s.ownerA,
    );
    expect(fractional.statusCode).toBe(400);

    const detail = await call(app, "GET", `${list()}/${auction.id}`, undefined, s.ownerA);
    expect(detail.statusCode).toBe(200);
    expect(
      detail.json<{
        auction: { events: unknown[]; lots: unknown[]; bidding: { available: boolean } };
      }>().auction,
    ).toMatchObject({
      bidding: { available: false },
    });
    expect(detail.json<{ auction: { lots: Lot[] } }>().auction.lots).toHaveLength(1);

    const lotDetail = await call(
      app,
      "GET",
      `${root()}/auction-lots/${lot.id}`,
      undefined,
      s.ownerA,
    );
    expect(lotDetail.statusCode).toBe(200);
    expect(
      lotDetail.json<{
        lot: { realEstate: { registryNumber: string } | null; bidding: { status: string } };
      }>().lot,
    ).toMatchObject({
      realEstate: { registryNumber: "12345" },
      bidding: { status: "not_configured" },
    });

    const audit = await database.db.query.auditEvents.findMany({
      where: eq(auditEvents.organizationId, s.orgA),
    });
    expect(
      audit.some((row) => row.action === "auction.created" && row.resourceId === auction.id),
    ).toBe(true);
  });

  it("detalhes de veículo + ônus com rótulos honestos", async () => {
    const created = await createAuction(s.ownerA, {
      title: "Leilão de veículos",
      auctionType: "seized_asset",
      status: "open",
    });
    const auctionId = created.json<{ auction: Auction }>().auction.id;
    const lotRes = await call(
      app,
      "POST",
      `${list()}/${auctionId}/lots`,
      {
        lotNumber: "V1",
        title: "Sedan 2018",
        assetType: "vehicle",
        appraisalValueCents: 4_000_000,
        firstMinimumBidCents: 2_500_000,
        commissionBasisPoints: 300,
        vehicle: {
          make: "MarcaX",
          model: "Sedan",
          year: 2018,
          plateMasked: "ABC*123",
          mileage: 80_000,
        },
      },
      s.ownerA,
    );
    const lotId = lotRes.json<{ lot: Lot }>().lot.id;

    const enc = await call(
      app,
      "POST",
      `${root()}/auction-lots/${lotId}/encumbrances`,
      {
        type: "alienacao_fiduciaria",
        description: "Alienação fiduciária informada no edital",
        amountCents: 150_000,
      },
      s.ownerA,
    );
    expect(enc.statusCode).toBe(201);
    expect(
      enc.json<{
        encumbrance: { label: string; verificationLabel: string; amountCents: number };
      }>().encumbrance,
    ).toMatchObject({
      label: "Ônus informado",
      verificationLabel: "Não verificado",
      amountCents: 150_000,
    });

    const lotDetail = await call(
      app,
      "GET",
      `${root()}/auction-lots/${lotId}`,
      undefined,
      s.ownerA,
    );
    expect(
      lotDetail.json<{ lot: { vehicle: { make: string } | null } }>().lot.vehicle,
    ).toMatchObject({
      make: "MarcaX",
    });
    expect(
      lotDetail.json<{ lot: { encumbrances: Array<{ verificationLabel: string }> } }>().lot
        .encumbrances[0]?.verificationLabel,
    ).toBe("Não verificado");
  });

  it("interesse, alerta e due diligence (assistiva)", async () => {
    const created = await createAuction(s.ownerA, {
      title: "Leilão para interesse",
      status: "open",
    });
    const auctionId = created.json<{ auction: Auction }>().auction.id;

    const saved = await call(
      app,
      "PUT",
      `${list()}/${auctionId}/interest`,
      { status: "watching", notes: "Acompanhar edital" },
      s.ownerA,
    );
    expect(saved.statusCode).toBe(200);
    expect(saved.json<{ interest: { status: string } }>().interest.status).toBe("watching");

    const wonDenied = await call(
      app,
      "PUT",
      `${list()}/${auctionId}/interest`,
      { status: "won" },
      s.ownerA,
    );
    expect(wonDenied.statusCode).toBe(400);

    const wonOk = await call(
      app,
      "PUT",
      `${list()}/${auctionId}/interest`,
      { status: "won", confirmOutcome: true },
      s.ownerA,
    );
    expect(wonOk.statusCode).toBe(200);
    expect(wonOk.json<{ interest: { status: string } }>().interest.status).toBe("won");

    const interests = await call(app, "GET", `${root()}/auction-interests`, undefined, s.ownerA);
    expect(interests.json<{ total: number }>().total).toBeGreaterThanOrEqual(1);

    const alert = await call(
      app,
      "POST",
      `${root()}/auction-alerts`,
      {
        name: "Imóveis SP até 1M",
        assetTypes: ["real_estate"],
        stateCodes: ["SP"],
        maxValueCents: 100_000_000,
      },
      s.ownerA,
    );
    expect(alert.statusCode).toBe(201);
    const alertId = alert.json<{ alert: { id: string } }>().alert.id;

    const dd = await call(app, "POST", `${root()}/auction-due-diligence`, { auctionId }, s.ownerA);
    expect(dd.statusCode).toBe(200);
    const items = dd.json<{ items: Array<{ itemKey: string; id: string }>; disclaimer: string }>();
    expect(items.items.map((i) => i.itemKey)).toEqual(
      expect.arrayContaining(["edital", "matricula", "onus", "ocupacao", "comissao"]),
    );
    expect(items.disclaimer).toMatch(/não constitui parecer jurídico/i);

    const itemId = items.items.find((i) => i.itemKey === "edital")!.id;
    const updated = await call(
      app,
      "PATCH",
      `${root()}/auction-due-diligence/${itemId}`,
      { status: "done", notes: "Edital lido" },
      s.ownerA,
    );
    expect(updated.statusCode).toBe(200);
    expect(updated.json<{ item: { status: string; assistive: boolean } }>().item).toMatchObject({
      status: "done",
      assistive: true,
    });

    expect(
      (await call(app, "DELETE", `${root()}/auction-alerts/${alertId}`, undefined, s.ownerA))
        .statusCode,
    ).toBe(204);

    const audit = await database.db.query.auditEvents.findMany({
      where: eq(auditEvents.organizationId, s.orgA),
    });
    expect(audit.some((row) => row.action === "auction.saved")).toBe(true);
    expect(audit.some((row) => row.action === "auction.alert_created")).toBe(true);
    expect(audit.some((row) => row.action === "auction.due_diligence_updated")).toBe(true);
  });

  it("vincula documento via document_links", async () => {
    const created = await createAuction(s.ownerA, { title: "Leilão com docs", status: "open" });
    const auctionId = created.json<{ auction: Auction }>().auction.id;
    const doc = await createDocumentWithFile(app, s.ownerA, s.orgA, s.matterAId, {
      title: "Edital PDF",
      fileName: "edital.txt",
      content: Buffer.from("Edital de leilão.", "utf8"),
      mime: "text/plain",
    });
    const linked = await call(
      app,
      "POST",
      `${list()}/${auctionId}/documents`,
      { documentId: doc.documentId, linkType: "auction_notice" },
      s.ownerA,
    );
    expect(linked.statusCode).toBe(201);
    expect(linked.json<{ link: { targetType: string; linkType: string } }>().link).toMatchObject({
      targetType: "auction",
      linkType: "auction_notice",
    });
    const docs = await call(app, "GET", `${list()}/${auctionId}/documents`, undefined, s.ownerA);
    expect(docs.json<{ items: Array<{ title: string }> }>().items.map((i) => i.title)).toEqual([
      "Edital PDF",
    ]);
    const audit = await database.db.query.auditEvents.findMany({
      where: eq(auditEvents.organizationId, s.orgA),
    });
    expect(audit.some((row) => row.action === "auction.document_linked")).toBe(true);
  });

  it("estimador de custo em centavos/bp e comparação sem recomendação", async () => {
    const created = await createAuction(s.ownerA, { title: "Leilão custo", status: "open" });
    const auctionId = created.json<{ auction: Auction }>().auction.id;
    const lotA = await call(
      app,
      "POST",
      `${list()}/${auctionId}/lots`,
      {
        lotNumber: "A",
        title: "Lote A",
        appraisalValueCents: 100_000_00,
        firstMinimumBidCents: 80_000_00,
        commissionBasisPoints: 500,
        buyerFeeCents: 1_000_00,
      },
      s.ownerA,
    );
    const lotB = await call(
      app,
      "POST",
      `${list()}/${auctionId}/lots`,
      {
        lotNumber: "B",
        title: "Lote B",
        appraisalValueCents: 200_000_00,
        firstMinimumBidCents: 150_000_00,
        commissionBasisPoints: 300,
        stateCode: "RJ",
      },
      s.ownerA,
    );
    const idA = lotA.json<{ lot: Lot }>().lot.id;
    const idB = lotB.json<{ lot: Lot }>().lot.id;

    // 8_000_000 * 500 / 10000 = 400_000 commission + 100_000 fees + 50_000 other
    const estimate = await call(
      app,
      "POST",
      `${list()}/estimate-cost`,
      {
        lotId: idA,
        bidCents: 8_000_000,
        knownFeesCents: 100_000,
        otherCostsCents: 50_000,
      },
      s.ownerA,
    );
    expect(estimate.statusCode).toBe(200);
    const body = estimate.json<{
      estimate: {
        bidCents: number;
        commissionCents: number;
        totalCents: number;
        disclaimer: string;
      };
    }>().estimate;
    expect(body.bidCents).toBe(8_000_000);
    expect(body.commissionCents).toBe(400_000);
    expect(body.totalCents).toBe(8_550_000);
    expect(body.disclaimer).toMatch(/não é custo final/i);
    expect(estimate.payload).not.toMatch(/compra segura|lucro garantido/i);

    const neg = await call(
      app,
      "POST",
      `${list()}/estimate-cost`,
      { bidCents: -1, commissionBasisPoints: 0 },
      s.ownerA,
    );
    expect(neg.statusCode).toBe(400);

    const compare = await call(app, "POST", `${list()}/compare`, { lotIds: [idA, idB] }, s.ownerA);
    expect(compare.statusCode).toBe(200);
    const compared = compare.json<{
      items: unknown[];
      recommendation: null;
      disclaimer: string;
    }>();
    expect(compared.items).toHaveLength(2);
    expect(compared.recommendation).toBeNull();
    expect(compared.disclaimer).toMatch(/não constitui recomendação/i);
  });

  describe("isolamento e global vs tenant", () => {
    let orgAuctionId: string;

    beforeAll(async () => {
      const created = await createAuction(s.ownerA, {
        title: "Leilão privado org A",
        status: "open",
      });
      orgAuctionId = created.json<{ auction: Auction }>().auction.id;
    });

    it("org B não acessa leilão da org A (404)", async () => {
      const requests: Array<[string, string, unknown?]> = [
        ["GET", `${list(s.orgB)}/${orgAuctionId}`],
        ["PATCH", `${list(s.orgB)}/${orgAuctionId}`, { title: "invadida" }],
        ["PUT", `${list(s.orgB)}/${orgAuctionId}/interest`, {}],
        ["GET", `${list(s.orgA)}/${orgAuctionId}`],
      ];
      for (const [method, url, body] of requests) {
        const response = await call(
          app,
          method as "GET",
          url,
          body as Record<string, unknown> | undefined,
          method === "GET" && url.includes(s.orgA) ? s.ownerB : s.ownerB,
        );
        // ownerB em caminho orgA → 404 (sem vínculo); caminho orgB → 404 (recurso invisível)
        expect(response.statusCode, `${method} ${url}`).toBe(404);
      }
      const listB = await call(app, "GET", list(s.orgB), undefined, s.ownerB);
      expect(listB.json<{ items: Auction[] }>().items.some((i) => i.id === orgAuctionId)).toBe(
        false,
      );
    });

    it("leilão global visível, somente leitura; interesses por organização", async () => {
      const [global] = await database.db
        .insert(auctions)
        .values({
          organizationId: null,
          sourceProvider: "manual",
          auctionType: "public_asset",
          title: "Leilão de referência global (fixture)",
          status: "open",
        })
        .returning();
      const globalId = global?.id as string;

      const viewA = await call(app, "GET", `${list(s.orgA)}/${globalId}`, undefined, s.ownerA);
      expect(viewA.statusCode).toBe(200);
      expect(viewA.json<{ auction: Auction }>().auction).toMatchObject({
        scope: "global",
        editable: false,
      });
      expect(
        (await call(app, "GET", `${list(s.orgB)}/${globalId}`, undefined, s.ownerB)).statusCode,
      ).toBe(200);

      expect(
        (await call(app, "PATCH", `${list(s.orgA)}/${globalId}`, { title: "alterada" }, s.ownerA))
          .statusCode,
      ).toBe(403);

      expect(
        (
          await call(
            app,
            "PUT",
            `${list(s.orgA)}/${globalId}/interest`,
            { status: "saved" },
            s.ownerA,
          )
        ).statusCode,
      ).toBe(200);
      const aSaved = await call(app, "GET", `${list(s.orgA)}?onlySaved=true`, undefined, s.ownerA);
      expect(aSaved.json<{ items: Auction[] }>().items.some((i) => i.id === globalId)).toBe(true);
      const bSaved = await call(app, "GET", `${list(s.orgB)}?onlySaved=true`, undefined, s.ownerB);
      expect(bSaved.json<{ items: Auction[] }>().items.some((i) => i.id === globalId)).toBe(false);

      const row = await database.db.query.auctions.findFirst({
        where: eq(auctions.id, globalId),
      });
      expect(row?.title).toBe("Leilão de referência global (fixture)");
    });
  });
});
