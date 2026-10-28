import {
  legalMatterTimelineEvents,
  messages,
  notifications,
  seedReferenceData,
  users,
} from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import { createMalwareScanner, LocalPrivateStorageProvider } from "@verasjuris/storage";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import {
  bootstrapEtapa6,
  createDocumentWithFile,
  multipartBody,
  type Etapa6Setup,
} from "./etapa6.fixtures.js";
import { call, registerVerified } from "./test-helpers.js";

describe("Etapa 14 — Portal do Cliente API", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let storageRoot: string;
  let s: Etapa6Setup;
  let clientId: string;
  let clientUserCookie: string;
  let clientUserId: string;
  let otherClientId: string;
  let visibleTimelineId: string;
  let hiddenTimelineId: string;
  let contractId: string;
  let staffDocRequestId: string;
  let threadId: string;
  let staffMessageId: string;

  const portal = (org = s?.orgA) => `/v1/organizations/${org}/portal`;
  const root = (org = s?.orgA) => `/v1/organizations/${org}`;

  beforeAll(async () => {
    database = await started;
    await seedReferenceData(database.db);
    storageRoot = await mkdtemp(path.join(tmpdir(), "vj-portal-"));
    app = await buildApp({
      db: database.db,
      logger: false,
      webOrigin: "http://127.0.0.1:3000",
      isProduction: false,
      email,
      storage: new LocalPrivateStorageProvider(storageRoot),
      malwareScanner: createMalwareScanner(),
    });
    s = await bootstrapEtapa6(app, email, "portal");

    const matter = await call(app, "GET", `${root()}/matters/${s.matterAId}`, undefined, s.ownerA);
    clientId = matter.json<{ matter: { clientId: string } }>().matter.clientId;

    const otherClient = await call(
      app,
      "POST",
      `${root()}/crm/clients`,
      { personType: "person", fullName: "Outro cliente portal" },
      s.ownerA,
    );
    otherClientId = otherClient.json<{ client: { id: string } }>().client.id;

    clientUserCookie = await registerVerified(app, email, {
      displayName: "Cliente Portal",
      email: "cliente.portal@exemplo.com",
    });
    const userRow = await database.db.query.users.findFirst({
      where: eq(users.email, "cliente.portal@exemplo.com"),
    });
    clientUserId = userRow!.id;

    const linked = await call(
      app,
      "POST",
      `${root()}/client-users`,
      { userId: clientUserId, crmClientId: clientId },
      s.ownerA,
    );
    expect(linked.statusCode).toBe(201);

    const [visible] = await database.db
      .insert(legalMatterTimelineEvents)
      .values({
        organizationId: s.orgA,
        legalMatterId: s.matterAId,
        eventType: "update",
        title: "Atualização visível",
        body: "Detalhe para o cliente",
        clientVisible: true,
      })
      .returning();
    visibleTimelineId = visible!.id;

    const [hidden] = await database.db
      .insert(legalMatterTimelineEvents)
      .values({
        organizationId: s.orgA,
        legalMatterId: s.matterAId,
        eventType: "internal",
        title: "Nota interna",
        body: "Segredo do escritório",
        clientVisible: false,
      })
      .returning();
    hiddenTimelineId = hidden!.id;

    const template = await call(
      app,
      "POST",
      `${root()}/contract-templates`,
      { title: "Modelo portal", contractType: "services" },
      s.ownerA,
    );
    const templateId = template.json<{ template: { id: string } }>().template.id;
    const createdContract = await call(
      app,
      "POST",
      `${root()}/contracts`,
      {
        title: "Contrato portal",
        clientId,
        legalMatterId: s.matterAId,
        contractTemplateId: templateId,
        contractType: "services",
        effectiveDate: "2020-01-01T00:00:00.000Z",
      },
      s.ownerA,
    );
    contractId = createdContract.json<{ contract: { id: string } }>().contract.id;
    await call(
      app,
      "PATCH",
      `${root()}/contracts/${contractId}`,
      { status: "pending_signature" },
      s.ownerA,
    );

    const staffReq = await call(
      app,
      "POST",
      `${root()}/client-document-requests`,
      {
        clientId,
        legalMatterId: s.matterAId,
        title: "Enviar RG",
        description: "Cópia autenticada",
      },
      s.ownerA,
    );
    staffDocRequestId = staffReq.json<{ documentRequest: { id: string } }>().documentRequest.id;

    const thread = await call(
      app,
      "POST",
      `${portal()}/threads`,
      { subject: "Dúvida sobre o caso", legalMatterId: s.matterAId },
      clientUserCookie,
    );
    threadId = thread.json<{ thread: { id: string } }>().thread.id;

    const [staffMsg] = await database.db
      .insert(messages)
      .values({
        organizationId: s.orgA,
        threadId,
        senderType: "staff",
        body: '<script>alert("xss")</script><p>Resposta do escritório</p>',
        clientVisible: true,
      })
      .returning();
    staffMessageId = staffMsg!.id;

    await database.db.insert(messages).values({
      organizationId: s.orgA,
      threadId,
      senderType: "staff",
      body: "Nota interna na thread",
      clientVisible: false,
    });

    await database.db.insert(notifications).values({
      organizationId: s.orgA,
      userId: clientUserId,
      type: "case_update",
      title: "Atualização",
      message: "Há novidades no seu caso",
    });
  });

  afterAll(async () => {
    await app.close();
    await database.close();
    await rm(storageRoot, { recursive: true, force: true });
  });

  it("portal /me exige vínculo de cliente", async () => {
    const res = await call(app, "GET", `${portal()}/me`, undefined, clientUserCookie);
    expect(res.statusCode).toBe(200);
    const body = res.json<{ context: { clientId: string }; dashboard: { caseCount: number } }>();
    expect(body.context.clientId).toBe(clientId);
    expect(body.dashboard.caseCount).toBeGreaterThanOrEqual(1);
  });

  it("usuário sem vínculo recebe 404 no portal", async () => {
    const res = await call(app, "GET", `${portal()}/me`, undefined, s.outsider);
    expect(res.statusCode).toBe(404);
  });

  it("cross-tenant: portal em outra organização retorna 404", async () => {
    const res = await call(app, "GET", `${portal(s.orgB)}/me`, undefined, clientUserCookie);
    expect(res.statusCode).toBe(404);
  });

  it("lista casos do cliente vinculado", async () => {
    const res = await call(app, "GET", `${portal()}/cases`, undefined, clientUserCookie);
    expect(res.statusCode).toBe(200);
    const body = res.json<{ cases: Array<{ id: string }> }>();
    expect(body.cases.some((c) => c.id === s.matterAId)).toBe(true);
  });

  it("timeline deny-by-default: só eventos clientVisible", async () => {
    const res = await call(
      app,
      "GET",
      `${portal()}/cases/${s.matterAId}`,
      undefined,
      clientUserCookie,
    );
    expect(res.statusCode).toBe(200);
    const body = res.json<{ timeline: Array<{ id: string; title: string }> }>();
    expect(body.timeline.some((e) => e.id === visibleTimelineId)).toBe(true);
    expect(body.timeline.some((e) => e.id === hiddenTimelineId)).toBe(false);
    expect(body.timeline.some((e) => e.title.includes("interna"))).toBe(false);
  });

  it("cross-client: caso de outro cliente retorna 404", async () => {
    const otherMatter = await call(
      app,
      "POST",
      `${root()}/matters`,
      { title: "Caso outro cliente", clientId: otherClientId },
      s.ownerA,
    );
    const otherMatterId = otherMatter.json<{ matter: { id: string } }>().matter.id;
    const res = await call(
      app,
      "GET",
      `${portal()}/cases/${otherMatterId}`,
      undefined,
      clientUserCookie,
    );
    expect(res.statusCode).toBe(404);
  });

  it("documentos visíveis no portal para caso do cliente", async () => {
    await createDocumentWithFile(app, s.ownerA, s.orgA, s.matterAId, {
      title: "Doc portal",
      fileName: "portal.txt",
      content: Buffer.from("conteudo cliente"),
      mime: "text/plain",
    });
    const res = await call(app, "GET", `${portal()}/documents`, undefined, clientUserCookie);
    expect(res.statusCode).toBe(200);
    const body = res.json<{ documents: Array<{ title: string }> }>();
    expect(body.documents.some((d) => d.title === "Doc portal")).toBe(true);
  });

  it("mensagens sanitizam XSS e ocultam staff não visível", async () => {
    const res = await call(
      app,
      "GET",
      `${portal()}/threads/${threadId}/messages`,
      undefined,
      clientUserCookie,
    );
    expect(res.statusCode).toBe(200);
    const body = res.json<{ messages: Array<{ id: string; body: string }> }>();
    const staff = body.messages.find((m) => m.id === staffMessageId);
    expect(staff).toBeTruthy();
    expect(staff!.body).not.toMatch(/<script/i);
    expect(staff!.body).toContain("Resposta do escritório");
    expect(body.messages.some((m) => m.body.includes("Nota interna"))).toBe(false);

    const sent = await call(
      app,
      "POST",
      `${portal()}/threads/${threadId}/messages`,
      { body: "<img src=x onerror=alert(1)>Olá" },
      clientUserCookie,
    );
    expect(sent.statusCode).toBe(201);
    expect(sent.json<{ message: { body: string } }>().message.body).not.toMatch(/onerror/i);
  });

  it("contratos e pagamentos no portal", async () => {
    const contractsRes = await call(
      app,
      "GET",
      `${portal()}/contracts`,
      undefined,
      clientUserCookie,
    );
    expect(contractsRes.statusCode).toBe(200);
    expect(
      contractsRes
        .json<{ contracts: Array<{ id: string }> }>()
        .contracts.some((c) => c.id === contractId),
    ).toBe(true);

    const badPaid = await call(
      app,
      "POST",
      `${root()}/client-payment-records`,
      {
        clientId,
        description: "Honorários",
        amountCents: 10_000,
        status: "paid",
        source: "manual",
      },
      s.ownerA,
    );
    expect(badPaid.statusCode).toBeGreaterThanOrEqual(400);

    const { documentId: evidenceDocId } = await createDocumentWithFile(
      app,
      s.ownerA,
      s.orgA,
      s.matterAId,
      {
        title: "Comprovante",
        fileName: "recibo.txt",
        content: Buffer.from("pago"),
        mime: "text/plain",
      },
    );

    const paid = await call(
      app,
      "POST",
      `${root()}/client-payment-records`,
      {
        clientId,
        description: "Honorários jan",
        amountCents: 50_000,
        status: "paid",
        source: "manual",
        evidenceDocumentId: evidenceDocId,
      },
      s.ownerA,
    );
    expect(paid.statusCode).toBe(201);

    const payments = await call(app, "GET", `${portal()}/payments`, undefined, clientUserCookie);
    expect(payments.statusCode).toBe(200);
    const list = payments.json<{ payments: Array<{ status: string; description: string }> }>()
      .payments;
    expect(list.some((p) => p.description === "Honorários jan" && p.status === "paid")).toBe(true);
  });

  it("solicitações, calendário e notificações", async () => {
    const req = await call(
      app,
      "POST",
      `${portal()}/requests`,
      { title: "Status do processo", requestType: "status_request" },
      clientUserCookie,
    );
    expect(req.statusCode).toBe(201);

    const listed = await call(app, "GET", `${portal()}/requests`, undefined, clientUserCookie);
    expect(listed.statusCode).toBe(200);
    expect(listed.json<{ requests: unknown[] }>().requests.length).toBeGreaterThan(0);

    const event = await call(
      app,
      "POST",
      `${root()}/calendar/events`,
      {
        title: "Reunião cliente",
        eventType: "meeting",
        startsAt: "2030-06-01T14:00:00.000Z",
        endsAt: "2030-06-01T15:00:00.000Z",
        legalMatterId: s.matterAId,
      },
      s.ownerA,
    );
    const eventId = event.json<{ event: { id: string } }>().event.id;

    const hiddenCal = await call(app, "GET", `${portal()}/calendar`, undefined, clientUserCookie);
    expect(
      hiddenCal.json<{ events: Array<{ id: string }> }>().events.some((e) => e.id === eventId),
    ).toBe(false);

    await call(
      app,
      "PATCH",
      `${root()}/calendar-events/${eventId}/client-visible`,
      { clientVisible: true },
      s.ownerA,
    );

    const visibleCal = await call(app, "GET", `${portal()}/calendar`, undefined, clientUserCookie);
    expect(
      visibleCal.json<{ events: Array<{ id: string }> }>().events.some((e) => e.id === eventId),
    ).toBe(true);

    const notif = await call(app, "GET", `${portal()}/notifications`, undefined, clientUserCookie);
    expect(notif.statusCode).toBe(200);
    expect(
      notif.json<{ notifications: Array<{ title: string }> }>().notifications.length,
    ).toBeGreaterThan(0);
  });

  it("fulfill document request com documento do cliente", async () => {
    const portalDoc = await call(app, "GET", `${portal()}/documents`, undefined, clientUserCookie);
    const docId = portalDoc
      .json<{ documents: Array<{ id: string; title: string }> }>()
      .documents.find((d) => d.title === "Doc portal")!.id;

    const fulfilled = await call(
      app,
      "POST",
      `${portal()}/document-requests/${staffDocRequestId}/fulfill`,
      { fulfilledDocumentId: docId },
      clientUserCookie,
    );
    expect(fulfilled.statusCode).toBe(200);
    expect(
      fulfilled.json<{ documentRequest: { fulfilledDocumentId: string } }>().documentRequest
        .fulfilledDocumentId,
    ).toBe(docId);
  });

  it("staff PATCH timeline clientVisible", async () => {
    const patched = await call(
      app,
      "PATCH",
      `${root()}/matters/${s.matterAId}/timeline/${hiddenTimelineId}/client-visible`,
      { clientVisible: true },
      s.ownerA,
    );
    expect(patched.statusCode).toBe(200);
    const caseRes = await call(
      app,
      "GET",
      `${portal()}/cases/${s.matterAId}`,
      undefined,
      clientUserCookie,
    );
    expect(
      caseRes
        .json<{ timeline: Array<{ id: string }> }>()
        .timeline.some((e) => e.id === hiddenTimelineId),
    ).toBe(true);
  });
});
