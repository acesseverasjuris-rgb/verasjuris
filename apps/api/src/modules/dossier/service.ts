import { recordAudit } from "@verasjuris/audit";
import { policyDossier, type SessionAccount } from "@verasjuris/auth";
import {
  administrativeProcesses,
  crmClients,
  documentLinks,
  documents,
  judicialProcesses,
  legalMatters,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import type { RequestMeta } from "../auth/service.js";

type DbTx = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

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

function requireDossierPermission(
  account: SessionAccount,
  organizationId: string,
  permission: Parameters<typeof policyDossier>[1],
) {
  const decision = policyDossier(accessOf(account, organizationId), permission);
  if (!decision.ok) throw new AppError(decision.code, decision.message);
  return membershipOf(account, organizationId)!;
}

function serializeDoc(row: typeof documents.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    ownerType: row.ownerType,
    ownerId: row.ownerId,
    documentKind: row.documentKind,
    legalContext: row.legalContext,
    evidentiaryRole: row.evidentiaryRole,
    confidentialityLevel: row.confidentialityLevel,
    currentVersionId: row.currentVersionId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function requireMatter(db: AppDatabase | DbTx, organizationId: string, matterId: string) {
  const row = await db.query.legalMatters.findFirst({
    where: and(eq(legalMatters.id, matterId), eq(legalMatters.organizationId, organizationId)),
  });
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos este caso no seu acesso.");
  return row;
}

async function requireClient(db: AppDatabase | DbTx, organizationId: string, clientId: string) {
  const row = await db.query.crmClients.findFirst({
    where: and(eq(crmClients.id, clientId), eq(crmClients.organizationId, organizationId)),
  });
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos este cliente no seu acesso.");
  return row;
}

async function requireJudicial(db: AppDatabase | DbTx, organizationId: string, processId: string) {
  const row = await db.query.judicialProcesses.findFirst({
    where: and(
      eq(judicialProcesses.id, processId),
      eq(judicialProcesses.organizationId, organizationId),
    ),
  });
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos este processo no seu acesso.");
  return row;
}

async function requireAdministrative(
  db: AppDatabase | DbTx,
  organizationId: string,
  processId: string,
) {
  const row = await db.query.administrativeProcesses.findFirst({
    where: and(
      eq(administrativeProcesses.id, processId),
      eq(administrativeProcesses.organizationId, organizationId),
    ),
  });
  if (!row) {
    throw new AppError("NOT_FOUND", "Não encontramos este processo administrativo no seu acesso.");
  }
  return row;
}

type DossierFilters = {
  documentKind?: typeof documents.$inferSelect.documentKind;
  legalContext?: typeof documents.$inferSelect.legalContext;
  evidentiaryRole?: typeof documents.$inferSelect.evidentiaryRole;
  q?: string;
  limit: number;
  offset: number;
};

async function projectDocuments(
  db: AppDatabase,
  organizationId: string,
  ownerClauses: Array<ReturnType<typeof and>>,
  filters: DossierFilters,
) {
  const conditions = [eq(documents.organizationId, organizationId), or(...ownerClauses)!];
  if (filters.documentKind) conditions.push(eq(documents.documentKind, filters.documentKind));
  if (filters.legalContext) conditions.push(eq(documents.legalContext, filters.legalContext));
  if (filters.evidentiaryRole) {
    conditions.push(eq(documents.evidentiaryRole, filters.evidentiaryRole));
  }
  if (filters.q) conditions.push(ilike(documents.title, `%${filters.q}%`));

  const where = and(...conditions);
  const [rows, totalRow] = await Promise.all([
    db.query.documents.findMany({
      where,
      orderBy: [desc(documents.updatedAt)],
      limit: filters.limit,
      offset: filters.offset,
    }),
    db.select({ value: count() }).from(documents).where(where),
  ]);
  return { documents: rows.map(serializeDoc), total: totalRow[0]?.value ?? 0 };
}

/** Projeção: documentos do matter + processos vinculados + links tipados. */
export async function getMatterDossier(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  filters: DossierFilters,
) {
  requireDossierPermission(account, organizationId, "dossier.read");
  const matter = await requireMatter(db, organizationId, matterId);

  const [judicial, administrative] = await Promise.all([
    db.query.judicialProcesses.findMany({
      where: and(
        eq(judicialProcesses.organizationId, organizationId),
        eq(judicialProcesses.legalMatterId, matterId),
      ),
      columns: { id: true },
    }),
    db.query.administrativeProcesses.findMany({
      where: and(
        eq(administrativeProcesses.organizationId, organizationId),
        eq(administrativeProcesses.legalMatterId, matterId),
      ),
      columns: { id: true },
    }),
  ]);

  const ownerClauses = [
    and(eq(documents.ownerType, "legal_matter"), eq(documents.ownerId, matterId)),
  ];
  for (const jp of judicial) {
    ownerClauses.push(
      and(eq(documents.ownerType, "judicial_process"), eq(documents.ownerId, jp.id)),
    );
  }
  for (const ap of administrative) {
    ownerClauses.push(
      and(eq(documents.ownerType, "administrative_process"), eq(documents.ownerId, ap.id)),
    );
  }

  const linked = await db
    .select({ documentId: documentLinks.documentId })
    .from(documentLinks)
    .where(
      and(
        eq(documentLinks.organizationId, organizationId),
        eq(documentLinks.targetType, "legal_matter"),
        eq(documentLinks.targetId, matterId),
      ),
    );
  for (const link of linked) {
    ownerClauses.push(eq(documents.id, link.documentId));
  }

  const projection = await projectDocuments(db, organizationId, ownerClauses, filters);
  const links = await db.query.documentLinks.findMany({
    where: and(
      eq(documentLinks.organizationId, organizationId),
      eq(documentLinks.targetType, "legal_matter"),
      eq(documentLinks.targetId, matterId),
    ),
    orderBy: [desc(documentLinks.createdAt)],
  });

  return {
    dossier: {
      kind: "matter" as const,
      matterId: matter.id,
      matterTitle: matter.title,
      matterReference: matter.internalReference,
      ...projection,
      links: links.map((l) => ({
        id: l.id,
        documentId: l.documentId,
        linkType: l.linkType,
        targetType: l.targetType,
        targetId: l.targetId,
        createdAt: l.createdAt.toISOString(),
      })),
      note: "Dossiê é projeção documental — não há entidade Dossier persistida.",
    },
  };
}

export async function getClientDossier(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  clientId: string,
  filters: DossierFilters,
) {
  requireDossierPermission(account, organizationId, "dossier.read");
  const client = await requireClient(db, organizationId, clientId);
  const projection = await projectDocuments(
    db,
    organizationId,
    [and(eq(documents.ownerType, "client"), eq(documents.ownerId, clientId))],
    filters,
  );
  return {
    dossier: {
      kind: "client" as const,
      clientId: client.id,
      ...projection,
      note: "Dossiê do cliente é projeção dos documentos com ownerType=client.",
    },
  };
}

export async function getJudicialDossier(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  processId: string,
  filters: DossierFilters,
) {
  requireDossierPermission(account, organizationId, "dossier.read");
  const process = await requireJudicial(db, organizationId, processId);
  const linked = await db
    .select({ documentId: documentLinks.documentId })
    .from(documentLinks)
    .where(
      and(
        eq(documentLinks.organizationId, organizationId),
        eq(documentLinks.targetType, "judicial_process"),
        eq(documentLinks.targetId, processId),
      ),
    );
  const ownerClauses = [
    and(eq(documents.ownerType, "judicial_process"), eq(documents.ownerId, processId)),
    ...linked.map((l) => eq(documents.id, l.documentId)),
  ];
  const projection = await projectDocuments(db, organizationId, ownerClauses, filters);
  return {
    dossier: {
      kind: "judicial_process" as const,
      judicialProcessId: process.id,
      legalMatterId: process.legalMatterId,
      ...projection,
      note: "Dossiê processual é projeção — sem pasta espelhada automática.",
    },
  };
}

export async function getAdministrativeDossier(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  processId: string,
  filters: DossierFilters,
) {
  requireDossierPermission(account, organizationId, "dossier.read");
  const process = await requireAdministrative(db, organizationId, processId);
  const linked = await db
    .select({ documentId: documentLinks.documentId })
    .from(documentLinks)
    .where(
      and(
        eq(documentLinks.organizationId, organizationId),
        eq(documentLinks.targetType, "administrative_process"),
        eq(documentLinks.targetId, processId),
      ),
    );
  const ownerClauses = [
    and(eq(documents.ownerType, "administrative_process"), eq(documents.ownerId, processId)),
    ...linked.map((l) => eq(documents.id, l.documentId)),
  ];
  const projection = await projectDocuments(db, organizationId, ownerClauses, filters);
  return {
    dossier: {
      kind: "administrative_process" as const,
      administrativeProcessId: process.id,
      legalMatterId: process.legalMatterId,
      ...projection,
      note: "Dossiê administrativo é projeção documental.",
    },
  };
}

export async function classifyDocument(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  documentId: string,
  input: {
    documentKind?: typeof documents.$inferInsert.documentKind;
    legalContext?: typeof documents.$inferInsert.legalContext;
    evidentiaryRole?: typeof documents.$inferInsert.evidentiaryRole;
  },
  meta: RequestMeta,
) {
  const actor = requireDossierPermission(account, organizationId, "dossier.manage_links");
  // classify também exige document.update semanticamente — dossier.manage_links cobre classificação tipada
  const doc = await db.query.documents.findFirst({
    where: and(eq(documents.id, documentId), eq(documents.organizationId, organizationId)),
  });
  if (!doc) throw new AppError("NOT_FOUND", "Não encontramos este documento no seu acesso.");

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(documents)
      .set({
        documentKind: input.documentKind ?? doc.documentKind,
        legalContext: input.legalContext ?? doc.legalContext,
        evidentiaryRole: input.evidentiaryRole ?? doc.evidentiaryRole,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId))
      .returning();
    if (!updated) throw new AppError("INTERNAL_ERROR", "Não foi possível classificar o documento.");
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "document.classified",
      resourceType: "document",
      resourceId: documentId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: {
        documentKind: updated.documentKind,
        legalContext: updated.legalContext,
        evidentiaryRole: updated.evidentiaryRole,
        actorMembershipId: actor.membershipId,
      },
    });
    return serializeDoc(updated);
  });
}

export async function linkDocument(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    documentId: string;
    linkType: string;
    targetType: string;
    targetId: string;
  },
  meta: RequestMeta,
) {
  const actor = requireDossierPermission(account, organizationId, "dossier.manage_links");
  const doc = await db.query.documents.findFirst({
    where: and(eq(documents.id, input.documentId), eq(documents.organizationId, organizationId)),
  });
  if (!doc) throw new AppError("NOT_FOUND", "Não encontramos este documento no seu acesso.");

  if (input.targetType === "legal_matter") {
    await requireMatter(db, organizationId, input.targetId);
  } else if (input.targetType === "client") {
    await requireClient(db, organizationId, input.targetId);
  } else if (input.targetType === "judicial_process") {
    await requireJudicial(db, organizationId, input.targetId);
  } else if (input.targetType === "administrative_process") {
    await requireAdministrative(db, organizationId, input.targetId);
  }

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(documentLinks)
      .values({
        organizationId,
        documentId: input.documentId,
        linkType: input.linkType,
        targetType: input.targetType,
        targetId: input.targetId,
        createdByMembershipId: actor.membershipId,
      })
      .returning();
    if (!created) throw new AppError("INTERNAL_ERROR", "Não foi possível vincular o documento.");
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "dossier.link_created",
      resourceType: "document_link",
      resourceId: created.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: {
        documentId: created.documentId,
        linkType: created.linkType,
        targetType: created.targetType,
        targetId: created.targetId,
      },
    });
    return {
      id: created.id,
      documentId: created.documentId,
      linkType: created.linkType,
      relationType: created.linkType,
      targetType: created.targetType,
      resourceType: created.targetType,
      targetId: created.targetId,
      resourceId: created.targetId,
      createdAt: created.createdAt.toISOString(),
    };
  });
}

export async function unlinkDocument(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  linkId: string,
  meta: RequestMeta,
) {
  requireDossierPermission(account, organizationId, "dossier.manage_links");
  const existing = await db.query.documentLinks.findFirst({
    where: and(eq(documentLinks.id, linkId), eq(documentLinks.organizationId, organizationId)),
  });
  if (!existing) throw new AppError("NOT_FOUND", "Não encontramos este vínculo no seu acesso.");

  return db.transaction(async (tx) => {
    await tx.delete(documentLinks).where(eq(documentLinks.id, linkId));
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "dossier.link_removed",
      resourceType: "document_link",
      resourceId: linkId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      before: {
        documentId: existing.documentId,
        targetType: existing.targetType,
        targetId: existing.targetId,
      },
    });
    return { ok: true as const };
  });
}
