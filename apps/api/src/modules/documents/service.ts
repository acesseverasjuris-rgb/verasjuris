import { recordAudit } from "@verasjuris/audit";
import {
  policyDocument,
  policyDocumentACL,
  policyDocumentConfidentiality,
  policyDocumentFolder,
  policyDocumentVersion,
  type SessionAccount,
} from "@verasjuris/auth";
import {
  administrativeProcesses,
  crmClients,
  crmIntakes,
  documentAclEntries,
  documentCategories,
  documentFolders,
  documents,
  documentTimelineEvents,
  documentVersions,
  isUniqueViolation,
  judicialProcesses,
  legalMatters,
  type AppDatabase,
} from "@verasjuris/database";
import type { MalwareScannerProvider, StorageProvider } from "@verasjuris/storage";
import { AppError } from "@verasjuris/types";
import { and, asc, count, desc, eq, ilike, inArray, max, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { RequestMeta } from "../auth/service.js";
import { ensureDocumentCategories } from "./categories.js";
import { processDocumentUpload, type UploadedFilePayload } from "./upload.js";

type DbTx = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

export type DocumentModuleDeps = {
  storage: StorageProvider;
  malwareScanner: MalwareScannerProvider;
  maxUploadBytes: number;
};

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

function requireDocumentPermission(
  account: SessionAccount,
  organizationId: string,
  permission: Parameters<typeof policyDocument>[1],
) {
  const decision = policyDocument(accessOf(account, organizationId), permission);
  if (!decision.ok) throw new AppError(decision.code, decision.message);
  return membershipOf(account, organizationId)!;
}

function serializeVersion(row: typeof documentVersions.$inferSelect) {
  return {
    id: row.id,
    versionNumber: row.versionNumber,
    originalFilename: row.originalFilename,
    safeFilename: row.safeFilename,
    mimeTypeDeclared: row.mimeTypeDeclared,
    mimeTypeDetected: row.mimeTypeDetected,
    sizeBytes: row.sizeBytes,
    sha256: row.sha256,
    status: row.status,
    scanStatus: row.scanStatus,
    scanProvider: row.scanProvider,
    scanResult: row.scanResult,
    createdAt: row.createdAt.toISOString(),
    uploadedByMembershipId: row.uploadedByMembershipId,
    // storageKey nunca é exposto na API.
  };
}

function serializeDocument(
  row: typeof documents.$inferSelect,
  extras?: {
    category?: { id: string; name: string; slug: string } | null;
    currentVersion?: ReturnType<typeof serializeVersion> | null;
  },
) {
  return {
    id: row.id,
    ownerType: row.ownerType,
    ownerId: row.ownerId,
    categoryId: row.categoryId,
    category: extras?.category ?? null,
    folderId: row.folderId,
    title: row.title,
    description: row.description,
    status: row.status,
    documentKind: row.documentKind,
    legalContext: row.legalContext,
    evidentiaryRole: row.evidentiaryRole,
    confidentialityLevel: row.confidentialityLevel,
    currentVersionId: row.currentVersionId,
    currentVersion: extras?.currentVersion ?? null,
    retentionUntil: row.retentionUntil?.toISOString() ?? null,
    legalHold: row.legalHold,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function requireDocumentInOrg(
  db: AppDatabase | DbTx,
  organizationId: string,
  documentId: string,
) {
  const doc = await db.query.documents.findFirst({
    where: and(eq(documents.id, documentId), eq(documents.organizationId, organizationId)),
  });
  if (!doc) {
    throw new AppError("NOT_FOUND", "Não encontramos este documento no seu acesso.");
  }
  return doc;
}

export async function assertCanReadDocument(
  db: AppDatabase | DbTx,
  account: SessionAccount,
  organizationId: string,
  doc: typeof documents.$inferSelect,
) {
  const membership = requireDocumentPermission(account, organizationId, "document.read");
  const access = accessOf(account, organizationId);
  const confidentiality = policyDocumentConfidentiality(
    access,
    doc.confidentialityLevel as "normal" | "restricted" | "confidential",
  );
  if (confidentiality.ok) return membership;

  const acl = await db.query.documentAclEntries.findFirst({
    where: and(
      eq(documentAclEntries.documentId, doc.id),
      eq(documentAclEntries.organizationId, organizationId),
      eq(documentAclEntries.permission, "read"),
      or(
        and(
          eq(documentAclEntries.principalType, "membership"),
          eq(documentAclEntries.principalId, membership.membershipId),
        ),
        and(
          eq(documentAclEntries.principalType, "user"),
          eq(documentAclEntries.principalId, account.user.id),
        ),
        and(
          eq(documentAclEntries.principalType, "organization"),
          eq(documentAclEntries.principalId, organizationId),
        ),
      ),
    ),
  });
  if (!acl) {
    throw new AppError(confidentiality.code, confidentiality.message);
  }
  return membership;
}

async function assertOwnerBinding(
  db: AppDatabase | DbTx,
  organizationId: string,
  ownerType: typeof documents.$inferInsert.ownerType,
  ownerId: string,
) {
  switch (ownerType) {
    case "organization": {
      if (ownerId !== organizationId) {
        throw new AppError("VALIDATION_ERROR", "ownerId deve ser a própria organização.", [
          { path: "ownerId", message: "Use o id da organização ativa." },
        ]);
      }
      return;
    }
    case "legal_matter": {
      const matter = await db.query.legalMatters.findFirst({
        where: and(eq(legalMatters.id, ownerId), eq(legalMatters.organizationId, organizationId)),
      });
      if (!matter) {
        throw new AppError("VALIDATION_ERROR", "Caso inválido para esta organização.", [
          { path: "ownerId", message: "Selecione um caso válido." },
        ]);
      }
      return;
    }
    case "judicial_process": {
      const process = await db.query.judicialProcesses.findFirst({
        where: and(
          eq(judicialProcesses.id, ownerId),
          eq(judicialProcesses.organizationId, organizationId),
        ),
      });
      if (!process) {
        throw new AppError("VALIDATION_ERROR", "Processo judicial inválido.", [
          { path: "ownerId", message: "Selecione um processo válido." },
        ]);
      }
      return;
    }
    case "administrative_process": {
      const process = await db.query.administrativeProcesses.findFirst({
        where: and(
          eq(administrativeProcesses.id, ownerId),
          eq(administrativeProcesses.organizationId, organizationId),
        ),
      });
      if (!process) {
        throw new AppError("VALIDATION_ERROR", "Processo administrativo inválido.", [
          { path: "ownerId", message: "Selecione um processo válido." },
        ]);
      }
      return;
    }
    case "client": {
      const client = await db.query.crmClients.findFirst({
        where: and(eq(crmClients.id, ownerId), eq(crmClients.organizationId, organizationId)),
      });
      if (!client) {
        throw new AppError("VALIDATION_ERROR", "Cliente inválido.", [
          { path: "ownerId", message: "Selecione um cliente válido." },
        ]);
      }
      return;
    }
    case "intake": {
      const intake = await db.query.crmIntakes.findFirst({
        where: and(eq(crmIntakes.id, ownerId), eq(crmIntakes.organizationId, organizationId)),
      });
      if (!intake) {
        throw new AppError("VALIDATION_ERROR", "Atendimento inválido.", [
          { path: "ownerId", message: "Selecione um atendimento válido." },
        ]);
      }
      return;
    }
    default:
      throw new AppError("VALIDATION_ERROR", "Tipo de vínculo inválido.", [
        { path: "ownerType", message: "Tipo não suportado." },
      ]);
  }
}

async function assertFolderInOrg(
  db: AppDatabase | DbTx,
  organizationId: string,
  folderId: string | null | undefined,
  ownerType?: string,
  ownerId?: string,
) {
  if (!folderId) return null;
  const folder = await db.query.documentFolders.findFirst({
    where: and(
      eq(documentFolders.id, folderId),
      eq(documentFolders.organizationId, organizationId),
    ),
  });
  if (!folder) {
    throw new AppError("VALIDATION_ERROR", "Pasta inválida.", [
      { path: "folderId", message: "Selecione uma pasta válida." },
    ]);
  }
  if (ownerType && ownerId && (folder.ownerType !== ownerType || folder.ownerId !== ownerId)) {
    throw new AppError("VALIDATION_ERROR", "A pasta não pertence ao mesmo vínculo do documento.", [
      { path: "folderId", message: "Escolha uma pasta do mesmo owner." },
    ]);
  }
  return folder;
}

async function assertNoFolderCycle(
  db: AppDatabase | DbTx,
  organizationId: string,
  folderId: string,
  parentFolderId: string | null,
) {
  if (!parentFolderId) return;
  if (parentFolderId === folderId) {
    throw new AppError("VALIDATION_ERROR", "Uma pasta não pode ser pai de si mesma.", [
      { path: "parentFolderId", message: "Ciclo detectado." },
    ]);
  }
  let current: string | null = parentFolderId;
  const seen = new Set<string>([folderId]);
  while (current) {
    if (seen.has(current)) {
      throw new AppError("VALIDATION_ERROR", "A hierarquia de pastas formaria um ciclo.", [
        { path: "parentFolderId", message: "Ciclo detectado." },
      ]);
    }
    seen.add(current);
    const parent: { parentFolderId: string | null } | undefined =
      await db.query.documentFolders.findFirst({
        where: and(
          eq(documentFolders.id, current),
          eq(documentFolders.organizationId, organizationId),
        ),
        columns: { parentFolderId: true },
      });
    current = parent?.parentFolderId ?? null;
  }
}

async function appendDocumentTimeline(
  tx: DbTx,
  input: {
    organizationId: string;
    documentId: string;
    eventType: string;
    title: string;
    summary?: string | null;
    versionId?: string | null;
    actorMembershipId?: string | null;
  },
) {
  await tx.insert(documentTimelineEvents).values({
    organizationId: input.organizationId,
    documentId: input.documentId,
    eventType: input.eventType,
    title: input.title,
    summary: input.summary ?? null,
    versionId: input.versionId ?? null,
    actorMembershipId: input.actorMembershipId ?? null,
    eventAt: new Date(),
  });
}

export async function listDocumentCategories(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  requireDocumentPermission(account, organizationId, "document.read");
  await ensureDocumentCategories(db, organizationId);
  const rows = await db.query.documentCategories.findMany({
    where: and(
      eq(documentCategories.organizationId, organizationId),
      eq(documentCategories.active, true),
    ),
    orderBy: [asc(documentCategories.sortOrder), asc(documentCategories.name)],
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    active: row.active,
    sortOrder: row.sortOrder,
  }));
}

export async function listDocuments(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: {
    q?: string;
    status?: string;
    categoryId?: string;
    ownerType?: string;
    ownerId?: string;
    folderId?: string;
    limit: number;
    offset: number;
  },
) {
  requireDocumentPermission(account, organizationId, "document.read");
  await ensureDocumentCategories(db, organizationId);

  const filters = [eq(documents.organizationId, organizationId)];
  if (query.status)
    filters.push(eq(documents.status, query.status as typeof documents.$inferSelect.status));
  if (query.categoryId) filters.push(eq(documents.categoryId, query.categoryId));
  if (query.ownerType)
    filters.push(
      eq(documents.ownerType, query.ownerType as typeof documents.$inferSelect.ownerType),
    );
  if (query.ownerId) filters.push(eq(documents.ownerId, query.ownerId));
  if (query.folderId) filters.push(eq(documents.folderId, query.folderId));
  if (query.q) {
    filters.push(
      or(ilike(documents.title, `%${query.q}%`), ilike(documents.description, `%${query.q}%`))!,
    );
  }

  const where = and(...filters);
  const [totalRow] = await db.select({ value: count() }).from(documents).where(where);
  const items = await db.query.documents.findMany({
    where,
    orderBy: [desc(documents.updatedAt)],
    limit: query.limit,
    offset: query.offset,
    with: { category: true },
  });

  const versionIds = items
    .map((item) => item.currentVersionId)
    .filter((id): id is string => Boolean(id));
  const versions =
    versionIds.length > 0
      ? await db.query.documentVersions.findMany({
          where: and(
            eq(documentVersions.organizationId, organizationId),
            inArray(documentVersions.id, versionIds),
          ),
        })
      : [];
  const versionMap = new Map(versions.map((item) => [item.id, item]));

  const readable: ReturnType<typeof serializeDocument>[] = [];
  for (const item of items) {
    try {
      await assertCanReadDocument(db, account, organizationId, item);
    } catch {
      continue;
    }
    const current = item.currentVersionId ? versionMap.get(item.currentVersionId) : null;
    readable.push(
      serializeDocument(item, {
        category: item.category
          ? { id: item.category.id, name: item.category.name, slug: item.category.slug }
          : null,
        currentVersion: current ? serializeVersion(current) : null,
      }),
    );
  }

  return {
    items: readable,
    documents: readable,
    total: totalRow?.value ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function getDocument(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  documentId: string,
) {
  const doc = await requireDocumentInOrg(db, organizationId, documentId);
  await assertCanReadDocument(db, account, organizationId, doc);

  const [category, versions, timeline, currentVersion] = await Promise.all([
    doc.categoryId
      ? db.query.documentCategories.findFirst({ where: eq(documentCategories.id, doc.categoryId) })
      : null,
    db.query.documentVersions.findMany({
      where: and(
        eq(documentVersions.documentId, documentId),
        eq(documentVersions.organizationId, organizationId),
      ),
      orderBy: [desc(documentVersions.versionNumber)],
    }),
    db.query.documentTimelineEvents.findMany({
      where: and(
        eq(documentTimelineEvents.documentId, documentId),
        eq(documentTimelineEvents.organizationId, organizationId),
      ),
      orderBy: [desc(documentTimelineEvents.eventAt)],
    }),
    doc.currentVersionId
      ? db.query.documentVersions.findFirst({
          where: eq(documentVersions.id, doc.currentVersionId),
        })
      : null,
  ]);

  return {
    ...serializeDocument(doc, {
      category: category ? { id: category.id, name: category.name, slug: category.slug } : null,
      currentVersion: currentVersion ? serializeVersion(currentVersion) : null,
    }),
    versions: versions.map(serializeVersion),
    timeline: timeline.map((row) => ({
      id: row.id,
      eventType: row.eventType,
      title: row.title,
      summary: row.summary,
      versionId: row.versionId,
      eventAt: row.eventAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

export async function createDocument(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    title: string;
    description?: string;
    ownerType: typeof documents.$inferInsert.ownerType;
    ownerId: string;
    categoryId?: string;
    folderId?: string;
    confidentialityLevel?: "normal" | "restricted" | "confidential";
    status?: "draft" | "active";
    documentKind?: typeof documents.$inferInsert.documentKind;
    legalContext?: typeof documents.$inferInsert.legalContext;
    evidentiaryRole?: typeof documents.$inferInsert.evidentiaryRole;
    retentionUntil?: string;
    legalHold?: boolean;
    metadata?: Record<string, unknown>;
  },
  meta: RequestMeta,
) {
  const actor = requireDocumentPermission(account, organizationId, "document.create");
  await ensureDocumentCategories(db, organizationId);
  await assertOwnerBinding(db, organizationId, input.ownerType, input.ownerId);
  await assertFolderInOrg(db, organizationId, input.folderId, input.ownerType, input.ownerId);

  if (input.categoryId) {
    const category = await db.query.documentCategories.findFirst({
      where: and(
        eq(documentCategories.id, input.categoryId),
        eq(documentCategories.organizationId, organizationId),
      ),
    });
    if (!category) {
      throw new AppError("VALIDATION_ERROR", "Categoria inválida.", [
        { path: "categoryId", message: "Selecione uma categoria válida." },
      ]);
    }
  }

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(documents)
      .values({
        organizationId,
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        categoryId: input.categoryId ?? null,
        folderId: input.folderId ?? null,
        title: input.title,
        description: input.description ?? null,
        status: input.status ?? "active",
        documentKind: input.documentKind ?? "other",
        legalContext: input.legalContext ?? "other",
        evidentiaryRole: input.evidentiaryRole ?? "none",
        confidentialityLevel: input.confidentialityLevel ?? "normal",
        retentionUntil: input.retentionUntil ? new Date(input.retentionUntil) : null,
        legalHold: input.legalHold ?? false,
        metadata: input.metadata ?? null,
        createdByMembershipId: actor.membershipId,
      })
      .returning();
    if (!created) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o documento.");

    await appendDocumentTimeline(tx, {
      organizationId,
      documentId: created.id,
      eventType: "document.created",
      title: `Documento criado: ${created.title}`,
      actorMembershipId: actor.membershipId,
    });

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "document.created",
      resourceType: "document",
      resourceId: created.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: {
        title: created.title,
        ownerType: created.ownerType,
        ownerId: created.ownerId,
        confidentialityLevel: created.confidentialityLevel,
      },
    });

    return serializeDocument(created);
  });
}

export async function updateDocument(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  documentId: string,
  input: {
    title?: string;
    description?: string | null;
    categoryId?: string | null;
    folderId?: string | null;
    confidentialityLevel?: "normal" | "restricted" | "confidential";
    status?: "draft" | "active";
    documentKind?: typeof documents.$inferInsert.documentKind;
    legalContext?: typeof documents.$inferInsert.legalContext;
    evidentiaryRole?: typeof documents.$inferInsert.evidentiaryRole;
    retentionUntil?: string | null;
    legalHold?: boolean;
    metadata?: Record<string, unknown> | null;
  },
  meta: RequestMeta,
) {
  const actor = requireDocumentPermission(account, organizationId, "document.update");
  const doc = await requireDocumentInOrg(db, organizationId, documentId);
  await assertCanReadDocument(db, account, organizationId, doc);
  if (doc.status === "archived") {
    throw new AppError("CONFLICT", "Documento arquivado. Restaure-o antes de editar.");
  }
  await assertFolderInOrg(
    db,
    organizationId,
    input.folderId === undefined ? doc.folderId : input.folderId,
    doc.ownerType,
    doc.ownerId,
  );

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(documents)
      .set({
        title: input.title ?? doc.title,
        description: input.description === undefined ? doc.description : input.description,
        categoryId: input.categoryId === undefined ? doc.categoryId : input.categoryId,
        folderId: input.folderId === undefined ? doc.folderId : input.folderId,
        confidentialityLevel: input.confidentialityLevel ?? doc.confidentialityLevel,
        status: input.status ?? doc.status,
        documentKind: input.documentKind ?? doc.documentKind,
        legalContext: input.legalContext ?? doc.legalContext,
        evidentiaryRole: input.evidentiaryRole ?? doc.evidentiaryRole,
        retentionUntil:
          input.retentionUntil === undefined
            ? doc.retentionUntil
            : input.retentionUntil
              ? new Date(input.retentionUntil)
              : null,
        legalHold: input.legalHold ?? doc.legalHold,
        metadata: input.metadata === undefined ? doc.metadata : input.metadata,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId))
      .returning();
    if (!updated) throw new AppError("INTERNAL_ERROR", "Não foi possível atualizar o documento.");

    await appendDocumentTimeline(tx, {
      organizationId,
      documentId,
      eventType: "document.updated",
      title: `Documento atualizado: ${updated.title}`,
      actorMembershipId: actor.membershipId,
    });
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "document.updated",
      resourceType: "document",
      resourceId: documentId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      before: { title: doc.title, status: doc.status },
      after: { title: updated.title, status: updated.status },
    });
    return serializeDocument(updated);
  });
}

export async function uploadDocumentVersion(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  documentId: string,
  file: UploadedFilePayload,
  deps: DocumentModuleDeps,
  meta: RequestMeta,
  options: { idempotencyKey?: string } = {},
) {
  const actor = requireDocumentPermission(account, organizationId, "document.upload_version");
  const versionDecision = policyDocumentVersion(
    accessOf(account, organizationId),
    "document.upload_version",
  );
  if (!versionDecision.ok) throw new AppError(versionDecision.code, versionDecision.message);

  const doc = await requireDocumentInOrg(db, organizationId, documentId);
  await assertCanReadDocument(db, account, organizationId, doc);

  if (options.idempotencyKey) {
    const existing = await db.query.documentVersions.findFirst({
      where: and(
        eq(documentVersions.organizationId, organizationId),
        eq(documentVersions.documentId, documentId),
        eq(documentVersions.idempotencyKey, options.idempotencyKey),
      ),
    });
    if (existing) {
      return {
        version: serializeVersion(existing),
        document: await getDocument(db, account, organizationId, documentId),
      };
    }
  }

  const versionId = randomUUID();
  const processed = await processDocumentUpload({
    file,
    maxBytes: deps.maxUploadBytes,
    organizationId,
    documentId,
    versionId,
    storage: deps.storage,
    scanner: deps.malwareScanner,
  });

  try {
    const created = await db.transaction(async (tx) => {
      const [agg] = await tx
        .select({ value: max(documentVersions.versionNumber) })
        .from(documentVersions)
        .where(eq(documentVersions.documentId, documentId));
      const nextVersion = (agg?.value ?? 0) + 1;

      const [row] = await tx
        .insert(documentVersions)
        .values({
          id: versionId,
          organizationId,
          documentId,
          versionNumber: nextVersion,
          storageProvider: processed.storageProvider,
          storageKey: processed.storageKey,
          originalFilename: processed.originalFilename,
          safeFilename: processed.safeFilename,
          mimeTypeDeclared: processed.mimeTypeDeclared,
          mimeTypeDetected: processed.mimeTypeDetected,
          sizeBytes: processed.sizeBytes,
          sha256: processed.sha256,
          status: processed.versionStatus,
          scanStatus: processed.scanStatus,
          scanProvider: processed.scanProvider,
          scanResult: processed.scanResult,
          idempotencyKey: options.idempotencyKey ?? null,
          uploadedByMembershipId: actor.membershipId,
        })
        .returning();
      if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar a versão.");

      if (processed.versionStatus === "available") {
        await tx
          .update(documents)
          .set({
            currentVersionId: row.id,
            updatedAt: new Date(),
          })
          .where(eq(documents.id, documentId));
      }

      await appendDocumentTimeline(tx, {
        organizationId,
        documentId,
        eventType: "document.version_uploaded",
        title: `Versão ${nextVersion} enviada: ${processed.safeFilename}`,
        summary:
          processed.scanStatus === "not_configured"
            ? "Verificação antimalware não configurada."
            : null,
        versionId: row.id,
        actorMembershipId: actor.membershipId,
      });

      await recordAudit(tx, {
        actorUserId: account.user.id,
        organizationId,
        action: "document.version_uploaded",
        resourceType: "document_version",
        resourceId: row.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        after: {
          documentId,
          versionNumber: nextVersion,
          scanStatus: row.scanStatus,
          sizeBytes: row.sizeBytes,
          mimeTypeDetected: row.mimeTypeDetected,
        },
      });

      return row;
    });

    return {
      version: serializeVersion(created),
      document: await getDocument(db, account, organizationId, documentId),
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("CONFLICT", "Conflito de versão ou chave de idempotência.");
    }
    throw error;
  }
}

export async function getDocumentDownloadStream(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  documentId: string,
  deps: DocumentModuleDeps,
  versionId?: string,
) {
  const downloadDecision = policyDocumentVersion(
    accessOf(account, organizationId),
    "document.download",
  );
  if (!downloadDecision.ok) throw new AppError(downloadDecision.code, downloadDecision.message);

  const doc = await requireDocumentInOrg(db, organizationId, documentId);
  await assertCanReadDocument(db, account, organizationId, doc);

  const targetVersionId = versionId ?? doc.currentVersionId;
  if (!targetVersionId) {
    throw new AppError("NOT_FOUND", "Este documento ainda não possui arquivo disponível.");
  }

  const version = await db.query.documentVersions.findFirst({
    where: and(
      eq(documentVersions.id, targetVersionId),
      eq(documentVersions.documentId, documentId),
      eq(documentVersions.organizationId, organizationId),
    ),
  });
  if (!version) {
    throw new AppError("NOT_FOUND", "Versão do documento não encontrada.");
  }
  if (version.status !== "available") {
    throw new AppError(
      "CONFLICT",
      "Esta versão não está disponível para download (quarentena ou rejeitada).",
    );
  }

  const object = await deps.storage.getObject(version.storageKey);
  return {
    stream: object.stream,
    contentType: version.mimeTypeDetected || version.mimeTypeDeclared || "application/octet-stream",
    filename: version.safeFilename,
    sizeBytes: version.sizeBytes,
    versionId: version.id,
  };
}

export async function createDocumentFolder(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    name: string;
    parentFolderId?: string;
    ownerType: typeof documentFolders.$inferInsert.ownerType;
    ownerId: string;
  },
  meta: RequestMeta,
) {
  const actor = requireDocumentPermission(account, organizationId, "document_folder.manage");
  const folderDecision = policyDocumentFolder(
    accessOf(account, organizationId),
    "document_folder.manage",
  );
  if (!folderDecision.ok) throw new AppError(folderDecision.code, folderDecision.message);

  await assertOwnerBinding(db, organizationId, input.ownerType, input.ownerId);
  if (input.parentFolderId) {
    await assertFolderInOrg(
      db,
      organizationId,
      input.parentFolderId,
      input.ownerType,
      input.ownerId,
    );
  }

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(documentFolders)
      .values({
        organizationId,
        parentFolderId: input.parentFolderId ?? null,
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        name: input.name,
        createdByMembershipId: actor.membershipId,
      })
      .returning();
    if (!created) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a pasta.");

    if (input.parentFolderId) {
      await assertNoFolderCycle(tx, organizationId, created.id, input.parentFolderId);
    }

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "document_folder.created",
      resourceType: "document_folder",
      resourceId: created.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { name: created.name, ownerType: created.ownerType },
    });

    return {
      id: created.id,
      name: created.name,
      parentFolderId: created.parentFolderId,
      ownerType: created.ownerType,
      ownerId: created.ownerId,
      createdAt: created.createdAt.toISOString(),
    };
  });
}

export async function addDocumentAcl(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  documentId: string,
  input: {
    principalType: "user" | "membership" | "role" | "organization";
    principalId: string;
    permission:
      | "read"
      | "download"
      | "upload_version"
      | "update_metadata"
      | "share"
      | "archive"
      | "delete";
  },
  meta: RequestMeta,
) {
  const actor = requireDocumentPermission(account, organizationId, "document.manage_acl");
  const aclDecision = policyDocumentACL(accessOf(account, organizationId), "document.manage_acl");
  if (!aclDecision.ok) throw new AppError(aclDecision.code, aclDecision.message);
  await requireDocumentInOrg(db, organizationId, documentId);

  try {
    return await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(documentAclEntries)
        .values({
          organizationId,
          documentId,
          principalType: input.principalType,
          principalId: input.principalId,
          permission: input.permission,
          grantedByMembershipId: actor.membershipId,
        })
        .returning();
      if (!created) throw new AppError("INTERNAL_ERROR", "Não foi possível conceder ACL.");

      await recordAudit(tx, {
        actorUserId: account.user.id,
        organizationId,
        action: "document.acl_granted",
        resourceType: "document_acl",
        resourceId: created.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        after: {
          documentId,
          principalType: created.principalType,
          permission: created.permission,
        },
      });

      return {
        id: created.id,
        principalType: created.principalType,
        principalId: created.principalId,
        permission: created.permission,
        createdAt: created.createdAt.toISOString(),
      };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("CONFLICT", "Esta permissão ACL já existe.");
    }
    throw error;
  }
}
