import { TemplateVariableResolver, formatMissingVariableMarker } from "@verasjuris/ai";
import { recordAudit } from "@verasjuris/audit";
import {
  policyLegalTemplate,
  policyLegalTemplateMutation,
  type SessionAccount,
} from "@verasjuris/auth";
import {
  type AppDatabase,
  legalDocumentTemplateVersions,
  legalDocumentTemplates,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, count, desc, eq, ilike, isNull, max, or, sql, type SQL } from "drizzle-orm";
import { authorize, escapeLike, iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";

type VariableField = { key: string; label?: string; type?: string; required?: boolean };

function serializeTemplate(row: typeof legalDocumentTemplates.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    scope: row.scope,
    templateType: row.templateType,
    name: row.name,
    description: row.description,
    legalAreaId: row.legalAreaId,
    jurisdiction: row.jurisdiction,
    documentKind: row.documentKind,
    currentVersionId: row.currentVersionId,
    active: row.active,
    createdByMembershipId: row.createdByMembershipId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeVersion(row: typeof legalDocumentTemplateVersions.$inferSelect) {
  return {
    id: row.id,
    templateId: row.templateId,
    version: row.version,
    content: row.content,
    contentFormat: row.contentFormat,
    variableSchema: row.variableSchema,
    sectionSchema: row.sectionSchema,
    status: row.status,
    changelog: row.changelog,
    createdByMembershipId: row.createdByMembershipId,
    approvedByMembershipId: row.approvedByMembershipId,
    createdAt: row.createdAt.toISOString(),
    activatedAt: iso(row.activatedAt),
  };
}

function fieldsFromSchema(schema: Record<string, unknown> | null | undefined): VariableField[] {
  const fields =
    schema && typeof schema === "object" ? (schema as { fields?: unknown }).fields : null;
  if (!Array.isArray(fields)) return [];
  return fields.filter(
    (item): item is VariableField =>
      Boolean(item) && typeof item === "object" && typeof (item as VariableField).key === "string",
  );
}

function allowedPathsFromSchema(schema: Record<string, unknown> | null | undefined): string[] {
  return fieldsFromSchema(schema).map((field) => field.key);
}

/** Rejeita expressões maliciosas / fora da whitelist no conteúdo do template. */
export function assertSafeTemplateExpressions(
  content: string,
  variableSchema: Record<string, unknown>,
): void {
  const resolver = new TemplateVariableResolver({
    allowedPaths: allowedPathsFromSchema(variableSchema),
  });
  const result = resolver.resolveTemplate(content, {});
  if (result.blockedExpressions.length > 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      "O conteúdo contém expressões de variável inválidas ou não permitidas.",
      result.blockedExpressions.map((expression) => ({
        path: "content",
        message: `Expressão bloqueada: ${expression}`,
      })),
    );
  }
}

async function requireReadableTemplate(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  templateId: string,
) {
  authorize(account, organizationId, (access) =>
    policyLegalTemplate(access, "legal_template.read"),
  );
  const row = await db.query.legalDocumentTemplates.findFirst({
    where: and(
      eq(legalDocumentTemplates.id, templateId),
      or(
        eq(legalDocumentTemplates.organizationId, organizationId),
        and(
          isNull(legalDocumentTemplates.organizationId),
          eq(legalDocumentTemplates.scope, "system"),
        ),
      ),
    ),
  });
  if (!row) {
    throw new AppError("NOT_FOUND", "Não encontramos este modelo no seu acesso.");
  }
  return row;
}

async function requireOrgTemplateForMutation(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  templateId: string,
  permission:
    | "legal_template.update"
    | "legal_template.approve"
    | "legal_template.activate"
    | "legal_template.archive",
) {
  const row = await requireReadableTemplate(db, account, organizationId, templateId);
  authorize(account, organizationId, (access) =>
    policyLegalTemplateMutation(access, permission, row.organizationId, organizationId),
  );
  return row;
}

async function nextTemplateVersion(db: AppDatabase, templateId: string): Promise<number> {
  const [row] = await db
    .select({ value: max(legalDocumentTemplateVersions.version) })
    .from(legalDocumentTemplateVersions)
    .where(eq(legalDocumentTemplateVersions.templateId, templateId));
  return (row?.value ?? 0) + 1;
}

export async function listLegalTemplates(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: {
    q?: string | undefined;
    scope?: "system" | "organization" | undefined;
    templateType?: string | undefined;
    documentKind?: string | undefined;
    legalAreaId?: string | undefined;
    active?: boolean | undefined;
    includeSystem?: boolean | undefined;
    limit: number;
    offset: number;
  },
) {
  authorize(account, organizationId, (access) =>
    policyLegalTemplate(access, "legal_template.read"),
  );

  const includeSystem = query.includeSystem !== false && query.scope !== "organization";
  const scopeFilter: SQL | undefined =
    query.scope === "system"
      ? and(
          isNull(legalDocumentTemplates.organizationId),
          eq(legalDocumentTemplates.scope, "system"),
        )
      : query.scope === "organization"
        ? eq(legalDocumentTemplates.organizationId, organizationId)
        : includeSystem
          ? or(
              eq(legalDocumentTemplates.organizationId, organizationId),
              and(
                isNull(legalDocumentTemplates.organizationId),
                eq(legalDocumentTemplates.scope, "system"),
              ),
            )
          : eq(legalDocumentTemplates.organizationId, organizationId);

  const filters: SQL[] = [scopeFilter as SQL];
  if (query.templateType) {
    filters.push(
      eq(
        legalDocumentTemplates.templateType,
        query.templateType as typeof legalDocumentTemplates.$inferSelect.templateType,
      ),
    );
  }
  if (query.documentKind) {
    filters.push(
      eq(
        legalDocumentTemplates.documentKind,
        query.documentKind as typeof legalDocumentTemplates.$inferSelect.documentKind,
      ),
    );
  }
  if (query.legalAreaId) {
    filters.push(eq(legalDocumentTemplates.legalAreaId, query.legalAreaId));
  }
  if (query.active !== undefined) {
    filters.push(eq(legalDocumentTemplates.active, query.active));
  }
  if (query.q) {
    const pattern = `%${escapeLike(query.q)}%`;
    filters.push(
      or(
        ilike(legalDocumentTemplates.name, pattern),
        ilike(legalDocumentTemplates.description, pattern),
      ) as SQL,
    );
  }

  const where = and(...filters);
  const [rows, totalRow] = await Promise.all([
    db.query.legalDocumentTemplates.findMany({
      where,
      orderBy: [desc(legalDocumentTemplates.updatedAt), desc(legalDocumentTemplates.id)],
      limit: query.limit,
      offset: query.offset,
    }),
    db.select({ value: count() }).from(legalDocumentTemplates).where(where),
  ]);

  return {
    templates: rows.map(serializeTemplate),
    total: totalRow[0]?.value ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function getLegalTemplate(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  templateId: string,
) {
  const row = await requireReadableTemplate(db, account, organizationId, templateId);
  const versions = await db.query.legalDocumentTemplateVersions.findMany({
    where: eq(legalDocumentTemplateVersions.templateId, templateId),
    orderBy: [desc(legalDocumentTemplateVersions.version)],
  });
  const currentVersion = row.currentVersionId
    ? (versions.find((item) => item.id === row.currentVersionId) ?? null)
    : null;
  return {
    template: serializeTemplate(row),
    currentVersion: currentVersion ? serializeVersion(currentVersion) : null,
    versions: versions.map(serializeVersion),
  };
}

export async function createLegalTemplate(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    name: string;
    description?: string | undefined;
    templateType: string;
    documentKind: string;
    legalAreaId?: string | undefined;
    jurisdiction?: string | undefined;
    content: string;
    contentFormat: "html" | "markdown" | "plain_text" | "structured";
    variableSchema: { fields: VariableField[] };
    sectionSchema?: Record<string, unknown> | undefined;
    changelog?: string | undefined;
  },
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyLegalTemplateMutation(access, "legal_template.create", organizationId, organizationId),
  );

  const variableSchema = { fields: input.variableSchema.fields ?? [] };
  assertSafeTemplateExpressions(input.content, variableSchema);

  const result = await db.transaction(async (tx) => {
    const [template] = await tx
      .insert(legalDocumentTemplates)
      .values({
        organizationId,
        scope: "organization",
        templateType: input.templateType as typeof legalDocumentTemplates.$inferInsert.templateType,
        name: input.name,
        description: input.description ?? null,
        legalAreaId: input.legalAreaId ?? null,
        jurisdiction: input.jurisdiction ?? null,
        documentKind: input.documentKind as typeof legalDocumentTemplates.$inferInsert.documentKind,
        active: true,
        createdByMembershipId: membership.membershipId,
      })
      .returning();
    if (!template) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o modelo.");

    const [version] = await tx
      .insert(legalDocumentTemplateVersions)
      .values({
        templateId: template.id,
        version: 1,
        content: input.content,
        contentFormat: input.contentFormat,
        variableSchema,
        sectionSchema: input.sectionSchema ?? null,
        status: "draft",
        changelog: input.changelog ?? null,
        createdByMembershipId: membership.membershipId,
      })
      .returning();
    if (!version)
      throw new AppError("INTERNAL_ERROR", "Não foi possível criar a versão do modelo.");

    const [updated] = await tx
      .update(legalDocumentTemplates)
      .set({ currentVersionId: version.id, updatedAt: new Date() })
      .where(eq(legalDocumentTemplates.id, template.id))
      .returning();

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "legal_template.created",
      resourceType: "legal_document_template",
      resourceId: template.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { name: template.name, templateType: template.templateType, versionId: version.id },
    });

    return { template: updated ?? template, version };
  });

  return {
    template: serializeTemplate(result.template),
    version: serializeVersion(result.version),
  };
}

export async function updateLegalTemplate(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  templateId: string,
  input: {
    name?: string | undefined;
    description?: string | null | undefined;
    templateType?: string | undefined;
    documentKind?: string | undefined;
    legalAreaId?: string | null | undefined;
    jurisdiction?: string | null | undefined;
    active?: boolean | undefined;
  },
  meta: RequestMeta,
) {
  await requireOrgTemplateForMutation(
    db,
    account,
    organizationId,
    templateId,
    "legal_template.update",
  );

  const [updated] = await db
    .update(legalDocumentTemplates)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.templateType !== undefined
        ? {
            templateType:
              input.templateType as typeof legalDocumentTemplates.$inferInsert.templateType,
          }
        : {}),
      ...(input.documentKind !== undefined
        ? {
            documentKind:
              input.documentKind as typeof legalDocumentTemplates.$inferInsert.documentKind,
          }
        : {}),
      ...(input.legalAreaId !== undefined ? { legalAreaId: input.legalAreaId } : {}),
      ...(input.jurisdiction !== undefined ? { jurisdiction: input.jurisdiction } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(legalDocumentTemplates.id, templateId),
        eq(legalDocumentTemplates.organizationId, organizationId),
      ),
    )
    .returning();
  if (!updated) throw new AppError("NOT_FOUND", "Não encontramos este modelo no seu acesso.");

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "legal_template.updated",
    resourceType: "legal_document_template",
    resourceId: templateId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: input,
  });

  return { template: serializeTemplate(updated) };
}

export async function createLegalTemplateVersion(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  templateId: string,
  input: {
    content: string;
    contentFormat: "html" | "markdown" | "plain_text" | "structured";
    variableSchema: { fields: VariableField[] };
    sectionSchema?: Record<string, unknown> | undefined;
    changelog?: string | undefined;
  },
  meta: RequestMeta,
) {
  await requireOrgTemplateForMutation(
    db,
    account,
    organizationId,
    templateId,
    "legal_template.update",
  );
  const membership = authorize(account, organizationId, (access) =>
    policyLegalTemplate(access, "legal_template.update"),
  );

  const variableSchema = { fields: input.variableSchema.fields ?? [] };
  assertSafeTemplateExpressions(input.content, variableSchema);

  const versionNumber = await nextTemplateVersion(db, templateId);
  const [version] = await db
    .insert(legalDocumentTemplateVersions)
    .values({
      templateId,
      version: versionNumber,
      content: input.content,
      contentFormat: input.contentFormat,
      variableSchema,
      sectionSchema: input.sectionSchema ?? null,
      status: "draft",
      changelog: input.changelog ?? null,
      createdByMembershipId: membership.membershipId,
    })
    .returning();
  if (!version) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a versão.");

  await db
    .update(legalDocumentTemplates)
    .set({ updatedAt: new Date() })
    .where(eq(legalDocumentTemplates.id, templateId));

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "legal_template.version_created",
    resourceType: "legal_document_template_version",
    resourceId: version.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { templateId, version: version.version },
  });

  return { version: serializeVersion(version) };
}

export async function listLegalTemplateVersions(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  templateId: string,
) {
  await requireReadableTemplate(db, account, organizationId, templateId);
  const versions = await db.query.legalDocumentTemplateVersions.findMany({
    where: eq(legalDocumentTemplateVersions.templateId, templateId),
    orderBy: [desc(legalDocumentTemplateVersions.version)],
  });
  return { versions: versions.map(serializeVersion) };
}

export async function getLegalTemplateVersion(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  templateId: string,
  versionId: string,
) {
  await requireReadableTemplate(db, account, organizationId, templateId);
  const version = await db.query.legalDocumentTemplateVersions.findFirst({
    where: and(
      eq(legalDocumentTemplateVersions.id, versionId),
      eq(legalDocumentTemplateVersions.templateId, templateId),
    ),
  });
  if (!version) {
    throw new AppError("NOT_FOUND", "Não encontramos esta versão do modelo no seu acesso.");
  }
  return { version: serializeVersion(version) };
}

async function loadVersionForTemplate(db: AppDatabase, templateId: string, versionId: string) {
  const version = await db.query.legalDocumentTemplateVersions.findFirst({
    where: and(
      eq(legalDocumentTemplateVersions.id, versionId),
      eq(legalDocumentTemplateVersions.templateId, templateId),
    ),
  });
  if (!version) {
    throw new AppError("NOT_FOUND", "Não encontramos esta versão do modelo no seu acesso.");
  }
  return version;
}

export async function submitLegalTemplateVersionForReview(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  templateId: string,
  versionId: string,
  meta: RequestMeta,
) {
  await requireOrgTemplateForMutation(
    db,
    account,
    organizationId,
    templateId,
    "legal_template.update",
  );
  const version = await loadVersionForTemplate(db, templateId, versionId);
  if (version.status !== "draft") {
    throw new AppError("CONFLICT", "Somente versões em draft podem ser enviadas para revisão.");
  }
  const [updated] = await db
    .update(legalDocumentTemplateVersions)
    .set({ status: "review" })
    .where(eq(legalDocumentTemplateVersions.id, versionId))
    .returning();
  if (!updated) throw new AppError("INTERNAL_ERROR", "Não foi possível atualizar a versão.");

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "legal_template.submitted_for_review",
    resourceType: "legal_document_template_version",
    resourceId: versionId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });

  return { version: serializeVersion(updated) };
}

export async function approveLegalTemplateVersion(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  templateId: string,
  versionId: string,
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyLegalTemplate(access, "legal_template.approve"),
  );
  await requireOrgTemplateForMutation(
    db,
    account,
    organizationId,
    templateId,
    "legal_template.approve",
  );
  const version = await loadVersionForTemplate(db, templateId, versionId);
  if (version.status !== "review" && version.status !== "draft") {
    throw new AppError("CONFLICT", "Somente versões em review (ou draft) podem ser aprovadas.");
  }
  const [updated] = await db
    .update(legalDocumentTemplateVersions)
    .set({
      status: "approved",
      approvedByMembershipId: membership.membershipId,
    })
    .where(eq(legalDocumentTemplateVersions.id, versionId))
    .returning();
  if (!updated) throw new AppError("INTERNAL_ERROR", "Não foi possível aprovar a versão.");

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "legal_template.approved",
    resourceType: "legal_document_template_version",
    resourceId: versionId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { approvedByMembershipId: membership.membershipId },
  });

  return { version: serializeVersion(updated) };
}

export async function activateLegalTemplateVersion(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  templateId: string,
  versionId: string,
  meta: RequestMeta,
) {
  await requireOrgTemplateForMutation(
    db,
    account,
    organizationId,
    templateId,
    "legal_template.activate",
  );
  const version = await loadVersionForTemplate(db, templateId, versionId);
  if (version.status !== "approved") {
    throw new AppError("CONFLICT", "Somente versões aprovadas podem ser ativadas.");
  }

  const activated = await db.transaction(async (tx) => {
    await tx
      .update(legalDocumentTemplateVersions)
      .set({ status: "deprecated" })
      .where(
        and(
          eq(legalDocumentTemplateVersions.templateId, templateId),
          eq(legalDocumentTemplateVersions.status, "active"),
          sql`${legalDocumentTemplateVersions.id} <> ${versionId}`,
        ),
      );

    const [updated] = await tx
      .update(legalDocumentTemplateVersions)
      .set({ status: "active", activatedAt: new Date() })
      .where(eq(legalDocumentTemplateVersions.id, versionId))
      .returning();
    if (!updated) throw new AppError("INTERNAL_ERROR", "Não foi possível ativar a versão.");

    await tx
      .update(legalDocumentTemplates)
      .set({ currentVersionId: versionId, updatedAt: new Date() })
      .where(eq(legalDocumentTemplates.id, templateId));

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "legal_template.activated",
      resourceType: "legal_document_template_version",
      resourceId: versionId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { templateId, version: updated.version },
    });

    return updated;
  });

  return { version: serializeVersion(activated) };
}

export async function archiveLegalTemplate(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  templateId: string,
  meta: RequestMeta,
) {
  await requireOrgTemplateForMutation(
    db,
    account,
    organizationId,
    templateId,
    "legal_template.archive",
  );

  const [updated] = await db
    .update(legalDocumentTemplates)
    .set({ active: false, updatedAt: new Date() })
    .where(
      and(
        eq(legalDocumentTemplates.id, templateId),
        eq(legalDocumentTemplates.organizationId, organizationId),
      ),
    )
    .returning();
  if (!updated) throw new AppError("NOT_FOUND", "Não encontramos este modelo no seu acesso.");

  await db
    .update(legalDocumentTemplateVersions)
    .set({ status: "archived" })
    .where(
      and(
        eq(legalDocumentTemplateVersions.templateId, templateId),
        sql`${legalDocumentTemplateVersions.status} <> 'archived'`,
      ),
    );

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "legal_template.archived",
    resourceType: "legal_document_template",
    resourceId: templateId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });

  return { template: serializeTemplate(updated) };
}

/**
 * Copia um template SYSTEM para a organização. Nunca edita o SYSTEM in-place.
 */
export async function duplicateSystemTemplateToOrg(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  templateId: string,
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyLegalTemplateMutation(access, "legal_template.create", organizationId, organizationId),
  );

  const source = await db.query.legalDocumentTemplates.findFirst({
    where: and(
      eq(legalDocumentTemplates.id, templateId),
      isNull(legalDocumentTemplates.organizationId),
      eq(legalDocumentTemplates.scope, "system"),
    ),
  });
  if (!source) {
    throw new AppError("NOT_FOUND", "Não encontramos este modelo institucional no seu acesso.");
  }

  const sourceVersion = source.currentVersionId
    ? await db.query.legalDocumentTemplateVersions.findFirst({
        where: eq(legalDocumentTemplateVersions.id, source.currentVersionId),
      })
    : await db.query.legalDocumentTemplateVersions.findFirst({
        where: eq(legalDocumentTemplateVersions.templateId, source.id),
        orderBy: [desc(legalDocumentTemplateVersions.version)],
      });
  if (!sourceVersion) {
    throw new AppError("CONFLICT", "O modelo institucional não possui versão utilizável.");
  }

  const result = await db.transaction(async (tx) => {
    const [template] = await tx
      .insert(legalDocumentTemplates)
      .values({
        organizationId,
        scope: "organization",
        templateType: source.templateType,
        name: source.name,
        description: source.description,
        legalAreaId: source.legalAreaId,
        jurisdiction: source.jurisdiction,
        documentKind: source.documentKind,
        active: true,
        createdByMembershipId: membership.membershipId,
      })
      .returning();
    if (!template) throw new AppError("INTERNAL_ERROR", "Não foi possível duplicar o modelo.");

    const [version] = await tx
      .insert(legalDocumentTemplateVersions)
      .values({
        templateId: template.id,
        version: 1,
        content: sourceVersion.content,
        contentFormat: sourceVersion.contentFormat,
        variableSchema: sourceVersion.variableSchema,
        sectionSchema: sourceVersion.sectionSchema,
        status: "draft",
        changelog: `Duplicado do template institucional ${source.id}`,
        createdByMembershipId: membership.membershipId,
      })
      .returning();
    if (!version) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a versão copiada.");

    const [updated] = await tx
      .update(legalDocumentTemplates)
      .set({ currentVersionId: version.id, updatedAt: new Date() })
      .where(eq(legalDocumentTemplates.id, template.id))
      .returning();

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "legal_template.duplicated_from_system",
      resourceType: "legal_document_template",
      resourceId: template.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { sourceTemplateId: source.id, sourceVersionId: sourceVersion.id },
    });

    return { template: updated ?? template, version };
  });

  return {
    template: serializeTemplate(result.template),
    version: serializeVersion(result.version),
  };
}

/**
 * Preview de variáveis — nunca muta template/versão.
 */
export async function previewLegalTemplateVersion(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  templateId: string,
  versionId: string,
  context: Record<string, unknown>,
) {
  await requireReadableTemplate(db, account, organizationId, templateId);
  const version = await loadVersionForTemplate(db, templateId, versionId);

  const allowedPaths = allowedPathsFromSchema(version.variableSchema);
  const resolver = new TemplateVariableResolver({ allowedPaths });
  const result = resolver.resolveTemplate(version.content, context);

  if (result.blockedExpressions.length > 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      "O conteúdo contém expressões de variável inválidas ou não permitidas.",
      result.blockedExpressions.map((expression) => ({
        path: "content",
        message: `Expressão bloqueada: ${expression}`,
      })),
    );
  }

  const requiredMissing = fieldsFromSchema(version.variableSchema)
    .filter((field) => field.required)
    .map((field) => field.key)
    .filter((key) => result.missingVariables.includes(key));

  return {
    preview: {
      rendered: result.rendered,
      missingVariables: result.missingVariables,
      requiredMissing,
      blockedExpressions: result.blockedExpressions,
      missingVariableMarkerExample: formatMissingVariableMarker("exemplo.chave"),
      mutated: false,
    },
    version: serializeVersion(version),
  };
}

/** Helper interno: carrega versão ativa/lida de um template acessível à org. */
export async function loadAccessibleTemplateVersion(
  db: AppDatabase,
  organizationId: string,
  templateId: string,
  templateVersionId?: string,
) {
  const template = await db.query.legalDocumentTemplates.findFirst({
    where: and(
      eq(legalDocumentTemplates.id, templateId),
      or(
        eq(legalDocumentTemplates.organizationId, organizationId),
        and(
          isNull(legalDocumentTemplates.organizationId),
          eq(legalDocumentTemplates.scope, "system"),
        ),
      ),
    ),
  });
  if (!template) {
    throw new AppError("NOT_FOUND", "Não encontramos este modelo no seu acesso.");
  }

  const version = templateVersionId
    ? await db.query.legalDocumentTemplateVersions.findFirst({
        where: and(
          eq(legalDocumentTemplateVersions.id, templateVersionId),
          eq(legalDocumentTemplateVersions.templateId, templateId),
        ),
      })
    : template.currentVersionId
      ? await db.query.legalDocumentTemplateVersions.findFirst({
          where: eq(legalDocumentTemplateVersions.id, template.currentVersionId),
        })
      : await db.query.legalDocumentTemplateVersions.findFirst({
          where: eq(legalDocumentTemplateVersions.templateId, templateId),
          orderBy: [desc(legalDocumentTemplateVersions.version)],
        });

  if (!version) {
    throw new AppError("CONFLICT", "O modelo não possui versão utilizável.");
  }

  return { template, version };
}

export function resolveTemplateContent(
  content: string,
  variableSchema: Record<string, unknown>,
  variableValues: Record<string, unknown> | undefined,
): {
  rendered: string;
  missingVariables: string[];
  blockedExpressions: string[];
} {
  const resolver = new TemplateVariableResolver({
    allowedPaths: allowedPathsFromSchema(variableSchema),
  });
  return resolver.resolveTemplate(content, variableValues ?? {});
}
