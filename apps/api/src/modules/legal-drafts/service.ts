import {
  type AIGateway,
  type LegalDraftFeature,
  LEGAL_DRAFT_FEATURE_INSTRUCTIONS,
  LEGAL_DRAFT_FEATURES,
  assertSuggestedCitationsFromSourceIds,
  createDocumentExportProvider,
  formatMissingVariableMarker,
  legalDraftOutputSchema,
  type LegalDraftOutput,
} from "@verasjuris/ai";
import { recordAudit } from "@verasjuris/audit";
import {
  assertLegalDraftTransition,
  assertLegalDraftTransitionGuards,
  policyLegalDraft,
  policyLegalWorkflow,
  type LegalDraftWorkflowStatus,
  type SessionAccount,
} from "@verasjuris/auth";
import {
  type AppDatabase,
  legalCitations,
  legalDocumentDraftVersions,
  legalDocumentDrafts,
  legalDocumentWorkflowHistory,
  legalDraftChecklistItems,
  legalDraftChecklists,
  legalDraftSourceSetItems,
  legalDraftSourceSets,
  legalMatters,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { LEGAL_DRAFT_CHECKLIST_ITEM_KEYS } from "@verasjuris/validation";
import { and, asc, count, desc, eq, ilike, inArray, max, type SQL } from "drizzle-orm";
import {
  recordAiNotConfigured,
  recordInProcessJob,
  runStructuredAi,
  type AiRunContext,
} from "../ai/runner.js";
import { authorize, escapeLike, iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";
import {
  assertCanReadDocument,
  createDocument,
  requireDocumentInOrg,
  uploadDocumentVersion,
  type DocumentModuleDeps,
} from "../documents/service.js";
import {
  loadAccessibleTemplateVersion,
  resolveTemplateContent,
} from "../legal-templates/service.js";

export type LegalDraftDeps = { db: AppDatabase; gateway: AIGateway };

const MISSING_VAR_RE = /⟦MISSING_VARIABLE:([^\]]+)⟧/g;

const CHECKLIST_LABELS: Record<(typeof LEGAL_DRAFT_CHECKLIST_ITEM_KEYS)[number], string> = {
  competence: "Competência",
  parties: "Partes",
  power_of_attorney: "Procuração",
  documents: "Documentos",
  claims: "Pedidos",
  amounts: "Valores",
  citations: "Citações",
  signature: "Assinatura",
  attachments: "Anexos",
  deadline: "Prazo",
  review: "Revisão",
  approval: "Aprovação",
};

const DOCUMENT_TYPE_TO_FEATURE: Partial<Record<string, LegalDraftFeature>> = {
  initial_petition: "legal_draft.initial_petition",
  defense: "legal_draft.defense",
  reply: "legal_draft.reply",
  motion: "legal_draft.motion",
  appeal: "legal_draft.appeal",
  counter_arguments: "legal_draft.counter_arguments",
  legal_opinion: "legal_draft.opinion",
  administrative_request: "legal_draft.admin_request",
  contract: "legal_draft.contract",
  notice: "legal_draft.notice",
};

const MANUAL_FILING_LABEL = "Protocolo informado manualmente";

function serializeDraft(row: typeof legalDocumentDrafts.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    legalMatterId: row.legalMatterId,
    judicialProcessId: row.judicialProcessId,
    administrativeProcessId: row.administrativeProcessId,
    clientId: row.clientId,
    templateId: row.templateId,
    templateVersionId: row.templateVersionId,
    documentType: row.documentType,
    title: row.title,
    status: row.status,
    content: row.content,
    structuredData: row.structuredData,
    aiRequestId: row.aiRequestId,
    sourceSetId: row.sourceSetId,
    currentDocumentId: row.currentDocumentId,
    reviewedByMembershipId: row.reviewedByMembershipId,
    reviewedAt: iso(row.reviewedAt),
    reviewComment: row.reviewComment,
    approvedByMembershipId: row.approvedByMembershipId,
    approvedAt: iso(row.approvedAt),
    filedAt: iso(row.filedAt),
    filedByMembershipId: row.filedByMembershipId,
    filingMethod: row.filingMethod,
    filingMethodLabel:
      row.filingMethod === "manual" ? MANUAL_FILING_LABEL : (row.filingMethod ?? null),
    protocolNumber: row.protocolNumber,
    evidenceDocumentId: row.evidenceDocumentId,
    filingNotes: row.filingNotes,
    confirmationEvidenceDocumentId: row.confirmationEvidenceDocumentId,
    confirmedAt: iso(row.confirmedAt),
    confirmedByMembershipId: row.confirmedByMembershipId,
    confirmationMethod: row.confirmationMethod,
    createdByMembershipId: row.createdByMembershipId,
    updatedByMembershipId: row.updatedByMembershipId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeDraftVersion(row: typeof legalDocumentDraftVersions.$inferSelect) {
  return {
    id: row.id,
    draftId: row.draftId,
    version: row.version,
    content: row.content,
    structuredData: row.structuredData,
    status: row.status,
    changeSummary: row.changeSummary,
    createdByMembershipId: row.createdByMembershipId,
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeHistory(row: typeof legalDocumentWorkflowHistory.$inferSelect) {
  return {
    id: row.id,
    draftId: row.draftId,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    actorMembershipId: row.actorMembershipId,
    reason: row.reason,
    evidenceDocumentId: row.evidenceDocumentId,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeChecklistItem(row: typeof legalDraftChecklistItems.$inferSelect) {
  return {
    id: row.id,
    checklistId: row.checklistId,
    itemKey: row.itemKey,
    label: row.label,
    category: row.category,
    required: row.required,
    status: row.status,
    sortOrder: row.sortOrder,
    notes: row.notes,
    completedByMembershipId: row.completedByMembershipId,
    completedAt: iso(row.completedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeSourceSet(row: typeof legalDraftSourceSets.$inferSelect) {
  return {
    id: row.id,
    draftId: row.draftId,
    name: row.name,
    createdByMembershipId: row.createdByMembershipId,
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeSourceItem(row: typeof legalDraftSourceSetItems.$inferSelect) {
  return {
    id: row.id,
    sourceSetId: row.sourceSetId,
    itemType: row.itemType,
    referenceId: row.referenceId,
    documentId: row.documentId,
    documentVersionId: row.documentVersionId,
    instructionText: row.instructionText,
    sortOrder: row.sortOrder,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
  };
}

async function requireDraft(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  draftId: string,
  permission: Parameters<typeof policyLegalDraft>[1] = "legal_draft.read",
) {
  authorize(account, organizationId, (access) => policyLegalDraft(access, permission));
  const row = await db.query.legalDocumentDrafts.findFirst({
    where: and(
      eq(legalDocumentDrafts.id, draftId),
      eq(legalDocumentDrafts.organizationId, organizationId),
    ),
  });
  if (!row) {
    throw new AppError("NOT_FOUND", "Não encontramos esta minuta no seu acesso.");
  }
  return row;
}

async function nextDraftVersionNumber(db: AppDatabase, draftId: string): Promise<number> {
  const [row] = await db
    .select({ value: max(legalDocumentDraftVersions.version) })
    .from(legalDocumentDraftVersions)
    .where(eq(legalDocumentDraftVersions.draftId, draftId));
  return (row?.value ?? 0) + 1;
}

async function saveDraftVersion(
  db: AppDatabase,
  organizationId: string,
  draft: typeof legalDocumentDrafts.$inferSelect,
  membershipId: string,
  changeSummary?: string,
) {
  const version = await nextDraftVersionNumber(db, draft.id);
  const [row] = await db
    .insert(legalDocumentDraftVersions)
    .values({
      organizationId,
      draftId: draft.id,
      version,
      content: draft.content,
      structuredData: draft.structuredData,
      status: draft.status,
      changeSummary: changeSummary ?? null,
      createdByMembershipId: membershipId,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível salvar a versão da minuta.");
  return row;
}

async function recordWorkflowHistory(
  db: AppDatabase,
  input: {
    organizationId: string;
    draftId: string;
    fromStatus: LegalDraftWorkflowStatus | null;
    toStatus: LegalDraftWorkflowStatus;
    actorMembershipId: string;
    reason?: string | null;
    evidenceDocumentId?: string | null;
    metadata?: Record<string, unknown> | null;
  },
) {
  await db.insert(legalDocumentWorkflowHistory).values({
    organizationId: input.organizationId,
    draftId: input.draftId,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    actorMembershipId: input.actorMembershipId,
    reason: input.reason ?? null,
    evidenceDocumentId: input.evidenceDocumentId ?? null,
    metadata: input.metadata ?? null,
  });
}

async function createDefaultChecklist(
  db: AppDatabase,
  organizationId: string,
  draftId: string,
  membershipId: string,
) {
  const [checklist] = await db
    .insert(legalDraftChecklists)
    .values({
      organizationId,
      draftId,
      name: "Checklist pré-protocolo",
      isTemplate: false,
      active: true,
      createdByMembershipId: membershipId,
    })
    .returning();
  if (!checklist) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o checklist.");

  await db.insert(legalDraftChecklistItems).values(
    LEGAL_DRAFT_CHECKLIST_ITEM_KEYS.map((itemKey, index) => ({
      organizationId,
      checklistId: checklist.id,
      itemKey,
      label: CHECKLIST_LABELS[itemKey],
      category: "pre_filing",
      required: true,
      status: "pending" as const,
      sortOrder: index,
    })),
  );

  return checklist;
}

function extractMissingVariables(content: string | null | undefined): string[] {
  if (!content) return [];
  const found = new Set<string>();
  for (const match of content.matchAll(MISSING_VAR_RE)) {
    if (match[1]) found.add(match[1]);
  }
  return [...found];
}

function justifiedMissingKeys(
  structuredData: Record<string, unknown> | null | undefined,
): Set<string> {
  const raw = structuredData?.justifiedMissingVariables;
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.filter((item): item is string => typeof item === "string"));
}

async function checklistReadiness(
  db: AppDatabase,
  organizationId: string,
  draftId: string,
): Promise<{ hasBlocking: boolean; criticalIncomplete: boolean }> {
  const checklists = await db.query.legalDraftChecklists.findMany({
    where: and(
      eq(legalDraftChecklists.organizationId, organizationId),
      eq(legalDraftChecklists.draftId, draftId),
      eq(legalDraftChecklists.active, true),
    ),
  });
  if (checklists.length === 0) {
    return { hasBlocking: false, criticalIncomplete: false };
  }
  const items = await db.query.legalDraftChecklistItems.findMany({
    where: and(
      eq(legalDraftChecklistItems.organizationId, organizationId),
      inArray(
        legalDraftChecklistItems.checklistId,
        checklists.map((item) => item.id),
      ),
    ),
  });
  const hasBlocking = items.some((item) => item.status === "blocked");
  const criticalIncomplete = items.some(
    (item) => item.required && item.status !== "done" && item.status !== "not_applicable",
  );
  return { hasBlocking, criticalIncomplete };
}

async function loadDraftBundle(db: AppDatabase, organizationId: string, draftId: string) {
  const [versions, history, checklists, sourceSet] = await Promise.all([
    db.query.legalDocumentDraftVersions.findMany({
      where: and(
        eq(legalDocumentDraftVersions.draftId, draftId),
        eq(legalDocumentDraftVersions.organizationId, organizationId),
      ),
      orderBy: [desc(legalDocumentDraftVersions.version)],
    }),
    db.query.legalDocumentWorkflowHistory.findMany({
      where: and(
        eq(legalDocumentWorkflowHistory.draftId, draftId),
        eq(legalDocumentWorkflowHistory.organizationId, organizationId),
      ),
      orderBy: [asc(legalDocumentWorkflowHistory.createdAt)],
    }),
    db.query.legalDraftChecklists.findMany({
      where: and(
        eq(legalDraftChecklists.draftId, draftId),
        eq(legalDraftChecklists.organizationId, organizationId),
      ),
    }),
    db.query.legalDocumentDrafts
      .findFirst({
        where: and(
          eq(legalDocumentDrafts.id, draftId),
          eq(legalDocumentDrafts.organizationId, organizationId),
        ),
        columns: { sourceSetId: true },
      })
      .then(async (draft) => {
        if (!draft?.sourceSetId) return null;
        const set = await db.query.legalDraftSourceSets.findFirst({
          where: and(
            eq(legalDraftSourceSets.id, draft.sourceSetId),
            eq(legalDraftSourceSets.organizationId, organizationId),
          ),
        });
        if (!set) return null;
        const items = await db.query.legalDraftSourceSetItems.findMany({
          where: and(
            eq(legalDraftSourceSetItems.sourceSetId, set.id),
            eq(legalDraftSourceSetItems.organizationId, organizationId),
          ),
          orderBy: [asc(legalDraftSourceSetItems.sortOrder), asc(legalDraftSourceSetItems.id)],
        });
        return { ...serializeSourceSet(set), items: items.map(serializeSourceItem) };
      }),
  ]);

  const checklistIds = checklists.map((item) => item.id);
  const checklistItems =
    checklistIds.length === 0
      ? []
      : await db.query.legalDraftChecklistItems.findMany({
          where: and(
            eq(legalDraftChecklistItems.organizationId, organizationId),
            inArray(legalDraftChecklistItems.checklistId, checklistIds),
          ),
          orderBy: [asc(legalDraftChecklistItems.sortOrder), asc(legalDraftChecklistItems.id)],
        });

  return {
    versions: versions.map(serializeDraftVersion),
    history: history.map(serializeHistory),
    checklists: checklists.map((checklist) => ({
      id: checklist.id,
      name: checklist.name,
      isTemplate: checklist.isTemplate,
      active: checklist.active,
      items: checklistItems
        .filter((item) => item.checklistId === checklist.id)
        .map(serializeChecklistItem),
    })),
    sourceSet,
  };
}

export async function listLegalDrafts(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: {
    q?: string | undefined;
    status?: string | undefined;
    documentType?: string | undefined;
    legalMatterId?: string | undefined;
    judicialProcessId?: string | undefined;
    administrativeProcessId?: string | undefined;
    clientId?: string | undefined;
    templateId?: string | undefined;
    limit: number;
    offset: number;
  },
) {
  authorize(account, organizationId, (access) => policyLegalDraft(access, "legal_draft.read"));

  const filters: SQL[] = [eq(legalDocumentDrafts.organizationId, organizationId)];
  if (query.status) {
    filters.push(
      eq(
        legalDocumentDrafts.status,
        query.status as typeof legalDocumentDrafts.$inferSelect.status,
      ),
    );
  }
  if (query.documentType) {
    filters.push(
      eq(
        legalDocumentDrafts.documentType,
        query.documentType as typeof legalDocumentDrafts.$inferSelect.documentType,
      ),
    );
  }
  if (query.legalMatterId) filters.push(eq(legalDocumentDrafts.legalMatterId, query.legalMatterId));
  if (query.judicialProcessId) {
    filters.push(eq(legalDocumentDrafts.judicialProcessId, query.judicialProcessId));
  }
  if (query.administrativeProcessId) {
    filters.push(eq(legalDocumentDrafts.administrativeProcessId, query.administrativeProcessId));
  }
  if (query.clientId) filters.push(eq(legalDocumentDrafts.clientId, query.clientId));
  if (query.templateId) filters.push(eq(legalDocumentDrafts.templateId, query.templateId));
  if (query.q) {
    filters.push(ilike(legalDocumentDrafts.title, `%${escapeLike(query.q)}%`));
  }

  const where = and(...filters);
  const [rows, totalRow] = await Promise.all([
    db.query.legalDocumentDrafts.findMany({
      where,
      orderBy: [desc(legalDocumentDrafts.updatedAt), desc(legalDocumentDrafts.id)],
      limit: query.limit,
      offset: query.offset,
    }),
    db.select({ value: count() }).from(legalDocumentDrafts).where(where),
  ]);

  return {
    drafts: rows.map(serializeDraft),
    total: totalRow[0]?.value ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function getLegalDraft(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  draftId: string,
) {
  const draft = await requireDraft(db, account, organizationId, draftId);
  const bundle = await loadDraftBundle(db, organizationId, draftId);
  return {
    draft: serializeDraft(draft),
    ...bundle,
    missingVariables: extractMissingVariables(draft.content),
  };
}

export async function createLegalDraft(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    title: string;
    documentType: string;
    legalMatterId?: string | undefined;
    judicialProcessId?: string | undefined;
    administrativeProcessId?: string | undefined;
    clientId?: string | undefined;
    templateId?: string | undefined;
    templateVersionId?: string | undefined;
    content?: string | undefined;
    structuredData?: Record<string, unknown> | undefined;
    variableValues?: Record<string, unknown> | undefined;
    sourceSetId?: string | undefined;
  },
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyLegalDraft(access, "legal_draft.create"),
  );

  if (input.legalMatterId) {
    const matter = await db.query.legalMatters.findFirst({
      where: and(
        eq(legalMatters.id, input.legalMatterId),
        eq(legalMatters.organizationId, organizationId),
      ),
    });
    if (!matter) {
      throw new AppError("NOT_FOUND", "Não encontramos este caso no seu acesso.");
    }
  }

  if (input.sourceSetId) {
    const sourceSet = await db.query.legalDraftSourceSets.findFirst({
      where: and(
        eq(legalDraftSourceSets.id, input.sourceSetId),
        eq(legalDraftSourceSets.organizationId, organizationId),
      ),
    });
    if (!sourceSet) {
      throw new AppError("NOT_FOUND", "Não encontramos este conjunto de fontes no seu acesso.");
    }
  }

  let content = input.content ?? "";
  let structuredData: Record<string, unknown> = {
    ...(input.structuredData ?? {}),
    ...(input.variableValues ? { variableValues: input.variableValues } : {}),
  };
  let templateId: string | null = input.templateId ?? null;
  let templateVersionId: string | null = input.templateVersionId ?? null;
  let documentType = input.documentType;
  let missingVariables: string[] = [];

  // Geração SEM IA: resolve variáveis do template no conteúdo.
  if (input.templateId) {
    const { template, version } = await loadAccessibleTemplateVersion(
      db,
      organizationId,
      input.templateId,
      input.templateVersionId,
    );
    templateId = template.id;
    templateVersionId = version.id;
    documentType = template.templateType;
    const resolved = resolveTemplateContent(
      version.content,
      version.variableSchema,
      input.variableValues,
    );
    if (resolved.blockedExpressions.length > 0) {
      throw new AppError(
        "VALIDATION_ERROR",
        "O modelo contém expressões de variável inválidas.",
        resolved.blockedExpressions.map((expression) => ({
          path: "template",
          message: `Expressão bloqueada: ${expression}`,
        })),
      );
    }
    content = input.content ?? resolved.rendered;
    missingVariables = resolved.missingVariables;
    structuredData = {
      ...structuredData,
      variableSchema: version.variableSchema,
      originalTemplateContent: version.content,
      missingVariables,
      generatedWithoutAi: true,
      contentFormat: version.contentFormat,
    };
  }

  const created = await db.transaction(async (tx) => {
    const [draft] = await tx
      .insert(legalDocumentDrafts)
      .values({
        organizationId,
        legalMatterId: input.legalMatterId ?? null,
        judicialProcessId: input.judicialProcessId ?? null,
        administrativeProcessId: input.administrativeProcessId ?? null,
        clientId: input.clientId ?? null,
        templateId,
        templateVersionId,
        documentType: documentType as typeof legalDocumentDrafts.$inferInsert.documentType,
        title: input.title,
        status: "draft",
        content,
        structuredData,
        sourceSetId: input.sourceSetId ?? null,
        createdByMembershipId: membership.membershipId,
        updatedByMembershipId: membership.membershipId,
      })
      .returning();
    if (!draft) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a minuta.");

    await tx.insert(legalDocumentDraftVersions).values({
      organizationId,
      draftId: draft.id,
      version: 1,
      content: draft.content,
      structuredData: draft.structuredData,
      status: "draft",
      changeSummary: templateId ? "Gerado a partir de modelo (sem IA)" : "Criação inicial",
      createdByMembershipId: membership.membershipId,
    });

    await createDefaultChecklist(
      tx as unknown as AppDatabase,
      organizationId,
      draft.id,
      membership.membershipId,
    );

    await recordWorkflowHistory(tx as unknown as AppDatabase, {
      organizationId,
      draftId: draft.id,
      fromStatus: null,
      toStatus: "draft",
      actorMembershipId: membership.membershipId,
      reason: "Criação da minuta",
      metadata: { generatedWithoutAi: Boolean(templateId), missingVariables },
    });

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "legal_draft.created",
      resourceType: "legal_document_draft",
      resourceId: draft.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: {
        title: draft.title,
        documentType: draft.documentType,
        templateId,
        generatedWithoutAi: Boolean(templateId),
      },
    });

    return draft;
  });

  return getLegalDraft(db, account, organizationId, created.id);
}

export async function updateLegalDraft(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  draftId: string,
  input: {
    title?: string | undefined;
    documentType?: string | undefined;
    content?: string | null | undefined;
    structuredData?: Record<string, unknown> | null | undefined;
    variableValues?: Record<string, unknown> | undefined;
    reviewComment?: string | null | undefined;
  },
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyLegalDraft(access, "legal_draft.update"),
  );
  const draft = await requireDraft(db, account, organizationId, draftId, "legal_draft.update");

  if (["filed", "confirmed", "archived", "cancelled"].includes(draft.status)) {
    throw new AppError("CONFLICT", "Esta minuta não pode mais ser editada neste status.");
  }

  let nextContent = input.content !== undefined ? input.content : draft.content;
  let nextStructured: Record<string, unknown> | null =
    input.structuredData !== undefined
      ? input.structuredData
      : ((draft.structuredData as Record<string, unknown> | null) ?? null);

  if (input.variableValues && draft.templateVersionId && draft.content) {
    const schema =
      (nextStructured?.variableSchema as Record<string, unknown> | undefined) ??
      ((draft.structuredData as Record<string, unknown> | null)?.variableSchema as
        | Record<string, unknown>
        | undefined) ??
      {};
    // Re-resolve only if explicit content not provided and we have template content stored via schema.
    if (
      input.content === undefined &&
      typeof nextStructured?.originalTemplateContent === "string"
    ) {
      const resolved = resolveTemplateContent(
        nextStructured.originalTemplateContent as string,
        schema,
        input.variableValues,
      );
      nextContent = resolved.rendered;
      nextStructured = {
        ...(nextStructured ?? {}),
        variableValues: input.variableValues,
        missingVariables: resolved.missingVariables,
      };
    } else {
      nextStructured = {
        ...(nextStructured ?? {}),
        variableValues: {
          ...((nextStructured?.variableValues as Record<string, unknown> | undefined) ?? {}),
          ...input.variableValues,
        },
      };
    }
  }

  const contentChanged = nextContent !== draft.content;
  const significant =
    contentChanged || input.structuredData !== undefined || input.variableValues !== undefined;

  const [updated] = await db
    .update(legalDocumentDrafts)
    .set({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.documentType !== undefined
        ? {
            documentType:
              input.documentType as typeof legalDocumentDrafts.$inferInsert.documentType,
          }
        : {}),
      ...(input.content !== undefined || input.variableValues ? { content: nextContent } : {}),
      ...(nextStructured !== draft.structuredData ? { structuredData: nextStructured } : {}),
      ...(input.reviewComment !== undefined ? { reviewComment: input.reviewComment } : {}),
      updatedByMembershipId: membership.membershipId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(legalDocumentDrafts.id, draftId),
        eq(legalDocumentDrafts.organizationId, organizationId),
      ),
    )
    .returning();
  if (!updated) throw new AppError("NOT_FOUND", "Não encontramos esta minuta no seu acesso.");

  if (significant) {
    await saveDraftVersion(
      db,
      organizationId,
      updated,
      membership.membershipId,
      "Edição significativa",
    );
  }

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "legal_draft.updated",
    resourceType: "legal_document_draft",
    resourceId: draftId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });

  return getLegalDraft(db, account, organizationId, draftId);
}

export async function createLegalDraftVersion(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  draftId: string,
  input: {
    content?: string | undefined;
    structuredData?: Record<string, unknown> | undefined;
    changeSummary?: string | undefined;
  },
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyLegalDraft(access, "legal_draft.update"),
  );
  const draft = await requireDraft(db, account, organizationId, draftId, "legal_draft.update");

  const [updated] = await db
    .update(legalDocumentDrafts)
    .set({
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.structuredData !== undefined ? { structuredData: input.structuredData } : {}),
      updatedByMembershipId: membership.membershipId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(legalDocumentDrafts.id, draftId),
        eq(legalDocumentDrafts.organizationId, organizationId),
      ),
    )
    .returning();
  if (!updated) throw new AppError("NOT_FOUND", "Não encontramos esta minuta no seu acesso.");

  const version = await saveDraftVersion(
    db,
    organizationId,
    updated,
    membership.membershipId,
    input.changeSummary ?? "Versão manual",
  );

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "legal_draft.version_created",
    resourceType: "legal_document_draft_version",
    resourceId: version.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });

  return { version: serializeDraftVersion(version), draft: serializeDraft(updated) };
}

export async function createLegalDraftSourceSet(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    name?: string | undefined;
    draftId?: string | undefined;
    items: Array<{
      itemType: string;
      referenceId?: string | undefined;
      documentId?: string | undefined;
      documentVersionId?: string | undefined;
      instructionText?: string | undefined;
      sortOrder: number;
      metadata?: Record<string, unknown> | undefined;
    }>;
  },
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyLegalDraft(access, "legal_draft.create"),
  );

  if (input.draftId) {
    await requireDraft(db, account, organizationId, input.draftId, "legal_draft.update");
  }

  for (const item of input.items) {
    if (item.documentId) {
      const doc = await requireDocumentInOrg(db, organizationId, item.documentId);
      await assertCanReadDocument(db, account, organizationId, doc);
    }
  }

  const created = await db.transaction(async (tx) => {
    const [set] = await tx
      .insert(legalDraftSourceSets)
      .values({
        organizationId,
        draftId: input.draftId ?? null,
        name: input.name ?? null,
        createdByMembershipId: membership.membershipId,
      })
      .returning();
    if (!set) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o conjunto de fontes.");

    const items =
      input.items.length === 0
        ? []
        : await tx
            .insert(legalDraftSourceSetItems)
            .values(
              input.items.map((item) => ({
                organizationId,
                sourceSetId: set.id,
                itemType: item.itemType as typeof legalDraftSourceSetItems.$inferInsert.itemType,
                referenceId: item.referenceId ?? null,
                documentId: item.documentId ?? null,
                documentVersionId: item.documentVersionId ?? null,
                instructionText: item.instructionText ?? null,
                sortOrder: item.sortOrder,
                metadata: item.metadata ?? null,
              })),
            )
            .returning();

    if (input.draftId) {
      await tx
        .update(legalDocumentDrafts)
        .set({ sourceSetId: set.id, updatedAt: new Date() })
        .where(
          and(
            eq(legalDocumentDrafts.id, input.draftId),
            eq(legalDocumentDrafts.organizationId, organizationId),
          ),
        );
    }

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "legal_draft.source_set_created",
      resourceType: "legal_draft_source_set",
      resourceId: set.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { itemCount: items.length, draftId: input.draftId ?? null },
    });

    return { set, items };
  });

  return {
    sourceSet: {
      ...serializeSourceSet(created.set),
      items: created.items.map(serializeSourceItem),
    },
  };
}

async function verifiedCitationIdsFromSourceSet(
  db: AppDatabase,
  organizationId: string,
  sourceSetId: string | null,
): Promise<string[]> {
  if (!sourceSetId) return [];
  const items = await db.query.legalDraftSourceSetItems.findMany({
    where: and(
      eq(legalDraftSourceSetItems.sourceSetId, sourceSetId),
      eq(legalDraftSourceSetItems.organizationId, organizationId),
      eq(legalDraftSourceSetItems.itemType, "citation"),
    ),
  });
  const citationIds = items
    .map((item) => item.referenceId)
    .filter((id): id is string => typeof id === "string");
  if (citationIds.length === 0) return [];

  const citations = await db.query.legalCitations.findMany({
    where: and(
      inArray(legalCitations.id, citationIds),
      eq(legalCitations.organizationId, organizationId),
    ),
  });

  return citations
    .filter(
      (citation) =>
        citation.verificationStatus === "verified" ||
        citation.verificationStatus === "source_available",
    )
    .map((citation) => citation.id);
}

function composeAiSections(output: LegalDraftOutput): string {
  return [
    output.sections.addressing,
    output.sections.qualification,
    output.sections.facts,
    output.sections.grounds,
    output.sections.provisional_relief,
    output.sections.claims,
    output.sections.evidence,
    output.sections.final_requests,
    output.sections.closing,
    output.sections.signature_metadata,
  ]
    .filter((part) => part && part.trim().length > 0)
    .join("\n\n");
}

export async function aiAssistLegalDraft(
  deps: LegalDraftDeps,
  account: SessionAccount,
  organizationId: string,
  draftId: string,
  input: { instructions?: string | undefined; idempotencyKey?: string | undefined },
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyLegalDraft(access, "legal_draft.ai_assist"),
  );
  const draft = await requireDraft(
    deps.db,
    account,
    organizationId,
    draftId,
    "legal_draft.ai_assist",
  );

  if (!["draft", "ai_assisted", "human_review"].includes(draft.status)) {
    throw new AppError("CONFLICT", "Assistência de IA não está disponível neste status da minuta.");
  }

  const feature = DOCUMENT_TYPE_TO_FEATURE[draft.documentType];
  if (!feature || !LEGAL_DRAFT_FEATURES.includes(feature)) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Assistência de IA não está disponível para o tipo de documento “${draft.documentType}”.`,
    );
  }

  const ctx: AiRunContext = {
    db: deps.db,
    gateway: deps.gateway,
    account,
    organizationId,
    membershipId: membership.membershipId,
    meta,
  };
  const inputReference = `legal_draft:${draftId}`;

  // Se IA não configurada: status permanece; erro honesto NOT_CONFIGURED.
  if (deps.gateway.describe().status === "not_configured") {
    await recordInProcessJob(deps.db, {
      organizationId,
      membershipId: membership.membershipId,
      jobType: "legal_draft.ai_assist",
      resourceType: "legal_document_draft",
      resourceId: draftId,
      status: "not_configured",
      errorCode: "AI_PROVIDER_NOT_CONFIGURED",
    });
    await recordAiNotConfigured(ctx, { feature, inputReference });
  }

  const allowedSourceIds = await verifiedCitationIdsFromSourceSet(
    deps.db,
    organizationId,
    draft.sourceSetId,
  );

  const promptParts = [
    `Título: ${draft.title}`,
    `Tipo: ${draft.documentType}`,
    draft.content ? `Conteúdo atual:\n${draft.content}` : "",
    input.instructions ? `Instruções do usuário:\n${input.instructions}` : "",
    `sourceIds verificados (suggestedCitations só destes): ${JSON.stringify(allowedSourceIds)}`,
  ].filter(Boolean);

  try {
    const outcome = await runStructuredAi(ctx, {
      feature,
      promptKey: feature,
      defaultInstructions: LEGAL_DRAFT_FEATURE_INSTRUCTIONS[feature],
      input: promptParts.join("\n\n"),
      inputLabel: `minuta:${draft.documentType}`,
      inputReference,
      schema: legalDraftOutputSchema,
      schemaName: "LegalDraft",
      ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
    });

    const output = assertSuggestedCitationsFromSourceIds(outcome.data, allowedSourceIds);
    const composed = composeAiSections(output);
    const fromStatus = draft.status as LegalDraftWorkflowStatus;
    const toStatus: LegalDraftWorkflowStatus =
      fromStatus === "human_review" ? "human_review" : "ai_assisted";

    if (fromStatus !== toStatus) {
      assertLegalDraftTransition(fromStatus, toStatus);
    }

    const [updated] = await deps.db
      .update(legalDocumentDrafts)
      .set({
        content: composed || draft.content,
        structuredData: {
          ...((draft.structuredData as Record<string, unknown> | null) ?? {}),
          aiAssist: output,
          assistive: true,
          appliedToDomain: false,
        },
        aiRequestId: outcome.requestId,
        status: toStatus,
        updatedByMembershipId: membership.membershipId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(legalDocumentDrafts.id, draftId),
          eq(legalDocumentDrafts.organizationId, organizationId),
        ),
      )
      .returning();
    if (!updated)
      throw new AppError("INTERNAL_ERROR", "Não foi possível aplicar a assistência de IA.");

    await saveDraftVersion(
      deps.db,
      organizationId,
      updated,
      membership.membershipId,
      "Assistência de IA (assistiva)",
    );

    if (fromStatus !== toStatus) {
      await recordWorkflowHistory(deps.db, {
        organizationId,
        draftId,
        fromStatus,
        toStatus,
        actorMembershipId: membership.membershipId,
        reason: "Assistência de IA",
        metadata: { aiRequestId: outcome.requestId, feature },
      });
    }

    await recordAudit(deps.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "legal_draft.ai_assisted",
      resourceType: "legal_document_draft",
      resourceId: draftId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { aiRequestId: outcome.requestId, feature, assistive: true },
    });

    await recordInProcessJob(deps.db, {
      organizationId,
      membershipId: membership.membershipId,
      jobType: "legal_draft.ai_assist",
      resourceType: "legal_document_draft",
      resourceId: draftId,
      status: "succeeded",
    });

    return getLegalDraft(deps.db, account, organizationId, draftId);
  } catch (error) {
    if (error instanceof AppError && error.code === "AI_PROVIDER_NOT_CONFIGURED") {
      throw error;
    }
    throw error;
  }
}

type TransitionOptions = {
  reason?: string | undefined;
  evidenceDocumentId?: string | undefined;
  filing?: {
    filedAt: string;
    filingMethod: "manual" | "electronic" | "provider" | "not_configured";
    protocolNumber?: string | undefined;
    evidenceDocumentId?: string | undefined;
    filingNotes?: string | undefined;
  };
  confirmation?: {
    confirmedAt?: string | undefined;
    confirmationMethod: "manual" | "provider";
    confirmationEvidenceDocumentId: string;
    notes?: string | undefined;
  };
  reviewComment?: string | null | undefined;
};

async function transitionDraft(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  draftId: string,
  toStatus: LegalDraftWorkflowStatus,
  permission: Parameters<typeof policyLegalWorkflow>[1],
  meta: RequestMeta,
  options: TransitionOptions = {},
) {
  const membership = authorize(account, organizationId, (access) =>
    policyLegalWorkflow(access, permission),
  );
  const draft = await requireDraft(db, account, organizationId, draftId, permission);
  const fromStatus = draft.status as LegalDraftWorkflowStatus;

  assertLegalDraftTransition(fromStatus, toStatus);

  if (options.evidenceDocumentId) {
    const doc = await requireDocumentInOrg(db, organizationId, options.evidenceDocumentId);
    await assertCanReadDocument(db, account, organizationId, doc);
  }
  if (options.filing?.evidenceDocumentId) {
    const doc = await requireDocumentInOrg(db, organizationId, options.filing.evidenceDocumentId);
    await assertCanReadDocument(db, account, organizationId, doc);
  }
  if (options.confirmation?.confirmationEvidenceDocumentId) {
    const doc = await requireDocumentInOrg(
      db,
      organizationId,
      options.confirmation.confirmationEvidenceDocumentId,
    );
    await assertCanReadDocument(db, account, organizationId, doc);
  }

  const readiness = await checklistReadiness(db, organizationId, draftId);
  const missing = extractMissingVariables(draft.content);
  const justified = justifiedMissingKeys(draft.structuredData as Record<string, unknown> | null);
  const unresolvedMissing = missing.filter((key) => !justified.has(key));

  const approvedBy =
    toStatus === "approved" ? membership.membershipId : draft.approvedByMembershipId;
  const filedAt = options.filing?.filedAt ?? (draft.filedAt ? draft.filedAt.toISOString() : null);
  const filingMethod = options.filing?.filingMethod ?? draft.filingMethod;
  const confirmationEvidenceDocumentId =
    options.confirmation?.confirmationEvidenceDocumentId ?? draft.confirmationEvidenceDocumentId;

  assertLegalDraftTransitionGuards(toStatus, {
    approvedByMembershipId: approvedBy,
    filedAt,
    filingMethod,
    confirmationEvidenceDocumentId,
    hasBlockingChecklistItems: readiness.hasBlocking,
    criticalChecklistIncomplete: readiness.criticalIncomplete,
    hasUnresolvedMissingVariables: unresolvedMissing.length > 0,
  });

  if (toStatus === "filed") {
    if (options.filing?.filingMethod && options.filing.filingMethod !== "manual") {
      throw new AppError(
        "CONFLICT",
        "Somente protocolo manual está disponível (“Protocolo informado manualmente”).",
      );
    }
  }

  const patch: Partial<typeof legalDocumentDrafts.$inferInsert> = {
    status: toStatus,
    updatedByMembershipId: membership.membershipId,
    updatedAt: new Date(),
  };

  if (toStatus === "human_review") {
    patch.reviewedByMembershipId = membership.membershipId;
    patch.reviewedAt = new Date();
    if (options.reviewComment !== undefined) patch.reviewComment = options.reviewComment;
  }
  if (toStatus === "approved") {
    patch.approvedByMembershipId = membership.membershipId;
    patch.approvedAt = new Date();
  }
  if (toStatus === "filed" && options.filing) {
    patch.filedAt = new Date(options.filing.filedAt);
    patch.filedByMembershipId = membership.membershipId;
    patch.filingMethod = "manual";
    patch.protocolNumber = options.filing.protocolNumber ?? null;
    patch.evidenceDocumentId = options.filing.evidenceDocumentId ?? null;
    patch.filingNotes = options.filing.filingNotes ?? null;
  }
  if (toStatus === "confirmed" && options.confirmation) {
    patch.confirmedAt = options.confirmation.confirmedAt
      ? new Date(options.confirmation.confirmedAt)
      : new Date();
    patch.confirmedByMembershipId = membership.membershipId;
    patch.confirmationMethod = options.confirmation.confirmationMethod;
    patch.confirmationEvidenceDocumentId = options.confirmation.confirmationEvidenceDocumentId;
  }
  if (toStatus === "rejected" && options.reviewComment !== undefined) {
    patch.reviewComment = options.reviewComment;
  }

  const [updated] = await db
    .update(legalDocumentDrafts)
    .set(patch)
    .where(
      and(
        eq(legalDocumentDrafts.id, draftId),
        eq(legalDocumentDrafts.organizationId, organizationId),
      ),
    )
    .returning();
  if (!updated)
    throw new AppError("INTERNAL_ERROR", "Não foi possível atualizar o status da minuta.");

  await recordWorkflowHistory(db, {
    organizationId,
    draftId,
    fromStatus,
    toStatus,
    actorMembershipId: membership.membershipId,
    reason: options.reason ?? null,
    evidenceDocumentId:
      options.confirmation?.confirmationEvidenceDocumentId ??
      options.filing?.evidenceDocumentId ??
      options.evidenceDocumentId ??
      null,
    metadata: {
      ...(options.filing ? { filingMethod: "manual", filingMethodLabel: MANUAL_FILING_LABEL } : {}),
      ...(options.confirmation
        ? { confirmationMethod: options.confirmation.confirmationMethod }
        : {}),
    },
  });

  const auditAction =
    toStatus === "approved"
      ? "legal_draft.approved"
      : toStatus === "filed"
        ? "legal_draft.filed"
        : toStatus === "confirmed"
          ? "legal_draft.confirmed"
          : `legal_draft.${toStatus}`;

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: auditAction,
    resourceType: "legal_document_draft",
    resourceId: draftId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { fromStatus, toStatus },
  });

  return getLegalDraft(db, account, organizationId, draftId);
}

export async function submitLegalDraftForReview(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  draftId: string,
  input: { reason?: string | undefined; reviewComment?: string | null | undefined },
  meta: RequestMeta,
) {
  return transitionDraft(
    db,
    account,
    organizationId,
    draftId,
    "human_review",
    "legal_draft.review",
    meta,
    input,
  );
}

export async function approveLegalDraft(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  draftId: string,
  input: { reason?: string | undefined },
  meta: RequestMeta,
) {
  return transitionDraft(
    db,
    account,
    organizationId,
    draftId,
    "approved",
    "legal_draft.approve",
    meta,
    input,
  );
}

export async function markLegalDraftReadyToFile(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  draftId: string,
  input: { reason?: string | undefined },
  meta: RequestMeta,
) {
  return transitionDraft(
    db,
    account,
    organizationId,
    draftId,
    "ready_to_file",
    "legal_draft.ready_to_file",
    meta,
    input,
  );
}

export async function fileLegalDraft(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  draftId: string,
  input: {
    filedAt: string;
    filingMethod?: "manual" | "electronic" | "provider" | "not_configured" | undefined;
    protocolNumber?: string | undefined;
    evidenceDocumentId?: string | undefined;
    filingNotes?: string | undefined;
    reason?: string | undefined;
  },
  meta: RequestMeta,
) {
  return transitionDraft(db, account, organizationId, draftId, "filed", "legal_draft.file", meta, {
    reason: input.reason,
    filing: {
      filedAt: input.filedAt,
      filingMethod: input.filingMethod ?? "manual",
      protocolNumber: input.protocolNumber,
      evidenceDocumentId: input.evidenceDocumentId,
      filingNotes: input.filingNotes,
    },
  });
}

export async function confirmLegalDraftFiling(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  draftId: string,
  input: {
    confirmedAt?: string | undefined;
    confirmationMethod?: "manual" | "provider" | undefined;
    confirmationEvidenceDocumentId: string;
    notes?: string | undefined;
    reason?: string | undefined;
  },
  meta: RequestMeta,
) {
  return transitionDraft(
    db,
    account,
    organizationId,
    draftId,
    "confirmed",
    "legal_draft.confirm",
    meta,
    {
      reason: input.reason ?? input.notes,
      confirmation: {
        confirmedAt: input.confirmedAt,
        confirmationMethod: input.confirmationMethod ?? "manual",
        confirmationEvidenceDocumentId: input.confirmationEvidenceDocumentId,
        notes: input.notes,
      },
    },
  );
}

export async function transitionLegalDraftWorkflow(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  draftId: string,
  input: {
    toStatus: string;
    reason?: string | undefined;
    evidenceDocumentId?: string | undefined;
  },
  meta: RequestMeta,
) {
  const toStatus = input.toStatus as LegalDraftWorkflowStatus;
  const permissionMap: Partial<
    Record<LegalDraftWorkflowStatus, Parameters<typeof policyLegalWorkflow>[1]>
  > = {
    human_review: "legal_draft.review",
    approved: "legal_draft.approve",
    ready_to_file: "legal_draft.ready_to_file",
    filed: "legal_draft.file",
    confirmed: "legal_draft.confirm",
    rejected: "legal_draft.review",
  };
  const permission = permissionMap[toStatus] ?? "legal_draft.review";

  if (toStatus === "filed") {
    throw new AppError(
      "VALIDATION_ERROR",
      "Use o endpoint /file com filedAt e filingMethod para protocolar.",
    );
  }
  if (toStatus === "confirmed") {
    throw new AppError(
      "VALIDATION_ERROR",
      "Use o endpoint /confirm com confirmationEvidenceDocumentId.",
    );
  }

  return transitionDraft(db, account, organizationId, draftId, toStatus, permission, meta, {
    reason: input.reason,
    evidenceDocumentId: input.evidenceDocumentId,
  });
}

export async function updateLegalDraftChecklistItem(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  draftId: string,
  itemId: string,
  input: { status?: string | undefined; notes?: string | null | undefined },
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyLegalDraft(access, "legal_draft.update"),
  );
  await requireDraft(db, account, organizationId, draftId, "legal_draft.update");

  const item = await db.query.legalDraftChecklistItems.findFirst({
    where: and(
      eq(legalDraftChecklistItems.id, itemId),
      eq(legalDraftChecklistItems.organizationId, organizationId),
    ),
  });
  if (!item) {
    throw new AppError("NOT_FOUND", "Não encontramos este item de checklist no seu acesso.");
  }

  const checklist = await db.query.legalDraftChecklists.findFirst({
    where: and(
      eq(legalDraftChecklists.id, item.checklistId),
      eq(legalDraftChecklists.draftId, draftId),
      eq(legalDraftChecklists.organizationId, organizationId),
    ),
  });
  if (!checklist) {
    throw new AppError("NOT_FOUND", "Não encontramos este item de checklist no seu acesso.");
  }

  const done = input.status === "done" || input.status === "not_applicable";
  const [updated] = await db
    .update(legalDraftChecklistItems)
    .set({
      ...(input.status !== undefined
        ? {
            status: input.status as typeof legalDraftChecklistItems.$inferInsert.status,
          }
        : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(done
        ? { completedByMembershipId: membership.membershipId, completedAt: new Date() }
        : input.status
          ? { completedByMembershipId: null, completedAt: null }
          : {}),
      updatedAt: new Date(),
    })
    .where(eq(legalDraftChecklistItems.id, itemId))
    .returning();
  if (!updated) throw new AppError("INTERNAL_ERROR", "Não foi possível atualizar o item.");

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "legal_draft.checklist_item_updated",
    resourceType: "legal_draft_checklist_item",
    resourceId: itemId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { status: updated.status },
  });

  return { item: serializeChecklistItem(updated) };
}

export async function convertLegalDraftToDocument(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  draftId: string,
  documentDeps: DocumentModuleDeps,
  meta: RequestMeta,
  input: { format?: "plain_text" | "html" | undefined } = {},
) {
  authorize(account, organizationId, (access) => policyLegalDraft(access, "legal_draft.update"));
  const draft = await requireDraft(db, account, organizationId, draftId, "legal_draft.update");
  if (!draft.content || draft.content.trim().length === 0) {
    throw new AppError("CONFLICT", "A minuta não possui conteúdo para converter em documento.");
  }

  const format = input.format ?? "plain_text";
  const mime = format === "html" ? "text/html" : "text/plain";
  const extension = format === "html" ? "html" : "txt";
  const body =
    format === "html" && !draft.content.includes("<")
      ? `<pre>${draft.content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`
      : draft.content;

  const ownerType = draft.legalMatterId ? "legal_matter" : "organization";
  const ownerId = draft.legalMatterId ?? organizationId;

  const document = await createDocument(
    db,
    account,
    organizationId,
    {
      title: draft.title,
      description: `Convertido da minuta ${draft.id}`,
      ownerType,
      ownerId,
      status: "draft",
      documentKind: "petition",
      legalContext: draft.legalMatterId ? "matter" : "other",
      metadata: { sourceDraftId: draft.id, convertedFrom: "legal_document_draft" },
    },
    meta,
  );

  const versionResult = await uploadDocumentVersion(
    db,
    account,
    organizationId,
    document.id,
    {
      filename: `${draft.title.slice(0, 80)}.${extension}`,
      mimetype: mime,
      data: Buffer.from(body, "utf8"),
    },
    documentDeps,
    meta,
  );

  await db
    .update(legalDocumentDrafts)
    .set({
      currentDocumentId: document.id,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(legalDocumentDrafts.id, draftId),
        eq(legalDocumentDrafts.organizationId, organizationId),
      ),
    );

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "legal_draft.converted_to_document",
    resourceType: "legal_document_draft",
    resourceId: draftId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { documentId: document.id },
  });

  return {
    draft: serializeDraft({
      ...draft,
      currentDocumentId: document.id,
    }),
    document,
    version: versionResult,
  };
}

export async function exportLegalDraft(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  draftId: string,
  format: "html" | "pdf" | "docx",
) {
  await requireDraft(db, account, organizationId, draftId, "legal_draft.read");
  const draft = await requireDraft(db, account, organizationId, draftId);
  if (!draft.content) {
    throw new AppError("CONFLICT", "A minuta não possui conteúdo para exportar.");
  }

  const html = draft.content.includes("<")
    ? draft.content
    : `<!DOCTYPE html><html><body><pre>${draft.content
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}</pre></body></html>`;

  const provider = createDocumentExportProvider();
  const result = await provider.export({
    html,
    title: draft.title,
    format,
  });

  return {
    format: result.format,
    mimeType: result.mimeType,
    filenameHint: result.filenameHint,
    body:
      typeof result.body === "string" ? result.body : Buffer.from(result.body).toString("base64"),
    encoding: typeof result.body === "string" ? "utf-8" : "base64",
  };
}

export { formatMissingVariableMarker, MANUAL_FILING_LABEL };
