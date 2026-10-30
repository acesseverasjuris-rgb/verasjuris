import { recordAudit } from "@verasjuris/audit";
import { policyInternalLegalMatter, type SessionAccount } from "@verasjuris/auth";
import {
  contracts,
  dueDiligenceChecklists,
  dueDiligenceItems,
  intellectualPropertyAssets,
  internalDueDiligenceCases,
  internalPolicies,
  legalMatters,
  policyAcknowledgements,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, desc, eq } from "drizzle-orm";
import { iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";
import { authorizeControl, parseDate } from "./internal-org.js";

function serializeIp(row: typeof intellectualPropertyAssets.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    type: row.assetType,
    title: row.title,
    status: row.status,
    registrationNumber: row.registrationNumber,
    ownerMembershipId: row.ownerMembershipId,
    filedAt: iso(row.filedAt),
    expiresAt: iso(row.expiresAt),
    documentId: row.documentId,
    notes: row.notes,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export async function createIntellectualProperty(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    type: typeof intellectualPropertyAssets.$inferSelect.assetType;
    title: string;
    description?: string;
    status?: typeof intellectualPropertyAssets.$inferSelect.status;
    registrationNumber?: string;
    ownerMembershipId?: string;
    filedAt?: string;
    expiresAt?: string;
  },
  meta: RequestMeta,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyInternalLegalMatter(a, "control.legal.manage"),
  );
  const [row] = await db
    .insert(intellectualPropertyAssets)
    .values({
      organizationId,
      assetType: input.type,
      title: input.title,
      notes: input.description ?? null,
      status: input.status ?? "draft",
      registrationNumber: input.registrationNumber ?? null,
      ownerMembershipId: input.ownerMembershipId ?? null,
      filedAt: parseDate(input.filedAt ?? null),
      expiresAt: parseDate(input.expiresAt ?? null),
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o ativo de PI.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "control.ip_created",
    resourceType: "intellectual_property_asset",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: serializeIp(row),
  });
  return { asset: serializeIp(row) };
}

export async function listIntellectualProperty(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyInternalLegalMatter(a, "control.legal.read"),
  );
  const rows = await db
    .select()
    .from(intellectualPropertyAssets)
    .where(eq(intellectualPropertyAssets.organizationId, organizationId))
    .orderBy(desc(intellectualPropertyAssets.createdAt));
  return { assets: rows.map(serializeIp) };
}

export async function createInternalDueDiligence(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    subjectType: string;
    subjectId: string;
    type: string;
    ownerMembershipId?: string;
    notes?: string;
  },
  meta: RequestMeta,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyInternalLegalMatter(a, "control.legal.manage"),
  );
  const caseType = (
    ["corporate", "vendor", "investment", "m_and_a", "partner", "other"].includes(input.type)
      ? input.type
      : "other"
  ) as typeof internalDueDiligenceCases.$inferSelect.type;
  return db.transaction(async (tx) => {
    const [caseRow] = await tx
      .insert(internalDueDiligenceCases)
      .values({
        organizationId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        type: caseType,
        title: `DD ${input.type} — ${input.subjectType}`,
        status: "open",
        ownerMembershipId: input.ownerMembershipId ?? null,
      })
      .returning();
    if (!caseRow) throw new AppError("INTERNAL_ERROR", "Não foi possível abrir a due diligence.");
    const [checklist] = await tx
      .insert(dueDiligenceChecklists)
      .values({ caseId: caseRow.id, name: "Checklist padrão" })
      .returning();
    const defaultItems = [
      { area: "corporate" as const, title: "Estrutura societária" },
      { area: "legal" as const, title: "Litígios relevantes" },
      { area: "contracts" as const, title: "Contratos materiais" },
    ];
    const items = [];
    if (checklist) {
      for (const [index, item] of defaultItems.entries()) {
        const [created] = await tx
          .insert(dueDiligenceItems)
          .values({
            checklistId: checklist.id,
            area: item.area,
            title: item.title,
            sortOrder: index,
            status: "pending",
          })
          .returning();
        if (created) items.push(created);
      }
    }
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "control.due_diligence_started",
      resourceType: "internal_due_diligence_case",
      resourceId: caseRow.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      metadata: input.notes ? { notes: input.notes } : undefined,
    });
    return {
      case: {
        id: caseRow.id,
        organizationId: caseRow.organizationId,
        subjectType: caseRow.subjectType,
        subjectId: caseRow.subjectId,
        type: caseRow.type,
        title: caseRow.title,
        status: caseRow.status,
        ownerMembershipId: caseRow.ownerMembershipId,
        openedAt: iso(caseRow.openedAt),
        createdAt: iso(caseRow.createdAt),
      },
      checklist: checklist
        ? { id: checklist.id, name: checklist.name, caseId: checklist.caseId }
        : null,
      items: items.map((i) => ({
        id: i.id,
        area: i.area,
        title: i.title,
        status: i.status,
      })),
    };
  });
}

export async function createInternalPolicy(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    title: string;
    category: string;
    version: string;
    status?: typeof internalPolicies.$inferSelect.status;
    effectiveAt?: string;
    reviewAt?: string;
    ownerMembershipId?: string;
    documentId?: string;
    summary?: string;
  },
  meta: RequestMeta,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyInternalLegalMatter(a, "control.legal.manage"),
  );
  const versionNum = Number.parseInt(input.version, 10);
  const [row] = await db
    .insert(internalPolicies)
    .values({
      organizationId,
      title: input.title,
      category: input.category,
      version: Number.isFinite(versionNum) && versionNum > 0 ? versionNum : 1,
      status: input.status ?? "draft",
      effectiveAt: parseDate(input.effectiveAt ?? null),
      reviewAt: parseDate(input.reviewAt ?? null),
      ownerMembershipId: input.ownerMembershipId ?? null,
      documentId: input.documentId ?? null,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a política.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "control.policy_created",
    resourceType: "internal_policy",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    metadata: input.summary ? { summary: input.summary } : undefined,
  });
  return {
    policy: {
      id: row.id,
      organizationId: row.organizationId,
      title: row.title,
      category: row.category,
      version: String(row.version),
      status: row.status,
      effectiveAt: iso(row.effectiveAt),
      reviewAt: iso(row.reviewAt),
      ownerMembershipId: row.ownerMembershipId,
      documentId: row.documentId,
      createdAt: iso(row.createdAt),
    },
  };
}

export async function acknowledgeInternalPolicy(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  policyId: string,
  input: { employeeId?: string },
  meta: RequestMeta,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyInternalLegalMatter(a, "control.legal.manage"),
  );
  const [policy] = await db
    .select()
    .from(internalPolicies)
    .where(
      and(eq(internalPolicies.id, policyId), eq(internalPolicies.organizationId, organizationId)),
    )
    .limit(1);
  if (!policy) throw new AppError("NOT_FOUND", "Não encontramos esta política no seu acesso.");
  const [row] = await db
    .insert(policyAcknowledgements)
    .values({
      policyId: policy.id,
      employeeId: input.employeeId ?? null,
      userId: account.user.id,
      policyVersion: policy.version,
      acknowledgedAt: new Date(),
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar o aceite.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "control.policy_acknowledged",
    resourceType: "policy_acknowledgement",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return {
    acknowledgement: {
      id: row.id,
      policyId: row.policyId,
      employeeId: row.employeeId,
      userId: row.userId,
      policyVersion: row.policyVersion,
      acknowledgedAt: iso(row.acknowledgedAt),
    },
  };
}

export async function listInternalMatters(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyInternalLegalMatter(a, "control.legal.read"),
  );
  const rows = await db
    .select()
    .from(legalMatters)
    .where(
      and(
        eq(legalMatters.organizationId, organizationId),
        eq(legalMatters.matterScope, "internal_company"),
      ),
    )
    .orderBy(desc(legalMatters.createdAt))
    .limit(100);
  return {
    matters: rows.map((m) => ({
      id: m.id,
      title: m.title,
      status: m.status,
      matterScope: m.matterScope,
      createdAt: iso(m.createdAt),
    })),
  };
}

export async function listInternalContractsByCategory(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  categoryTag?: string,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyInternalLegalMatter(a, "control.legal.read"),
  );
  const filters = [eq(contracts.organizationId, organizationId)];
  const rows = await db
    .select()
    .from(contracts)
    .where(and(...filters))
    .orderBy(desc(contracts.createdAt))
    .limit(100);
  const filtered = categoryTag
    ? rows.filter((c) => {
        const tags = c as {
          categoryTags?: unknown;
          tags?: unknown;
          metadata?: Record<string, unknown>;
        };
        const metaTags = tags.metadata?.categoryTags;
        const list = Array.isArray(metaTags)
          ? metaTags
          : Array.isArray(tags.categoryTags)
            ? tags.categoryTags
            : Array.isArray(tags.tags)
              ? tags.tags
              : [];
        return list.map(String).includes(categoryTag);
      })
    : rows;
  return {
    contracts: filtered.map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      createdAt: iso(c.createdAt),
    })),
    categoryFilter: categoryTag ?? null,
  };
}
