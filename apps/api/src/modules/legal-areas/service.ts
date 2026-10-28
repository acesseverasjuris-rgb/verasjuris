import type {
  ElectoralDataProvider,
  EnvironmentalDataProvider,
  RegistryProvider,
} from "@verasjuris/ai";
import { recordAudit } from "@verasjuris/audit";
import { policyLegalAreaModule, policyLegalMatter, type SessionAccount } from "@verasjuris/auth";
import {
  administrativeLawCases,
  arbitrationCases,
  civilClaimItems,
  civilDamages,
  civilObligations,
  consumerCases,
  corporateCases,
  criminalCases,
  criminalCharges,
  custodyArrangements,
  custodialMeasures,
  digitalCases,
  electoralCases,
  environmentalCases,
  estateAssets,
  estateCases,
  estateHeirs,
  estateShares,
  familyRelationships,
  internationalCases,
  legalAreaChecklists,
  legalAreaFeatureConfig,
  legalAreaModules,
  legalAreaTemplatePacks,
  legalAreaWorkflowConfigs,
  legalMatterAreaBindings,
  legalMatters,
  mediationCases,
  medicalCases,
  propertyDivisions,
  realEstateAssets,
  realEstateCases,
  sentencingInformation,
  sportsCases,
  supportObligations,
  versionedRuleSets,
  type AppDatabase,
  type LegalAreaModuleKey,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, asc, count, desc, eq, sql, type SQL } from "drizzle-orm";
import { authorize, iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";
import {
  ensureLegalAreaCatalog,
  getFeaturesForArea,
  resolveModuleByKey,
  syncModuleFeaturesToDb,
} from "./registry.js";

export type LegalAreaModuleDeps = {
  electoralDataProvider: ElectoralDataProvider;
  environmentalDataProvider: EnvironmentalDataProvider;
  registryProvider: RegistryProvider;
};

export { getFeaturesForArea, hasFeature, LEGAL_AREA_FEATURES } from "./registry.js";

async function requireMatter(db: AppDatabase, organizationId: string, legalMatterId: string) {
  const row = await db.query.legalMatters.findFirst({
    where: and(eq(legalMatters.id, legalMatterId), eq(legalMatters.organizationId, organizationId)),
  });
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos este caso.");
  return row;
}

function requireMatterRead(account: SessionAccount, organizationId: string) {
  authorize(account, organizationId, (access) => policyLegalMatter(access, "matter.read"));
}

function requireMatterUpdate(account: SessionAccount, organizationId: string) {
  authorize(account, organizationId, (access) => policyLegalMatter(access, "matter.update"));
}

function requireModuleRead(account: SessionAccount, organizationId: string) {
  authorize(account, organizationId, (access) =>
    policyLegalAreaModule(access, "legal_area_module.read"),
  );
}

function requireModuleManage(account: SessionAccount, organizationId: string) {
  authorize(account, organizationId, (access) =>
    policyLegalAreaModule(access, "legal_area_module.manage"),
  );
}

async function auditLegalArea(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  meta: RequestMeta,
  after?: Record<string, unknown> | null,
) {
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action,
    resourceType,
    resourceId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: after ?? null,
  });
}

async function auditSensitiveRead(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  kind: "criminal" | "medical",
  resourceType: string,
  resourceId: string,
  meta: RequestMeta,
  legalMatterId: string,
) {
  await auditLegalArea(
    db,
    account,
    organizationId,
    `legal_area.${kind}_record.read`,
    resourceType,
    resourceId,
    meta,
    { legalMatterId, confidentialityAccess: true },
  );
}

function serializeModule(row: typeof legalAreaModules.$inferSelect) {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    active: row.active,
    version: row.version,
    configuration: row.configuration,
    features: getFeaturesForArea(row.key),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/* ─── Módulos & features ─── */

export async function listLegalAreaModules(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { key?: LegalAreaModuleKey; active?: boolean; limit: number; offset: number },
) {
  requireModuleRead(account, organizationId);
  await ensureLegalAreaCatalog(db);

  const filters: SQL[] = [];
  if (query.key) filters.push(eq(legalAreaModules.key, query.key));
  if (query.active !== undefined) filters.push(eq(legalAreaModules.active, query.active));

  const where = filters.length ? and(...filters) : undefined;
  const [items, totalRow] = await Promise.all([
    db
      .select()
      .from(legalAreaModules)
      .where(where)
      .orderBy(asc(legalAreaModules.key))
      .limit(query.limit)
      .offset(query.offset),
    db.select({ total: count() }).from(legalAreaModules).where(where),
  ]);

  return {
    items: items.map(serializeModule),
    total: Number(totalRow[0]?.total ?? 0),
    limit: query.limit,
    offset: query.offset,
  };
}

export async function getLegalAreaModule(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  moduleKey: LegalAreaModuleKey,
) {
  requireModuleRead(account, organizationId);
  const row = await resolveModuleByKey(db, moduleKey);
  if (!row) throw new AppError("NOT_FOUND", "Módulo de área não encontrado.");
  await syncModuleFeaturesToDb(db, row.id, row.key);
  return { module: serializeModule(row) };
}

export async function listLegalAreaModuleFeatures(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  moduleKey: LegalAreaModuleKey,
) {
  requireModuleRead(account, organizationId);
  const mod = await resolveModuleByKey(db, moduleKey);
  if (!mod) throw new AppError("NOT_FOUND", "Módulo de área não encontrado.");
  await syncModuleFeaturesToDb(db, mod.id, mod.key);
  const rows = await db
    .select()
    .from(legalAreaFeatureConfig)
    .where(eq(legalAreaFeatureConfig.moduleId, mod.id))
    .orderBy(asc(legalAreaFeatureConfig.featureKey));
  return {
    moduleKey,
    items: rows.map((r) => ({
      id: r.id,
      featureKey: r.featureKey,
      active: r.active,
      configuration: r.configuration,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
  };
}

export async function createLegalAreaModuleFeature(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  moduleKey: LegalAreaModuleKey,
  input: { featureKey: string; active?: boolean; configuration?: Record<string, unknown> },
  meta: RequestMeta,
) {
  requireModuleManage(account, organizationId);
  const mod = await resolveModuleByKey(db, moduleKey);
  if (!mod) throw new AppError("NOT_FOUND", "Módulo de área não encontrado.");

  const [row] = await db
    .insert(legalAreaFeatureConfig)
    .values({
      moduleId: mod.id,
      featureKey: input.featureKey,
      active: input.active ?? true,
      configuration: input.configuration ?? null,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar a feature.");

  await auditLegalArea(
    db,
    account,
    organizationId,
    "legal_area.feature.create",
    "legal_area_feature",
    row.id,
    meta,
    { moduleKey, featureKey: row.featureKey },
  );

  return {
    feature: {
      id: row.id,
      featureKey: row.featureKey,
      active: row.active,
      configuration: row.configuration,
    },
  };
}

/* ─── Checklists, packs, workflows, rule sets ─── */

export async function listLegalAreaChecklists(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { moduleId?: string; status?: string; limit: number; offset: number },
) {
  requireModuleRead(account, organizationId);
  await ensureLegalAreaCatalog(db);
  const filters: SQL[] = [
    sql`(${legalAreaChecklists.organizationId} IS NULL OR ${legalAreaChecklists.organizationId} = ${organizationId})`,
  ];
  if (query.moduleId) filters.push(eq(legalAreaChecklists.moduleId, query.moduleId));
  if (query.status) {
    filters.push(
      eq(
        legalAreaChecklists.status,
        query.status as (typeof legalAreaChecklists.$inferSelect)["status"],
      ),
    );
  }
  const where = and(...filters);
  const [items, totalRow] = await Promise.all([
    db
      .select()
      .from(legalAreaChecklists)
      .where(where)
      .orderBy(desc(legalAreaChecklists.updatedAt))
      .limit(query.limit)
      .offset(query.offset),
    db.select({ total: count() }).from(legalAreaChecklists).where(where),
  ]);
  return {
    items: items.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      moduleId: r.moduleId,
      key: r.key,
      title: r.title,
      version: r.version,
      status: r.status,
      items: r.items,
      isSystem: r.isSystem,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    total: Number(totalRow[0]?.total ?? 0),
    limit: query.limit,
    offset: query.offset,
  };
}

export async function createLegalAreaChecklist(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    moduleId: string;
    key: string;
    title: string;
    version?: string;
    status?: string;
    items?: Array<{ key: string; label: string; required?: boolean }>;
  },
  meta: RequestMeta,
) {
  requireModuleManage(account, organizationId);
  const [row] = await db
    .insert(legalAreaChecklists)
    .values({
      organizationId,
      moduleId: input.moduleId,
      key: input.key,
      title: input.title,
      version: input.version ?? "1",
      status: (input.status ?? "active") as (typeof legalAreaChecklists.$inferSelect)["status"],
      items: input.items ?? null,
      isSystem: false,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o checklist.");
  await auditLegalArea(
    db,
    account,
    organizationId,
    "legal_area.checklist.create",
    "legal_area_checklist",
    row.id,
    meta,
    { key: row.key },
  );
  return { checklist: { id: row.id, key: row.key, title: row.title, status: row.status } };
}

export async function listLegalAreaTemplatePacks(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { limit: number; offset: number },
) {
  requireModuleRead(account, organizationId);
  const where = sql`(${legalAreaTemplatePacks.organizationId} IS NULL OR ${legalAreaTemplatePacks.organizationId} = ${organizationId})`;
  const [items, totalRow] = await Promise.all([
    db
      .select()
      .from(legalAreaTemplatePacks)
      .where(where)
      .orderBy(desc(legalAreaTemplatePacks.updatedAt))
      .limit(query.limit)
      .offset(query.offset),
    db.select({ total: count() }).from(legalAreaTemplatePacks).where(where),
  ]);
  return {
    items: items.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      moduleId: r.moduleId,
      packKey: r.packKey,
      title: r.title,
      active: r.active,
      isSystem: r.isSystem,
      createdAt: r.createdAt.toISOString(),
    })),
    total: Number(totalRow[0]?.total ?? 0),
    limit: query.limit,
    offset: query.offset,
  };
}

export async function createLegalAreaTemplatePack(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    moduleId: string;
    packKey: string;
    title: string;
    legalDocumentTemplateId?: string;
    active?: boolean;
    metadata?: Record<string, unknown>;
  },
  meta: RequestMeta,
) {
  requireModuleManage(account, organizationId);
  const [row] = await db
    .insert(legalAreaTemplatePacks)
    .values({
      organizationId,
      moduleId: input.moduleId,
      packKey: input.packKey,
      title: input.title,
      legalDocumentTemplateId: input.legalDocumentTemplateId ?? null,
      active: input.active ?? true,
      metadata: input.metadata ?? null,
      isSystem: false,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o pack.");
  await auditLegalArea(
    db,
    account,
    organizationId,
    "legal_area.template_pack.create",
    "legal_area_template_pack",
    row.id,
    meta,
    { packKey: row.packKey },
  );
  return { pack: { id: row.id, packKey: row.packKey, title: row.title } };
}

export async function listLegalAreaWorkflowConfigs(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { limit: number; offset: number },
) {
  requireModuleRead(account, organizationId);
  const where = sql`(${legalAreaWorkflowConfigs.organizationId} IS NULL OR ${legalAreaWorkflowConfigs.organizationId} = ${organizationId})`;
  const [items, totalRow] = await Promise.all([
    db
      .select()
      .from(legalAreaWorkflowConfigs)
      .where(where)
      .orderBy(asc(legalAreaWorkflowConfigs.key))
      .limit(query.limit)
      .offset(query.offset),
    db.select({ total: count() }).from(legalAreaWorkflowConfigs).where(where),
  ]);
  return {
    items: items.map((r) => ({
      id: r.id,
      moduleId: r.moduleId,
      key: r.key,
      title: r.title,
      stages: r.stages,
      active: r.active,
      createdAt: r.createdAt.toISOString(),
    })),
    total: Number(totalRow[0]?.total ?? 0),
    limit: query.limit,
    offset: query.offset,
  };
}

export async function createLegalAreaWorkflowConfig(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    moduleId: string;
    key: string;
    title: string;
    stages?: Array<{ key: string; label: string; order: number }>;
    active?: boolean;
    metadata?: Record<string, unknown>;
  },
  meta: RequestMeta,
) {
  requireModuleManage(account, organizationId);
  const [row] = await db
    .insert(legalAreaWorkflowConfigs)
    .values({
      organizationId,
      moduleId: input.moduleId,
      key: input.key,
      title: input.title,
      stages: input.stages ?? null,
      active: input.active ?? true,
      metadata: input.metadata ?? null,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a configuração.");
  await auditLegalArea(
    db,
    account,
    organizationId,
    "legal_area.workflow.create",
    "legal_area_workflow",
    row.id,
    meta,
    { key: row.key },
  );
  return { workflow: { id: row.id, key: row.key, title: row.title } };
}

export async function listVersionedRuleSets(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: {
    domain?: string;
    status?: string;
    key?: string;
    limit: number;
    offset: number;
  },
) {
  requireModuleRead(account, organizationId);
  const filters: SQL[] = [
    sql`(${versionedRuleSets.organizationId} IS NULL OR ${versionedRuleSets.organizationId} = ${organizationId})`,
  ];
  if (query.domain) filters.push(eq(versionedRuleSets.domain, query.domain));
  if (query.key) filters.push(eq(versionedRuleSets.key, query.key));
  if (query.status) {
    filters.push(
      eq(
        versionedRuleSets.status,
        query.status as (typeof versionedRuleSets.$inferSelect)["status"],
      ),
    );
  }
  const where = and(...filters);
  const [items, totalRow] = await Promise.all([
    db
      .select()
      .from(versionedRuleSets)
      .where(where)
      .orderBy(desc(versionedRuleSets.effectiveFrom))
      .limit(query.limit)
      .offset(query.offset),
    db.select({ total: count() }).from(versionedRuleSets).where(where),
  ]);
  return {
    items: items.map((r) => ({
      id: r.id,
      key: r.key,
      domain: r.domain,
      version: r.version,
      effectiveFrom: iso(r.effectiveFrom),
      effectiveTo: iso(r.effectiveTo),
      status: r.status,
      locked: r.locked,
      source: r.source,
    })),
    total: Number(totalRow[0]?.total ?? 0),
    limit: query.limit,
    offset: query.offset,
  };
}

export async function createVersionedRuleSet(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    key: string;
    domain: string;
    version: string;
    effectiveFrom: string;
    effectiveTo?: string | null;
    source?: string;
    sourceUrl?: string;
    status?: string;
    locked?: boolean;
    metadata?: Record<string, unknown>;
  },
  meta: RequestMeta,
) {
  requireModuleManage(account, organizationId);
  const [row] = await db
    .insert(versionedRuleSets)
    .values({
      organizationId,
      key: input.key,
      domain: input.domain,
      version: input.version,
      effectiveFrom: new Date(input.effectiveFrom),
      effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
      source: input.source ?? "system",
      sourceUrl: input.sourceUrl ?? null,
      status: (input.status ?? "active") as (typeof versionedRuleSets.$inferSelect)["status"],
      locked: input.locked ?? false,
      metadata: input.metadata ?? null,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o rule set.");
  await auditLegalArea(
    db,
    account,
    organizationId,
    "legal_area.rule_set.create",
    "versioned_rule_set",
    row.id,
    meta,
    { key: row.key, domain: row.domain, version: row.version },
  );
  return { ruleSet: { id: row.id, key: row.key, version: row.version, domain: row.domain } };
}

/* ─── Bindings & extensions summary ─── */

export async function createLegalMatterAreaBinding(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  input: {
    moduleId: string;
    confidentiality?: string;
    metadata?: Record<string, unknown>;
  },
  meta: RequestMeta,
) {
  requireMatterUpdate(account, organizationId);
  await requireMatter(db, organizationId, legalMatterId);
  const [row] = await db
    .insert(legalMatterAreaBindings)
    .values({
      organizationId,
      legalMatterId,
      moduleId: input.moduleId,
      confidentiality: (input.confidentiality ??
        "standard") as (typeof legalMatterAreaBindings.$inferSelect)["confidentiality"],
      metadata: input.metadata ?? null,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível vincular o módulo.");
  await auditLegalArea(
    db,
    account,
    organizationId,
    "legal_area.binding.create",
    "legal_matter_area_binding",
    row.id,
    meta,
    { legalMatterId, moduleId: row.moduleId },
  );
  return {
    binding: {
      id: row.id,
      legalMatterId: row.legalMatterId,
      moduleId: row.moduleId,
      confidentiality: row.confidentiality,
    },
  };
}

export async function listLegalMatterAreaBindings(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
) {
  requireMatterRead(account, organizationId);
  await requireMatter(db, organizationId, legalMatterId);
  const rows = await db
    .select()
    .from(legalMatterAreaBindings)
    .where(
      and(
        eq(legalMatterAreaBindings.organizationId, organizationId),
        eq(legalMatterAreaBindings.legalMatterId, legalMatterId),
      ),
    )
    .orderBy(asc(legalMatterAreaBindings.createdAt));
  return {
    items: rows.map((r) => ({
      id: r.id,
      moduleId: r.moduleId,
      confidentiality: r.confidentiality,
      metadata: r.metadata,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export async function getLegalMatterAreaExtensions(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
) {
  requireMatterRead(account, organizationId);
  await requireMatter(db, organizationId, legalMatterId);

  async function countMatterRows(
    table:
      | typeof civilClaimItems
      | typeof consumerCases
      | typeof familyRelationships
      | typeof estateCases
      | typeof corporateCases
      | typeof criminalCases
      | typeof administrativeLawCases
      | typeof medicalCases
      | typeof realEstateAssets
      | typeof realEstateCases
      | typeof environmentalCases
      | typeof electoralCases
      | typeof sportsCases
      | typeof digitalCases
      | typeof internationalCases
      | typeof arbitrationCases
      | typeof mediationCases
      | typeof civilDamages
      | typeof civilObligations
      | typeof custodyArrangements
      | typeof supportObligations
      | typeof propertyDivisions,
  ) {
    const [row] = await db
      .select({ total: count() })
      .from(table)
      .where(and(eq(table.organizationId, organizationId), eq(table.legalMatterId, legalMatterId)));
    return Number(row?.total ?? 0);
  }

  const [
    civilClaimItemsCount,
    civilDamagesCount,
    civilObligationsCount,
    consumerCasesCount,
    familyRelationshipsCount,
    custodyCount,
    supportCount,
    propertyDivisionsCount,
    estateCasesCount,
    corporateCasesCount,
    criminalCasesCount,
    adminCasesCount,
    medicalCasesCount,
    realEstateAssetsCount,
    realEstateCasesCount,
    environmentalCasesCount,
    electoralCasesCount,
    sportsCasesCount,
    digitalCasesCount,
    internationalCasesCount,
    arbitrationCasesCount,
    mediationCasesCount,
  ] = await Promise.all([
    countMatterRows(civilClaimItems),
    countMatterRows(civilDamages),
    countMatterRows(civilObligations),
    countMatterRows(consumerCases),
    countMatterRows(familyRelationships),
    countMatterRows(custodyArrangements),
    countMatterRows(supportObligations),
    countMatterRows(propertyDivisions),
    countMatterRows(estateCases),
    countMatterRows(corporateCases),
    countMatterRows(criminalCases),
    countMatterRows(administrativeLawCases),
    countMatterRows(medicalCases),
    countMatterRows(realEstateAssets),
    countMatterRows(realEstateCases),
    countMatterRows(environmentalCases),
    countMatterRows(electoralCases),
    countMatterRows(sportsCases),
    countMatterRows(digitalCases),
    countMatterRows(internationalCases),
    countMatterRows(arbitrationCases),
    countMatterRows(mediationCases),
  ]);

  return {
    legalMatterId,
    extensions: {
      civil: {
        claimItems: civilClaimItemsCount,
        damages: civilDamagesCount,
        obligations: civilObligationsCount,
      },
      consumerCases: consumerCasesCount,
      family: {
        relationships: familyRelationshipsCount,
        custody: custodyCount,
        support: supportCount,
        propertyDivisions: propertyDivisionsCount,
      },
      estateCases: estateCasesCount,
      corporateCases: corporateCasesCount,
      criminalCases: criminalCasesCount,
      administrativeLawCases: adminCasesCount,
      medicalCases: medicalCasesCount,
      realEstate: { assets: realEstateAssetsCount, cases: realEstateCasesCount },
      environmentalCases: environmentalCasesCount,
      electoralCases: electoralCasesCount,
      sportsCases: sportsCasesCount,
      digitalCases: digitalCasesCount,
      internationalCases: internationalCasesCount,
      arbitrationCases: arbitrationCasesCount,
      mediationCases: mediationCasesCount,
    },
  };
}

export async function getAreaProvidersStatus(
  account: SessionAccount,
  organizationId: string,
  deps: LegalAreaModuleDeps,
) {
  requireModuleRead(account, organizationId);
  const [electoral, environmental, registry] = await Promise.all([
    deps.electoralDataProvider.healthCheck(),
    deps.environmentalDataProvider.healthCheck(),
    deps.registryProvider.healthCheck(),
  ]);
  return {
    electoral: { provider: deps.electoralDataProvider.id, ...electoral },
    environmental: { provider: deps.environmentalDataProvider.id, ...environmental },
    registry: { provider: deps.registryProvider.id, ...registry },
    manualEntryAvailable: true,
  };
}

/* ─── Matter-scoped extensions (create/list) ─── */

type ExtensionListQuery = {
  limit: number;
  offset: number;
};

function mapTimestamps<T extends { createdAt: Date; updatedAt: Date }>(row: T) {
  const copy = { ...row } as Record<string, unknown>;
  copy.createdAt = row.createdAt.toISOString();
  copy.updatedAt = row.updatedAt.toISOString();
  for (const [key, value] of Object.entries(copy)) {
    if (value instanceof Date) copy[key] = value.toISOString();
  }
  return copy as T & { createdAt: string; updatedAt: string };
}

export async function listCivilClaimItems(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  query: ExtensionListQuery,
) {
  requireMatterRead(account, organizationId);
  await requireMatter(db, organizationId, legalMatterId);
  const where = and(
    eq(civilClaimItems.organizationId, organizationId),
    eq(civilClaimItems.legalMatterId, legalMatterId),
  );
  const items = await db
    .select()
    .from(civilClaimItems)
    .where(where)
    .limit(query.limit)
    .offset(query.offset);
  return { items: items.map(mapTimestamps) };
}

export async function createCivilClaimItem(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  input: Omit<typeof civilClaimItems.$inferInsert, "organizationId" | "legalMatterId">,
) {
  requireMatterUpdate(account, organizationId);
  await requireMatter(db, organizationId, legalMatterId);
  const [row] = await db
    .insert(civilClaimItems)
    .values({ ...input, organizationId, legalMatterId })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o pedido.");
  return { claimItem: mapTimestamps(row) };
}

export async function listCivilDamages(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  query: ExtensionListQuery,
) {
  requireMatterRead(account, organizationId);
  await requireMatter(db, organizationId, legalMatterId);
  const items = await db
    .select()
    .from(civilDamages)
    .where(
      and(
        eq(civilDamages.organizationId, organizationId),
        eq(civilDamages.legalMatterId, legalMatterId),
      ),
    )
    .limit(query.limit)
    .offset(query.offset);
  return { items: items.map(mapTimestamps) };
}

export async function createCivilDamage(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  input: Omit<typeof civilDamages.$inferInsert, "organizationId" | "legalMatterId">,
) {
  requireMatterUpdate(account, organizationId);
  await requireMatter(db, organizationId, legalMatterId);
  const [row] = await db
    .insert(civilDamages)
    .values({ ...input, organizationId, legalMatterId })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar o dano.");
  return { damage: mapTimestamps(row) };
}

export async function listCivilObligations(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  query: ExtensionListQuery,
) {
  requireMatterRead(account, organizationId);
  await requireMatter(db, organizationId, legalMatterId);
  const items = await db
    .select()
    .from(civilObligations)
    .where(
      and(
        eq(civilObligations.organizationId, organizationId),
        eq(civilObligations.legalMatterId, legalMatterId),
      ),
    )
    .limit(query.limit)
    .offset(query.offset);
  return { items: items.map(mapTimestamps) };
}

export async function createCivilObligation(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  input: Record<string, unknown>,
) {
  requireMatterUpdate(account, organizationId);
  await requireMatter(db, organizationId, legalMatterId);
  const [row] = await db
    .insert(civilObligations)
    .values(
      normalizeDateFields({
        ...input,
        organizationId,
        legalMatterId,
      }) as typeof civilObligations.$inferInsert,
    )
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar a obrigação.");
  return { obligation: mapTimestamps(row) };
}

function normalizeDateFields(input: Record<string, unknown>): Record<string, unknown> {
  const out = { ...input };
  for (const key of ["dueDate", "deathDate", "sentenceDate", "awardDate"] as const) {
    const value = out[key];
    if (typeof value === "string") out[key] = new Date(value);
  }
  return out;
}

type MatterScopedCaseTable =
  | typeof consumerCases
  | typeof corporateCases
  | typeof administrativeLawCases
  | typeof medicalCases
  | typeof realEstateCases
  | typeof environmentalCases
  | typeof electoralCases
  | typeof sportsCases
  | typeof digitalCases
  | typeof internationalCases
  | typeof arbitrationCases
  | typeof mediationCases
  | typeof estateCases
  | typeof criminalCases
  | typeof familyRelationships
  | typeof custodyArrangements
  | typeof supportObligations
  | typeof propertyDivisions;

async function listMatterCases(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  fromTable: MatterScopedCaseTable,
  query: ExtensionListQuery,
) {
  requireMatterRead(account, organizationId);
  await requireMatter(db, organizationId, legalMatterId);
  const items = (await db
    .select()
    .from(fromTable)
    .where(
      and(eq(fromTable.organizationId, organizationId), eq(fromTable.legalMatterId, legalMatterId)),
    )
    .limit(query.limit)
    .offset(query.offset)) as Array<{ createdAt: Date; updatedAt: Date }>;
  return { items: items.map(mapTimestamps) };
}

async function createMatterCase(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  fromTable: MatterScopedCaseTable,
  input: Record<string, unknown>,
) {
  requireMatterUpdate(account, organizationId);
  await requireMatter(db, organizationId, legalMatterId);
  const [row] = await db
    .insert(fromTable)
    .values(
      normalizeDateFields({
        ...input,
        organizationId,
        legalMatterId,
      }) as typeof fromTable.$inferInsert,
    )
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o registro.");
  return row as { createdAt: Date; updatedAt: Date };
}

export const listConsumerCases = (
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  query: ExtensionListQuery,
) => listMatterCases(db, account, organizationId, legalMatterId, consumerCases, query);

export async function createConsumerCase(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  input: Record<string, unknown>,
) {
  const row = await createMatterCase(
    db,
    account,
    organizationId,
    legalMatterId,
    consumerCases,
    input,
  );
  return { consumerCase: mapTimestamps(row) };
}

export async function listFamilyRelationships(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  query: ExtensionListQuery,
) {
  requireMatterRead(account, organizationId);
  await requireMatter(db, organizationId, legalMatterId);
  const items = await db
    .select()
    .from(familyRelationships)
    .where(
      and(
        eq(familyRelationships.organizationId, organizationId),
        eq(familyRelationships.legalMatterId, legalMatterId),
      ),
    )
    .limit(query.limit)
    .offset(query.offset);
  return { items: items.map(mapTimestamps) };
}

export async function createFamilyRelationship(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  input: Record<string, unknown>,
) {
  const row = await createMatterCase(
    db,
    account,
    organizationId,
    legalMatterId,
    familyRelationships,
    input,
  );
  return { relationship: mapTimestamps(row) };
}

export async function listCustodyArrangements(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  query: ExtensionListQuery,
) {
  return listMatterCases(db, account, organizationId, legalMatterId, custodyArrangements, query);
}

export async function createCustodyArrangement(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  input: Record<string, unknown>,
) {
  const row = await createMatterCase(
    db,
    account,
    organizationId,
    legalMatterId,
    custodyArrangements,
    input,
  );
  return { custody: mapTimestamps(row) };
}

export async function listSupportObligations(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  query: ExtensionListQuery,
) {
  return listMatterCases(db, account, organizationId, legalMatterId, supportObligations, query);
}

export async function createSupportObligation(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  input: Record<string, unknown>,
) {
  const row = await createMatterCase(
    db,
    account,
    organizationId,
    legalMatterId,
    supportObligations,
    input,
  );
  return { support: mapTimestamps(row) };
}

export async function listPropertyDivisions(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  query: ExtensionListQuery,
) {
  return listMatterCases(db, account, organizationId, legalMatterId, propertyDivisions, query);
}

export async function createPropertyDivision(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  input: Record<string, unknown>,
) {
  const row = await createMatterCase(
    db,
    account,
    organizationId,
    legalMatterId,
    propertyDivisions,
    input,
  );
  return { propertyDivision: mapTimestamps(row) };
}

export async function listEstateCases(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  query: ExtensionListQuery,
) {
  return listMatterCases(db, account, organizationId, legalMatterId, estateCases, query);
}

export async function createEstateCase(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  input: Record<string, unknown>,
) {
  const row = await createMatterCase(
    db,
    account,
    organizationId,
    legalMatterId,
    estateCases,
    input,
  );
  return { estateCase: mapTimestamps(row) };
}

async function requireEstateCase(db: AppDatabase, organizationId: string, estateCaseId: string) {
  const row = await db.query.estateCases.findFirst({
    where: and(eq(estateCases.id, estateCaseId), eq(estateCases.organizationId, organizationId)),
  });
  if (!row) throw new AppError("NOT_FOUND", "Inventário não encontrado.");
  return row;
}

export async function listEstateAssets(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  estateCaseId: string,
  query: ExtensionListQuery,
) {
  requireMatterRead(account, organizationId);
  await requireEstateCase(db, organizationId, estateCaseId);
  const items = await db
    .select()
    .from(estateAssets)
    .where(
      and(
        eq(estateAssets.organizationId, organizationId),
        eq(estateAssets.estateCaseId, estateCaseId),
      ),
    )
    .limit(query.limit)
    .offset(query.offset);
  return { items: items.map(mapTimestamps) };
}

export async function createEstateAsset(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  estateCaseId: string,
  input: Omit<typeof estateAssets.$inferInsert, "organizationId" | "estateCaseId">,
) {
  requireMatterUpdate(account, organizationId);
  await requireEstateCase(db, organizationId, estateCaseId);
  const [row] = await db
    .insert(estateAssets)
    .values({ ...input, organizationId, estateCaseId })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar o bem.");
  return { asset: mapTimestamps(row) };
}

export async function listEstateHeirs(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  estateCaseId: string,
  query: ExtensionListQuery,
) {
  requireMatterRead(account, organizationId);
  await requireEstateCase(db, organizationId, estateCaseId);
  const items = await db
    .select()
    .from(estateHeirs)
    .where(
      and(
        eq(estateHeirs.organizationId, organizationId),
        eq(estateHeirs.estateCaseId, estateCaseId),
      ),
    )
    .limit(query.limit)
    .offset(query.offset);
  return { items: items.map(mapTimestamps) };
}

export async function createEstateHeir(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  estateCaseId: string,
  input: Omit<typeof estateHeirs.$inferInsert, "organizationId" | "estateCaseId">,
) {
  requireMatterUpdate(account, organizationId);
  await requireEstateCase(db, organizationId, estateCaseId);
  const [row] = await db
    .insert(estateHeirs)
    .values({ ...input, organizationId, estateCaseId })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar o herdeiro.");
  return { heir: mapTimestamps(row) };
}

export async function listEstateShares(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  estateCaseId: string,
  query: ExtensionListQuery,
) {
  requireMatterRead(account, organizationId);
  await requireEstateCase(db, organizationId, estateCaseId);
  const items = await db
    .select()
    .from(estateShares)
    .where(
      and(
        eq(estateShares.organizationId, organizationId),
        eq(estateShares.estateCaseId, estateCaseId),
      ),
    )
    .limit(query.limit)
    .offset(query.offset);
  return { items: items.map(mapTimestamps) };
}

export async function createEstateShare(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  estateCaseId: string,
  input: Omit<typeof estateShares.$inferInsert, "organizationId" | "estateCaseId">,
) {
  requireMatterUpdate(account, organizationId);
  await requireEstateCase(db, organizationId, estateCaseId);
  const [row] = await db
    .insert(estateShares)
    .values({ ...input, organizationId, estateCaseId })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar a quota.");
  return { share: mapTimestamps(row) };
}

export async function listCorporateCases(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  query: ExtensionListQuery,
) {
  return listMatterCases(db, account, organizationId, legalMatterId, corporateCases, query);
}

export async function createCorporateCase(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  input: Record<string, unknown>,
) {
  const row = await createMatterCase(
    db,
    account,
    organizationId,
    legalMatterId,
    corporateCases,
    input,
  );
  return { corporateCase: mapTimestamps(row) };
}

export async function listCriminalCases(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  query: ExtensionListQuery,
  meta: RequestMeta,
) {
  requireMatterRead(account, organizationId);
  await requireMatter(db, organizationId, legalMatterId);
  const items = await db
    .select()
    .from(criminalCases)
    .where(
      and(
        eq(criminalCases.organizationId, organizationId),
        eq(criminalCases.legalMatterId, legalMatterId),
      ),
    )
    .limit(query.limit)
    .offset(query.offset);
  for (const row of items) {
    await auditSensitiveRead(
      db,
      account,
      organizationId,
      "criminal",
      "criminal_case",
      row.id,
      meta,
      legalMatterId,
    );
  }
  return { items: items.map(mapTimestamps) };
}

export async function createCriminalCase(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  input: Record<string, unknown>,
) {
  const row = await createMatterCase(
    db,
    account,
    organizationId,
    legalMatterId,
    criminalCases,
    input,
  );
  return { criminalCase: mapTimestamps(row) };
}

async function requireCriminalCase(
  db: AppDatabase,
  organizationId: string,
  criminalCaseId: string,
) {
  const row = await db.query.criminalCases.findFirst({
    where: and(
      eq(criminalCases.id, criminalCaseId),
      eq(criminalCases.organizationId, organizationId),
    ),
  });
  if (!row) throw new AppError("NOT_FOUND", "Caso criminal não encontrado.");
  return row;
}

export async function listCriminalCharges(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  criminalCaseId: string,
  query: ExtensionListQuery,
  meta: RequestMeta,
) {
  requireMatterRead(account, organizationId);
  const parent = await requireCriminalCase(db, organizationId, criminalCaseId);
  const items = await db
    .select()
    .from(criminalCharges)
    .where(
      and(
        eq(criminalCharges.organizationId, organizationId),
        eq(criminalCharges.criminalCaseId, criminalCaseId),
      ),
    )
    .limit(query.limit)
    .offset(query.offset);
  for (const row of items) {
    await auditSensitiveRead(
      db,
      account,
      organizationId,
      "criminal",
      "criminal_charge",
      row.id,
      meta,
      parent.legalMatterId,
    );
  }
  return { items: items.map(mapTimestamps) };
}

export async function createCriminalCharge(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  criminalCaseId: string,
  input: Omit<typeof criminalCharges.$inferInsert, "organizationId" | "criminalCaseId">,
) {
  requireMatterUpdate(account, organizationId);
  await requireCriminalCase(db, organizationId, criminalCaseId);
  const [row] = await db
    .insert(criminalCharges)
    .values({ ...input, organizationId, criminalCaseId })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar a imputação.");
  return { charge: mapTimestamps(row) };
}

export async function listCustodialMeasures(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  criminalCaseId: string,
  query: ExtensionListQuery,
  meta: RequestMeta,
) {
  requireMatterRead(account, organizationId);
  const parent = await requireCriminalCase(db, organizationId, criminalCaseId);
  const items = await db
    .select()
    .from(custodialMeasures)
    .where(
      and(
        eq(custodialMeasures.organizationId, organizationId),
        eq(custodialMeasures.criminalCaseId, criminalCaseId),
      ),
    )
    .limit(query.limit)
    .offset(query.offset);
  for (const row of items) {
    await auditSensitiveRead(
      db,
      account,
      organizationId,
      "criminal",
      "custodial_measure",
      row.id,
      meta,
      parent.legalMatterId,
    );
  }
  return { items: items.map(mapTimestamps) };
}

export async function createCustodialMeasure(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  criminalCaseId: string,
  input: Omit<typeof custodialMeasures.$inferInsert, "organizationId" | "criminalCaseId">,
) {
  requireMatterUpdate(account, organizationId);
  await requireCriminalCase(db, organizationId, criminalCaseId);
  const [row] = await db
    .insert(custodialMeasures)
    .values({ ...input, organizationId, criminalCaseId })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar a medida.");
  return { measure: mapTimestamps(row) };
}

export async function listSentencingInformation(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  criminalCaseId: string,
  query: ExtensionListQuery,
  meta: RequestMeta,
) {
  requireMatterRead(account, organizationId);
  const parent = await requireCriminalCase(db, organizationId, criminalCaseId);
  const items = await db
    .select()
    .from(sentencingInformation)
    .where(
      and(
        eq(sentencingInformation.organizationId, organizationId),
        eq(sentencingInformation.criminalCaseId, criminalCaseId),
      ),
    )
    .limit(query.limit)
    .offset(query.offset);
  for (const row of items) {
    await auditSensitiveRead(
      db,
      account,
      organizationId,
      "criminal",
      "sentencing_information",
      row.id,
      meta,
      parent.legalMatterId,
    );
  }
  return { items: items.map(mapTimestamps) };
}

export async function createSentencingInformation(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  criminalCaseId: string,
  input: Record<string, unknown>,
) {
  requireMatterUpdate(account, organizationId);
  await requireCriminalCase(db, organizationId, criminalCaseId);
  const [row] = await db
    .insert(sentencingInformation)
    .values(
      normalizeDateFields({
        ...input,
        organizationId,
        criminalCaseId,
      }) as typeof sentencingInformation.$inferInsert,
    )
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar a sentença.");
  return { sentencing: mapTimestamps(row) };
}

export async function listAdministrativeLawCases(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  query: ExtensionListQuery,
) {
  return listMatterCases(db, account, organizationId, legalMatterId, administrativeLawCases, query);
}

export async function createAdministrativeLawCase(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  input: Record<string, unknown>,
) {
  const row = await createMatterCase(
    db,
    account,
    organizationId,
    legalMatterId,
    administrativeLawCases,
    input,
  );
  return { administrativeLawCase: mapTimestamps(row) };
}

export async function listMedicalCases(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  query: ExtensionListQuery,
  meta: RequestMeta,
) {
  requireMatterRead(account, organizationId);
  await requireMatter(db, organizationId, legalMatterId);
  const items = await db
    .select()
    .from(medicalCases)
    .where(
      and(
        eq(medicalCases.organizationId, organizationId),
        eq(medicalCases.legalMatterId, legalMatterId),
      ),
    )
    .limit(query.limit)
    .offset(query.offset);
  for (const row of items) {
    await auditSensitiveRead(
      db,
      account,
      organizationId,
      "medical",
      "medical_case",
      row.id,
      meta,
      legalMatterId,
    );
  }
  return { items: items.map(mapTimestamps) };
}

export async function createMedicalCase(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  input: Record<string, unknown>,
) {
  const row = await createMatterCase(
    db,
    account,
    organizationId,
    legalMatterId,
    medicalCases,
    input,
  );
  return { medicalCase: mapTimestamps(row) };
}

export async function listRealEstateAssets(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  query: ExtensionListQuery,
) {
  requireMatterRead(account, organizationId);
  await requireMatter(db, organizationId, legalMatterId);
  const items = await db
    .select()
    .from(realEstateAssets)
    .where(
      and(
        eq(realEstateAssets.organizationId, organizationId),
        eq(realEstateAssets.legalMatterId, legalMatterId),
      ),
    )
    .limit(query.limit)
    .offset(query.offset);
  return { items: items.map(mapTimestamps) };
}

export async function createRealEstateAsset(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  input: Omit<typeof realEstateAssets.$inferInsert, "organizationId" | "legalMatterId">,
) {
  requireMatterUpdate(account, organizationId);
  await requireMatter(db, organizationId, legalMatterId);
  const [row] = await db
    .insert(realEstateAssets)
    .values({ ...input, organizationId, legalMatterId })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível registrar o imóvel.");
  return { asset: mapTimestamps(row) };
}

export async function listRealEstateCases(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  query: ExtensionListQuery,
) {
  return listMatterCases(db, account, organizationId, legalMatterId, realEstateCases, query);
}

export async function createRealEstateCase(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  input: Record<string, unknown>,
) {
  const row = await createMatterCase(
    db,
    account,
    organizationId,
    legalMatterId,
    realEstateCases,
    input,
  );
  return { realEstateCase: mapTimestamps(row) };
}

export async function listEnvironmentalCases(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  query: ExtensionListQuery,
) {
  return listMatterCases(db, account, organizationId, legalMatterId, environmentalCases, query);
}

export async function createEnvironmentalCase(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  input: Record<string, unknown>,
) {
  const row = await createMatterCase(
    db,
    account,
    organizationId,
    legalMatterId,
    environmentalCases,
    input,
  );
  return { environmentalCase: mapTimestamps(row) };
}

export async function listElectoralCases(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  query: ExtensionListQuery,
) {
  return listMatterCases(db, account, organizationId, legalMatterId, electoralCases, query);
}

export async function createElectoralCase(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  input: Record<string, unknown>,
) {
  const row = await createMatterCase(
    db,
    account,
    organizationId,
    legalMatterId,
    electoralCases,
    input,
  );
  return { electoralCase: mapTimestamps(row) };
}

export async function listSportsCases(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  query: ExtensionListQuery,
) {
  return listMatterCases(db, account, organizationId, legalMatterId, sportsCases, query);
}

export async function createSportsCase(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  input: Record<string, unknown>,
) {
  const row = await createMatterCase(
    db,
    account,
    organizationId,
    legalMatterId,
    sportsCases,
    input,
  );
  return { sportsCase: mapTimestamps(row) };
}

export async function listDigitalCases(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  query: ExtensionListQuery,
) {
  return listMatterCases(db, account, organizationId, legalMatterId, digitalCases, query);
}

export async function createDigitalCase(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  input: Record<string, unknown>,
) {
  const row = await createMatterCase(
    db,
    account,
    organizationId,
    legalMatterId,
    digitalCases,
    input,
  );
  return { digitalCase: mapTimestamps(row) };
}

export async function listInternationalCases(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  query: ExtensionListQuery,
) {
  return listMatterCases(db, account, organizationId, legalMatterId, internationalCases, query);
}

export async function createInternationalCase(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  input: Record<string, unknown>,
) {
  const row = await createMatterCase(
    db,
    account,
    organizationId,
    legalMatterId,
    internationalCases,
    input,
  );
  return { internationalCase: mapTimestamps(row) };
}

export async function listArbitrationCases(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  query: ExtensionListQuery,
) {
  return listMatterCases(db, account, organizationId, legalMatterId, arbitrationCases, query);
}

export async function createArbitrationCase(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  input: Record<string, unknown>,
) {
  const row = await createMatterCase(
    db,
    account,
    organizationId,
    legalMatterId,
    arbitrationCases,
    input,
  );
  return { arbitrationCase: mapTimestamps(row) };
}

export async function listMediationCases(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  query: ExtensionListQuery,
) {
  return listMatterCases(db, account, organizationId, legalMatterId, mediationCases, query);
}

export async function createMediationCase(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  legalMatterId: string,
  input: Record<string, unknown>,
) {
  const row = await createMatterCase(
    db,
    account,
    organizationId,
    legalMatterId,
    mediationCases,
    input,
  );
  return { mediationCase: mapTimestamps(row) };
}
