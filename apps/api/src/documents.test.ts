import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createTestDatabase } from "@verasjuris/database/testing";
import { seedReferenceData } from "@verasjuris/database";
import { MemoryEmailProvider } from "@verasjuris/email";
import { createMalwareScanner, LocalPrivateStorageProvider } from "@verasjuris/storage";
import { CSRF_HEADER, SESSION_COOKIE } from "@verasjuris/security";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { call, registerVerified } from "./test-helpers.js";

function multipartBody(fileName: string, content: Buffer, mime: string) {
  const boundary = "----VjBoundary7MA4YWxkTrZu0gW";
  const preamble =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
    `Content-Type: ${mime}\r\n\r\n`;
  const ending = `\r\n--${boundary}--\r\n`;
  return {
    payload: Buffer.concat([Buffer.from(preamble, "utf8"), content, Buffer.from(ending, "utf8")]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

describe("Etapa 3.2 — Documents API", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let storageRoot: string;
  let ownerA: string;
  let ownerB: string;
  let orgA: string;
  let orgB: string;
  let matterAId: string;

  beforeAll(async () => {
    database = await started;
    await seedReferenceData(database.db);
    storageRoot = await mkdtemp(path.join(tmpdir(), "vj-docs-"));
    app = await buildApp({
      db: database.db,
      logger: false,
      webOrigin: "http://127.0.0.1:3000",
      isProduction: false,
      email,
      storage: new LocalPrivateStorageProvider(storageRoot),
      malwareScanner: createMalwareScanner(),
      documentMaxUploadBytes: 2 * 1024 * 1024,
    });

    ownerA = await registerVerified(app, email, {
      displayName: "Owner A Docs",
      email: "owner.a.docs@exemplo.com",
    });
    ownerB = await registerVerified(app, email, {
      displayName: "Owner B Docs",
      email: "owner.b.docs@exemplo.com",
    });

    const createdA = await call(app, "POST", "/v1/organizations", { name: "Org Docs A" }, ownerA);
    orgA = createdA.json<{ organization: { id: string } }>().organization.id;

    const createdB = await call(app, "POST", "/v1/organizations", { name: "Org Docs B" }, ownerB);
    orgB = createdB.json<{ organization: { id: string } }>().organization.id;

    const clientA = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/crm/clients`,
      { personType: "person", fullName: "Cliente Docs A" },
      ownerA,
    );
    const clientAId = clientA.json<{ client: { id: string } }>().client.id;

    const matterA = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/matters`,
      { title: "Caso Docs A", clientId: clientAId },
      ownerA,
    );
    matterAId = matterA.json<{ matter: { id: string } }>().matter.id;
  });

  afterAll(async () => {
    await app.close();
    await database.close();
    await rm(storageRoot, { recursive: true, force: true });
  });

  it("cria documento e faz upload com scan not_configured", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/documents`,
      {
        title: "Contrato social",
        ownerType: "legal_matter",
        ownerId: matterAId,
        confidentialityLevel: "normal",
      },
      ownerA,
    );
    expect(created.statusCode).toBe(201);
    const document = created.json<{ document: { id: string } }>().document;

    const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n", "utf8");
    const multipart = multipartBody("contrato.pdf", pdf, "application/pdf");
    const uploaded = await app.inject({
      method: "POST",
      url: `/v1/organizations/${orgA}/documents/${document.id}/versions`,
      headers: {
        [CSRF_HEADER]: "1",
        cookie: `${SESSION_COOKIE}=${ownerA}`,
        "content-type": multipart.contentType,
      },
      payload: multipart.payload,
    });
    expect(uploaded.statusCode).toBe(201);
    const body = uploaded.json<{
      version: {
        scanStatus: string;
        status: string;
        originalFilename: string;
        storageKey?: string;
      };
    }>();
    expect(body.version.scanStatus).toBe("not_configured");
    expect(body.version.status).toBe("available");
    expect(body.version.originalFilename).toBe("contrato.pdf");
    expect(body.version.storageKey).toBeUndefined();
    expect(JSON.stringify(body)).not.toMatch(/storageKey|storage_key/i);
  });

  it("rejeita MIME não permitido", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/documents`,
      {
        title: "Arquivo exe",
        ownerType: "organization",
        ownerId: orgA,
      },
      ownerA,
    );
    const documentId = created.json<{ document: { id: string } }>().document.id;
    const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    const multipart = multipartBody("malware.exe", exe, "application/x-msdownload");
    const uploaded = await app.inject({
      method: "POST",
      url: `/v1/organizations/${orgA}/documents/${documentId}/versions`,
      headers: {
        [CSRF_HEADER]: "1",
        cookie: `${SESSION_COOKIE}=${ownerA}`,
        "content-type": multipart.contentType,
      },
      payload: multipart.payload,
    });
    expect(uploaded.statusCode).toBe(400);
  });

  it("sanitiza filename com path traversal", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/documents`,
      {
        title: "Traversal",
        ownerType: "organization",
        ownerId: orgA,
      },
      ownerA,
    );
    const documentId = created.json<{ document: { id: string } }>().document.id;
    const txt = Buffer.from("conteudo seguro\n", "utf8");
    const multipart = multipartBody("../../etc/passwd.txt", txt, "text/plain");
    const uploaded = await app.inject({
      method: "POST",
      url: `/v1/organizations/${orgA}/documents/${documentId}/versions`,
      headers: {
        [CSRF_HEADER]: "1",
        cookie: `${SESSION_COOKIE}=${ownerA}`,
        "content-type": multipart.contentType,
      },
      payload: multipart.payload,
    });
    expect(uploaded.statusCode).toBe(201);
    const version = uploaded.json<{
      version: { originalFilename: string; safeFilename: string };
    }>().version;
    expect(version.originalFilename).toBe("passwd.txt");
    expect(version.safeFilename).not.toContain("..");
    expect(version.safeFilename).not.toContain("/");
  });

  it("retorna 404 cross-tenant", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/documents`,
      {
        title: "Segredo A",
        ownerType: "organization",
        ownerId: orgA,
      },
      ownerA,
    );
    const documentId = created.json<{ document: { id: string } }>().document.id;

    const cross = await call(
      app,
      "GET",
      `/v1/organizations/${orgB}/documents/${documentId}`,
      undefined,
      ownerB,
    );
    expect(cross.statusCode).toBe(404);
  });

  it("lista categorias seed da organização", async () => {
    const categories = await call(
      app,
      "GET",
      `/v1/organizations/${orgA}/document-categories`,
      undefined,
      ownerA,
    );
    expect(categories.statusCode).toBe(200);
    const items = categories.json<{ categories: Array<{ slug: string }> }>().categories;
    expect(items.some((item) => item.slug === "contrato")).toBe(true);
  });
});
