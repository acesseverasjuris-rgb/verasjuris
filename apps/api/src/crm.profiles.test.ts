import { MemoryEmailProvider } from "@verasjuris/email";
import { createTestDatabase } from "@verasjuris/database/testing";
import { seedReferenceData } from "@verasjuris/database";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { call, registerVerified, sessionFrom, testPassword as password } from "./test-helpers.js";

describe("Etapa 1.2 + 2 — perfis profissionais e CRM", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let ownerA: string;
  let ownerB: string;
  let memberA: string;
  let orgA: string;
  let orgB: string;
  let ownerAMembershipId: string;

  beforeAll(async () => {
    const database = await started;
    await seedReferenceData(database.db);
    app = await buildApp({
      db: database.db,
      logger: false,
      webOrigin: "http://127.0.0.1:3000",
      isProduction: false,
      email,
    });

    ownerA = await registerVerified(app, email, {
      displayName: "Owner A CRM",
      email: "owner.a.crm@exemplo.com",
    });
    ownerB = await registerVerified(app, email, {
      displayName: "Owner B CRM",
      email: "owner.b.crm@exemplo.com",
    });
    await registerVerified(app, email, {
      displayName: "Member A CRM",
      email: "member.a.crm@exemplo.com",
    });

    const createdA = await call(app, "POST", "/v1/organizations", { name: "Org CRM A" }, ownerA);
    expect(createdA.statusCode).toBe(201);
    orgA = createdA.json<{ organization: { id: string } }>().organization.id;

    const createdB = await call(app, "POST", "/v1/organizations", { name: "Org CRM B" }, ownerB);
    expect(createdB.statusCode).toBe(201);
    orgB = createdB.json<{ organization: { id: string } }>().organization.id;

    await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/members`,
      { email: "member.a.crm@exemplo.com" },
      ownerA,
    );
    const memberLogin = await call(app, "POST", "/v1/auth/login", {
      email: "member.a.crm@exemplo.com",
      password,
    });
    memberA = sessionFrom(memberLogin.headers);

    const members = await call(app, "GET", `/v1/organizations/${orgA}/members`, undefined, ownerA);
    ownerAMembershipId = members
      .json<{ members: Array<{ membershipId: string; email: string }> }>()
      .members.find((item) => item.email === "owner.a.crm@exemplo.com")!.membershipId;
  });

  afterAll(async () => {
    await app.close();
    await (await started).close();
  });

  it("acumula perfil de advogado e parceiro no mesmo usuário", async () => {
    const lawyer = await call(
      app,
      "PUT",
      "/v1/profiles/me/lawyer",
      {
        professionalName: "Dra. Ana CRM",
        oabNumber: "123456",
        oabUf: "SP",
        bio: "Direito civil",
      },
      ownerA,
    );
    expect(lawyer.statusCode).toBe(200);

    const partner = await call(
      app,
      "PUT",
      "/v1/profiles/me/partner",
      { category: "correspondent", presentation: "Atuação como correspondente" },
      ownerA,
    );
    expect(partner.statusCode).toBe(200);

    const me = await call(app, "GET", "/v1/profiles/me", undefined, ownerA);
    expect(me.statusCode).toBe(200);
    const profiles = me.json<{
      profiles: {
        lawyer: { oabNumber: string | null } | null;
        partner: { category: string } | null;
        professional: { verificationStatus: string } | null;
      };
    }>().profiles;
    expect(profiles.lawyer?.oabNumber).toBe("123456");
    expect(profiles.partner?.category).toBe("correspondent");
    expect(profiles.professional?.verificationStatus).toBe("pending");
  });

  it("rejeita forçar verificationStatus verified", async () => {
    const forced = await call(
      app,
      "PUT",
      "/v1/profiles/me/lawyer",
      { professionalName: "Hack", verificationStatus: "verified" },
      ownerA,
    );
    expect(forced.statusCode).toBe(403);
  });

  it("verificação OAB e identidade retornam NOT_CONFIGURED", async () => {
    const oab = await call(app, "POST", "/v1/profiles/me/lawyer/verify", {}, ownerA);
    expect(oab.statusCode).toBe(503);
    expect(oab.json<{ error: { code: string } }>().error.code).toBe("NOT_CONFIGURED");

    const kyc = await call(app, "POST", "/v1/profiles/me/identity/verify", {}, ownerA);
    expect(kyc.statusCode).toBe(503);
  });

  it("perfil de funcionário é escopo de organização", async () => {
    const employee = await call(
      app,
      "PUT",
      `/v1/organizations/${orgA}/profiles/employees/me`,
      { jobTitle: "Assistente", department: "Contencioso" },
      memberA,
    );
    expect(employee.statusCode).toBe(200);

    const denied = await call(
      app,
      "PUT",
      `/v1/organizations/${orgB}/profiles/employees/me`,
      { jobTitle: "Intruso" },
      memberA,
    );
    expect([403, 404]).toContain(denied.statusCode);
  });

  it("cria lead PF, busca, filtra e pagina", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/crm/leads`,
      {
        personType: "person",
        name: "Maria Lead PF",
        email: "maria.lead@exemplo.com",
        phone: "11999990000",
        ownerMembershipId: ownerAMembershipId,
      },
      ownerA,
    );
    expect(created.statusCode).toBe(201);

    const pj = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/crm/leads`,
      {
        personType: "organization",
        name: "Empresa Lead LTDA",
        tradeName: "Empresa Lead",
        email: "contato@empresalead.com",
      },
      ownerA,
    );
    expect(pj.statusCode).toBe(201);

    const search = await call(
      app,
      "GET",
      `/v1/organizations/${orgA}/crm/leads?q=Maria&limit=10&offset=0`,
      undefined,
      ownerA,
    );
    expect(search.statusCode).toBe(200);
    const body = search.json<{ items: Array<{ name: string }>; total: number }>();
    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(body.items.some((item) => item.name.includes("Maria"))).toBe(true);

    const filtered = await call(
      app,
      "GET",
      `/v1/organizations/${orgA}/crm/leads?status=new&personType=organization`,
      undefined,
      ownerA,
    );
    expect(filtered.statusCode).toBe(200);
    expect(
      filtered
        .json<{ items: Array<{ personType: string }> }>()
        .items.every((item) => item.personType === "organization"),
    ).toBe(true);
  });

  it("cria tag, nota, interação e converte lead sem duplicar", async () => {
    const tag = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/crm/tags`,
      { name: "Prioridade", color: "#0B56F0" },
      ownerA,
    );
    expect(tag.statusCode).toBe(201);
    const tagId = tag.json<{ tag: { id: string } }>().tag.id;

    const lead = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/crm/leads`,
      {
        personType: "person",
        name: "Lead Conversão",
        email: "conversao@exemplo.com",
        tagIds: [tagId],
      },
      ownerA,
    );
    expect(lead.statusCode).toBe(201);
    const leadId = lead.json<{ lead: { id: string } }>().lead.id;

    const note = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/crm/notes`,
      {
        resourceType: "lead",
        resourceId: leadId,
        content: "Primeiro contato telefônico realizado.",
      },
      ownerA,
    );
    expect(note.statusCode).toBe(201);

    const interaction = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/crm/interactions`,
      {
        resourceType: "lead",
        resourceId: leadId,
        type: "call",
        title: "Ligação de qualificação",
        body: "Registro manual da ligação.",
      },
      ownerA,
    );
    expect(interaction.statusCode).toBe(201);

    const converted = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/crm/leads/${leadId}/convert`,
      {},
      ownerA,
    );
    expect(converted.statusCode).toBe(200);
    const clientId = converted.json<{ clientId: string }>().clientId;
    expect(clientId).toBeTruthy();

    const again = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/crm/leads/${leadId}/convert`,
      {},
      ownerA,
    );
    expect(again.statusCode).toBe(409);

    const timeline = await call(
      app,
      "GET",
      `/v1/organizations/${orgA}/crm/leads/${leadId}/timeline`,
      undefined,
      ownerA,
    );
    expect(timeline.statusCode).toBe(200);
    expect(timeline.json<{ items: unknown[] }>().items.length).toBeGreaterThan(0);

    const client = await call(
      app,
      "GET",
      `/v1/organizations/${orgA}/crm/clients/${clientId}`,
      undefined,
      ownerA,
    );
    expect(client.statusCode).toBe(200);
  });

  it("valida CPF/CNPJ e mascara na leitura", async () => {
    const invalid = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/crm/clients`,
      { personType: "person", fullName: "CPF Inválido", cpf: "11111111111" },
      ownerA,
    );
    expect(invalid.statusCode).toBe(400);

    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/crm/clients`,
      { personType: "person", fullName: "CPF Válido", cpf: "390.533.447-05" },
      ownerA,
    );
    expect(created.statusCode).toBe(201);
    const clientId = created.json<{ client: { id: string } }>().client.id;
    const detail = await call(
      app,
      "GET",
      `/v1/organizations/${orgA}/crm/clients/${clientId}`,
      undefined,
      ownerA,
    );
    const client = detail.json<{ client: { cpfMasked?: string | null; cpfNormalized?: string } }>()
      .client;
    expect(client.cpfMasked).toMatch(/\*\*\*/);
    expect(client.cpfNormalized).toBeUndefined();
  });

  it("protege CRM cross-tenant com 404", async () => {
    const lead = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/crm/leads`,
      { personType: "person", name: "Lead Isolado" },
      ownerA,
    );
    const leadId = lead.json<{ lead: { id: string } }>().lead.id;

    const read = await call(
      app,
      "GET",
      `/v1/organizations/${orgB}/crm/leads/${leadId}`,
      undefined,
      ownerB,
    );
    expect(read.statusCode).toBe(404);

    const convert = await call(
      app,
      "POST",
      `/v1/organizations/${orgB}/crm/leads/${leadId}/convert`,
      {},
      ownerB,
    );
    expect(convert.statusCode).toBe(404);

    const note = await call(
      app,
      "POST",
      `/v1/organizations/${orgB}/crm/notes`,
      {
        resourceType: "lead",
        resourceId: leadId,
        content: "Tentativa cross-tenant",
      },
      ownerB,
    );
    expect([403, 404]).toContain(note.statusCode);
  });

  it("membro sem crm.manage_tags não cria tag", async () => {
    const tag = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/crm/tags`,
      { name: "Negada" },
      memberA,
    );
    expect(tag.statusCode).toBe(403);
  });

  it("visão geral e catálogo seedam por organização", async () => {
    const overview = await call(
      app,
      "GET",
      `/v1/organizations/${orgA}/crm/overview`,
      undefined,
      ownerA,
    );
    expect(overview.statusCode).toBe(200);
    const counts = overview.json<{ overview: { leads: number; clients: number } }>().overview;
    expect(counts.leads).toBeGreaterThan(0);

    const sources = await call(
      app,
      "GET",
      `/v1/organizations/${orgA}/crm/sources`,
      undefined,
      ownerA,
    );
    expect(sources.statusCode).toBe(200);
    expect(sources.json<{ sources: unknown[] }>().sources.length).toBeGreaterThan(0);
  });
});
