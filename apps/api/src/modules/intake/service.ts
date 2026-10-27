import { recordAudit } from "@verasjuris/audit";
import {
  assertIntakeTransition,
  assertTriageTransition,
  policyInitialDocument,
  policyIntake,
  policyLegalArea,
  policyTriage,
  type SessionAccount,
} from "@verasjuris/auth";
import {
  crmChannels,
  crmClients,
  crmContacts,
  crmIntakeDocuments,
  crmIntakes,
  crmInteractions,
  crmLeads,
  crmSources,
  crmTriages,
  isUniqueViolation,
  legalAreas,
  organizationMembers,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { slugifyName } from "@verasjuris/validation";
import { and, asc, count, desc, eq, gte, ilike, isNull, lte, or, sql } from "drizzle-orm";
import type { RequestMeta } from "../auth/service.js";
import { ensureCrmCatalog } from "../crm/catalog.js";
import { convertLead, listTimeline } from "../crm/service.js";
import { ensureLegalAreasCatalog } from "./catalog.js";
import { objectStorage } from "./storage.js";

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

function requireIntakePermission(
  account: SessionAccount,
  organizationId: string,
  permission: Parameters<typeof policyIntake>[1],
) {
  const decision = policyIntake(accessOf(account, organizationId), permission);
  if (!decision.ok) throw new AppError(decision.code, decision.message);
  return membershipOf(account, organizationId)!;
}

function requireTriagePermission(
  account: SessionAccount,
  organizationId: string,
  permission: Parameters<typeof policyTriage>[1],
) {
  const decision = policyTriage(accessOf(account, organizationId), permission);
  if (!decision.ok) throw new AppError(decision.code, decision.message);
  return membershipOf(account, organizationId)!;
}

function requireLegalAreaPermission(
  account: SessionAccount,
  organizationId: string,
  permission: Parameters<typeof policyLegalArea>[1],
) {
  const decision = policyLegalArea(accessOf(account, organizationId), permission);
  if (!decision.ok) throw new AppError(decision.code, decision.message);
  return membershipOf(account, organizationId)!;
}

function requireDocumentPermission(
  account: SessionAccount,
  organizationId: string,
  permission: Parameters<typeof policyInitialDocument>[1],
) {
  const decision = policyInitialDocument(accessOf(account, organizationId), permission);
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

async function requireIntake(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  intakeId: string,
  permission: Parameters<typeof policyIntake>[1] = "intake.read",
) {
  requireIntakePermission(account, organizationId, permission);
  const intake = await db.query.crmIntakes.findFirst({
    where: and(eq(crmIntakes.id, intakeId), eq(crmIntakes.organizationId, organizationId)),
  });
  if (!intake) throw new AppError("NOT_FOUND", "Não encontramos este recurso no seu acesso.");
  return intake;
}

async function requireTriage(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  intakeId: string,
  permission: Parameters<typeof policyTriage>[1] = "triage.read",
) {
  requireTriagePermission(account, organizationId, permission);
  const triage = await db.query.crmTriages.findFirst({
    where: and(eq(crmTriages.intakeId, intakeId), eq(crmTriages.organizationId, organizationId)),
  });
  if (!triage) throw new AppError("NOT_FOUND", "Não encontramos esta triagem no seu acesso.");
  return triage;
}

async function requireDoc(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  documentId: string,
  permission: Parameters<typeof policyInitialDocument>[1] = "document_initial.read",
) {
  requireDocumentPermission(account, organizationId, permission);
  const doc = await db.query.crmIntakeDocuments.findFirst({
    where: and(
      eq(crmIntakeDocuments.id, documentId),
      eq(crmIntakeDocuments.organizationId, organizationId),
    ),
  });
  if (!doc) throw new AppError("NOT_FOUND", "Não encontramos este documento no seu acesso.");
  return doc;
}

async function requireLegalArea(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalAreaId: string,
  permission: Parameters<typeof policyLegalArea>[1] = "intake.read",
) {
  requireLegalAreaPermission(account, organizationId, permission);
  const area = await db.query.legalAreas.findFirst({
    where: and(eq(legalAreas.id, legalAreaId), eq(legalAreas.organizationId, organizationId)),
  });
  if (!area) throw new AppError("NOT_FOUND", "Não encontramos esta área jurídica no seu acesso.");
  return area;
}

async function assertLegalAreaInOrg(
  db: AppDatabase,
  organizationId: string,
  legalAreaId: string | undefined | null,
) {
  if (!legalAreaId) return;
  const row = await db.query.legalAreas.findFirst({
    where: and(eq(legalAreas.organizationId, organizationId), eq(legalAreas.id, legalAreaId)),
    columns: { id: true },
  });
  if (!row) {
    throw new AppError(
      "VALIDATION_ERROR",
      "A área jurídica informada não pertence à organização ativa.",
      [{ path: "legalAreaId", message: "Área jurídica inválida para esta organização." }],
    );
  }
}

async function assertLeadInOrg(db: AppDatabase, organizationId: string, leadId: string) {
  const row = await db.query.crmLeads.findFirst({
    where: and(eq(crmLeads.id, leadId), eq(crmLeads.organizationId, organizationId)),
    columns: { id: true },
  });
  if (!row) {
    throw new AppError("NOT_FOUND", "Não encontramos este recurso no seu acesso.");
  }
}

async function assertClientInOrg(db: AppDatabase, organizationId: string, clientId: string) {
  const row = await db.query.crmClients.findFirst({
    where: and(eq(crmClients.id, clientId), eq(crmClients.organizationId, organizationId)),
    columns: { id: true },
  });
  if (!row) {
    throw new AppError("NOT_FOUND", "Não encontramos este recurso no seu acesso.");
  }
}

async function assertContactInOrg(db: AppDatabase, organizationId: string, contactId: string) {
  const row = await db.query.crmContacts.findFirst({
    where: and(eq(crmContacts.id, contactId), eq(crmContacts.organizationId, organizationId)),
    columns: { id: true },
  });
  if (!row) {
    throw new AppError("NOT_FOUND", "Não encontramos este recurso no seu acesso.");
  }
}

async function assertSourceInOrg(
  db: AppDatabase,
  organizationId: string,
  sourceId: string | undefined | null,
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
  channelId: string | undefined | null,
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

function mapIntakeSummary(intake: {
  id: string;
  title: string;
  summary: string | null;
  status: string;
  urgency: string;
  serviceMode: string;
  startedAt: Date;
  closedAt: Date | null;
  convertedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  responsibleMembershipId: string | null;
  legalAreaId: string | null;
  leadId: string | null;
  clientId: string | null;
  contactId: string | null;
  source?: { id: string; name: string } | null;
  channel?: { id: string; name: string } | null;
  legalArea?: { id: string; name: string; slug: string } | null;
}) {
  return {
    id: intake.id,
    title: intake.title,
    summary: intake.summary,
    status: intake.status,
    urgency: intake.urgency,
    serviceMode: intake.serviceMode,
    responsibleMembershipId: intake.responsibleMembershipId,
    legalAreaId: intake.legalAreaId,
    leadId: intake.leadId,
    clientId: intake.clientId,
    contactId: intake.contactId,
    source: intake.source ? { id: intake.source.id, name: intake.source.name } : null,
    channel: intake.channel ? { id: intake.channel.id, name: intake.channel.name } : null,
    legalArea: intake.legalArea
      ? { id: intake.legalArea.id, name: intake.legalArea.name, slug: intake.legalArea.slug }
      : null,
    startedAt: intake.startedAt.toISOString(),
    closedAt: intake.closedAt?.toISOString() ?? null,
    convertedAt: intake.convertedAt?.toISOString() ?? null,
    createdAt: intake.createdAt.toISOString(),
    updatedAt: intake.updatedAt.toISOString(),
  };
}

export async function listLegalAreas(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  requireLegalAreaPermission(account, organizationId, "intake.read");
  await ensureLegalAreasCatalog(db, organizationId);
  return db.query.legalAreas.findMany({
    where: eq(legalAreas.organizationId, organizationId),
    orderBy: [asc(legalAreas.sortOrder), asc(legalAreas.name)],
  });
}

export async function createLegalArea(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: { name: string; slug?: string; description?: string; sortOrder?: number },
  meta: RequestMeta,
) {
  requireLegalAreaPermission(account, organizationId, "legal_area.manage");
  const slug = input.slug?.trim() ? slugifyName(input.slug) : slugifyName(input.name);
  try {
    const [area] = await db
      .insert(legalAreas)
      .values({
        organizationId,
        name: input.name,
        slug,
        description: input.description,
        sortOrder: input.sortOrder ?? 0,
        isSystem: false,
      })
      .returning();
    if (!area) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a área jurídica.");
    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "legal_area.created",
      resourceType: "legal_area",
      resourceId: area.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { name: area.name, slug: area.slug },
    });
    return area;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(
        "CONFLICT",
        "Já existe uma área jurídica com este identificador nesta organização.",
      );
    }
    throw error;
  }
}

type IntakeListQuery = {
  q?: string;
  status?: string;
  urgency?: string;
  legalAreaId?: string;
  responsibleMembershipId?: string;
  sourceId?: string;
  channelId?: string;
  from?: string;
  to?: string;
  limit: number;
  offset: number;
  sort: "createdAt" | "updatedAt" | "startedAt" | "urgency";
  order: "asc" | "desc";
};

export async function listIntakes(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: IntakeListQuery,
) {
  requireIntakePermission(account, organizationId, "intake.read");
  await ensureLegalAreasCatalog(db, organizationId);
  const filters = [eq(crmIntakes.organizationId, organizationId)];
  if (query.status) {
    filters.push(
      eq(crmIntakes.status, query.status as (typeof crmIntakes.status.enumValues)[number]),
    );
  }
  if (query.urgency) {
    filters.push(
      eq(crmIntakes.urgency, query.urgency as (typeof crmIntakes.urgency.enumValues)[number]),
    );
  }
  if (query.legalAreaId) filters.push(eq(crmIntakes.legalAreaId, query.legalAreaId));
  if (query.responsibleMembershipId) {
    filters.push(eq(crmIntakes.responsibleMembershipId, query.responsibleMembershipId));
  }
  if (query.sourceId) filters.push(eq(crmIntakes.sourceId, query.sourceId));
  if (query.channelId) filters.push(eq(crmIntakes.channelId, query.channelId));
  if (query.from) filters.push(gte(crmIntakes.startedAt, new Date(query.from)));
  if (query.to) filters.push(lte(crmIntakes.startedAt, new Date(query.to)));
  if (query.q) {
    const term = `%${query.q}%`;
    filters.push(or(ilike(crmIntakes.title, term), ilike(crmIntakes.summary, term))!);
  }

  const orderColumn =
    query.sort === "createdAt"
      ? crmIntakes.createdAt
      : query.sort === "startedAt"
        ? crmIntakes.startedAt
        : query.sort === "urgency"
          ? crmIntakes.urgency
          : crmIntakes.updatedAt;
  const orderBy = query.order === "asc" ? asc(orderColumn) : desc(orderColumn);
  const where = and(...filters);
  const [totalRow] = await db.select({ value: count() }).from(crmIntakes).where(where);
  const items = await db.query.crmIntakes.findMany({
    where,
    orderBy: [orderBy],
    limit: query.limit,
    offset: query.offset,
    with: {
      source: true,
      channel: true,
      legalArea: true,
    },
  });
  return {
    items: items.map((item) => mapIntakeSummary(item)),
    total: totalRow?.value ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function createIntake(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    title: string;
    summary?: string;
    leadId?: string;
    clientId?: string;
    contactId?: string;
    createLead?: {
      personType?: "person" | "organization";
      name: string;
      tradeName?: string;
      email?: string;
      phone?: string;
    };
    sourceId?: string;
    channelId?: string;
    legalAreaId?: string;
    serviceMode: "online" | "in_person" | "phone" | "video" | "message" | "other";
    urgency: "normal" | "attention" | "urgent" | "critical";
    responsibleMembershipId?: string;
    preferredContactMethod?: string;
    externalReference?: string;
  },
  meta: RequestMeta,
) {
  const actor = requireIntakePermission(account, organizationId, "intake.create");
  await ensureLegalAreasCatalog(db, organizationId);
  await ensureCrmCatalog(db, organizationId);

  if (input.leadId && input.createLead) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Informe um lead existente ou dados para criar um novo lead, não ambos.",
      [{ path: "leadId", message: "Escolha apenas uma forma de vincular o lead." }],
    );
  }

  if (input.leadId) await assertLeadInOrg(db, organizationId, input.leadId);
  if (input.clientId) await assertClientInOrg(db, organizationId, input.clientId);
  if (input.contactId) await assertContactInOrg(db, organizationId, input.contactId);
  await assertSourceInOrg(db, organizationId, input.sourceId);
  await assertChannelInOrg(db, organizationId, input.channelId);
  await assertLegalAreaInOrg(db, organizationId, input.legalAreaId);

  if (input.responsibleMembershipId) {
    if (input.responsibleMembershipId !== actor.membershipId) {
      requireIntakePermission(account, organizationId, "intake.assign");
    }
    await requireActiveMembershipInOrg(db, organizationId, input.responsibleMembershipId);
  }

  const created = await db.transaction(async (tx) => {
    let leadId = input.leadId;
    if (input.createLead) {
      const [lead] = await tx
        .insert(crmLeads)
        .values({
          organizationId,
          personType: input.createLead.personType ?? "person",
          name: input.createLead.name,
          tradeName: input.createLead.tradeName,
          email: input.createLead.email,
          phone: input.createLead.phone,
          sourceId: input.sourceId,
          channelId: input.channelId,
          ownerMembershipId: input.responsibleMembershipId ?? actor.membershipId,
          createdByUserId: account.user.id,
        })
        .returning();
      if (!lead) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o lead vinculado.");
      leadId = lead.id;
    }

    const [intake] = await tx
      .insert(crmIntakes)
      .values({
        organizationId,
        title: input.title,
        summary: input.summary,
        leadId,
        clientId: input.clientId,
        contactId: input.contactId,
        sourceId: input.sourceId,
        channelId: input.channelId,
        legalAreaId: input.legalAreaId,
        serviceMode: input.serviceMode,
        urgency: input.urgency,
        status: "open",
        responsibleMembershipId: input.responsibleMembershipId ?? actor.membershipId,
        createdByMembershipId: actor.membershipId,
        preferredContactMethod: input.preferredContactMethod,
        externalReference: input.externalReference,
      })
      .returning();
    if (!intake) throw new AppError("INTERNAL_ERROR", "Não foi possível abrir o atendimento.");

    await tx.insert(crmInteractions).values({
      organizationId,
      resourceType: "intake",
      resourceId: intake.id,
      type: "status_change",
      origin: "system",
      title: "Atendimento aberto",
      body: input.summary ?? "Novo atendimento registrado.",
      actorUserId: account.user.id,
    });

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "intake.created",
      resourceType: "crm_intake",
      resourceId: intake.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { status: intake.status, title: intake.title },
    });

    return intake;
  });

  return getIntake(db, account, organizationId, created.id);
}

export async function getIntake(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  intakeId: string,
) {
  requireIntakePermission(account, organizationId, "intake.read");
  const intake = await db.query.crmIntakes.findFirst({
    where: and(eq(crmIntakes.id, intakeId), eq(crmIntakes.organizationId, organizationId)),
    with: {
      lead: true,
      client: true,
      contact: true,
      legalArea: true,
      source: true,
      channel: true,
      triage: true,
      documents: true,
    },
  });
  if (!intake) throw new AppError("NOT_FOUND", "Não encontramos este recurso no seu acesso.");
  return {
    ...mapIntakeSummary(intake),
    lead: intake.lead
      ? {
          id: intake.lead.id,
          name: intake.lead.name,
          email: intake.lead.email,
          phone: intake.lead.phone,
          status: intake.lead.status,
        }
      : null,
    client: intake.client
      ? {
          id: intake.client.id,
          fullName: intake.client.fullName,
          legalName: intake.client.legalName,
          status: intake.client.status,
        }
      : null,
    contact: intake.contact
      ? {
          id: intake.contact.id,
          name: intake.contact.name,
          email: intake.contact.email,
          phone: intake.contact.phone,
        }
      : null,
    triage: intake.triage
      ? {
          id: intake.triage.id,
          status: intake.triage.status,
          urgency: intake.triage.urgency,
          summary: intake.triage.summary,
          reviewedAt: intake.triage.reviewedAt?.toISOString() ?? null,
        }
      : null,
    documents: intake.documents.map((doc) => ({
      id: doc.id,
      filename: doc.filename,
      status: doc.status,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
      unavailableReason: doc.unavailableReason,
      createdAt: doc.createdAt.toISOString(),
    })),
  };
}

export async function updateIntake(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  intakeId: string,
  input: {
    title?: string;
    summary?: string;
    status?: string;
    urgency?: string;
    serviceMode?: string;
    legalAreaId?: string | null;
    sourceId?: string | null;
    channelId?: string | null;
    responsibleMembershipId?: string | null;
    preferredContactMethod?: string | null;
    externalReference?: string | null;
  },
  meta: RequestMeta,
) {
  const actor = requireIntakePermission(account, organizationId, "intake.update");
  const current = await requireIntake(db, account, organizationId, intakeId, "intake.update");

  if (input.status && (input.status === "closed" || input.status === "archived")) {
    requireIntakePermission(account, organizationId, "intake.close");
  }

  if (input.status && input.status !== current.status) {
    assertIntakeTransition(
      current.status as Parameters<typeof assertIntakeTransition>[0],
      input.status as Parameters<typeof assertIntakeTransition>[1],
    );
  }

  if (input.responsibleMembershipId) {
    if (input.responsibleMembershipId !== actor.membershipId) {
      requireIntakePermission(account, organizationId, "intake.assign");
    }
    await requireActiveMembershipInOrg(db, organizationId, input.responsibleMembershipId);
  }

  if (input.legalAreaId) await assertLegalAreaInOrg(db, organizationId, input.legalAreaId);
  if (input.sourceId) await assertSourceInOrg(db, organizationId, input.sourceId);
  if (input.channelId) await assertChannelInOrg(db, organizationId, input.channelId);

  const [updated] = await db
    .update(crmIntakes)
    .set({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.summary !== undefined ? { summary: input.summary } : {}),
      ...(input.status !== undefined
        ? {
            status: input.status as (typeof crmIntakes.status.enumValues)[number],
            ...(input.status === "closed" || input.status === "archived"
              ? { closedAt: new Date() }
              : {}),
          }
        : {}),
      ...(input.urgency !== undefined
        ? { urgency: input.urgency as (typeof crmIntakes.urgency.enumValues)[number] }
        : {}),
      ...(input.serviceMode !== undefined
        ? { serviceMode: input.serviceMode as (typeof crmIntakes.serviceMode.enumValues)[number] }
        : {}),
      ...(input.legalAreaId !== undefined ? { legalAreaId: input.legalAreaId } : {}),
      ...(input.sourceId !== undefined ? { sourceId: input.sourceId } : {}),
      ...(input.channelId !== undefined ? { channelId: input.channelId } : {}),
      ...(input.responsibleMembershipId !== undefined
        ? { responsibleMembershipId: input.responsibleMembershipId }
        : {}),
      ...(input.preferredContactMethod !== undefined
        ? { preferredContactMethod: input.preferredContactMethod }
        : {}),
      ...(input.externalReference !== undefined
        ? { externalReference: input.externalReference }
        : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(crmIntakes.id, intakeId), eq(crmIntakes.organizationId, organizationId)))
    .returning();
  if (!updated) throw new AppError("NOT_FOUND", "Não encontramos este recurso no seu acesso.");

  if (input.urgency !== undefined && input.urgency !== current.urgency) {
    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "intake.urgency_changed",
      resourceType: "crm_intake",
      resourceId: intakeId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      before: { urgency: current.urgency },
      after: { urgency: updated.urgency },
    });
  }

  if (input.status !== undefined && input.status !== current.status) {
    await db.insert(crmInteractions).values({
      organizationId,
      resourceType: "intake",
      resourceId: intakeId,
      type: "status_change",
      origin: "system",
      title: "Status do atendimento alterado",
      body: `${current.status} → ${updated.status}`,
      actorUserId: account.user.id,
    });
    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "intake.status_changed",
      resourceType: "crm_intake",
      resourceId: intakeId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      before: { status: current.status },
      after: { status: updated.status },
    });
  } else if (
    input.responsibleMembershipId !== undefined &&
    input.responsibleMembershipId !== current.responsibleMembershipId
  ) {
    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "intake.assigned",
      resourceType: "crm_intake",
      resourceId: intakeId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      before: { responsibleMembershipId: current.responsibleMembershipId },
      after: { responsibleMembershipId: updated.responsibleMembershipId },
    });
  } else {
    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "intake.updated",
      resourceType: "crm_intake",
      resourceId: intakeId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
    });
  }

  return getIntake(db, account, organizationId, intakeId);
}

function triageHasStarted(status: string): boolean {
  return status !== "draft" && status !== "closed";
}

async function syncIntakeFromTriage(
  db: AppDatabase,
  intakeId: string,
  organizationId: string,
  triageInput: { legalAreaId?: string; urgency?: string; status?: string },
  intakeStatus: string,
) {
  const intakePatch: Partial<typeof crmIntakes.$inferInsert> = {};
  if (triageInput.legalAreaId !== undefined) intakePatch.legalAreaId = triageInput.legalAreaId;
  if (triageInput.urgency !== undefined) {
    intakePatch.urgency = triageInput.urgency as (typeof crmIntakes.urgency.enumValues)[number];
  }
  if (triageInput.status && triageHasStarted(triageInput.status) && intakeStatus === "open") {
    assertIntakeTransition("open", "triage");
    intakePatch.status = "triage";
  }
  if (Object.keys(intakePatch).length === 0) return;
  intakePatch.updatedAt = new Date();
  await db
    .update(crmIntakes)
    .set(intakePatch)
    .where(and(eq(crmIntakes.id, intakeId), eq(crmIntakes.organizationId, organizationId)));
}

export async function upsertTriage(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  intakeId: string,
  input: {
    legalAreaId?: string;
    urgency?: string;
    summary?: string;
    facts?: string;
    requestNeed?: string;
    relevantDates?: string;
    riskNotes?: string;
    missingInformation?: string;
    nextAction?: string;
    responsibleMembershipId?: string;
    status?: string;
  },
  meta: RequestMeta,
) {
  const actor = requireIntakePermission(account, organizationId, "intake.read");
  const intake = await requireIntake(db, account, organizationId, intakeId, "intake.read");
  const existing = await db.query.crmTriages.findFirst({
    where: and(eq(crmTriages.intakeId, intakeId), eq(crmTriages.organizationId, organizationId)),
  });

  if (input.responsibleMembershipId) {
    await requireActiveMembershipInOrg(db, organizationId, input.responsibleMembershipId);
  }
  if (input.legalAreaId) await assertLegalAreaInOrg(db, organizationId, input.legalAreaId);

  if (!existing) {
    requireTriagePermission(account, organizationId, "triage.create");
    if (input.status) {
      assertTriageTransition("draft", input.status as Parameters<typeof assertTriageTransition>[1]);
    }
    if (input.status === "reviewed") {
      requireTriagePermission(account, organizationId, "triage.review");
    }

    const [triage] = await db
      .insert(crmTriages)
      .values({
        organizationId,
        intakeId,
        legalAreaId: input.legalAreaId,
        urgency: (input.urgency ??
          intake.urgency) as (typeof crmTriages.urgency.enumValues)[number],
        summary: input.summary,
        facts: input.facts,
        requestNeed: input.requestNeed,
        relevantDates: input.relevantDates,
        riskNotes: input.riskNotes,
        missingInformation: input.missingInformation,
        nextAction: input.nextAction,
        responsibleMembershipId: input.responsibleMembershipId ?? actor.membershipId,
        status: (input.status ?? "draft") as (typeof crmTriages.status.enumValues)[number],
        createdByMembershipId: actor.membershipId,
        ...(input.status === "reviewed"
          ? { reviewedByMembershipId: actor.membershipId, reviewedAt: new Date() }
          : {}),
      })
      .returning();
    if (!triage) throw new AppError("INTERNAL_ERROR", "Não foi possível iniciar a triagem.");

    await syncIntakeFromTriage(db, intakeId, organizationId, input, intake.status);

    await db.insert(crmInteractions).values({
      organizationId,
      resourceType: "intake",
      resourceId: intakeId,
      type: "status_change",
      origin: "system",
      title: "Triagem iniciada",
      body: `Status da triagem: ${triage.status}`,
      actorUserId: account.user.id,
    });

    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "triage.created",
      resourceType: "crm_triage",
      resourceId: triage.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { status: triage.status, intakeId },
    });

    return getTriage(db, account, organizationId, intakeId);
  }

  requireTriagePermission(account, organizationId, "triage.update");
  if (input.status && input.status !== existing.status) {
    assertTriageTransition(
      existing.status as Parameters<typeof assertTriageTransition>[0],
      input.status as Parameters<typeof assertTriageTransition>[1],
    );
  }
  if (input.status === "reviewed" && existing.status !== "reviewed") {
    requireTriagePermission(account, organizationId, "triage.review");
  }

  const [updated] = await db
    .update(crmTriages)
    .set({
      ...(input.legalAreaId !== undefined ? { legalAreaId: input.legalAreaId } : {}),
      ...(input.urgency !== undefined
        ? { urgency: input.urgency as (typeof crmTriages.urgency.enumValues)[number] }
        : {}),
      ...(input.summary !== undefined ? { summary: input.summary } : {}),
      ...(input.facts !== undefined ? { facts: input.facts } : {}),
      ...(input.requestNeed !== undefined ? { requestNeed: input.requestNeed } : {}),
      ...(input.relevantDates !== undefined ? { relevantDates: input.relevantDates } : {}),
      ...(input.riskNotes !== undefined ? { riskNotes: input.riskNotes } : {}),
      ...(input.missingInformation !== undefined
        ? { missingInformation: input.missingInformation }
        : {}),
      ...(input.nextAction !== undefined ? { nextAction: input.nextAction } : {}),
      ...(input.responsibleMembershipId !== undefined
        ? { responsibleMembershipId: input.responsibleMembershipId }
        : {}),
      ...(input.status !== undefined
        ? { status: input.status as (typeof crmTriages.status.enumValues)[number] }
        : {}),
      ...(input.status === "reviewed" && existing.status !== "reviewed"
        ? { reviewedByMembershipId: actor.membershipId, reviewedAt: new Date() }
        : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(crmTriages.id, existing.id), eq(crmTriages.organizationId, organizationId)))
    .returning();
  if (!updated) throw new AppError("NOT_FOUND", "Não encontramos esta triagem no seu acesso.");

  await syncIntakeFromTriage(db, intakeId, organizationId, input, intake.status);

  if (input.status !== undefined && input.status !== existing.status) {
    await db.insert(crmInteractions).values({
      organizationId,
      resourceType: "intake",
      resourceId: intakeId,
      type: "status_change",
      origin: "system",
      title: "Triagem atualizada",
      body: `${existing.status} → ${updated.status}`,
      actorUserId: account.user.id,
    });
  }

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "triage.updated",
    resourceType: "crm_triage",
    resourceId: existing.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    before: { status: existing.status },
    after: { status: updated.status },
  });

  return getTriage(db, account, organizationId, intakeId);
}

export async function getTriage(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  intakeId: string,
) {
  requireTriagePermission(account, organizationId, "triage.read");
  await requireIntake(db, account, organizationId, intakeId, "intake.read");
  const triage = await db.query.crmTriages.findFirst({
    where: and(eq(crmTriages.intakeId, intakeId), eq(crmTriages.organizationId, organizationId)),
  });
  if (!triage) throw new AppError("NOT_FOUND", "Não encontramos esta triagem no seu acesso.");
  return {
    id: triage.id,
    intakeId: triage.intakeId,
    legalAreaId: triage.legalAreaId,
    urgency: triage.urgency,
    summary: triage.summary,
    facts: triage.facts,
    requestNeed: triage.requestNeed,
    relevantDates: triage.relevantDates,
    riskNotes: triage.riskNotes,
    missingInformation: triage.missingInformation,
    nextAction: triage.nextAction,
    responsibleMembershipId: triage.responsibleMembershipId,
    status: triage.status,
    reviewedByMembershipId: triage.reviewedByMembershipId,
    reviewedAt: triage.reviewedAt?.toISOString() ?? null,
    createdAt: triage.createdAt.toISOString(),
    updatedAt: triage.updatedAt.toISOString(),
  };
}

export async function registerIntakeDocument(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  intakeId: string,
  input: {
    filename: string;
    status: "pending" | "received" | "unavailable" | "rejected";
    unavailableReason?: string;
    mimeType?: string;
    sizeBytes?: number;
  },
  meta: RequestMeta,
) {
  requireDocumentPermission(account, organizationId, "document_initial.upload");
  await requireIntake(db, account, organizationId, intakeId, "intake.read");

  if (input.status === "received") {
    await objectStorage.upload();
  }

  const [doc] = await db
    .insert(crmIntakeDocuments)
    .values({
      organizationId,
      intakeId,
      uploadedByUserId: account.user.id,
      filename: input.filename,
      status: input.status,
      unavailableReason: input.unavailableReason,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    })
    .returning();
  if (!doc) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar o documento.");

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "initial_document.registered",
    resourceType: "crm_intake_document",
    resourceId: doc.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { filename: doc.filename, status: doc.status, intakeId },
  });

  return {
    id: doc.id,
    intakeId: doc.intakeId,
    filename: doc.filename,
    status: doc.status,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    unavailableReason: doc.unavailableReason,
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function listIntakeDocuments(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  intakeId: string,
) {
  requireDocumentPermission(account, organizationId, "document_initial.read");
  await requireIntake(db, account, organizationId, intakeId, "intake.read");
  const docs = await db.query.crmIntakeDocuments.findMany({
    where: and(
      eq(crmIntakeDocuments.intakeId, intakeId),
      eq(crmIntakeDocuments.organizationId, organizationId),
    ),
    orderBy: [desc(crmIntakeDocuments.createdAt)],
  });
  return docs.map((doc) => ({
    id: doc.id,
    filename: doc.filename,
    status: doc.status,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    unavailableReason: doc.unavailableReason,
    createdAt: doc.createdAt.toISOString(),
  }));
}

export async function convertIntake(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  intakeId: string,
  meta: RequestMeta,
) {
  requireIntakePermission(account, organizationId, "intake.convert");
  const intake = await requireIntake(db, account, organizationId, intakeId, "intake.read");

  if (intake.clientId || intake.status === "converted") {
    throw new AppError(
      "CONFLICT",
      "Este atendimento já foi convertido. Nenhuma alteração adicional.",
    );
  }
  if (!intake.leadId) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Atendimento sem lead vinculado não pode ser convertido em cliente.",
      [{ path: "leadId", message: "Vincule um lead antes de converter." }],
    );
  }

  const { clientId } = await convertLead(db, account, organizationId, intake.leadId, meta);

  const [updated] = await db
    .update(crmIntakes)
    .set({
      clientId,
      status: "converted",
      convertedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(crmIntakes.id, intakeId),
        eq(crmIntakes.organizationId, organizationId),
        isNull(crmIntakes.clientId),
        sql`${crmIntakes.status} <> 'converted'`,
      ),
    )
    .returning();
  if (!updated) {
    throw new AppError(
      "CONFLICT",
      "Este atendimento já foi convertido. Nenhuma alteração adicional.",
    );
  }

  await db.insert(crmInteractions).values({
    organizationId,
    resourceType: "intake",
    resourceId: intakeId,
    type: "lead_conversion",
    origin: "system",
    title: "Atendimento convertido em cliente",
    body: `Cliente ${clientId}`,
    actorUserId: account.user.id,
  });

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "intake.converted",
    resourceType: "crm_intake",
    resourceId: intakeId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { clientId, leadId: intake.leadId },
  });

  return { intakeId, clientId };
}

export async function listIntakeTimeline(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  intakeId: string,
) {
  requireIntakePermission(account, organizationId, "intake.read");
  return listTimeline(db, account, organizationId, "intake", intakeId);
}
