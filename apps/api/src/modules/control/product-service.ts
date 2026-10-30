import type { DeploymentProvider, IssueTrackerProvider } from "@verasjuris/ai";
import { recordAudit } from "@verasjuris/audit";
import { policyProductProject, type SessionAccount } from "@verasjuris/auth";
import {
  controlProjects,
  isUniqueViolation,
  productBugs,
  productFeatures,
  productReleases,
  productRoadmaps,
  roadmapItems,
  technologyIncidents,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, desc, eq } from "drizzle-orm";
import { iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";
import { authorizeControl, mapBugSeverity, parseDate, requireDate } from "./internal-org.js";

export type ProductModuleDeps = {
  deploymentProvider?: DeploymentProvider;
  issueTrackerProvider?: IssueTrackerProvider;
};

export async function createProductRoadmap(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: { name: string; description?: string; periodLabel?: string; active?: boolean },
  meta: RequestMeta,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyProductProject(a, "control.product.manage"),
  );
  const description = [
    input.description,
    input.periodLabel ? `Período: ${input.periodLabel}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const [row] = await db
    .insert(productRoadmaps)
    .values({
      organizationId,
      name: input.name,
      description: description || null,
      active: input.active ?? true,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o roadmap.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "control.roadmap_changed",
    resourceType: "product_roadmap",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return {
    roadmap: {
      id: row.id,
      name: row.name,
      description: row.description,
      active: row.active,
      createdAt: iso(row.createdAt),
    },
  };
}

export async function createRoadmapItem(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    roadmapId: string;
    title: string;
    description?: string;
    type: typeof roadmapItems.$inferSelect.type;
    priority: typeof roadmapItems.$inferSelect.priority;
    status?: string;
    targetQuarter?: string;
    ownerMembershipId?: string;
    productArea?: string;
    linkedProjectId?: string;
  },
  meta: RequestMeta,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyProductProject(a, "control.product.manage"),
  );
  const [roadmap] = await db
    .select()
    .from(productRoadmaps)
    .where(
      and(
        eq(productRoadmaps.id, input.roadmapId),
        eq(productRoadmaps.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!roadmap) throw new AppError("NOT_FOUND", "Não encontramos este roadmap no seu acesso.");
  const status = (
    ["proposed", "planned", "in_progress", "done", "deferred", "cancelled"].includes(
      input.status ?? "",
    )
      ? input.status
      : "proposed"
  ) as typeof roadmapItems.$inferSelect.status;
  const [row] = await db
    .insert(roadmapItems)
    .values({
      roadmapId: roadmap.id,
      title: input.title,
      description: input.description ?? null,
      type: input.type,
      priority: input.priority,
      status,
      targetQuarter: input.targetQuarter ?? null,
      ownerMembershipId: input.ownerMembershipId ?? null,
      productArea: input.productArea ?? null,
      linkedProjectId: input.linkedProjectId ?? null,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o item.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "control.roadmap_changed",
    resourceType: "roadmap_item",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return {
    item: {
      id: row.id,
      roadmapId: row.roadmapId,
      title: row.title,
      type: row.type,
      priority: row.priority,
      status: row.status,
      targetQuarter: row.targetQuarter,
      createdAt: iso(row.createdAt),
    },
  };
}

export async function createProductBug(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    title: string;
    description?: string;
    severity: string;
    priority: typeof productBugs.$inferSelect.priority;
    status?: typeof productBugs.$inferSelect.status;
    environment?: string;
    ownerMembershipId?: string;
    reproductionSteps?: string;
    fixedInReleaseId?: string;
  },
  meta: RequestMeta,
  deps: ProductModuleDeps = {},
) {
  const actor = await authorizeControl(db, account, organizationId, (a) =>
    policyProductProject(a, "control.product.manage"),
  );
  const [row] = await db
    .insert(productBugs)
    .values({
      organizationId,
      title: input.title,
      description: input.description ?? null,
      severity: mapBugSeverity(input.severity),
      priority: input.priority,
      status: input.status ?? "open",
      environment: input.environment ?? null,
      reporterMembershipId: actor.membershipId,
      ownerMembershipId: input.ownerMembershipId ?? null,
      reproductionSteps: input.reproductionSteps ?? null,
      fixedInReleaseId: input.fixedInReleaseId ?? null,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o bug.");

  let externalIssue: Awaited<ReturnType<NonNullable<IssueTrackerProvider["createIssue"]>>> | null =
    null;
  if (deps.issueTrackerProvider) {
    externalIssue = await deps.issueTrackerProvider.createIssue({
      organizationId,
      title: input.title,
      description: input.description,
      labels: ["bug", input.severity],
    });
  }

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "control.bug_created",
    resourceType: "product_bug",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    metadata: externalIssue
      ? {
          externalIssueStatus: externalIssue.status,
          externalIssueId: externalIssue.externalIssueId,
          providerKey: externalIssue.providerKey,
        }
      : undefined,
  });
  return {
    bug: {
      id: row.id,
      title: row.title,
      severity: row.severity,
      priority: row.priority,
      status: row.status,
      createdAt: iso(row.createdAt),
    },
    externalIssue: externalIssue
      ? {
          status: externalIssue.status,
          externalIssueId: externalIssue.externalIssueId,
          providerKey: externalIssue.providerKey,
        }
      : { status: "not_configured" as const, externalIssueId: null, providerKey: "not_configured" },
  };
}

export async function createTechnologyIncident(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    severity: typeof technologyIncidents.$inferSelect.severity;
    title: string;
    description?: string;
    startedAt: string;
    detectedAt?: string;
    impact?: string;
    ownerMembershipId?: string;
  },
  meta: RequestMeta,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyProductProject(a, "control.product.manage"),
  );
  const [row] = await db
    .insert(technologyIncidents)
    .values({
      organizationId,
      severity: input.severity,
      title: input.title,
      description: input.description ?? null,
      startedAt: requireDate(input.startedAt),
      detectedAt: parseDate(input.detectedAt ?? null) ?? new Date(),
      impact: input.impact ?? null,
      status: "open",
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível abrir o incidente técnico.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "control.tech_incident_opened",
    resourceType: "technology_incident",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return {
    incident: {
      id: row.id,
      severity: row.severity,
      title: row.title,
      status: row.status,
      startedAt: iso(row.startedAt),
      detectedAt: iso(row.detectedAt),
      createdAt: iso(row.createdAt),
    },
  };
}

export async function createProductRelease(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    version: string;
    name?: string;
    environment?: string;
    status?: typeof productReleases.$inferSelect.status;
    plannedAt?: string;
    notes?: string;
    commitReference?: string;
  },
  meta: RequestMeta,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyProductProject(a, "control.product.manage"),
  );
  try {
    const [row] = await db
      .insert(productReleases)
      .values({
        organizationId,
        version: input.version,
        name: input.name ?? null,
        environment: input.environment ?? null,
        status: input.status ?? "planned",
        plannedAt: parseDate(input.plannedAt ?? null),
        notes: input.notes ?? null,
        commitReference: input.commitReference ?? null,
        deploymentReference: null,
      })
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o release.");
    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "control.release_created",
      resourceType: "product_release",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
    });
    return {
      release: {
        id: row.id,
        version: row.version,
        name: row.name,
        environment: row.environment,
        status: row.status,
        plannedAt: iso(row.plannedAt),
        releasedAt: iso(row.releasedAt),
        notes: row.notes,
        commitReference: row.commitReference,
        deploymentReference: row.deploymentReference,
        createdAt: iso(row.createdAt),
      },
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("CONFLICT", "Já existe um release com esta versão.");
    }
    throw error;
  }
}

/**
 * Mark released with notes/commit evidence. Without DeploymentProvider,
 * deploymentReference stays null and health remains not_configured — never fake deploy.
 */
export async function markProductReleaseReleased(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  releaseId: string,
  input: { notes?: string; commitReference?: string },
  meta: RequestMeta,
  deps: ProductModuleDeps = {},
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyProductProject(a, "control.product.manage"),
  );
  const [existing] = await db
    .select()
    .from(productReleases)
    .where(
      and(eq(productReleases.id, releaseId), eq(productReleases.organizationId, organizationId)),
    )
    .limit(1);
  if (!existing) throw new AppError("NOT_FOUND", "Não encontramos este release no seu acesso.");

  const notes = input.notes ?? existing.notes;
  const commitReference = input.commitReference ?? existing.commitReference;
  if (!notes && !commitReference) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Informe notes ou commitReference como evidência para marcar como released.",
    );
  }

  let deploymentReference: string | null = null;
  let deploymentHealth: "not_configured" | "ok" | "degraded" | "unavailable" = "not_configured";
  if (deps.deploymentProvider) {
    const health = await deps.deploymentProvider.healthCheck();
    deploymentHealth = health.status;
    if (health.status === "ok") {
      const deployment = await deps.deploymentProvider.triggerDeployment({
        organizationId,
        environment: existing.environment ?? "production",
        version: existing.version,
        commitReference: commitReference ?? undefined,
      });
      deploymentReference = deployment.externalDeploymentId;
    }
  }

  const [row] = await db
    .update(productReleases)
    .set({
      status: "released",
      releasedAt: new Date(),
      notes,
      commitReference,
      deploymentReference,
      updatedAt: new Date(),
    })
    .where(eq(productReleases.id, releaseId))
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Falha ao marcar release.");

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "control.release_marked_released",
    resourceType: "product_release",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    metadata: { deploymentHealth, deploymentReference },
  });

  return {
    release: {
      id: row.id,
      version: row.version,
      status: row.status,
      releasedAt: iso(row.releasedAt),
      notes: row.notes,
      commitReference: row.commitReference,
      deploymentReference: row.deploymentReference,
    },
    deploymentProvider: { status: deploymentHealth },
  };
}

export async function createProductFeature(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    key: string;
    name: string;
    description?: string;
    ownerMembershipId?: string;
    status?: typeof productFeatures.$inferSelect.status;
    releaseId?: string;
    featureFlagKey?: string;
  },
  meta: RequestMeta,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyProductProject(a, "control.product.manage"),
  );
  try {
    const [row] = await db
      .insert(productFeatures)
      .values({
        organizationId,
        key: input.key,
        name: input.name,
        description: input.description ?? null,
        ownerMembershipId: input.ownerMembershipId ?? null,
        status: input.status ?? "discovery",
        releaseId: input.releaseId ?? null,
        featureFlagKey: input.featureFlagKey ?? null,
      })
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a feature.");
    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "control.feature_created",
      resourceType: "product_feature",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
    });
    return {
      feature: {
        id: row.id,
        key: row.key,
        name: row.name,
        status: row.status,
        releaseId: row.releaseId,
        createdAt: iso(row.createdAt),
      },
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("CONFLICT", "Já existe uma feature com esta chave.");
    }
    throw error;
  }
}

export async function createControlProject(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    title: string;
    description?: string;
    ownerMembershipId?: string;
    sponsorMembershipId?: string;
    status?: typeof controlProjects.$inferSelect.status;
    startAt?: string;
    targetEndAt?: string;
    budgetId?: string;
  },
  meta: RequestMeta,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyProductProject(a, "control.product.manage"),
  );
  const [row] = await db
    .insert(controlProjects)
    .values({
      organizationId,
      title: input.title,
      description: input.description ?? null,
      ownerMembershipId: input.ownerMembershipId ?? null,
      sponsorMembershipId: input.sponsorMembershipId ?? null,
      status: input.status ?? "proposed",
      startAt: parseDate(input.startAt ?? null),
      targetEndAt: parseDate(input.targetEndAt ?? null),
      budgetId: input.budgetId ?? null,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o projeto.");
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "control.project_created",
    resourceType: "control_project",
    resourceId: row.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return {
    project: {
      id: row.id,
      title: row.title,
      status: row.status,
      ownerMembershipId: row.ownerMembershipId,
      startAt: iso(row.startAt),
      targetEndAt: iso(row.targetEndAt),
      createdAt: iso(row.createdAt),
    },
  };
}

export async function listProductBugs(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  await authorizeControl(db, account, organizationId, (a) =>
    policyProductProject(a, "control.product.read"),
  );
  const rows = await db
    .select()
    .from(productBugs)
    .where(eq(productBugs.organizationId, organizationId))
    .orderBy(desc(productBugs.createdAt))
    .limit(100);
  return {
    bugs: rows.map((b) => ({
      id: b.id,
      title: b.title,
      severity: b.severity,
      status: b.status,
      priority: b.priority,
      createdAt: iso(b.createdAt),
    })),
  };
}

export async function roadmapStatusRefreshJob(db: AppDatabase, organizationId: string) {
  const roadmaps = await db
    .select()
    .from(productRoadmaps)
    .where(
      and(eq(productRoadmaps.organizationId, organizationId), eq(productRoadmaps.active, true)),
    );
  return { activeRoadmaps: roadmaps.length };
}
