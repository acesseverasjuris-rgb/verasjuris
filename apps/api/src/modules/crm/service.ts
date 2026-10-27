import {
  crmChannels,
  crmClientTags,
  crmClients,
  crmContacts,
  crmInteractions,
  crmIntakes,
  crmLeadTags,
  crmLeads,
  crmNotes,
  crmOpportunities,
  crmSources,
  crmTags,
  isUniqueViolation,
  legalMatters,
  organizationMembers,
  type AppDatabase,
} from "@verasjuris/database";
import { policyCrm, type SessionAccount } from "@verasjuris/auth";
import { AppError } from "@verasjuris/types";
import {
  maskCnpj,
  maskCpf,
  normalizeCnpj,
  normalizeCpf,
  slugifyName,
} from "@verasjuris/validation";
import { and, asc, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import type { RequestMeta } from "../auth/service.js";
import { recordAudit } from "@verasjuris/audit";
import { ensureCrmCatalog } from "./catalog.js";

function membershipOf(account: SessionAccount, organizationId: string) {
  return account.memberships.find((item) => item.organizationId === organizationId) ?? null;
}

function accessOf(account: SessionAccount, organizationId: string) {
  const membership = membershipOf(account, organizationId);
  return membership
    ? {
        status: membership.membershipStatus,
        organizationStatus: membership.organizationStatus,
        permissions: membership.permissions,
        roles: membership.roles,
      }
    : null;
}

function requireCrm(
  account: SessionAccount,
  organizationId: string,
  permission: Parameters<typeof policyCrm>[1],
) {
  const decision = policyCrm(accessOf(account, organizationId), permission);
  if (!decision.ok) throw new AppError(decision.code, decision.message);
  return membershipOf(account, organizationId)!;
}

async function requireActiveMembershipInOrg(
  db: AppDatabase,
  organizationId: string,
  membershipId: string,
) {
  const row = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.id, membershipId),
      eq(organizationMembers.organizationId, organizationId),
      eq(organizationMembers.status, "active"),
    ),
  });
  if (!row) {
    throw new AppError(
      "VALIDATION_ERROR",
      "O responsável precisa ser um participante ativo desta organização.",
    );
  }
}

async function assertTagsInOrg(db: AppDatabase, organizationId: string, tagIds: string[]) {
  if (tagIds.length === 0) return;
  const rows = await db.query.crmTags.findMany({
    where: and(eq(crmTags.organizationId, organizationId), inArray(crmTags.id, tagIds)),
    columns: { id: true },
  });
  if (rows.length !== new Set(tagIds).size) {
    throw new AppError("VALIDATION_ERROR", "Uma ou mais tags não pertencem à organização ativa.", [
      { path: "tagIds", message: "Informe apenas tags da organização ativa." },
    ]);
  }
}

async function assertSourceInOrg(
  db: AppDatabase,
  organizationId: string,
  sourceId: string | undefined,
) {
  if (!sourceId) return;
  const row = await db.query.crmSources.findFirst({
    where: and(eq(crmSources.organizationId, organizationId), eq(crmSources.id, sourceId)),
    columns: { id: true },
  });
  if (!row) {
    throw new AppError("VALIDATION_ERROR", "A origem informada não pertence à organização ativa.", [
      { path: "sourceId", message: "Origem inválida para esta organização." },
    ]);
  }
}

async function assertChannelInOrg(
  db: AppDatabase,
  organizationId: string,
  channelId: string | undefined,
) {
  if (!channelId) return;
  const row = await db.query.crmChannels.findFirst({
    where: and(eq(crmChannels.organizationId, organizationId), eq(crmChannels.id, channelId)),
    columns: { id: true },
  });
  if (!row) {
    throw new AppError("VALIDATION_ERROR", "O canal informado não pertence à organização ativa.", [
      { path: "channelId", message: "Canal inválido para esta organização." },
    ]);
  }
}

async function assertCrmResourceInOrg(
  db: AppDatabase,
  organizationId: string,
  resourceType: "lead" | "client" | "contact" | "intake" | "opportunity" | "case",
  resourceId: string,
) {
  if (resourceType === "lead") {
    const row = await db.query.crmLeads.findFirst({
      where: and(eq(crmLeads.id, resourceId), eq(crmLeads.organizationId, organizationId)),
      columns: { id: true },
    });
    if (!row) throw new AppError("NOT_FOUND", "Não encontramos este recurso no seu acesso.");
    return;
  }
  if (resourceType === "client") {
    const row = await db.query.crmClients.findFirst({
      where: and(eq(crmClients.id, resourceId), eq(crmClients.organizationId, organizationId)),
      columns: { id: true },
    });
    if (!row) throw new AppError("NOT_FOUND", "Não encontramos este recurso no seu acesso.");
    return;
  }
  if (resourceType === "contact") {
    const row = await db.query.crmContacts.findFirst({
      where: and(eq(crmContacts.id, resourceId), eq(crmContacts.organizationId, organizationId)),
      columns: { id: true },
    });
    if (!row) throw new AppError("NOT_FOUND", "Não encontramos este recurso no seu acesso.");
    return;
  }
  if (resourceType === "opportunity") {
    const row = await db.query.crmOpportunities.findFirst({
      where: and(
        eq(crmOpportunities.id, resourceId),
        eq(crmOpportunities.organizationId, organizationId),
      ),
      columns: { id: true },
    });
    if (!row) throw new AppError("NOT_FOUND", "Não encontramos este recurso no seu acesso.");
    return;
  }
  if (resourceType === "case") {
    const row = await db.query.legalMatters.findFirst({
      where: and(eq(legalMatters.id, resourceId), eq(legalMatters.organizationId, organizationId)),
      columns: { id: true },
    });
    if (!row) throw new AppError("NOT_FOUND", "Não encontramos este recurso no seu acesso.");
    return;
  }
  const row = await db.query.crmIntakes.findFirst({
    where: and(eq(crmIntakes.id, resourceId), eq(crmIntakes.organizationId, organizationId)),
    columns: { id: true },
  });
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos este recurso no seu acesso.");
}

export async function listSources(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  requireCrm(account, organizationId, "crm.read");
  await ensureCrmCatalog(db, organizationId);
  return db.query.crmSources.findMany({
    where: eq(crmSources.organizationId, organizationId),
    orderBy: [asc(crmSources.name)],
  });
}

export async function listChannels(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  requireCrm(account, organizationId, "crm.read");
  await ensureCrmCatalog(db, organizationId);
  return db.query.crmChannels.findMany({
    where: eq(crmChannels.organizationId, organizationId),
    orderBy: [asc(crmChannels.name)],
  });
}

export async function listTags(db: AppDatabase, account: SessionAccount, organizationId: string) {
  requireCrm(account, organizationId, "crm.read");
  return db.query.crmTags.findMany({
    where: eq(crmTags.organizationId, organizationId),
    orderBy: [asc(crmTags.name)],
  });
}

export async function createTag(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: { name: string; color?: string },
  meta: RequestMeta,
) {
  requireCrm(account, organizationId, "crm.manage_tags");
  const slug = slugifyName(input.name);
  try {
    const [tag] = await db
      .insert(crmTags)
      .values({
        organizationId,
        name: input.name,
        slug,
        color: input.color,
        createdByUserId: account.user.id,
      })
      .returning();
    if (!tag) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a tag.");
    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "crm.tag_created",
      resourceType: "crm_tag",
      resourceId: tag.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { name: tag.name, slug: tag.slug },
    });
    return tag;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("CONFLICT", "Já existe uma tag com este nome nesta organização.");
    }
    throw error;
  }
}

type ListQuery = {
  q?: string;
  status?: string;
  sourceId?: string;
  channelId?: string;
  ownerMembershipId?: string;
  tagId?: string;
  personType?: "person" | "organization";
  limit: number;
  offset: number;
  sort: "createdAt" | "updatedAt" | "name";
  order: "asc" | "desc";
};

export async function listLeads(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: ListQuery,
) {
  requireCrm(account, organizationId, "crm.read");
  await ensureCrmCatalog(db, organizationId);
  const filters = [eq(crmLeads.organizationId, organizationId)];
  if (query.status) {
    filters.push(eq(crmLeads.status, query.status as (typeof crmLeads.status.enumValues)[number]));
  }
  if (query.sourceId) filters.push(eq(crmLeads.sourceId, query.sourceId));
  if (query.channelId) filters.push(eq(crmLeads.channelId, query.channelId));
  if (query.ownerMembershipId)
    filters.push(eq(crmLeads.ownerMembershipId, query.ownerMembershipId));
  if (query.personType) filters.push(eq(crmLeads.personType, query.personType));
  if (query.q) {
    const term = `%${query.q}%`;
    filters.push(
      or(ilike(crmLeads.name, term), ilike(crmLeads.email, term), ilike(crmLeads.phone, term))!,
    );
  }
  if (query.tagId) {
    const tagged = await db
      .select({ leadId: crmLeadTags.leadId })
      .from(crmLeadTags)
      .where(
        and(eq(crmLeadTags.organizationId, organizationId), eq(crmLeadTags.tagId, query.tagId)),
      );
    const ids = tagged.map((t) => t.leadId);
    if (ids.length === 0) return { items: [], total: 0, limit: query.limit, offset: query.offset };
    filters.push(inArray(crmLeads.id, ids));
  }

  const orderColumn =
    query.sort === "name"
      ? crmLeads.name
      : query.sort === "createdAt"
        ? crmLeads.createdAt
        : crmLeads.updatedAt;
  const orderBy = query.order === "asc" ? asc(orderColumn) : desc(orderColumn);

  const where = and(...filters);
  const [totalRow] = await db.select({ value: count() }).from(crmLeads).where(where);
  const items = await db.query.crmLeads.findMany({
    where,
    orderBy: [orderBy],
    limit: query.limit,
    offset: query.offset,
    with: {
      source: true,
      channel: true,
      tags: { with: { tag: true } },
    },
  });
  return {
    items: items.map((lead) => ({
      id: lead.id,
      personType: lead.personType,
      name: lead.name,
      tradeName: lead.tradeName,
      email: lead.email,
      phone: lead.phone,
      status: lead.status,
      summary: lead.summary,
      source: lead.source ? { id: lead.source.id, name: lead.source.name } : null,
      channel: lead.channel ? { id: lead.channel.id, name: lead.channel.name } : null,
      ownerMembershipId: lead.ownerMembershipId,
      tags: lead.tags.map((link) => ({
        id: link.tag.id,
        name: link.tag.name,
        color: link.tag.color,
      })),
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
      convertedAt: lead.convertedAt?.toISOString() ?? null,
    })),
    total: totalRow?.value ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function createLead(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    personType: "person" | "organization";
    name: string;
    tradeName?: string;
    email?: string;
    phone?: string;
    summary?: string;
    sourceId?: string;
    channelId?: string;
    ownerMembershipId?: string;
    tagIds?: string[];
  },
  meta: RequestMeta,
) {
  const actor = requireCrm(account, organizationId, "crm.create");
  await ensureCrmCatalog(db, organizationId);
  if (input.ownerMembershipId) {
    if (input.ownerMembershipId !== actor.membershipId) {
      requireCrm(account, organizationId, "crm.assign");
    }
    await requireActiveMembershipInOrg(db, organizationId, input.ownerMembershipId);
  }
  await assertSourceInOrg(db, organizationId, input.sourceId);
  await assertChannelInOrg(db, organizationId, input.channelId);
  await assertTagsInOrg(db, organizationId, input.tagIds ?? []);
  const created = await db.transaction(async (tx) => {
    const [lead] = await tx
      .insert(crmLeads)
      .values({
        organizationId,
        personType: input.personType,
        name: input.name,
        tradeName: input.tradeName,
        email: input.email,
        phone: input.phone,
        summary: input.summary,
        sourceId: input.sourceId,
        channelId: input.channelId,
        ownerMembershipId: input.ownerMembershipId ?? actor.membershipId,
        createdByUserId: account.user.id,
      })
      .returning();
    if (!lead) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o lead.");
    for (const tagId of input.tagIds ?? []) {
      await tx.insert(crmLeadTags).values({ organizationId, leadId: lead.id, tagId });
    }
    await tx.insert(crmInteractions).values({
      organizationId,
      resourceType: "lead",
      resourceId: lead.id,
      type: "status_change",
      origin: "system",
      title: "Lead criado",
      body: "Lead registrado no CRM.",
      actorUserId: account.user.id,
    });
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "crm.lead_created",
      resourceType: "crm_lead",
      resourceId: lead.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { status: lead.status, personType: lead.personType },
    });
    return lead;
  });
  return created;
}

export async function getLead(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  leadId: string,
) {
  requireCrm(account, organizationId, "crm.read");
  const lead = await db.query.crmLeads.findFirst({
    where: and(eq(crmLeads.id, leadId), eq(crmLeads.organizationId, organizationId)),
    with: {
      source: true,
      channel: true,
      tags: { with: { tag: true } },
      contacts: true,
    },
  });
  if (!lead) throw new AppError("NOT_FOUND", "Não encontramos este recurso no seu acesso.");
  return lead;
}

export async function updateLead(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  leadId: string,
  input: Record<string, unknown>,
  meta: RequestMeta,
) {
  const actor = requireCrm(account, organizationId, "crm.update");
  const current = await getLead(db, account, organizationId, leadId);
  if (current.status === "converted" && input.status && input.status !== "converted") {
    throw new AppError("CONFLICT", "Lead convertido não pode voltar a outro status operacional.");
  }
  if (typeof input.ownerMembershipId === "string") {
    if (input.ownerMembershipId !== actor.membershipId) {
      requireCrm(account, organizationId, "crm.assign");
    }
    await requireActiveMembershipInOrg(db, organizationId, input.ownerMembershipId);
  }
  if (typeof input.sourceId === "string")
    await assertSourceInOrg(db, organizationId, input.sourceId);
  if (typeof input.channelId === "string")
    await assertChannelInOrg(db, organizationId, input.channelId);
  const [updated] = await db
    .update(crmLeads)
    .set({
      ...(input.name !== undefined ? { name: input.name as string } : {}),
      ...(input.tradeName !== undefined ? { tradeName: input.tradeName as string } : {}),
      ...(input.email !== undefined ? { email: input.email as string } : {}),
      ...(input.phone !== undefined ? { phone: input.phone as string } : {}),
      ...(input.summary !== undefined ? { summary: input.summary as string } : {}),
      ...(input.status !== undefined
        ? { status: input.status as (typeof crmLeads.status.enumValues)[number] }
        : {}),
      ...(input.sourceId !== undefined ? { sourceId: input.sourceId as string } : {}),
      ...(input.channelId !== undefined ? { channelId: input.channelId as string } : {}),
      ...(input.ownerMembershipId !== undefined
        ? { ownerMembershipId: input.ownerMembershipId as string }
        : {}),
      ...(input.personType !== undefined
        ? { personType: input.personType as "person" | "organization" }
        : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(crmLeads.id, leadId), eq(crmLeads.organizationId, organizationId)))
    .returning();
  if (!updated) throw new AppError("NOT_FOUND", "Não encontramos este recurso no seu acesso.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "crm.lead_updated",
    resourceType: "crm_lead",
    resourceId: leadId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    before: { status: current.status },
    after: { status: updated.status },
  });
  return updated;
}

export async function convertLead(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  leadId: string,
  meta: RequestMeta,
) {
  requireCrm(account, organizationId, "crm.update");
  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from crm_leads where id = ${leadId} for update`);
    const lead = await tx.query.crmLeads.findFirst({
      where: and(eq(crmLeads.id, leadId), eq(crmLeads.organizationId, organizationId)),
      with: { contacts: true, tags: true },
    });
    if (!lead) throw new AppError("NOT_FOUND", "Não encontramos este recurso no seu acesso.");
    if (lead.status === "converted" || lead.convertedClientId) {
      throw new AppError("CONFLICT", "Este lead já foi convertido. Nenhuma alteração adicional.");
    }
    const [client] = await tx
      .insert(crmClients)
      .values({
        organizationId,
        personType: lead.personType,
        status: "active",
        fullName: lead.personType === "person" ? lead.name : null,
        legalName: lead.personType === "organization" ? lead.name : null,
        tradeName: lead.tradeName,
        email: lead.email,
        phone: lead.phone,
        notes: lead.summary,
        sourceId: lead.sourceId,
        channelId: lead.channelId,
        ownerMembershipId: lead.ownerMembershipId,
        createdByUserId: account.user.id,
        convertedFromLeadId: lead.id,
      })
      .returning();
    if (!client) throw new AppError("INTERNAL_ERROR", "Não foi possível converter o lead.");
    for (const contact of lead.contacts) {
      await tx.insert(crmContacts).values({
        organizationId,
        clientId: client.id,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        jobTitle: contact.jobTitle,
        notes: contact.notes,
        isPrimary: contact.isPrimary,
        contactPreferences: contact.contactPreferences,
      });
    }
    for (const link of lead.tags) {
      await tx.insert(crmClientTags).values({
        organizationId,
        clientId: client.id,
        tagId: link.tagId,
      });
    }
    await tx
      .update(crmLeads)
      .set({
        status: "converted",
        convertedAt: new Date(),
        convertedClientId: client.id,
        updatedAt: new Date(),
      })
      .where(eq(crmLeads.id, lead.id));
    await tx.insert(crmInteractions).values({
      organizationId,
      resourceType: "lead",
      resourceId: lead.id,
      type: "lead_conversion",
      origin: "system",
      title: "Lead convertido em cliente",
      body: `Cliente ${client.id}`,
      actorUserId: account.user.id,
    });
    await tx.insert(crmInteractions).values({
      organizationId,
      resourceType: "client",
      resourceId: client.id,
      type: "lead_conversion",
      origin: "system",
      title: "Cliente originado de lead",
      body: `Lead ${lead.id}`,
      actorUserId: account.user.id,
    });
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "crm.lead_converted",
      resourceType: "crm_lead",
      resourceId: lead.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { clientId: client.id },
    });
    return { leadId: lead.id, clientId: client.id };
  });
}

export async function listClients(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: ListQuery,
) {
  requireCrm(account, organizationId, "crm.read");
  const filters = [eq(crmClients.organizationId, organizationId)];
  if (query.status) {
    filters.push(
      eq(crmClients.status, query.status as (typeof crmClients.status.enumValues)[number]),
    );
  }
  if (query.personType) filters.push(eq(crmClients.personType, query.personType));
  if (query.sourceId) filters.push(eq(crmClients.sourceId, query.sourceId));
  if (query.ownerMembershipId)
    filters.push(eq(crmClients.ownerMembershipId, query.ownerMembershipId));
  if (query.q) {
    const term = `%${query.q}%`;
    filters.push(
      or(
        ilike(crmClients.fullName, term),
        ilike(crmClients.legalName, term),
        ilike(crmClients.tradeName, term),
        ilike(crmClients.email, term),
        ilike(crmClients.phone, term),
      )!,
    );
  }
  const where = and(...filters);
  const [totalRow] = await db.select({ value: count() }).from(crmClients).where(where);
  const orderColumn =
    query.sort === "name"
      ? sql`coalesce(${crmClients.fullName}, ${crmClients.legalName})`
      : query.sort === "createdAt"
        ? crmClients.createdAt
        : crmClients.updatedAt;
  const items = await db.query.crmClients.findMany({
    where,
    orderBy: [query.order === "asc" ? asc(orderColumn) : desc(orderColumn)],
    limit: query.limit,
    offset: query.offset,
    with: { source: true, channel: true, tags: { with: { tag: true } } },
  });
  return {
    items: items.map((client) => ({
      id: client.id,
      personType: client.personType,
      status: client.status,
      displayName:
        client.personType === "person"
          ? client.socialName || client.fullName || "Sem nome"
          : client.tradeName || client.legalName || "Sem nome",
      email: client.email,
      phone: client.phone,
      cpfMasked: maskCpf(client.cpfNormalized),
      cnpjMasked: maskCnpj(client.cnpjNormalized),
      ownerMembershipId: client.ownerMembershipId,
      tags: client.tags.map((link) => ({
        id: link.tag.id,
        name: link.tag.name,
        color: link.tag.color,
      })),
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
    })),
    total: totalRow?.value ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function createClient(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    personType: "person" | "organization";
    fullName?: string;
    socialName?: string;
    cpf?: string;
    legalName?: string;
    tradeName?: string;
    cnpj?: string;
    email?: string;
    phone?: string;
    website?: string;
    notes?: string;
    sourceId?: string;
    channelId?: string;
    ownerMembershipId?: string;
    tagIds?: string[];
  },
  meta: RequestMeta,
) {
  const actor = requireCrm(account, organizationId, "crm.create");
  if (input.personType === "person" && !input.fullName) {
    throw new AppError("VALIDATION_ERROR", "Informe o nome da pessoa física.");
  }
  if (input.personType === "organization" && !input.legalName) {
    throw new AppError("VALIDATION_ERROR", "Informe a razão social.");
  }
  const cpfNormalized = input.cpf ? normalizeCpf(input.cpf) : null;
  if (input.cpf && !cpfNormalized) {
    throw new AppError("VALIDATION_ERROR", "CPF inválido.", [
      { path: "cpf", message: "Informe um CPF válido." },
    ]);
  }
  const cnpjNormalized = input.cnpj ? normalizeCnpj(input.cnpj) : null;
  if (input.cnpj && !cnpjNormalized) {
    throw new AppError("VALIDATION_ERROR", "CNPJ inválido.", [
      { path: "cnpj", message: "Informe um CNPJ válido." },
    ]);
  }
  if (input.ownerMembershipId) {
    if (input.ownerMembershipId !== actor.membershipId) {
      requireCrm(account, organizationId, "crm.assign");
    }
    await requireActiveMembershipInOrg(db, organizationId, input.ownerMembershipId);
  }
  await assertSourceInOrg(db, organizationId, input.sourceId);
  await assertChannelInOrg(db, organizationId, input.channelId);
  await assertTagsInOrg(db, organizationId, input.tagIds ?? []);
  const created = await db.transaction(async (tx) => {
    const [client] = await tx
      .insert(crmClients)
      .values({
        organizationId,
        personType: input.personType,
        fullName: input.fullName,
        socialName: input.socialName,
        cpfNormalized,
        legalName: input.legalName,
        tradeName: input.tradeName,
        cnpjNormalized,
        email: input.email,
        phone: input.phone,
        website: input.website,
        notes: input.notes,
        sourceId: input.sourceId,
        channelId: input.channelId,
        ownerMembershipId: input.ownerMembershipId ?? actor.membershipId,
        createdByUserId: account.user.id,
      })
      .returning();
    if (!client) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o cliente.");
    for (const tagId of input.tagIds ?? []) {
      await tx.insert(crmClientTags).values({ organizationId, clientId: client.id, tagId });
    }
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "crm.client_created",
      resourceType: "crm_client",
      resourceId: client.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { personType: client.personType },
    });
    return client;
  });
  return created;
}

export async function getClient(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  clientId: string,
) {
  requireCrm(account, organizationId, "crm.read");
  const client = await db.query.crmClients.findFirst({
    where: and(eq(crmClients.id, clientId), eq(crmClients.organizationId, organizationId)),
    with: { source: true, channel: true, tags: { with: { tag: true } }, contacts: true },
  });
  if (!client) throw new AppError("NOT_FOUND", "Não encontramos este recurso no seu acesso.");
  return {
    ...client,
    cpfMasked: maskCpf(client.cpfNormalized),
    cnpjMasked: maskCnpj(client.cnpjNormalized),
    cpfNormalized: undefined,
    cnpjNormalized: undefined,
  };
}

export async function updateClient(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  clientId: string,
  input: {
    personType?: "person" | "organization";
    fullName?: string;
    socialName?: string;
    cpf?: string;
    legalName?: string;
    tradeName?: string;
    cnpj?: string;
    email?: string;
    phone?: string;
    website?: string;
    notes?: string;
    sourceId?: string;
    channelId?: string;
    ownerMembershipId?: string;
    status?: "active" | "inactive" | "archived";
  },
  meta: RequestMeta,
) {
  const actor = requireCrm(account, organizationId, "crm.update");
  const current = await db.query.crmClients.findFirst({
    where: and(eq(crmClients.id, clientId), eq(crmClients.organizationId, organizationId)),
  });
  if (!current) throw new AppError("NOT_FOUND", "Não encontramos este recurso no seu acesso.");

  if (typeof input.ownerMembershipId === "string") {
    if (input.ownerMembershipId !== actor.membershipId) {
      requireCrm(account, organizationId, "crm.assign");
    }
    await requireActiveMembershipInOrg(db, organizationId, input.ownerMembershipId);
  }
  if (typeof input.sourceId === "string")
    await assertSourceInOrg(db, organizationId, input.sourceId);
  if (typeof input.channelId === "string")
    await assertChannelInOrg(db, organizationId, input.channelId);

  let cpfNormalized: string | null | undefined;
  if (input.cpf !== undefined) {
    cpfNormalized = input.cpf ? normalizeCpf(input.cpf) : null;
    if (input.cpf && !cpfNormalized) {
      throw new AppError("VALIDATION_ERROR", "CPF inválido.", [
        { path: "cpf", message: "Informe um CPF válido." },
      ]);
    }
  }

  let cnpjNormalized: string | null | undefined;
  if (input.cnpj !== undefined) {
    cnpjNormalized = input.cnpj ? normalizeCnpj(input.cnpj) : null;
    if (input.cnpj && !cnpjNormalized) {
      throw new AppError("VALIDATION_ERROR", "CNPJ inválido.", [
        { path: "cnpj", message: "Informe um CNPJ válido." },
      ]);
    }
  }

  const [updated] = await db
    .update(crmClients)
    .set({
      ...(input.personType !== undefined ? { personType: input.personType } : {}),
      ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
      ...(input.socialName !== undefined ? { socialName: input.socialName } : {}),
      ...(cpfNormalized !== undefined ? { cpfNormalized } : {}),
      ...(input.legalName !== undefined ? { legalName: input.legalName } : {}),
      ...(input.tradeName !== undefined ? { tradeName: input.tradeName } : {}),
      ...(cnpjNormalized !== undefined ? { cnpjNormalized } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.website !== undefined ? { website: input.website } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.sourceId !== undefined ? { sourceId: input.sourceId } : {}),
      ...(input.channelId !== undefined ? { channelId: input.channelId } : {}),
      ...(input.ownerMembershipId !== undefined
        ? { ownerMembershipId: input.ownerMembershipId }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(crmClients.id, clientId), eq(crmClients.organizationId, organizationId)))
    .returning();
  if (!updated) throw new AppError("NOT_FOUND", "Não encontramos este recurso no seu acesso.");

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "crm.client_updated",
    resourceType: "crm_client",
    resourceId: clientId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    before: { status: current.status },
    after: { status: updated.status },
  });

  return {
    ...updated,
    cpfMasked: maskCpf(updated.cpfNormalized),
    cnpjMasked: maskCnpj(updated.cnpjNormalized),
    cpfNormalized: undefined,
    cnpjNormalized: undefined,
  };
}

export async function listContacts(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { clientId?: string; leadId?: string; limit: number; offset: number },
) {
  requireCrm(account, organizationId, "crm.read");
  const filters = [eq(crmContacts.organizationId, organizationId)];
  if (query.clientId) filters.push(eq(crmContacts.clientId, query.clientId));
  if (query.leadId) filters.push(eq(crmContacts.leadId, query.leadId));
  const where = and(...filters);
  const [totalRow] = await db.select({ value: count() }).from(crmContacts).where(where);
  const items = await db.query.crmContacts.findMany({
    where,
    orderBy: [desc(crmContacts.createdAt)],
    limit: query.limit,
    offset: query.offset,
  });
  return {
    items,
    total: totalRow?.value ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function createNote(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    resourceType: "lead" | "client" | "contact" | "intake" | "opportunity" | "case";
    resourceId: string;
    content: string;
    visibility: "organization" | "internal" | "private";
  },
  meta: RequestMeta,
) {
  const actor = requireCrm(account, organizationId, "crm.write_notes");
  await assertCrmResourceInOrg(db, organizationId, input.resourceType, input.resourceId);
  const [note] = await db
    .insert(crmNotes)
    .values({
      organizationId,
      authorMembershipId: actor.membershipId,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      content: input.content,
      visibility: input.visibility,
    })
    .returning();
  if (!note) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a anotação.");
  await db.insert(crmInteractions).values({
    organizationId,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    type: "note",
    origin: "manual",
    title: "Anotação registrada",
    body: input.content.slice(0, 280),
    actorUserId: account.user.id,
  });
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "crm.note_created",
    resourceType: "crm_note",
    resourceId: note.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { resourceType: input.resourceType, resourceId: input.resourceId },
  });
  return note;
}

export async function createInteraction(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    resourceType: "lead" | "client" | "contact" | "intake" | "opportunity" | "case";
    resourceId: string;
    type: "note" | "call" | "email" | "meeting" | "message";
    title: string;
    body?: string;
  },
  meta: RequestMeta,
) {
  requireCrm(account, organizationId, "crm.update");
  await assertCrmResourceInOrg(db, organizationId, input.resourceType, input.resourceId);
  const [row] = await db
    .insert(crmInteractions)
    .values({
      organizationId,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      type: input.type,
      origin: "manual",
      title: input.title,
      body: input.body,
      actorUserId: account.user.id,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar a interação.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "crm.interaction_created",
    resourceType: "crm_interaction",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { type: input.type, resourceType: input.resourceType },
  });
  return row;
}

export async function listTimeline(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  resourceType: "lead" | "client" | "intake" | "opportunity" | "case",
  resourceId: string,
) {
  requireCrm(account, organizationId, "crm.read");
  await assertCrmResourceInOrg(db, organizationId, resourceType, resourceId);
  const notesAllowed = policyCrm(accessOf(account, organizationId), "crm.read_notes");
  const interactions = await db.query.crmInteractions.findMany({
    where: and(
      eq(crmInteractions.organizationId, organizationId),
      eq(crmInteractions.resourceType, resourceType),
      eq(crmInteractions.resourceId, resourceId),
    ),
    orderBy: [desc(crmInteractions.occurredAt)],
    limit: 100,
  });
  const notes = notesAllowed.ok
    ? await db.query.crmNotes.findMany({
        where: and(
          eq(crmNotes.organizationId, organizationId),
          eq(crmNotes.resourceType, resourceType),
          eq(crmNotes.resourceId, resourceId),
        ),
        orderBy: [desc(crmNotes.createdAt)],
        limit: 50,
      })
    : [];
  const items = [
    ...interactions.map((item) => ({
      kind: "interaction" as const,
      id: item.id,
      type: item.type,
      title: item.title,
      body: item.body,
      occurredAt: item.occurredAt.toISOString(),
      origin: item.origin,
    })),
    ...notes.map((note) => ({
      kind: "note" as const,
      id: note.id,
      type: "note" as const,
      title: "Anotação",
      body: note.content,
      occurredAt: note.createdAt.toISOString(),
      origin: "manual" as const,
    })),
  ].sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
  return { items };
}

export async function crmOverview(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  requireCrm(account, organizationId, "crm.read");
  const [leadsTotal] = await db
    .select({ value: count() })
    .from(crmLeads)
    .where(eq(crmLeads.organizationId, organizationId));
  const [clientsTotal] = await db
    .select({ value: count() })
    .from(crmClients)
    .where(eq(crmClients.organizationId, organizationId));
  const [openLeads] = await db
    .select({ value: count() })
    .from(crmLeads)
    .where(
      and(
        eq(crmLeads.organizationId, organizationId),
        sql`${crmLeads.status} not in ('converted', 'archived', 'unqualified')`,
      ),
    );
  return {
    leads: leadsTotal?.value ?? 0,
    openLeads: openLeads?.value ?? 0,
    clients: clientsTotal?.value ?? 0,
  };
}
