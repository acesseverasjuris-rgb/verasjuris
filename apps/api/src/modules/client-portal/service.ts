import { sanitizeExportHtml } from "@verasjuris/ai";
import {
  policyCalendar,
  policyClientPortal,
  policyLegalMatter,
  resolveClientPortalContext,
  type ClientPortalContext,
  type SessionAccount,
} from "@verasjuris/auth";
import {
  administrativeProcesses,
  calendarEvents,
  clientAppointmentRequests,
  clientDocumentRequests,
  clientPaymentRecords,
  clientRequests,
  contracts,
  conversationParticipants,
  conversationThreads,
  crmClients,
  documentAclEntries,
  documentVersions,
  documents,
  judicialProcesses,
  legalMatterTimelineEvents,
  legalMatters,
  messages,
  notifications,
  organizationClientUsers,
  users,
  type AppDatabase,
} from "@verasjuris/database";
import type { MalwareScannerProvider, StorageProvider } from "@verasjuris/storage";
import { AppError } from "@verasjuris/types";
import { and, asc, count, desc, eq, gte, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { sanitizeAiText } from "../ai/sanitize.js";
import type { RequestMeta } from "../auth/service.js";
import { processDocumentUpload, type UploadedFilePayload } from "../documents/upload.js";

type DbTx = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

export type ClientPortalModuleDeps = {
  storage: StorageProvider;
  malwareScanner: MalwareScannerProvider;
  maxUploadBytes: number;
};

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

function membershipOf(account: SessionAccount, organizationId: string) {
  return account.memberships.find((item) => item.organizationId === organizationId) ?? null;
}

function staffAccessOf(account: SessionAccount, organizationId: string) {
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

function requireStaffPortalPermission(
  account: SessionAccount,
  organizationId: string,
  permission: Parameters<typeof policyClientPortal>[1],
) {
  const decision = policyClientPortal(staffAccessOf(account, organizationId), permission);
  if (!decision.ok) throw new AppError(decision.code, decision.message);
  return membershipOf(account, organizationId)!;
}

export async function resolvePortalContext(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
): Promise<ClientPortalContext> {
  return resolveClientPortalContext(db, account.user.id, organizationId);
}

async function clientMatterIds(
  db: AppDatabase | DbTx,
  ctx: ClientPortalContext,
): Promise<string[]> {
  const rows = await db
    .select({ id: legalMatters.id })
    .from(legalMatters)
    .where(
      and(
        eq(legalMatters.organizationId, ctx.organizationId),
        eq(legalMatters.clientId, ctx.clientId),
      ),
    );
  return rows.map((r) => r.id);
}

async function requirePortalMatter(
  db: AppDatabase | DbTx,
  ctx: ClientPortalContext,
  matterId: string,
) {
  const matter = await db.query.legalMatters.findFirst({
    where: and(eq(legalMatters.id, matterId), eq(legalMatters.organizationId, ctx.organizationId)),
  });
  if (!matter || matter.clientId !== ctx.clientId) {
    throw new AppError("NOT_FOUND", "Não encontramos este caso no seu acesso.");
  }
  return matter;
}

function serializePortalMatterSummary(matter: typeof legalMatters.$inferSelect) {
  return {
    id: matter.id,
    title: matter.title,
    internalReference: matter.internalReference,
    summary: matter.summary,
    status: matter.status,
    priority: matter.priority,
    openedAt: iso(matter.openedAt),
    closedAt: iso(matter.closedAt),
    updatedAt: iso(matter.updatedAt),
  };
}

function sanitizeMessageBody(body: string): string {
  return sanitizeAiText(sanitizeExportHtml(body));
}

function portalPaymentView(row: typeof clientPaymentRecords.$inferSelect) {
  const paidAllowed =
    row.status !== "paid" ||
    Boolean(row.evidenceDocumentId) ||
    (row.source !== "manual" && row.source !== "not_configured");
  return {
    id: row.id,
    description: row.description,
    amountCents: row.amountCents,
    dueAt: iso(row.dueAt),
    paidAt: paidAllowed ? iso(row.paidAt) : null,
    status: paidAllowed ? row.status : row.status === "paid" ? "pending" : row.status,
    paymentMethod: row.paymentMethod,
    legalMatterId: row.legalMatterId,
    contractId: row.contractId,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

async function portalCanReadDocument(
  db: AppDatabase | DbTx,
  ctx: ClientPortalContext,
  doc: typeof documents.$inferSelect,
  matterIds: string[],
): Promise<boolean> {
  if (doc.organizationId !== ctx.organizationId) return false;
  if (doc.status === "archived") return false;

  const ownerOk =
    (doc.ownerType === "client" && doc.ownerId === ctx.clientId) ||
    (doc.ownerType === "legal_matter" && matterIds.includes(doc.ownerId));

  if (!ownerOk) {
    const acl = await db.query.documentAclEntries.findFirst({
      where: and(
        eq(documentAclEntries.documentId, doc.id),
        eq(documentAclEntries.organizationId, ctx.organizationId),
        eq(documentAclEntries.permission, "read"),
        eq(documentAclEntries.principalType, "user"),
        eq(documentAclEntries.principalId, ctx.userId),
      ),
    });
    if (!acl) return false;
  }

  if (doc.confidentialityLevel === "normal") return true;

  const acl = await db.query.documentAclEntries.findFirst({
    where: and(
      eq(documentAclEntries.documentId, doc.id),
      eq(documentAclEntries.organizationId, ctx.organizationId),
      eq(documentAclEntries.permission, "read"),
      or(
        and(
          eq(documentAclEntries.principalType, "user"),
          eq(documentAclEntries.principalId, ctx.userId),
        ),
        and(
          eq(documentAclEntries.principalType, "organization"),
          eq(documentAclEntries.principalId, ctx.organizationId),
        ),
      ),
    ),
  });
  return Boolean(acl);
}

function serializePortalDocument(
  row: typeof documents.$inferSelect,
  version?: typeof documentVersions.$inferSelect | null,
) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    documentKind: row.documentKind,
    ownerType: row.ownerType,
    ownerId: row.ownerId,
    currentVersionId: row.currentVersionId,
    currentVersion: version
      ? {
          id: version.id,
          versionNumber: version.versionNumber,
          safeFilename: version.safeFilename,
          mimeTypeDetected: version.mimeTypeDetected,
          sizeBytes: version.sizeBytes,
          createdAt: iso(version.createdAt),
        }
      : null,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

async function requirePortalThread(db: AppDatabase, ctx: ClientPortalContext, threadId: string) {
  const thread = await db.query.conversationThreads.findFirst({
    where: and(
      eq(conversationThreads.id, threadId),
      eq(conversationThreads.organizationId, ctx.organizationId),
    ),
  });
  if (!thread) {
    throw new AppError("NOT_FOUND", "Não encontramos esta conversa no seu acesso.");
  }
  if (thread.clientId && thread.clientId !== ctx.clientId) {
    throw new AppError("NOT_FOUND", "Não encontramos esta conversa no seu acesso.");
  }
  const participant = await db.query.conversationParticipants.findFirst({
    where: and(
      eq(conversationParticipants.threadId, threadId),
      eq(conversationParticipants.userId, ctx.userId),
    ),
  });
  if (!thread.clientId && !participant) {
    throw new AppError("NOT_FOUND", "Não encontramos esta conversa no seu acesso.");
  }
  return thread;
}

export async function portalGetMe(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  const ctx = await resolvePortalContext(db, account, organizationId);
  const matterIds = await clientMatterIds(db, ctx);

  const [openRequests, openDocReqs, openThreads, pendingPayments] = await Promise.all([
    db
      .select({ value: count() })
      .from(clientRequests)
      .where(
        and(
          eq(clientRequests.organizationId, ctx.organizationId),
          eq(clientRequests.clientId, ctx.clientId),
          inArray(clientRequests.status, ["open", "in_review", "assigned", "waiting_client"]),
        ),
      ),
    db
      .select({ value: count() })
      .from(clientDocumentRequests)
      .where(
        and(
          eq(clientDocumentRequests.organizationId, ctx.organizationId),
          eq(clientDocumentRequests.clientId, ctx.clientId),
          inArray(clientDocumentRequests.status, ["open", "viewed", "uploaded", "under_review"]),
        ),
      ),
    db
      .select({ value: count() })
      .from(conversationThreads)
      .where(
        and(
          eq(conversationThreads.organizationId, ctx.organizationId),
          eq(conversationThreads.clientId, ctx.clientId),
          inArray(conversationThreads.status, ["open", "waiting_client", "waiting_staff"]),
        ),
      ),
    db
      .select({ value: count() })
      .from(clientPaymentRecords)
      .where(
        and(
          eq(clientPaymentRecords.organizationId, ctx.organizationId),
          eq(clientPaymentRecords.clientId, ctx.clientId),
          inArray(clientPaymentRecords.status, ["pending", "overdue", "partial"]),
        ),
      ),
  ]);

  return {
    context: ctx,
    dashboard: {
      caseCount: matterIds.length,
      openRequests: openRequests[0]?.value ?? 0,
      openDocumentRequests: openDocReqs[0]?.value ?? 0,
      openThreads: openThreads[0]?.value ?? 0,
      pendingPayments: pendingPayments[0]?.value ?? 0,
    },
  };
}

export async function portalListCases(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { limit: number; offset: number },
) {
  const ctx = await resolvePortalContext(db, account, organizationId);
  const rows = await db.query.legalMatters.findMany({
    where: and(
      eq(legalMatters.organizationId, ctx.organizationId),
      eq(legalMatters.clientId, ctx.clientId),
    ),
    orderBy: [desc(legalMatters.updatedAt)],
    limit: query.limit,
    offset: query.offset,
  });
  const [totalRow] = await db
    .select({ value: count() })
    .from(legalMatters)
    .where(
      and(
        eq(legalMatters.organizationId, ctx.organizationId),
        eq(legalMatters.clientId, ctx.clientId),
      ),
    );
  return {
    cases: rows.map(serializePortalMatterSummary),
    total: totalRow?.value ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function portalGetCase(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
) {
  const ctx = await resolvePortalContext(db, account, organizationId);
  const matter = await requirePortalMatter(db, ctx, matterId);
  const timeline = await db.query.legalMatterTimelineEvents.findMany({
    where: and(
      eq(legalMatterTimelineEvents.legalMatterId, matterId),
      eq(legalMatterTimelineEvents.clientVisible, true),
    ),
    orderBy: [desc(legalMatterTimelineEvents.occurredAt)],
  });
  return {
    case: serializePortalMatterSummary(matter),
    timeline: timeline.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      title: e.title,
      body: e.body ? sanitizeAiText(e.body) : null,
      occurredAt: iso(e.occurredAt),
    })),
  };
}

export async function portalListCaseProcesses(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
) {
  const ctx = await resolvePortalContext(db, account, organizationId);
  await requirePortalMatter(db, ctx, matterId);

  const judicial = await db.query.judicialProcesses.findMany({
    where: and(
      eq(judicialProcesses.organizationId, ctx.organizationId),
      eq(judicialProcesses.legalMatterId, matterId),
    ),
  });

  const administrative = await db.query.administrativeProcesses.findMany({
    where: and(
      eq(administrativeProcesses.organizationId, ctx.organizationId),
      eq(administrativeProcesses.legalMatterId, matterId),
    ),
  });

  return {
    judicial: judicial
      .filter((p) => p.confidentialityLevel !== "secret")
      .map((p) => ({
        id: p.id,
        cnjNumber: p.cnjNumber,
        status: p.status,
        filingDate: iso(p.filingDate),
        lastMovementAt: iso(p.lastMovementAt),
        confidentialityLevel: p.confidentialityLevel,
      })),
    administrative: administrative.map((p) => ({
      id: p.id,
      number: p.number,
      protocolNumber: p.protocolNumber,
      subject: p.subject,
      status: p.status,
      protocolDate: iso(p.protocolDate),
    })),
  };
}

export async function portalListDocuments(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { limit: number; offset: number; legalMatterId?: string },
) {
  const ctx = await resolvePortalContext(db, account, organizationId);
  let matterIds = await clientMatterIds(db, ctx);
  if (query.legalMatterId) {
    await requirePortalMatter(db, ctx, query.legalMatterId);
    matterIds = [query.legalMatterId];
  }

  const ownerFilter = or(
    and(eq(documents.ownerType, "client"), eq(documents.ownerId, ctx.clientId)),
    matterIds.length > 0
      ? and(eq(documents.ownerType, "legal_matter"), inArray(documents.ownerId, matterIds))
      : sql`false`,
  );

  const candidates = await db.query.documents.findMany({
    where: and(eq(documents.organizationId, ctx.organizationId), ownerFilter),
    orderBy: [desc(documents.updatedAt)],
    limit: Math.min(query.limit * 3, 300),
    offset: query.offset,
  });

  const visible: typeof candidates = [];
  for (const doc of candidates) {
    if (await portalCanReadDocument(db, ctx, doc, matterIds)) visible.push(doc);
    if (visible.length >= query.limit) break;
  }

  const enriched = await Promise.all(
    visible.map(async (doc) => {
      const version = doc.currentVersionId
        ? await db.query.documentVersions.findFirst({
            where: eq(documentVersions.id, doc.currentVersionId),
          })
        : null;
      return serializePortalDocument(doc, version);
    }),
  );

  return { documents: enriched, limit: query.limit, offset: query.offset };
}

export async function portalUploadDocument(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    title: string;
    ownerType: "legal_matter" | "client";
    ownerId: string;
    legalMatterId?: string;
  },
  file: UploadedFilePayload,
  deps: ClientPortalModuleDeps,
) {
  const ctx = await resolvePortalContext(db, account, organizationId);
  const matterIds = await clientMatterIds(db, ctx);

  if (input.ownerType === "client") {
    if (input.ownerId !== ctx.clientId) {
      throw new AppError("NOT_FOUND", "Não encontramos este vínculo no seu acesso.");
    }
  } else {
    await requirePortalMatter(db, ctx, input.ownerId);
  }

  const documentId = randomUUID();
  const versionId = randomUUID();
  const processed = await processDocumentUpload({
    file,
    maxBytes: deps.maxUploadBytes,
    organizationId: ctx.organizationId,
    documentId,
    versionId,
    storage: deps.storage,
    scanner: deps.malwareScanner,
  });

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(documents)
      .values({
        id: documentId,
        organizationId: ctx.organizationId,
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        title: input.title,
        status: processed.versionStatus === "available" ? "active" : "draft",
        documentKind: "other",
        legalContext: "other",
        evidentiaryRole: "none",
        confidentialityLevel: "normal",
        createdByMembershipId: null,
      })
      .returning();
    if (!created) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o documento.");

    const [version] = await tx
      .insert(documentVersions)
      .values({
        id: versionId,
        organizationId: ctx.organizationId,
        documentId,
        versionNumber: 1,
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
        uploadedByMembershipId: null,
      })
      .returning();

    if (version && processed.versionStatus === "available") {
      await tx
        .update(documents)
        .set({ currentVersionId: version.id, updatedAt: new Date() })
        .where(eq(documents.id, documentId));
    }

    return { document: serializePortalDocument(created, version) };
  });
}

export async function portalListDocumentRequests(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { limit: number; offset: number; status?: string },
) {
  const ctx = await resolvePortalContext(db, account, organizationId);
  const filters = [
    eq(clientDocumentRequests.organizationId, ctx.organizationId),
    eq(clientDocumentRequests.clientId, ctx.clientId),
  ];
  if (query.status) {
    filters.push(eq(clientDocumentRequests.status, query.status as never));
  }
  const rows = await db.query.clientDocumentRequests.findMany({
    where: and(...filters),
    orderBy: [desc(clientDocumentRequests.createdAt)],
    limit: query.limit,
    offset: query.offset,
  });
  return {
    documentRequests: rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      documentKind: r.documentKind,
      dueAt: iso(r.dueAt),
      status: r.status,
      legalMatterId: r.legalMatterId,
      fulfilledDocumentId: r.fulfilledDocumentId,
      createdAt: iso(r.createdAt),
    })),
    limit: query.limit,
    offset: query.offset,
  };
}

export async function portalCreateDocumentRequest(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    title: string;
    description?: string;
    documentKind?: string;
    legalMatterId?: string;
  },
) {
  const ctx = await resolvePortalContext(db, account, organizationId);
  if (input.legalMatterId) await requirePortalMatter(db, ctx, input.legalMatterId);

  const [row] = await db
    .insert(clientDocumentRequests)
    .values({
      organizationId: ctx.organizationId,
      clientId: ctx.clientId,
      legalMatterId: input.legalMatterId ?? null,
      title: input.title,
      description: input.description ?? null,
      documentKind: input.documentKind ?? null,
      status: "open",
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar a solicitação.");
  return { documentRequest: row };
}

export async function portalFulfillDocumentRequest(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  requestId: string,
  fulfilledDocumentId: string,
) {
  const ctx = await resolvePortalContext(db, account, organizationId);
  const req = await db.query.clientDocumentRequests.findFirst({
    where: and(
      eq(clientDocumentRequests.id, requestId),
      eq(clientDocumentRequests.organizationId, ctx.organizationId),
    ),
  });
  if (!req || req.clientId !== ctx.clientId) {
    throw new AppError("NOT_FOUND", "Não encontramos esta solicitação no seu acesso.");
  }

  const doc = await db.query.documents.findFirst({
    where: eq(documents.id, fulfilledDocumentId),
  });
  if (!doc || doc.organizationId !== ctx.organizationId) {
    throw new AppError("NOT_FOUND", "Não encontramos este documento no seu acesso.");
  }
  const matterIds = await clientMatterIds(db, ctx);
  if (!(await portalCanReadDocument(db, ctx, doc, matterIds))) {
    throw new AppError("NOT_FOUND", "Não encontramos este documento no seu acesso.");
  }

  const [updated] = await db
    .update(clientDocumentRequests)
    .set({
      fulfilledDocumentId,
      status: "uploaded",
      updatedAt: new Date(),
    })
    .where(eq(clientDocumentRequests.id, requestId))
    .returning();
  return { documentRequest: updated };
}

export async function portalListThreads(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { limit: number; offset: number },
) {
  const ctx = await resolvePortalContext(db, account, organizationId);
  const rows = await db.query.conversationThreads.findMany({
    where: and(
      eq(conversationThreads.organizationId, ctx.organizationId),
      eq(conversationThreads.clientId, ctx.clientId),
    ),
    orderBy: [desc(conversationThreads.updatedAt)],
    limit: query.limit,
    offset: query.offset,
  });
  return {
    threads: rows.map((t) => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      legalMatterId: t.legalMatterId,
      createdAt: iso(t.createdAt),
      updatedAt: iso(t.updatedAt),
    })),
    limit: query.limit,
    offset: query.offset,
  };
}

export async function portalCreateThread(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: { subject: string; legalMatterId?: string },
) {
  const ctx = await resolvePortalContext(db, account, organizationId);
  if (input.legalMatterId) await requirePortalMatter(db, ctx, input.legalMatterId);

  return db.transaction(async (tx) => {
    const [thread] = await tx
      .insert(conversationThreads)
      .values({
        organizationId: ctx.organizationId,
        clientId: ctx.clientId,
        legalMatterId: input.legalMatterId ?? null,
        subject: input.subject,
        status: "open",
        createdByUserId: ctx.userId,
      })
      .returning();
    if (!thread) throw new AppError("INTERNAL_ERROR", "Não foi possível abrir a conversa.");

    await tx.insert(conversationParticipants).values({
      organizationId: ctx.organizationId,
      threadId: thread.id,
      userId: ctx.userId,
      participantRole: "client",
    });

    return {
      thread: {
        id: thread.id,
        subject: thread.subject,
        status: thread.status,
        legalMatterId: thread.legalMatterId,
      },
    };
  });
}

export async function portalListMessages(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  threadId: string,
  query: { limit: number; offset: number },
) {
  const ctx = await resolvePortalContext(db, account, organizationId);
  await requirePortalThread(db, ctx, threadId);

  const rows = await db.query.messages.findMany({
    where: and(
      eq(messages.threadId, threadId),
      eq(messages.organizationId, ctx.organizationId),
      isNull(messages.deletedAt),
      or(eq(messages.clientVisible, true), eq(messages.senderType, "client")),
    ),
    orderBy: [asc(messages.createdAt)],
    limit: query.limit,
    offset: query.offset,
  });

  return {
    messages: rows.map((m) => ({
      id: m.id,
      body: sanitizeMessageBody(m.body),
      senderType: m.senderType,
      createdAt: iso(m.createdAt),
    })),
    limit: query.limit,
    offset: query.offset,
  };
}

export async function portalCreateMessage(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  threadId: string,
  body: string,
) {
  const ctx = await resolvePortalContext(db, account, organizationId);
  await requirePortalThread(db, ctx, threadId);
  const sanitized = sanitizeMessageBody(body);

  const [row] = await db
    .insert(messages)
    .values({
      organizationId: ctx.organizationId,
      threadId,
      senderUserId: ctx.userId,
      senderType: "client",
      body: sanitized,
      clientVisible: true,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível enviar a mensagem.");

  await db
    .update(conversationThreads)
    .set({ status: "waiting_staff", updatedAt: new Date() })
    .where(eq(conversationThreads.id, threadId));

  return {
    message: {
      id: row.id,
      body: row.body,
      senderType: row.senderType,
      createdAt: iso(row.createdAt),
    },
  };
}

export async function portalListContracts(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { limit: number; offset: number },
) {
  const ctx = await resolvePortalContext(db, account, organizationId);
  const rows = await db.query.contracts.findMany({
    where: and(
      eq(contracts.organizationId, ctx.organizationId),
      eq(contracts.clientId, ctx.clientId),
    ),
    orderBy: [desc(contracts.updatedAt)],
    limit: query.limit,
    offset: query.offset,
  });
  const clientVisibleStatuses = new Set([
    "pending_signature",
    "partially_signed",
    "signed",
    "active",
    "expiring",
    "expired",
    "terminated",
  ]);
  return {
    contracts: rows
      .filter((c) => clientVisibleStatuses.has(c.status))
      .map((c) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        contractType: c.contractType,
        effectiveDate: iso(c.effectiveDate),
        expirationDate: iso(c.expirationDate),
        legalMatterId: c.legalMatterId,
        updatedAt: iso(c.updatedAt),
      })),
    limit: query.limit,
    offset: query.offset,
  };
}

export async function portalListPayments(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { limit: number; offset: number },
) {
  const ctx = await resolvePortalContext(db, account, organizationId);
  const rows = await db.query.clientPaymentRecords.findMany({
    where: and(
      eq(clientPaymentRecords.organizationId, ctx.organizationId),
      eq(clientPaymentRecords.clientId, ctx.clientId),
    ),
    orderBy: [desc(clientPaymentRecords.createdAt)],
    limit: query.limit,
    offset: query.offset,
  });
  return {
    payments: rows.map(portalPaymentView),
    limit: query.limit,
    offset: query.offset,
  };
}

export async function portalListRequests(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { limit: number; offset: number },
) {
  const ctx = await resolvePortalContext(db, account, organizationId);
  const rows = await db.query.clientRequests.findMany({
    where: and(
      eq(clientRequests.organizationId, ctx.organizationId),
      eq(clientRequests.clientId, ctx.clientId),
    ),
    orderBy: [desc(clientRequests.createdAt)],
    limit: query.limit,
    offset: query.offset,
  });
  return {
    requests: rows.map((r) => ({
      id: r.id,
      requestType: r.requestType,
      title: r.title,
      description: r.description,
      status: r.status,
      legalMatterId: r.legalMatterId,
      createdAt: iso(r.createdAt),
      updatedAt: iso(r.updatedAt),
    })),
    limit: query.limit,
    offset: query.offset,
  };
}

export async function portalCreateRequest(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    requestType?: (typeof clientRequests.$inferInsert)["requestType"];
    title: string;
    description?: string;
    legalMatterId?: string;
  },
) {
  const ctx = await resolvePortalContext(db, account, organizationId);
  if (input.legalMatterId) await requirePortalMatter(db, ctx, input.legalMatterId);

  const [row] = await db
    .insert(clientRequests)
    .values({
      organizationId: ctx.organizationId,
      clientId: ctx.clientId,
      legalMatterId: input.legalMatterId ?? null,
      createdByUserId: ctx.userId,
      requestType: input.requestType ?? "general",
      title: input.title,
      description: input.description ?? null,
      status: "open",
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar a solicitação.");
  return { request: row };
}

export async function portalListAppointmentRequests(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { limit: number; offset: number },
) {
  const ctx = await resolvePortalContext(db, account, organizationId);
  const rows = await db.query.clientAppointmentRequests.findMany({
    where: and(
      eq(clientAppointmentRequests.organizationId, ctx.organizationId),
      eq(clientAppointmentRequests.clientId, ctx.clientId),
    ),
    orderBy: [desc(clientAppointmentRequests.createdAt)],
    limit: query.limit,
    offset: query.offset,
  });
  return {
    appointmentRequests: rows.map((r) => ({
      id: r.id,
      appointmentType: r.appointmentType,
      notes: r.notes,
      status: r.status,
      preferredDateRanges: r.preferredDateRanges,
      legalMatterId: r.legalMatterId,
      createdAt: iso(r.createdAt),
    })),
    limit: query.limit,
    offset: query.offset,
  };
}

export async function portalCreateAppointmentRequest(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    appointmentType?: string;
    notes?: string;
    legalMatterId?: string;
    preferredDateRanges?: Array<{ start: string; end: string }>;
  },
) {
  const ctx = await resolvePortalContext(db, account, organizationId);
  if (input.legalMatterId) await requirePortalMatter(db, ctx, input.legalMatterId);

  const [row] = await db
    .insert(clientAppointmentRequests)
    .values({
      organizationId: ctx.organizationId,
      clientId: ctx.clientId,
      legalMatterId: input.legalMatterId ?? null,
      createdByUserId: ctx.userId,
      appointmentType: input.appointmentType ?? "general",
      notes: input.notes ?? null,
      preferredDateRanges: input.preferredDateRanges ?? null,
      status: "open",
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar o pedido.");
  return { appointmentRequest: row };
}

export async function portalListCalendar(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { from?: string; to?: string; limit: number; offset: number },
) {
  const ctx = await resolvePortalContext(db, account, organizationId);
  const matterIds = await clientMatterIds(db, ctx);
  if (matterIds.length === 0) {
    return { events: [], limit: query.limit, offset: query.offset };
  }

  const filters = [
    eq(calendarEvents.organizationId, ctx.organizationId),
    eq(calendarEvents.clientVisible, true),
    inArray(calendarEvents.legalMatterId, matterIds),
    ne(calendarEvents.status, "cancelled"),
  ];
  if (query.from) filters.push(gte(calendarEvents.startsAt, new Date(query.from)));
  if (query.to) filters.push(lte(calendarEvents.endsAt, new Date(query.to)));

  const rows = await db.query.calendarEvents.findMany({
    where: and(...filters),
    orderBy: [asc(calendarEvents.startsAt)],
    limit: query.limit,
    offset: query.offset,
  });

  return {
    events: rows.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description ? sanitizeAiText(e.description) : null,
      eventType: e.eventType,
      startsAt: iso(e.startsAt),
      endsAt: iso(e.endsAt),
      timezone: e.timezone,
      allDay: e.allDay,
      locationType: e.locationType,
      locationText: e.locationText,
      legalMatterId: e.legalMatterId,
      status: e.status,
    })),
    limit: query.limit,
    offset: query.offset,
  };
}

export async function portalListNotifications(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { limit: number; offset: number },
) {
  const ctx = await resolvePortalContext(db, account, organizationId);
  const rows = await db.query.notifications.findMany({
    where: and(
      eq(notifications.organizationId, ctx.organizationId),
      eq(notifications.userId, ctx.userId),
    ),
    orderBy: [desc(notifications.createdAt)],
    limit: query.limit,
    offset: query.offset,
  });
  return {
    notifications: rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: sanitizeAiText(n.message),
      resourceType: n.resourceType,
      resourceId: n.resourceId,
      readAt: iso(n.readAt),
      createdAt: iso(n.createdAt),
    })),
    limit: query.limit,
    offset: query.offset,
  };
}

/* ─── Staff helpers ─── */

export async function staffLinkClientUser(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: { userId: string; crmClientId: string },
  meta: RequestMeta,
) {
  requireStaffPortalPermission(account, organizationId, "client_portal.link_user");

  const client = await db.query.crmClients.findFirst({
    where: and(eq(crmClients.id, input.crmClientId), eq(crmClients.organizationId, organizationId)),
  });
  if (!client) throw new AppError("NOT_FOUND", "Não encontramos este cliente.");

  const targetUser = await db.query.users.findFirst({ where: eq(users.id, input.userId) });
  if (!targetUser) throw new AppError("NOT_FOUND", "Não encontramos este usuário.");

  const existing = await db.query.organizationClientUsers.findFirst({
    where: and(
      eq(organizationClientUsers.organizationId, organizationId),
      eq(organizationClientUsers.userId, input.userId),
    ),
  });

  const row = existing
    ? (
        await db
          .update(organizationClientUsers)
          .set({ crmClientId: input.crmClientId, updatedAt: new Date() })
          .where(eq(organizationClientUsers.id, existing.id))
          .returning()
      )[0]
    : (
        await db
          .insert(organizationClientUsers)
          .values({
            organizationId,
            userId: input.userId,
            crmClientId: input.crmClientId,
          })
          .returning()
      )[0];

  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível vincular o usuário.");
  void meta;
  return { organizationClientUser: row };
}

export async function staffCreateDocumentRequest(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    clientId: string;
    legalMatterId?: string;
    title: string;
    description?: string;
    documentKind?: string;
    dueAt?: string;
    status?: (typeof clientDocumentRequests.$inferInsert)["status"];
  },
  meta: RequestMeta,
) {
  const actor = requireStaffPortalPermission(
    account,
    organizationId,
    "client_portal.manage_requests",
  );

  const client = await db.query.crmClients.findFirst({
    where: and(eq(crmClients.id, input.clientId), eq(crmClients.organizationId, organizationId)),
  });
  if (!client) throw new AppError("NOT_FOUND", "Não encontramos este cliente.");

  if (input.legalMatterId) {
    const matter = await db.query.legalMatters.findFirst({
      where: and(
        eq(legalMatters.id, input.legalMatterId),
        eq(legalMatters.organizationId, organizationId),
        eq(legalMatters.clientId, input.clientId),
      ),
    });
    if (!matter) throw new AppError("NOT_FOUND", "Não encontramos este caso para o cliente.");
  }

  const [row] = await db
    .insert(clientDocumentRequests)
    .values({
      organizationId,
      clientId: input.clientId,
      legalMatterId: input.legalMatterId ?? null,
      requestedByMembershipId: actor.membershipId,
      title: input.title,
      description: input.description ?? null,
      documentKind: input.documentKind ?? null,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      status: input.status ?? "open",
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a solicitação.");
  void meta;
  return { documentRequest: row };
}

export async function staffCreatePaymentRecord(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    clientId: string;
    legalMatterId?: string;
    contractId?: string;
    description: string;
    amountCents: number;
    dueAt?: string;
    status?: (typeof clientPaymentRecords.$inferInsert)["status"];
    paymentMethod?: string;
    externalReference?: string;
    source?: string;
    evidenceDocumentId?: string;
  },
  meta: RequestMeta,
) {
  const actor = requireStaffPortalPermission(
    account,
    organizationId,
    "client_portal.manage_payments",
  );

  const client = await db.query.crmClients.findFirst({
    where: and(eq(crmClients.id, input.clientId), eq(crmClients.organizationId, organizationId)),
  });
  if (!client) throw new AppError("NOT_FOUND", "Não encontramos este cliente.");

  const status = input.status ?? "pending";
  const source = input.source ?? "manual";
  if (status === "paid" && source === "manual" && !input.evidenceDocumentId) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Pagamento manual como pago exige documento de evidência.",
      [{ path: "evidenceDocumentId", message: "Informe a evidência ou use fonte de provedor." }],
    );
  }

  const [row] = await db
    .insert(clientPaymentRecords)
    .values({
      organizationId,
      clientId: input.clientId,
      legalMatterId: input.legalMatterId ?? null,
      contractId: input.contractId ?? null,
      description: input.description,
      amountCents: input.amountCents,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      paidAt: status === "paid" ? new Date() : null,
      status,
      paymentMethod: input.paymentMethod ?? null,
      externalReference: input.externalReference ?? null,
      source,
      evidenceDocumentId: input.evidenceDocumentId ?? null,
      recordedByMembershipId: actor.membershipId,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar o pagamento.");
  void meta;
  return { payment: portalPaymentView(row) };
}

export async function staffPatchCalendarClientVisible(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  eventId: string,
  clientVisible: boolean,
) {
  requireStaffPortalPermission(account, organizationId, "client_portal.manage_requests");
  const calendarDecision = policyCalendar(
    staffAccessOf(account, organizationId),
    "calendar.update",
  );
  if (!calendarDecision.ok) throw new AppError(calendarDecision.code, calendarDecision.message);

  const event = await db.query.calendarEvents.findFirst({
    where: and(eq(calendarEvents.id, eventId), eq(calendarEvents.organizationId, organizationId)),
  });
  if (!event) throw new AppError("NOT_FOUND", "Não encontramos este compromisso.");

  const [updated] = await db
    .update(calendarEvents)
    .set({ clientVisible, updatedAt: new Date() })
    .where(eq(calendarEvents.id, eventId))
    .returning();
  return { event: { id: updated!.id, clientVisible: updated!.clientVisible } };
}

export async function staffPatchTimelineClientVisible(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  matterId: string,
  eventId: string,
  clientVisible: boolean,
) {
  const matterDecision = policyLegalMatter(staffAccessOf(account, organizationId), "matter.update");
  if (!matterDecision.ok) throw new AppError(matterDecision.code, matterDecision.message);

  const event = await db.query.legalMatterTimelineEvents.findFirst({
    where: and(
      eq(legalMatterTimelineEvents.id, eventId),
      eq(legalMatterTimelineEvents.legalMatterId, matterId),
      eq(legalMatterTimelineEvents.organizationId, organizationId),
    ),
  });
  if (!event) throw new AppError("NOT_FOUND", "Não encontramos este evento na linha do tempo.");

  const [updated] = await db
    .update(legalMatterTimelineEvents)
    .set({ clientVisible })
    .where(eq(legalMatterTimelineEvents.id, eventId))
    .returning();
  return { timelineEvent: { id: updated!.id, clientVisible: updated!.clientVisible } };
}
