import { createTestDatabase } from "@verasjuris/database/testing";
import { seedReferenceData } from "@verasjuris/database";
import { MemoryEmailProvider } from "@verasjuris/email";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { call, registerVerified } from "./test-helpers.js";

describe("Etapa 5.1 — Calendar API", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let ownerA: string;
  let ownerB: string;
  let orgA: string;
  let orgB: string;
  let matterId: string;
  let processId: string;
  let hearingId: string;
  let membershipId: string;

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
    ownerA = await registerVerified(app, email, {
      displayName: "Owner A Cal",
      email: "owner.a.cal@exemplo.com",
    });
    ownerB = await registerVerified(app, email, {
      displayName: "Owner B Cal",
      email: "owner.b.cal@exemplo.com",
    });
    orgA = (await call(app, "POST", "/v1/organizations", { name: "Org Cal A" }, ownerA)).json<{
      organization: { id: string };
    }>().organization.id;
    orgB = (await call(app, "POST", "/v1/organizations", { name: "Org Cal B" }, ownerB)).json<{
      organization: { id: string };
    }>().organization.id;

    const members = await call(app, "GET", `/v1/organizations/${orgA}/members`, undefined, ownerA);
    membershipId = members
      .json<{ members: Array<{ membershipId: string; email: string }> }>()
      .members.find((item) => item.email === "owner.a.cal@exemplo.com")!.membershipId;

    const client = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/crm/clients`,
      { personType: "person", fullName: "Cliente Cal" },
      ownerA,
    );
    const clientId = client.json<{ client: { id: string } }>().client.id;
    const matter = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/matters`,
      { title: "Caso Cal", clientId },
      ownerA,
    );
    matterId = matter.json<{ matter: { id: string } }>().matter.id;

    const courts = await call(app, "GET", `/v1/organizations/${orgA}/courts`, undefined, ownerA);
    const tribunalId = courts
      .json<{ courts: Array<{ id: string; acronym: string }> }>()
      .courts.find((item) => item.acronym === "TJSP")!.id;

    const process = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/matters/${matterId}/judicial-processes`,
      {
        cnjNumber: "0000001-20.2016.8.26.0100",
        tribunalId,
      },
      ownerA,
    );
    expect(process.statusCode).toBe(201);
    processId = process.json<{ process: { id: string } }>().process.id;

    const hearing = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/matters/${matterId}/judicial-processes/${processId}/hearings`,
      {
        type: "conciliation",
        scheduledAt: new Date("2026-11-10T14:00:00.000Z").toISOString(),
      },
      ownerA,
    );
    expect(hearing.statusCode).toBe(201);
    hearingId = hearing.json<{ hearing: { id: string } }>().hearing.id;
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  it("cria evento e avisa conflito sem bloquear", async () => {
    const starts = new Date("2026-12-01T10:00:00.000Z").toISOString();
    const ends = new Date("2026-12-01T11:00:00.000Z").toISOString();
    const first = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/calendar/events`,
      {
        title: "Reunião 1",
        startsAt: starts,
        endsAt: ends,
        responsibleMembershipId: membershipId,
      },
      ownerA,
    );
    expect(first.statusCode).toBe(201);
    const overlap = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/calendar/events`,
      {
        title: "Reunião 2",
        startsAt: new Date("2026-12-01T10:30:00.000Z").toISOString(),
        endsAt: new Date("2026-12-01T11:30:00.000Z").toISOString(),
        responsibleMembershipId: membershipId,
      },
      ownerA,
    );
    expect(overlap.statusCode).toBe(201);
    const body = overlap.json<{ conflicts: unknown[]; conflictWarning: string | null }>();
    expect(body.conflicts.length).toBeGreaterThan(0);
    expect(body.conflictWarning).toBeTruthy();
  });

  it("projeta audiência via judicialHearingId (SSOT)", async () => {
    const linked = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/calendar/link-hearing`,
      { judicialHearingId: hearingId },
      ownerA,
    );
    expect(linked.statusCode).toBe(201);
    const event = linked.json<{ event: { judicialHearingId: string; eventType: string } }>().event;
    expect(event.judicialHearingId).toBe(hearingId);
    expect(event.eventType).toBe("hearing");
    const again = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/calendar/link-hearing`,
      { judicialHearingId: hearingId },
      ownerA,
    );
    expect(again.statusCode).toBe(200);
    expect(again.json<{ created: boolean }>().created).toBe(false);
  });

  it("retorna 404 cross-tenant", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/calendar/events`,
      {
        title: "Privado",
        startsAt: new Date("2026-12-20T10:00:00.000Z").toISOString(),
        endsAt: new Date("2026-12-20T11:00:00.000Z").toISOString(),
      },
      ownerA,
    );
    const eventId = created.json<{ event: { id: string } }>().event.id;
    const foreign = await call(
      app,
      "GET",
      `/v1/organizations/${orgB}/calendar/events/${eventId}`,
      undefined,
      ownerB,
    );
    expect(foreign.statusCode).toBe(404);
  });

  it("declara externalSync NOT_CONFIGURED", async () => {
    const list = await call(
      app,
      "GET",
      `/v1/organizations/${orgA}/calendar/events`,
      undefined,
      ownerA,
    );
    expect(list.json<{ externalSync: string }>().externalSync).toBe("NOT_CONFIGURED");
  });
});
