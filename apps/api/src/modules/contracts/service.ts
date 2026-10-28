import {
  type ContractManagementProvider,
  NotConfiguredContractManagementProvider,
  sanitizeExportHtml,
  type SignatureProvider,
} from "@verasjuris/ai";
import { recordAudit } from "@verasjuris/audit";
import {
  authorizeAccess,
  policyContract,
  policyContractApproval,
  policyContractClause,
  policyContractTermination,
  policyContractVersion,
  policySignatureRequest,
  type SessionAccount,
} from "@verasjuris/auth";
import {
  contractAmendments,
  contractApprovalPolicies,
  contractApprovals,
  contractClauseInstances,
  contractClauses,
  contractObligations,
  contractParties,
  contractRenewals,
  contractTemplates,
  contractTerminations,
  contractTimelineEvents,
  contractVersions,
  contracts,
  crmClients,
  legalDocumentDrafts,
  legalMatters,
  manualSignatureRecords,
  signatureRequests,
  signatureSigners,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, asc, count, desc, eq, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import { authorize, escapeLike, iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";
import { requireDocumentInOrg } from "../documents/service.js";

export type ContractsModuleDeps = {
  signatureProvider: SignatureProvider;
  contractManagementProvider?: ContractManagementProvider;
};

const MANUAL_SIGNATURE_LABEL = "Assinatura registrada manualmente.";

function parseDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(value);
}

function sanitizeClauseContent(content: string): string {
  return sanitizeExportHtml(content);
}

function assertNoEvalInContent(content: string, path = "content"): void {
  if (/\beval\s*\(/i.test(content) || /new\s+Function\s*\(/i.test(content)) {
    throw new AppError("VALIDATION_ERROR", "Conteúdo contém expressões não permitidas.", [
      { path, message: "Expressões eval/Function são bloqueadas." },
    ]);
  }
}

function requirePermission(
  account: SessionAccount,
  organizationId: string,
  permission: Parameters<typeof authorizeAccess>[0]["required"],
) {
  return authorize(account, organizationId, (access) =>
    authorizeAccess({ membership: access, required: permission }),
  );
}

async function requireContractRow(db: AppDatabase, organizationId: string, contractId: string) {
  const row = await db.query.contracts.findFirst({
    where: and(eq(contracts.id, contractId), eq(contracts.organizationId, organizationId)),
  });
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos este contrato.");
  return row;
}

async function requireVersionRow(
  db: AppDatabase,
  organizationId: string,
  contractId: string,
  versionId: string,
) {
  const row = await db.query.contractVersions.findFirst({
    where: and(
      eq(contractVersions.id, versionId),
      eq(contractVersions.contractId, contractId),
      eq(contractVersions.organizationId, organizationId),
    ),
  });
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos esta versão do contrato.");
  return row;
}

async function assertVersionMutable(version: typeof contractVersions.$inferSelect) {
  if (version.immutable || version.status === "signed") {
    throw new AppError("CONFLICT", "Esta versão está assinada e não pode ser alterada.");
  }
}

async function recordTimeline(
  db: AppDatabase,
  input: {
    organizationId: string;
    contractId: string;
    eventType: string;
    summary: string;
    actorMembershipId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  await db.insert(contractTimelineEvents).values({
    organizationId: input.organizationId,
    contractId: input.contractId,
    eventType: input.eventType,
    summary: input.summary,
    actorMembershipId: input.actorMembershipId ?? null,
    metadata: input.metadata ?? null,
  });
}

async function auditContract(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  action: string,
  resourceId: string,
  meta: RequestMeta,
  after?: Record<string, unknown>,
) {
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action,
    resourceType: "contract",
    resourceId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: after ?? null,
  });
}

function serializeContract(row: typeof contracts.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    legalMatterId: row.legalMatterId,
    clientId: row.clientId,
    contractTemplateId: row.contractTemplateId,
    currentVersionId: row.currentVersionId,
    title: row.title,
    contractType: row.contractType,
    status: row.status,
    effectiveDate: iso(row.effectiveDate),
    expirationDate: iso(row.expirationDate),
    indefiniteTerm: row.indefiniteTerm,
    renewalType: row.renewalType,
    renewalNoticeDays: row.renewalNoticeDays,
    terminationDate: iso(row.terminationDate),
    governingLaw: row.governingLaw,
    jurisdiction: row.jurisdiction,
    currency: row.currency,
    totalValueCents: row.totalValueCents,
    sourceDraftId: row.sourceDraftId,
    createdByMembershipId: row.createdByMembershipId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeVersion(row: typeof contractVersions.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    contractId: row.contractId,
    version: row.version,
    sourceDraftId: row.sourceDraftId,
    documentId: row.documentId,
    documentVersionId: row.documentVersionId,
    contentSnapshot: row.contentSnapshot,
    clauseSnapshot: row.clauseSnapshot,
    status: row.status,
    immutable: row.immutable,
    createdByMembershipId: row.createdByMembershipId,
    approvedByMembershipId: row.approvedByMembershipId,
    approvedAt: iso(row.approvedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function assertClientInOrg(db: AppDatabase, organizationId: string, clientId: string) {
  const client = await db.query.crmClients.findFirst({
    where: and(eq(crmClients.id, clientId), eq(crmClients.organizationId, organizationId)),
    columns: { id: true },
  });
  if (!client) throw new AppError("NOT_FOUND", "Não encontramos este cliente.");
}

async function assertMatterInOrg(db: AppDatabase, organizationId: string, legalMatterId: string) {
  const matter = await db.query.legalMatters.findFirst({
    where: and(eq(legalMatters.id, legalMatterId), eq(legalMatters.organizationId, organizationId)),
    columns: { id: true },
  });
  if (!matter) throw new AppError("NOT_FOUND", "Não encontramos este caso jurídico.");
}

async function assertDraftInOrg(db: AppDatabase, organizationId: string, draftId: string) {
  const draft = await db.query.legalDocumentDrafts.findFirst({
    where: and(
      eq(legalDocumentDrafts.id, draftId),
      eq(legalDocumentDrafts.organizationId, organizationId),
    ),
    columns: { id: true },
  });
  if (!draft) throw new AppError("NOT_FOUND", "Não encontramos este rascunho jurídico.");
}

async function syncSignatureCompletion(
  db: AppDatabase,
  organizationId: string,
  contractId: string,
  versionId: string,
  actorMembershipId: string | null,
  meta: RequestMeta,
  account: SessionAccount,
) {
  const parties = await db.query.contractParties.findMany({
    where: and(
      eq(contractParties.contractId, contractId),
      eq(contractParties.organizationId, organizationId),
      eq(contractParties.signerRequired, true),
    ),
  });
  const manual = await db.query.manualSignatureRecords.findMany({
    where: and(
      eq(manualSignatureRecords.contractVersionId, versionId),
      eq(manualSignatureRecords.organizationId, organizationId),
    ),
  });
  const signedPartyIds = new Set(
    manual.map((r) => r.contractPartyId).filter((id): id is string => Boolean(id)),
  );
  const providerSigned = await db.query.signatureRequests.findFirst({
    where: and(
      eq(signatureRequests.contractVersionId, versionId),
      eq(signatureRequests.organizationId, organizationId),
      eq(signatureRequests.status, "signed"),
    ),
  });

  const allManual = parties.length > 0 && parties.every((p) => signedPartyIds.has(p.id));

  const fullySigned = Boolean(providerSigned) || allManual;

  if (!fullySigned) {
    const someSigned = manual.length > 0 || providerSigned?.status === "partially_signed";
    if (someSigned) {
      await db
        .update(contracts)
        .set({ status: "partially_signed", updatedAt: new Date() })
        .where(eq(contracts.id, contractId));
    }
    return;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(contractVersions)
      .set({ status: "signed", immutable: true, updatedAt: new Date() })
      .where(eq(contractVersions.id, versionId));
    await tx
      .update(contracts)
      .set({ status: "signed", updatedAt: new Date() })
      .where(eq(contracts.id, contractId));
  });

  await auditContract(
    db,
    account,
    organizationId,
    "contract.signature_recorded",
    contractId,
    meta,
    {
      versionId,
      fullySigned: true,
    },
  );
  await recordTimeline(db, {
    organizationId,
    contractId,
    eventType: "signature_completed",
    summary: providerSigned ? "Contrato assinado via provedor eletrônico." : MANUAL_SIGNATURE_LABEL,
    actorMembershipId,
  });

  await maybeActivateContract(db, account, organizationId, contractId, actorMembershipId, meta);
}

async function maybeActivateContract(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  contractId: string,
  actorMembershipId: string | null,
  meta: RequestMeta,
) {
  const contract = await requireContractRow(db, organizationId, contractId);
  if (contract.status !== "signed") return;
  const effective = contract.effectiveDate;
  const now = new Date();
  if (effective && effective > now) return;

  await db
    .update(contracts)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(contracts.id, contractId));

  await auditContract(db, account, organizationId, "contract.activated", contractId, meta);
  await recordTimeline(db, {
    organizationId,
    contractId,
    eventType: "activated",
    summary: "Contrato ativado.",
    actorMembershipId,
  });
}

export async function getSignatureProvidersStatus(
  account: SessionAccount,
  organizationId: string,
  deps: ContractsModuleDeps,
) {
  authorize(account, organizationId, (access) => policyContract(access, "contract.read"));
  const managementProvider =
    deps.contractManagementProvider ?? new NotConfiguredContractManagementProvider();
  const [signature, management] = await Promise.all([
    deps.signatureProvider.healthCheck(),
    managementProvider.healthCheck(),
  ]);
  return { signature, contractManagement: management };
}

export async function listContracts(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: {
    q?: string;
    clientId?: string;
    legalMatterId?: string;
    status?: (typeof contracts.$inferSelect)["status"];
    contractType?: string;
    expiringBefore?: string;
    limit: number;
    offset: number;
  },
) {
  authorize(account, organizationId, (access) => policyContract(access, "contract.read"));
  const filters: SQL[] = [eq(contracts.organizationId, organizationId)];
  if (query.clientId) filters.push(eq(contracts.clientId, query.clientId));
  if (query.legalMatterId) filters.push(eq(contracts.legalMatterId, query.legalMatterId));
  if (query.status) filters.push(eq(contracts.status, query.status));
  if (query.contractType) filters.push(eq(contracts.contractType, query.contractType));
  if (query.expiringBefore) {
    filters.push(lte(contracts.expirationDate, new Date(query.expiringBefore)));
  }
  if (query.q) {
    const pattern = `%${escapeLike(query.q)}%`;
    filters.push(ilike(contracts.title, pattern));
  }
  const where = and(...filters);
  const [items, totalRow] = await Promise.all([
    db.query.contracts.findMany({
      where,
      orderBy: desc(contracts.updatedAt),
      limit: query.limit,
      offset: query.offset,
    }),
    db.select({ total: count() }).from(contracts).where(where),
  ]);
  return {
    items: items.map(serializeContract),
    total: totalRow[0]?.total ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function createContract(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    title: string;
    legalMatterId?: string;
    clientId?: string;
    contractTemplateId?: string;
    contractType?: string;
    status?: (typeof contracts.$inferSelect)["status"];
    effectiveDate?: string;
    expirationDate?: string | null;
    indefiniteTerm?: boolean;
    renewalType?: (typeof contracts.$inferSelect)["renewalType"];
    renewalNoticeDays?: number;
    governingLaw?: string;
    jurisdiction?: string;
    currency?: string;
    totalValueCents?: number;
    sourceDraftId?: string;
  },
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyContract(access, "contract.create"),
  );
  if (input.status === "signed") {
    throw new AppError(
      "VALIDATION_ERROR",
      "Não é possível criar contrato já assinado sem evidência de assinatura.",
    );
  }
  if (input.clientId) await assertClientInOrg(db, organizationId, input.clientId);
  if (input.legalMatterId) await assertMatterInOrg(db, organizationId, input.legalMatterId);
  if (input.sourceDraftId) await assertDraftInOrg(db, organizationId, input.sourceDraftId);
  if (input.contractTemplateId) {
    const template = await db.query.contractTemplates.findFirst({
      where: and(
        eq(contractTemplates.id, input.contractTemplateId),
        or(
          eq(contractTemplates.organizationId, organizationId),
          eq(contractTemplates.isSystem, true),
        ),
      ),
    });
    if (!template) throw new AppError("NOT_FOUND", "Não encontramos este modelo de contrato.");
  }

  const [row] = await db
    .insert(contracts)
    .values({
      organizationId,
      title: input.title,
      legalMatterId: input.legalMatterId ?? null,
      clientId: input.clientId ?? null,
      contractTemplateId: input.contractTemplateId ?? null,
      contractType: input.contractType ?? "other",
      status: input.status ?? "draft",
      effectiveDate: parseDate(input.effectiveDate) ?? null,
      expirationDate: parseDate(input.expirationDate) ?? null,
      indefiniteTerm: input.indefiniteTerm ?? false,
      renewalType: input.renewalType ?? "none",
      renewalNoticeDays: input.renewalNoticeDays ?? null,
      governingLaw: input.governingLaw ?? null,
      jurisdiction: input.jurisdiction ?? null,
      currency: input.currency ?? "BRL",
      totalValueCents: input.totalValueCents ?? null,
      sourceDraftId: input.sourceDraftId ?? null,
      createdByMembershipId: membership.membershipId,
    })
    .returning();

  await auditContract(db, account, organizationId, "contract.created", row!.id, meta);
  await recordTimeline(db, {
    organizationId,
    contractId: row!.id,
    eventType: "created",
    summary: "Contrato criado.",
    actorMembershipId: membership.membershipId,
  });

  return { contract: serializeContract(row!) };
}

export async function getContract(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  contractId: string,
) {
  authorize(account, organizationId, (access) => policyContract(access, "contract.read"));
  const row = await requireContractRow(db, organizationId, contractId);
  return { contract: serializeContract(row) };
}

export async function updateContract(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  contractId: string,
  input: Partial<{
    title: string;
    legalMatterId?: string;
    clientId?: string;
    contractTemplateId?: string;
    contractType: string;
    status: (typeof contracts.$inferSelect)["status"];
    effectiveDate?: string;
    expirationDate?: string | null;
    indefiniteTerm: boolean;
    renewalType: (typeof contracts.$inferSelect)["renewalType"];
    renewalNoticeDays?: number;
    governingLaw?: string;
    jurisdiction?: string;
    currency?: string;
    totalValueCents?: number;
    sourceDraftId?: string;
  }>,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) => policyContract(access, "contract.update"));
  const existing = await requireContractRow(db, organizationId, contractId);
  if (input.status === "signed" || input.status === "active") {
    throw new AppError(
      "VALIDATION_ERROR",
      "Status assinado/ativo exige fluxo de assinatura (provedor ou registro manual com evidência).",
    );
  }
  if (input.clientId) await assertClientInOrg(db, organizationId, input.clientId);
  if (input.legalMatterId) await assertMatterInOrg(db, organizationId, input.legalMatterId);
  if (input.sourceDraftId) await assertDraftInOrg(db, organizationId, input.sourceDraftId);

  const [row] = await db
    .update(contracts)
    .set({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.legalMatterId !== undefined ? { legalMatterId: input.legalMatterId ?? null } : {}),
      ...(input.clientId !== undefined ? { clientId: input.clientId ?? null } : {}),
      ...(input.contractTemplateId !== undefined
        ? { contractTemplateId: input.contractTemplateId ?? null }
        : {}),
      ...(input.contractType !== undefined ? { contractType: input.contractType } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.effectiveDate !== undefined
        ? { effectiveDate: parseDate(input.effectiveDate) ?? null }
        : {}),
      ...(input.expirationDate !== undefined
        ? { expirationDate: parseDate(input.expirationDate) ?? null }
        : {}),
      ...(input.indefiniteTerm !== undefined ? { indefiniteTerm: input.indefiniteTerm } : {}),
      ...(input.renewalType !== undefined ? { renewalType: input.renewalType } : {}),
      ...(input.renewalNoticeDays !== undefined
        ? { renewalNoticeDays: input.renewalNoticeDays ?? null }
        : {}),
      ...(input.governingLaw !== undefined ? { governingLaw: input.governingLaw ?? null } : {}),
      ...(input.jurisdiction !== undefined ? { jurisdiction: input.jurisdiction ?? null } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
      ...(input.totalValueCents !== undefined
        ? { totalValueCents: input.totalValueCents ?? null }
        : {}),
      ...(input.sourceDraftId !== undefined ? { sourceDraftId: input.sourceDraftId ?? null } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(contracts.id, contractId), eq(contracts.organizationId, organizationId)))
    .returning();

  if (input.status === "archived") {
    await auditContract(db, account, organizationId, "contract.archived", contractId, meta);
    await recordTimeline(db, {
      organizationId,
      contractId,
      eventType: "archived",
      summary: "Contrato arquivado.",
      actorMembershipId: null,
    });
  }

  return { contract: serializeContract(row ?? existing) };
}

export async function createContractVersion(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  contractId: string,
  input: {
    sourceDraftId?: string;
    documentId?: string;
    documentVersionId?: string;
    contentSnapshot?: string;
    clauseSnapshot?: unknown[];
    status?: (typeof contractVersions.$inferSelect)["status"];
  },
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyContractVersion(access, "contract.create"),
  );
  await requireContractRow(db, organizationId, contractId);
  if (input.status === "signed") {
    throw new AppError("VALIDATION_ERROR", "Versão assinada exige fluxo de assinatura.");
  }
  if (input.sourceDraftId) await assertDraftInOrg(db, organizationId, input.sourceDraftId);
  if (input.contentSnapshot) assertNoEvalInContent(input.contentSnapshot, "contentSnapshot");

  const maxRow = await db
    .select({ max: sql<number>`coalesce(max(${contractVersions.version}), 0)` })
    .from(contractVersions)
    .where(eq(contractVersions.contractId, contractId));
  const nextVersion = (maxRow[0]?.max ?? 0) + 1;

  const [row] = await db
    .insert(contractVersions)
    .values({
      organizationId,
      contractId,
      version: nextVersion,
      sourceDraftId: input.sourceDraftId ?? null,
      documentId: input.documentId ?? null,
      documentVersionId: input.documentVersionId ?? null,
      contentSnapshot: input.contentSnapshot ? sanitizeClauseContent(input.contentSnapshot) : null,
      clauseSnapshot: input.clauseSnapshot ?? null,
      status: input.status ?? "draft",
      createdByMembershipId: membership.membershipId,
    })
    .returning();

  await db
    .update(contracts)
    .set({ currentVersionId: row!.id, updatedAt: new Date() })
    .where(eq(contracts.id, contractId));

  await auditContract(db, account, organizationId, "contract.version_created", contractId, meta, {
    versionId: row!.id,
    version: nextVersion,
  });
  await recordTimeline(db, {
    organizationId,
    contractId,
    eventType: "version_created",
    summary: `Versão ${nextVersion} criada.`,
    actorMembershipId: membership.membershipId,
  });

  return { version: serializeVersion(row!) };
}

export async function listContractVersions(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  contractId: string,
  query: { limit: number; offset: number },
) {
  authorize(account, organizationId, (access) => policyContractVersion(access, "contract.read"));
  await requireContractRow(db, organizationId, contractId);
  const where = and(
    eq(contractVersions.contractId, contractId),
    eq(contractVersions.organizationId, organizationId),
  );
  const [items, totalRow] = await Promise.all([
    db.query.contractVersions.findMany({
      where,
      orderBy: desc(contractVersions.version),
      limit: query.limit,
      offset: query.offset,
    }),
    db.select({ total: count() }).from(contractVersions).where(where),
  ]);
  return {
    items: items.map(serializeVersion),
    total: totalRow[0]?.total ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function createContractParty(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  contractId: string,
  input: {
    partyRole?: (typeof contractParties.$inferSelect)["partyRole"];
    displayName: string;
    documentReference?: string;
    representative?: string;
    clientId?: string;
    signingOrder?: number;
    signerRequired?: boolean;
    email?: string;
    phone?: string;
  },
  meta: RequestMeta,
) {
  const membership = requirePermission(account, organizationId, "contract.manage_parties");
  await requireContractRow(db, organizationId, contractId);
  if (input.clientId) await assertClientInOrg(db, organizationId, input.clientId);

  const [row] = await db
    .insert(contractParties)
    .values({
      organizationId,
      contractId,
      partyRole: input.partyRole ?? "other",
      displayName: input.displayName,
      documentReference: input.documentReference ?? null,
      representative: input.representative ?? null,
      clientId: input.clientId ?? null,
      signingOrder: input.signingOrder ?? 1,
      signerRequired: input.signerRequired ?? true,
      email: input.email ?? null,
      phone: input.phone ?? null,
    })
    .returning();

  await auditContract(db, account, organizationId, "contract.party_added", contractId, meta, {
    partyId: row!.id,
  });
  await recordTimeline(db, {
    organizationId,
    contractId,
    eventType: "party_added",
    summary: `Parte adicionada: ${row!.displayName}.`,
    actorMembershipId: membership.membershipId,
  });

  return { party: row };
}

export async function listContractParties(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  contractId: string,
  query: { limit: number; offset: number },
) {
  authorize(account, organizationId, (access) => policyContract(access, "contract.read"));
  await requireContractRow(db, organizationId, contractId);
  const where = and(
    eq(contractParties.contractId, contractId),
    eq(contractParties.organizationId, organizationId),
  );
  const items = await db.query.contractParties.findMany({
    where,
    orderBy: asc(contractParties.signingOrder),
    limit: query.limit,
    offset: query.offset,
  });
  const totalRow = await db.select({ total: count() }).from(contractParties).where(where);
  return { items, total: totalRow[0]?.total ?? 0, limit: query.limit, offset: query.offset };
}

export async function createContractClauseInstance(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  contractId: string,
  input: {
    contractVersionId?: string;
    clauseId?: string;
    sortOrder?: number;
    key: string;
    title: string;
    contentSnapshot: string;
    variablesSnapshot?: Record<string, unknown>;
    negotiated?: boolean;
  },
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyContractClause(access, "contract.manage_clauses"),
  );
  const contract = await requireContractRow(db, organizationId, contractId);
  const versionId = input.contractVersionId ?? contract.currentVersionId;
  if (!versionId) throw new AppError("CONFLICT", "O contrato não possui versão atual.");
  const version = await requireVersionRow(db, organizationId, contractId, versionId);
  await assertVersionMutable(version);

  assertNoEvalInContent(input.contentSnapshot, "contentSnapshot");
  const content = sanitizeClauseContent(input.contentSnapshot);

  const [row] = await db
    .insert(contractClauseInstances)
    .values({
      organizationId,
      contractVersionId: versionId,
      clauseId: input.clauseId ?? null,
      sortOrder: input.sortOrder ?? 0,
      key: input.key,
      title: input.title,
      contentSnapshot: content,
      variablesSnapshot: input.variablesSnapshot ?? null,
      negotiated: input.negotiated ?? false,
    })
    .returning();

  await auditContract(db, account, organizationId, "contract.clause_changed", contractId, meta, {
    clauseInstanceId: row!.id,
  });
  await recordTimeline(db, {
    organizationId,
    contractId,
    eventType: "clause_changed",
    summary: `Cláusula ${input.key} adicionada/atualizada na versão.`,
    actorMembershipId: membership.membershipId,
  });

  return { clauseInstance: row };
}

export async function listContractClauseInstances(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  contractId: string,
) {
  authorize(account, organizationId, (access) => policyContract(access, "contract.read"));
  const contract = await requireContractRow(db, organizationId, contractId);
  if (!contract.currentVersionId)
    return { items: [] as (typeof contractClauseInstances.$inferSelect)[] };
  const items = await db.query.contractClauseInstances.findMany({
    where: and(
      eq(contractClauseInstances.contractVersionId, contract.currentVersionId),
      eq(contractClauseInstances.organizationId, organizationId),
    ),
    orderBy: asc(contractClauseInstances.sortOrder),
  });
  return { items };
}

export async function createContractApproval(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  contractId: string,
  input: {
    contractVersionId: string;
    approverMembershipId: string;
    approvalType?: (typeof contractApprovals.$inferSelect)["approvalType"];
    status?: (typeof contractApprovals.$inferSelect)["status"];
    comment?: string;
    sequenceOrder?: number;
  },
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyContractApproval(access, "contract.review"),
  );
  await requireContractRow(db, organizationId, contractId);
  await requireVersionRow(db, organizationId, contractId, input.contractVersionId);

  const [row] = await db
    .insert(contractApprovals)
    .values({
      organizationId,
      contractId,
      contractVersionId: input.contractVersionId,
      approverMembershipId: input.approverMembershipId,
      approvalType: input.approvalType ?? "single",
      status: input.status ?? "pending",
      comment: input.comment ?? null,
      sequenceOrder: input.sequenceOrder ?? 1,
    })
    .returning();

  await auditContract(
    db,
    account,
    organizationId,
    "contract.approval_requested",
    contractId,
    meta,
    {
      approvalId: row!.id,
    },
  );
  await recordTimeline(db, {
    organizationId,
    contractId,
    eventType: "approval_requested",
    summary: "Aprovação solicitada.",
    actorMembershipId: membership.membershipId,
  });

  return { approval: row };
}

export async function updateContractApproval(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  contractId: string,
  approvalId: string,
  input: {
    status?: (typeof contractApprovals.$inferSelect)["status"];
    comment?: string | null;
    decidedAt?: string;
  },
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyContractApproval(access, "contract.approve"),
  );
  const approval = await db.query.contractApprovals.findFirst({
    where: and(
      eq(contractApprovals.id, approvalId),
      eq(contractApprovals.contractId, contractId),
      eq(contractApprovals.organizationId, organizationId),
    ),
  });
  if (!approval) throw new AppError("NOT_FOUND", "Não encontramos esta aprovação.");

  const [row] = await db
    .update(contractApprovals)
    .set({
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.comment !== undefined ? { comment: input.comment } : {}),
      ...(input.decidedAt !== undefined ? { decidedAt: parseDate(input.decidedAt) ?? null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(contractApprovals.id, approvalId))
    .returning();

  if (input.status === "approved") {
    await auditContract(db, account, organizationId, "contract.approved", contractId, meta, {
      approvalId,
    });
    await recordTimeline(db, {
      organizationId,
      contractId,
      eventType: "approved",
      summary: "Contrato aprovado.",
      actorMembershipId: membership.membershipId,
    });
  }

  return { approval: row };
}

export async function listContractApprovals(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  contractId: string,
  query: { limit: number; offset: number },
) {
  authorize(account, organizationId, (access) => policyContractApproval(access, "contract.read"));
  await requireContractRow(db, organizationId, contractId);
  const where = and(
    eq(contractApprovals.contractId, contractId),
    eq(contractApprovals.organizationId, organizationId),
  );
  const items = await db.query.contractApprovals.findMany({
    where,
    orderBy: asc(contractApprovals.sequenceOrder),
    limit: query.limit,
    offset: query.offset,
  });
  const totalRow = await db.select({ total: count() }).from(contractApprovals).where(where);
  return { items, total: totalRow[0]?.total ?? 0, limit: query.limit, offset: query.offset };
}

export async function createSignatureRequest(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  contractId: string,
  input: {
    contractVersionId: string;
    providerKey?: string;
    externalEnvelopeId?: string;
    status?: (typeof signatureRequests.$inferSelect)["status"];
    expiresAt?: string;
    evidenceDocumentId?: string;
    certificateMetadata?: Record<string, unknown>;
  },
  meta: RequestMeta,
  deps: ContractsModuleDeps,
) {
  const membership = authorize(account, organizationId, (access) =>
    policySignatureRequest(access, "contract.request_signature"),
  );
  const contract = await requireContractRow(db, organizationId, contractId);
  await requireVersionRow(db, organizationId, contractId, input.contractVersionId);

  const envelope = await deps.signatureProvider.createEnvelope({
    contractId,
    contractVersionId: input.contractVersionId,
    title: contract.title,
    expiresAt: input.expiresAt ?? null,
  });

  const status =
    envelope.status === "not_configured"
      ? "not_configured"
      : (input.status ?? envelope.status ?? "draft");

  const [row] = await db
    .insert(signatureRequests)
    .values({
      organizationId,
      contractId,
      contractVersionId: input.contractVersionId,
      providerKey: envelope.providerKey ?? input.providerKey ?? "not_configured",
      externalEnvelopeId: envelope.externalEnvelopeId ?? input.externalEnvelopeId ?? null,
      status,
      expiresAt: parseDate(input.expiresAt) ?? null,
      evidenceDocumentId: input.evidenceDocumentId ?? null,
      certificateMetadata: input.certificateMetadata ?? null,
      createdByMembershipId: membership.membershipId,
    })
    .returning();

  await auditContract(
    db,
    account,
    organizationId,
    "contract.signature_requested",
    contractId,
    meta,
    {
      signatureRequestId: row!.id,
      providerStatus: status,
    },
  );
  await recordTimeline(db, {
    organizationId,
    contractId,
    eventType: "signature_requested",
    summary:
      status === "not_configured"
        ? "Solicitação de assinatura criada (provedor não configurado)."
        : "Solicitação de assinatura criada.",
    actorMembershipId: membership.membershipId,
  });

  return {
    signatureRequest: row,
    providerMessage:
      status === "not_configured"
        ? "Provedor de assinatura não configurado. Nenhuma assinatura eletrônica foi registrada."
        : undefined,
  };
}

export async function sendSignatureRequest(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  contractId: string,
  signatureRequestId: string,
  meta: RequestMeta,
  deps: ContractsModuleDeps,
) {
  authorize(account, organizationId, (access) =>
    policySignatureRequest(access, "contract.request_signature"),
  );
  const request = await db.query.signatureRequests.findFirst({
    where: and(
      eq(signatureRequests.id, signatureRequestId),
      eq(signatureRequests.contractId, contractId),
      eq(signatureRequests.organizationId, organizationId),
    ),
  });
  if (!request) throw new AppError("NOT_FOUND", "Não encontramos esta solicitação de assinatura.");

  const envelope = request.externalEnvelopeId
    ? await deps.signatureProvider.send({ externalEnvelopeId: request.externalEnvelopeId })
    : await deps.signatureProvider.createEnvelope({
        contractId,
        contractVersionId: request.contractVersionId,
        title: "Contrato",
      });

  const status = envelope.status === "not_configured" ? "not_configured" : envelope.status;
  const now = new Date();

  const [row] = await db
    .update(signatureRequests)
    .set({
      status,
      providerKey: envelope.providerKey,
      externalEnvelopeId: envelope.externalEnvelopeId,
      ...(status !== "not_configured" ? { sentAt: now } : {}),
      updatedAt: now,
    })
    .where(eq(signatureRequests.id, signatureRequestId))
    .returning();

  if (status === "not_configured") {
    return {
      signatureRequest: row,
      message:
        "Provedor de assinatura não configurado. A solicitação permanece sem envio eletrônico e não foi marcada como assinada.",
      signed: false,
    };
  }

  await db
    .update(contracts)
    .set({ status: "pending_signature", updatedAt: now })
    .where(eq(contracts.id, contractId));

  return { signatureRequest: row, signed: false };
}

export async function listSignatureRequests(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  contractId: string,
  query: { limit: number; offset: number },
) {
  authorize(account, organizationId, (access) => policySignatureRequest(access, "contract.read"));
  await requireContractRow(db, organizationId, contractId);
  const where = and(
    eq(signatureRequests.contractId, contractId),
    eq(signatureRequests.organizationId, organizationId),
  );
  const items = await db.query.signatureRequests.findMany({
    where,
    orderBy: desc(signatureRequests.createdAt),
    limit: query.limit,
    offset: query.offset,
  });
  const totalRow = await db.select({ total: count() }).from(signatureRequests).where(where);
  return { items, total: totalRow[0]?.total ?? 0, limit: query.limit, offset: query.offset };
}

export async function recordManualSignature(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  contractId: string,
  input: {
    contractVersionId: string;
    contractPartyId?: string;
    signedAt: string;
    evidenceDocumentId: string;
    method?: (typeof manualSignatureRecords.$inferSelect)["method"];
    notes?: string;
  },
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policySignatureRequest(access, "contract.record_signature"),
  );
  await requireContractRow(db, organizationId, contractId);
  const version = await requireVersionRow(db, organizationId, contractId, input.contractVersionId);
  await assertVersionMutable(version);
  await requireDocumentInOrg(db, organizationId, input.evidenceDocumentId);

  const [row] = await db
    .insert(manualSignatureRecords)
    .values({
      organizationId,
      contractId,
      contractVersionId: input.contractVersionId,
      contractPartyId: input.contractPartyId ?? null,
      signedAt: new Date(input.signedAt),
      evidenceDocumentId: input.evidenceDocumentId,
      method: input.method ?? "manual",
      recordedByMembershipId: membership.membershipId,
      notes: input.notes ?? null,
    })
    .returning();

  await auditContract(
    db,
    account,
    organizationId,
    "contract.signature_recorded",
    contractId,
    meta,
    {
      manualSignatureId: row!.id,
      label: MANUAL_SIGNATURE_LABEL,
      electronicProvider: false,
    },
  );
  await recordTimeline(db, {
    organizationId,
    contractId,
    eventType: "signature_recorded",
    summary: MANUAL_SIGNATURE_LABEL,
    actorMembershipId: membership.membershipId,
    metadata: { method: row!.method, electronicProvider: false },
  });

  await syncSignatureCompletion(
    db,
    organizationId,
    contractId,
    input.contractVersionId,
    membership.membershipId,
    meta,
    account,
  );

  return {
    manualSignature: row,
    label: MANUAL_SIGNATURE_LABEL,
    electronicProviderSignature: false,
  };
}

export async function createContractRenewal(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  contractId: string,
  input: {
    renewalType?: (typeof contractRenewals.$inferSelect)["renewalType"];
    noticeDate?: string;
    proposedNewExpiration?: string;
    status?: (typeof contractRenewals.$inferSelect)["status"];
    documentId?: string;
    approvalId?: string;
    notes?: string;
  },
  meta: RequestMeta,
) {
  const membership = requirePermission(account, organizationId, "contract.manage_renewal");
  await requireContractRow(db, organizationId, contractId);

  const [row] = await db
    .insert(contractRenewals)
    .values({
      organizationId,
      contractId,
      renewalType: input.renewalType ?? "manual",
      noticeDate: parseDate(input.noticeDate) ?? null,
      proposedNewExpiration: parseDate(input.proposedNewExpiration) ?? null,
      status: input.status ?? "draft",
      documentId: input.documentId ?? null,
      approvalId: input.approvalId ?? null,
      notes: input.notes ?? null,
    })
    .returning();

  await auditContract(db, account, organizationId, "contract.renewal_started", contractId, meta, {
    renewalId: row!.id,
  });
  await recordTimeline(db, {
    organizationId,
    contractId,
    eventType: "renewal_started",
    summary: "Processo de renovação iniciado.",
    actorMembershipId: membership.membershipId,
  });

  return { renewal: row };
}

export async function completeContractRenewal(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  contractId: string,
  renewalId: string,
  meta: RequestMeta,
) {
  const membership = requirePermission(account, organizationId, "contract.manage_renewal");
  const renewal = await db.query.contractRenewals.findFirst({
    where: and(
      eq(contractRenewals.id, renewalId),
      eq(contractRenewals.contractId, contractId),
      eq(contractRenewals.organizationId, organizationId),
    ),
  });
  if (!renewal) throw new AppError("NOT_FOUND", "Não encontramos esta renovação.");

  const [row] = await db
    .update(contractRenewals)
    .set({ status: "completed", updatedAt: new Date() })
    .where(eq(contractRenewals.id, renewalId))
    .returning();

  if (renewal.proposedNewExpiration) {
    await db
      .update(contracts)
      .set({
        expirationDate: renewal.proposedNewExpiration,
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(contracts.id, contractId));
  }

  await auditContract(db, account, organizationId, "contract.renewed", contractId, meta, {
    renewalId,
  });
  await recordTimeline(db, {
    organizationId,
    contractId,
    eventType: "renewed",
    summary: "Contrato renovado.",
    actorMembershipId: membership.membershipId,
  });

  return { renewal: row };
}

export async function listContractRenewals(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  contractId: string,
  query: { limit: number; offset: number },
) {
  authorize(account, organizationId, (access) => policyContract(access, "contract.read"));
  await requireContractRow(db, organizationId, contractId);
  const where = and(
    eq(contractRenewals.contractId, contractId),
    eq(contractRenewals.organizationId, organizationId),
  );
  const items = await db.query.contractRenewals.findMany({
    where,
    orderBy: desc(contractRenewals.createdAt),
    limit: query.limit,
    offset: query.offset,
  });
  const totalRow = await db.select({ total: count() }).from(contractRenewals).where(where);
  return { items, total: totalRow[0]?.total ?? 0, limit: query.limit, offset: query.offset };
}

export async function createContractTermination(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  contractId: string,
  input: {
    terminationType?: (typeof contractTerminations.$inferSelect)["terminationType"];
    requestedAt: string;
    effectiveAt?: string;
    reason?: string;
    noticePeriodDays?: number;
    penaltyCents?: number;
    status?: (typeof contractTerminations.$inferSelect)["status"];
    sourceDocumentId?: string;
  },
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyContractTermination(access, "contract.terminate"),
  );
  await requireContractRow(db, organizationId, contractId);

  const [row] = await db
    .insert(contractTerminations)
    .values({
      organizationId,
      contractId,
      terminationType: input.terminationType ?? "other",
      requestedAt: new Date(input.requestedAt),
      effectiveAt: parseDate(input.effectiveAt) ?? null,
      reason: input.reason ?? null,
      noticePeriodDays: input.noticePeriodDays ?? null,
      penaltyCents: input.penaltyCents ?? null,
      status: input.status ?? "draft",
      sourceDocumentId: input.sourceDocumentId ?? null,
    })
    .returning();

  await auditContract(
    db,
    account,
    organizationId,
    "contract.termination_started",
    contractId,
    meta,
    {
      terminationId: row!.id,
    },
  );
  await recordTimeline(db, {
    organizationId,
    contractId,
    eventType: "termination_started",
    summary: "Processo de rescisão iniciado.",
    actorMembershipId: membership.membershipId,
  });

  return { termination: row };
}

export async function effectiveContractTermination(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  contractId: string,
  terminationId: string,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyContractTermination(access, "contract.terminate"),
  );
  const termination = await db.query.contractTerminations.findFirst({
    where: and(
      eq(contractTerminations.id, terminationId),
      eq(contractTerminations.contractId, contractId),
      eq(contractTerminations.organizationId, organizationId),
    ),
  });
  if (!termination) throw new AppError("NOT_FOUND", "Não encontramos esta rescisão.");

  const effectiveAt = termination.effectiveAt ?? new Date();
  const [row] = await db
    .update(contractTerminations)
    .set({ status: "effective", effectiveAt, updatedAt: new Date() })
    .where(eq(contractTerminations.id, terminationId))
    .returning();

  await db
    .update(contracts)
    .set({
      status: "terminated",
      terminationDate: effectiveAt,
      updatedAt: new Date(),
    })
    .where(eq(contracts.id, contractId));

  await auditContract(db, account, organizationId, "contract.terminated", contractId, meta, {
    terminationId,
  });
  await recordTimeline(db, {
    organizationId,
    contractId,
    eventType: "terminated",
    summary: "Contrato rescindido.",
    actorMembershipId: null,
  });

  return { termination: row };
}

export async function listContractTerminations(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  contractId: string,
  query: { limit: number; offset: number },
) {
  authorize(account, organizationId, (access) => policyContract(access, "contract.read"));
  await requireContractRow(db, organizationId, contractId);
  const where = and(
    eq(contractTerminations.contractId, contractId),
    eq(contractTerminations.organizationId, organizationId),
  );
  const items = await db.query.contractTerminations.findMany({
    where,
    orderBy: desc(contractTerminations.createdAt),
    limit: query.limit,
    offset: query.offset,
  });
  const totalRow = await db.select({ total: count() }).from(contractTerminations).where(where);
  return { items, total: totalRow[0]?.total ?? 0, limit: query.limit, offset: query.offset };
}

export async function createContractObligation(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  contractId: string,
  input: {
    contractPartyId?: string;
    sourceClauseInstanceId?: string;
    description: string;
    dueDate?: string;
    recurrence?: string;
    amountCents?: number;
    status?: (typeof contractObligations.$inferSelect)["status"];
  },
  meta: RequestMeta,
) {
  requirePermission(account, organizationId, "contract.manage_obligations");
  await requireContractRow(db, organizationId, contractId);

  const [row] = await db
    .insert(contractObligations)
    .values({
      organizationId,
      contractId,
      contractPartyId: input.contractPartyId ?? null,
      sourceClauseInstanceId: input.sourceClauseInstanceId ?? null,
      description: input.description,
      dueDate: parseDate(input.dueDate) ?? null,
      recurrence: input.recurrence ?? null,
      amountCents: input.amountCents ?? null,
      status: input.status ?? "open",
    })
    .returning();

  await auditContract(
    db,
    account,
    organizationId,
    "contract.obligation_created",
    contractId,
    meta,
    {
      obligationId: row!.id,
    },
  );

  return { obligation: row };
}

export async function listContractObligations(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  contractId: string,
  query: { limit: number; offset: number },
) {
  authorize(account, organizationId, (access) => policyContract(access, "contract.read"));
  await requireContractRow(db, organizationId, contractId);
  const where = and(
    eq(contractObligations.contractId, contractId),
    eq(contractObligations.organizationId, organizationId),
  );
  const items = await db.query.contractObligations.findMany({
    where,
    orderBy: asc(contractObligations.dueDate),
    limit: query.limit,
    offset: query.offset,
  });
  const totalRow = await db.select({ total: count() }).from(contractObligations).where(where);
  return { items, total: totalRow[0]?.total ?? 0, limit: query.limit, offset: query.offset };
}

export async function createContractAmendment(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  contractId: string,
  input: {
    amendmentType?: string;
    effectiveDate?: string;
    changedClauses?: unknown[];
    documentId?: string;
    approvalStatus?: (typeof contractAmendments.$inferSelect)["approvalStatus"];
    signatureStatus?: (typeof contractAmendments.$inferSelect)["signatureStatus"];
    status?: (typeof contractAmendments.$inferSelect)["status"];
    notes?: string;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) => policyContract(access, "contract.update"));
  await requireContractRow(db, organizationId, contractId);

  const maxRow = await db
    .select({ max: sql<number>`coalesce(max(${contractAmendments.version}), 0)` })
    .from(contractAmendments)
    .where(eq(contractAmendments.parentContractId, contractId));
  const nextVersion = (maxRow[0]?.max ?? 0) + 1;

  const [row] = await db
    .insert(contractAmendments)
    .values({
      organizationId,
      parentContractId: contractId,
      version: nextVersion,
      amendmentType: input.amendmentType ?? "other",
      effectiveDate: parseDate(input.effectiveDate) ?? null,
      changedClauses: input.changedClauses ?? null,
      documentId: input.documentId ?? null,
      approvalStatus: input.approvalStatus ?? "pending",
      signatureStatus: input.signatureStatus ?? "draft",
      status: input.status ?? "draft",
      notes: input.notes ?? null,
    })
    .returning();

  await auditContract(db, account, organizationId, "contract.amendment_created", contractId, meta, {
    amendmentId: row!.id,
  });

  return { amendment: row };
}

export async function listContractAmendments(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  contractId: string,
) {
  authorize(account, organizationId, (access) => policyContract(access, "contract.read"));
  await requireContractRow(db, organizationId, contractId);
  const items = await db.query.contractAmendments.findMany({
    where: and(
      eq(contractAmendments.parentContractId, contractId),
      eq(contractAmendments.organizationId, organizationId),
    ),
    orderBy: desc(contractAmendments.version),
  });
  return { items };
}

export async function getContractTimeline(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  contractId: string,
) {
  authorize(account, organizationId, (access) => policyContract(access, "contract.read"));
  await requireContractRow(db, organizationId, contractId);
  const items = await db.query.contractTimelineEvents.findMany({
    where: and(
      eq(contractTimelineEvents.contractId, contractId),
      eq(contractTimelineEvents.organizationId, organizationId),
    ),
    orderBy: desc(contractTimelineEvents.createdAt),
  });
  return { items };
}

/* ─── Templates, clause library, approval policies ─── */

export async function listContractTemplates(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { q?: string; active?: boolean; contractType?: string; limit: number; offset: number },
) {
  authorize(account, organizationId, (access) => policyContract(access, "contract.read"));
  const filters: SQL[] = [
    or(eq(contractTemplates.organizationId, organizationId), eq(contractTemplates.isSystem, true))!,
  ];
  if (query.active !== undefined) filters.push(eq(contractTemplates.active, query.active));
  if (query.contractType) filters.push(eq(contractTemplates.contractType, query.contractType));
  if (query.q) filters.push(ilike(contractTemplates.title, `%${escapeLike(query.q)}%`));
  const where = and(...filters);
  const items = await db.query.contractTemplates.findMany({
    where,
    orderBy: desc(contractTemplates.updatedAt),
    limit: query.limit,
    offset: query.offset,
  });
  const totalRow = await db.select({ total: count() }).from(contractTemplates).where(where);
  return { items, total: totalRow[0]?.total ?? 0, limit: query.limit, offset: query.offset };
}

export async function createContractTemplate(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    title: string;
    legalDocumentTemplateId?: string;
    contractType?: string;
    active?: boolean;
    metadata?: Record<string, unknown>;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) => policyContract(access, "contract.create"));
  const [row] = await db
    .insert(contractTemplates)
    .values({
      organizationId,
      title: input.title,
      legalDocumentTemplateId: input.legalDocumentTemplateId ?? null,
      contractType: input.contractType ?? "other",
      active: input.active ?? true,
      metadata: input.metadata ?? null,
    })
    .returning();
  await auditContract(db, account, organizationId, "contract.template_created", row!.id, meta);
  return { template: row };
}

export async function listContractClausesLibrary(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { q?: string; category?: string; active?: boolean; limit: number; offset: number },
) {
  authorize(account, organizationId, (access) => policyContractClause(access, "contract.read"));
  const filters: SQL[] = [
    or(eq(contractClauses.organizationId, organizationId), eq(contractClauses.source, "system"))!,
  ];
  if (query.category) filters.push(eq(contractClauses.category, query.category));
  if (query.active !== undefined) filters.push(eq(contractClauses.active, query.active));
  if (query.q) {
    filters.push(
      or(
        ilike(contractClauses.title, `%${escapeLike(query.q)}%`),
        ilike(contractClauses.key, `%${escapeLike(query.q)}%`),
      )!,
    );
  }
  const where = and(...filters);
  const items = await db.query.contractClauses.findMany({
    where,
    orderBy: desc(contractClauses.updatedAt),
    limit: query.limit,
    offset: query.offset,
  });
  const totalRow = await db.select({ total: count() }).from(contractClauses).where(where);
  return { items, total: totalRow[0]?.total ?? 0, limit: query.limit, offset: query.offset };
}

export async function createContractClauseLibrary(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    key: string;
    title: string;
    category?: string;
    content: string;
    version?: string;
    source?: (typeof contractClauses.$inferSelect)["source"];
    active?: boolean;
    riskLevel?: string;
    locked?: boolean;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyContractClause(access, "contract.manage_clauses"),
  );
  assertNoEvalInContent(input.content);
  const content = sanitizeClauseContent(input.content);

  const [row] = await db
    .insert(contractClauses)
    .values({
      organizationId,
      key: input.key,
      title: input.title,
      category: input.category ?? "general",
      content,
      version: input.version ?? "1",
      source: input.source ?? "organization",
      active: input.active ?? true,
      riskLevel: input.riskLevel ?? null,
      locked: input.locked ?? false,
    })
    .returning();

  await auditContract(
    db,
    account,
    organizationId,
    "contract.clause_library_created",
    row!.id,
    meta,
  );
  return { clause: row };
}

export async function listContractApprovalPolicies(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { limit: number; offset: number },
) {
  authorize(account, organizationId, (access) => policyContractApproval(access, "contract.read"));
  const where = eq(contractApprovalPolicies.organizationId, organizationId);
  const items = await db.query.contractApprovalPolicies.findMany({
    where,
    orderBy: desc(contractApprovalPolicies.updatedAt),
    limit: query.limit,
    offset: query.offset,
  });
  const totalRow = await db.select({ total: count() }).from(contractApprovalPolicies).where(where);
  return { items, total: totalRow[0]?.total ?? 0, limit: query.limit, offset: query.offset };
}

export async function createContractApprovalPolicy(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    name: string;
    approvalType?: (typeof contractApprovalPolicies.$inferSelect)["approvalType"];
    minValueCents?: number;
    contractType?: string;
    department?: string;
    riskLevel?: string;
    requireSecondApprover?: boolean;
    active?: boolean;
    metadata?: Record<string, unknown>;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) => policyContractApproval(access, "contract.review"));
  const [row] = await db
    .insert(contractApprovalPolicies)
    .values({
      organizationId,
      name: input.name,
      approvalType: input.approvalType ?? "single",
      minValueCents: input.minValueCents ?? null,
      contractType: input.contractType ?? null,
      department: input.department ?? null,
      riskLevel: input.riskLevel ?? null,
      requireSecondApprover: input.requireSecondApprover ?? false,
      active: input.active ?? true,
      metadata: input.metadata ?? null,
    })
    .returning();
  await auditContract(
    db,
    account,
    organizationId,
    "contract.approval_policy_created",
    row!.id,
    meta,
  );
  return { policy: row };
}

export async function markContractExpired(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  contractId: string,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) => policyContract(access, "contract.update"));
  const contract = await requireContractRow(db, organizationId, contractId);
  if (!contract.expirationDate) {
    throw new AppError("VALIDATION_ERROR", "Contrato sem data de expiração.");
  }
  await db
    .update(contracts)
    .set({ status: "expired", updatedAt: new Date() })
    .where(eq(contracts.id, contractId));
  await recordTimeline(db, {
    organizationId,
    contractId,
    eventType: "expired",
    summary: "Contrato expirado.",
    actorMembershipId: null,
  });
  return { contractId, status: "expired" as const };
}
