import {
  auditEvents,
  communicationMessages,
  communicationOutbox,
  notifications,
  seedReferenceData,
} from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { substituteTemplateVariables } from "./modules/communication/service.js";
import { bootstrapEtapa6, type Etapa6Setup } from "./etapa6.fixtures.js";
import { call } from "./test-helpers.js";

describe("Etapa 15 — Communication Core API", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let s: Etapa6Setup;
  let ownerUserId: string;
  let templateVersionId: string;

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
    s = await bootstrapEtapa6(app, email, "communication");

    const session = await call(app, "GET", "/v1/auth/session", undefined, s.ownerA);
    ownerUserId = session.json<{ account: { user: { id: string } } }>().account.user.id;
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  it("substituição de variáveis respeita whitelist", () => {
    const out = substituteTemplateVariables("Olá {{name}}", { name: "Ana" }, ["name"]);
    expect(out).toBe("Olá Ana");
    expect(() => substituteTemplateVariables("{{evil}}", { evil: "x" }, ["name"])).toThrow();
  });

  it("status de provedores externos: not_configured", async () => {
    const res = await call(
      app,
      "GET",
      `${root()}/communication/providers/status`,
      undefined,
      s.ownerA,
    );
    expect(res.statusCode).toBe(200);
    const body = res.json<{
      email: { status: string };
      sms: { status: string };
      whatsapp: { status: string };
      push: { status: string };
    }>();
    expect(body.email.status).toBe("not_configured");
    expect(body.sms.status).toBe("not_configured");
    expect(body.whatsapp.status).toBe("not_configured");
    expect(body.push.status).toBe("not_configured");
  });

  it("cria template, versão e envia com variáveis", async () => {
    const created = await call(
      app,
      "POST",
      `${root()}/communication/templates`,
      {
        channel: "in_app",
        key: "welcome",
        name: "Boas-vindas",
        bodyTemplate: "Olá {{name}}, bem-vindo.",
        variableSchema: { name: { type: "string" } },
        category: "transactional",
      },
      s.ownerA,
    );
    expect(created.statusCode).toBe(201);
    const templateId = created.json<{ template: { id: string } }>().template.id;

    const version = await call(
      app,
      "POST",
      `${root()}/communication/templates/${templateId}/versions`,
      {
        templateId,
        version: 1,
        bodyTemplate: "Olá {{name}}, bem-vindo à organização.",
        variableSchema: { name: { type: "string" } },
      },
      s.ownerA,
    );
    expect(version.statusCode).toBe(201);
    templateVersionId = version.json<{ version: { id: string } }>().version.id;

    const sent = await call(
      app,
      "POST",
      `${root()}/communication/messages`,
      {
        recipientType: "user",
        recipientId: ownerUserId,
        channel: "in_app",
        category: "transactional",
        templateVersionId,
        variables: { name: "Owner" },
        idempotencyKey: "comm-inapp-welcome-001",
      },
      s.ownerA,
    );
    expect(sent.statusCode).toBe(201);
    const msg = sent.json<{ message: { status: string; bodySnapshot: string } }>().message;
    expect(msg.status).toBe("delivered");
    expect(msg.bodySnapshot).toContain("Owner");

    const inAppRows = await database.db.query.notifications.findMany({
      where: and(eq(notifications.organizationId, s.orgA), eq(notifications.userId, ownerUserId)),
    });
    expect(inAppRows.some((n) => n.message.includes("Owner"))).toBe(true);
  });

  it("email/sms/whatsapp/push ficam not_configured", async () => {
    for (const channel of ["email", "sms", "whatsapp", "push"] as const) {
      const res = await call(
        app,
        "POST",
        `${root()}/communication/messages`,
        {
          recipientType: "user",
          recipientId: ownerUserId,
          channel,
          category: "transactional",
          bodySnapshot: `Teste canal ${channel}`,
          idempotencyKey: `comm-${channel}-nc-001`,
        },
        s.ownerA,
      );
      expect(res.statusCode).toBe(201);
      expect(res.json<{ message: { status: string } }>().message.status).toBe("not_configured");
    }
  });

  it("preferência desabilitada bloqueia envio (exceto política marketing/transactional)", async () => {
    await call(
      app,
      "POST",
      `${root()}/communication/preferences`,
      {
        userId: ownerUserId,
        channel: "in_app",
        category: "system",
        enabled: false,
      },
      s.ownerA,
    );

    const blocked = await call(
      app,
      "POST",
      `${root()}/communication/messages`,
      {
        recipientType: "user",
        recipientId: ownerUserId,
        channel: "in_app",
        category: "system",
        bodySnapshot: "Sistema off",
        idempotencyKey: "comm-pref-block-001",
      },
      s.ownerA,
    );
    expect(blocked.statusCode).toBe(403);

    await call(
      app,
      "PATCH",
      `${root()}/communication/preferences/${
        (
          await call(
            app,
            "GET",
            `${root()}/communication/preferences?userId=${ownerUserId}`,
            undefined,
            s.ownerA,
          )
        )
          .json<{ items: Array<{ id: string; category: string }> }>()
          .items.find((p) => p.category === "system")!.id
      }`,
      { enabled: true },
      s.ownerA,
    );
  });

  it("opt-out marketing bloqueia marketing; transactional segue", async () => {
    await call(
      app,
      "POST",
      `${root()}/communication/consents`,
      {
        subjectType: "user",
        subjectId: ownerUserId,
        channel: "email",
        category: "marketing",
        status: "opted_out",
      },
      s.ownerA,
    );

    const marketing = await call(
      app,
      "POST",
      `${root()}/communication/messages`,
      {
        recipientType: "user",
        recipientId: ownerUserId,
        channel: "email",
        category: "marketing",
        bodySnapshot: "Promo",
        idempotencyKey: "comm-mkt-block-001",
      },
      s.ownerA,
    );
    expect(marketing.statusCode).toBe(403);

    const transactional = await call(
      app,
      "POST",
      `${root()}/communication/messages`,
      {
        recipientType: "user",
        recipientId: ownerUserId,
        channel: "email",
        category: "transactional",
        bodySnapshot: "Recibo",
        idempotencyKey: "comm-tx-ok-001",
      },
      s.ownerA,
    );
    expect(transactional.statusCode).toBe(201);
    expect(transactional.json<{ message: { status: string } }>().message.status).toBe(
      "not_configured",
    );
  });

  it("idempotency key por organização", async () => {
    const key = "comm-idem-org-a-001";
    const first = await call(
      app,
      "POST",
      `${root()}/communication/messages`,
      {
        recipientType: "user",
        recipientId: ownerUserId,
        channel: "in_app",
        category: "security",
        bodySnapshot: "Alerta",
        idempotencyKey: key,
      },
      s.ownerA,
    );
    const second = await call(
      app,
      "POST",
      `${root()}/communication/messages`,
      {
        recipientType: "user",
        recipientId: ownerUserId,
        channel: "in_app",
        category: "security",
        bodySnapshot: "Alerta",
        idempotencyKey: key,
      },
      s.ownerA,
    );
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    const a = first.json<{ message: { id: string }; deduplicated?: boolean }>();
    const b = second.json<{ message: { id: string }; deduplicated?: boolean }>();
    expect(a.message.id).toBe(b.message.id);
    expect(b.deduplicated).toBe(true);
  });

  it("outbox criado e retry só para falha transitória", async () => {
    const sent = await call(
      app,
      "POST",
      `${root()}/communication/messages`,
      {
        recipientType: "user",
        recipientId: ownerUserId,
        channel: "email",
        category: "transactional",
        bodySnapshot: "Retry me",
        idempotencyKey: "comm-retry-001",
      },
      s.ownerA,
    );
    const messageId = sent.json<{ message: { id: string } }>().message.id;
    const outbox = await database.db.query.communicationOutbox.findFirst({
      where: eq(communicationOutbox.communicationMessageId, messageId),
    });
    expect(outbox).toBeTruthy();

    await database.db
      .update(communicationMessages)
      .set({ status: "failed", errorCode: "TIMEOUT", failedAt: new Date() })
      .where(eq(communicationMessages.id, messageId));

    const retry = await call(
      app,
      "POST",
      `${root()}/communication/messages/${messageId}/retry`,
      {},
      s.ownerA,
    );
    expect(retry.statusCode).toBe(200);
    expect(retry.json<{ message: { status: string } }>().message.status).toBe("not_configured");
  });

  it("cross-tenant: histórico de mensagem retorna 404", async () => {
    const list = await call(
      app,
      "GET",
      `${root()}/communication/messages?limit=1`,
      undefined,
      s.ownerA,
    );
    const messageId = list.json<{ items: Array<{ id: string }> }>().items[0]?.id;
    expect(messageId).toBeTruthy();
    const cross = await call(
      app,
      "GET",
      `${root(s.orgB)}/communication/messages/${messageId}/history`,
      undefined,
      s.ownerB,
    );
    expect(cross.statusCode).toBe(404);
  });

  it("auditoria communication.queued registrada", async () => {
    const audits = await database.db.query.auditEvents.findMany({
      where: eq(auditEvents.action, "communication.queued"),
    });
    expect(audits.length).toBeGreaterThan(0);
  });
});
