import {
  LEGAL_AREA_MODULE_KEYS,
  legalAreaChecklists,
  legalAreaFeatureConfig,
  legalAreaModules,
  type AppDatabase,
  type LegalAreaModuleKey,
} from "@verasjuris/database";
import { and, eq, inArray } from "drizzle-orm";

/** Capacidades conhecidas por módulo (fonte in-memory; sincronizada com `legal_area_feature_config`). */
export const LEGAL_AREA_FEATURES = {
  TAX: [
    "tax_calculation",
    "tax_credit",
    "tax_assessment",
    "tax_obligation",
    "tax_refund",
    "tax_compensation",
    "tax_enforcement",
    "tax_thesis",
    "tax_rule_set",
  ],
  CIVIL: ["civil_claim", "civil_damages", "civil_obligations", "versioned_rules"],
  CONSUMER: ["consumer_case", "cdc_checklist"],
  FAMILY: ["custody", "support", "divorce", "property_division", "family_relationship"],
  SUCCESSION: ["estate_case", "estate_inventory", "estate_shares"],
  CORPORATE: ["corporate_case", "corporate_transaction"],
  CRIMINAL: ["criminal_case", "criminal_charges", "custodial_measures", "sentencing"],
  ADMINISTRATIVE: ["administrative_law_case", "admin_process_link"],
  MEDICAL: ["medical_case", "health_plan_denial"],
  REAL_ESTATE: ["real_estate_asset", "real_estate_case"],
  ENVIRONMENTAL: ["environmental_case", "environmental_licensing"],
  ELECTORAL: ["electoral_case", "electoral_data_provider"],
  SPORTS: ["sports_case", "sports_federation"],
  DIGITAL: ["digital_case", "lgpd"],
  INTERNATIONAL: ["international_case", "cross_border"],
  ARBITRATION: ["arbitration_case", "arbitration_award"],
  MEDIATION: ["mediation_case", "mediation_settlement"],
} as const satisfies Record<LegalAreaModuleKey, readonly string[]>;

export type LegalAreaFeatureKey = (typeof LEGAL_AREA_FEATURES)[LegalAreaModuleKey][number];

export function getFeaturesForArea(key: LegalAreaModuleKey): readonly string[] {
  return LEGAL_AREA_FEATURES[key] ?? [];
}

export function hasFeature(area: LegalAreaModuleKey, feature: string): boolean {
  return getFeaturesForArea(area).includes(feature);
}

const MODULE_CATALOG: Record<LegalAreaModuleKey, { name: string; description: string }> = {
  TAX: { name: "Tributário", description: "Gestão tributária e cálculos fiscais." },
  CIVIL: { name: "Cível", description: "Pedidos, danos e obrigações em matéria cível." },
  CONSUMER: { name: "Consumidor", description: "Relações de consumo e CDC." },
  FAMILY: { name: "Família", description: "Divórcio, guarda, alimentos e partilha." },
  SUCCESSION: { name: "Sucessões", description: "Inventário, herdeiros e quinhões." },
  CORPORATE: { name: "Empresarial", description: "Operações societárias e contratos." },
  CRIMINAL: { name: "Penal", description: "Defesa criminal e medidas cautelares." },
  ADMINISTRATIVE: {
    name: "Administrativo",
    description: "Contencioso administrativo e processos vinculados.",
  },
  MEDICAL: { name: "Saúde", description: "Planos de saúde e responsabilidade médica." },
  REAL_ESTATE: { name: "Imobiliário", description: "Imóveis e litígios imobiliários." },
  ENVIRONMENTAL: { name: "Ambiental", description: "Licenciamento e infrações ambientais." },
  ELECTORAL: { name: "Eleitoral", description: "Contencioso e registros eleitorais." },
  SPORTS: { name: "Desportivo", description: "Justiça desportiva e contratos." },
  DIGITAL: { name: "Digital", description: "LGPD, plataformas e direito digital." },
  INTERNATIONAL: {
    name: "Internacional",
    description: "Jurisdições estrangeiras e cooperação.",
  },
  ARBITRATION: { name: "Arbitragem", description: "Procedimentos arbitrais." },
  MEDIATION: { name: "Mediação", description: "Mediação e autocomposição." },
};

export const SYSTEM_CHECKLIST_SEEDS = [
  {
    moduleKey: "FAMILY" as const,
    key: "FAMILY_DIVORCE",
    title: "Checklist — divórcio consensual",
    items: [
      { key: "marriage_cert", label: "Certidão de casamento atualizada", required: true },
      { key: "asset_list", label: "Relação de bens comuns", required: true },
      { key: "minors", label: "Guarda e visitas (se houver filhos)", required: false },
    ],
  },
  {
    moduleKey: "CRIMINAL" as const,
    key: "CRIMINAL_DEFENSE",
    title: "Checklist — defesa criminal inicial",
    items: [
      { key: "custody_status", label: "Situação custodial do cliente", required: true },
      { key: "charges_review", label: "Revisão da acusação", required: true },
    ],
  },
  {
    moduleKey: "MEDICAL" as const,
    key: "MEDICAL_HOME_CARE",
    title: "Checklist — home care / negativa de plano",
    items: [
      { key: "denial_letter", label: "Carta de negativa do plano", required: true },
      { key: "medical_report", label: "Laudo médico recente", required: true },
    ],
  },
  {
    moduleKey: "ENVIRONMENTAL" as const,
    key: "ENVIRONMENTAL_FINE",
    title: "Checklist — defesa de auto de infração",
    items: [
      { key: "infraction_notice", label: "Auto de infração", required: true },
      { key: "environmental_license", label: "Licenças ambientais vigentes", required: false },
    ],
  },
] as const;

let seedPromise: Promise<void> | null = null;

/** Garante catálogo SYSTEM + feature_config + checklists de exemplo (idempotente). */
export async function ensureLegalAreaCatalog(db: AppDatabase): Promise<void> {
  if (seedPromise) return seedPromise;
  seedPromise = seedLegalAreaCatalog(db);
  await seedPromise;
}

async function seedLegalAreaCatalog(db: AppDatabase): Promise<void> {
  const existing = await db.select({ id: legalAreaModules.id }).from(legalAreaModules).limit(1);
  if (existing.length > 0) {
    await syncAllModuleFeatures(db);
    return;
  }

  await db.transaction(async (tx) => {
    for (const key of LEGAL_AREA_MODULE_KEYS) {
      const meta = MODULE_CATALOG[key];
      const [moduleRow] = await tx
        .insert(legalAreaModules)
        .values({
          key,
          name: meta.name,
          description: meta.description,
          active: true,
          version: "1",
        })
        .returning();
      if (!moduleRow) continue;
      const features = getFeaturesForArea(key);
      if (features.length > 0) {
        await tx.insert(legalAreaFeatureConfig).values(
          features.map((featureKey) => ({
            moduleId: moduleRow.id,
            featureKey,
            active: true,
          })),
        );
      }
    }

    const modules = await tx.select().from(legalAreaModules);
    const byKey = new Map(modules.map((m) => [m.key, m.id]));

    for (const seed of SYSTEM_CHECKLIST_SEEDS) {
      const moduleId = byKey.get(seed.moduleKey);
      if (!moduleId) continue;
      const exists = await tx.query.legalAreaChecklists.findFirst({
        where: and(
          eq(legalAreaChecklists.moduleId, moduleId),
          eq(legalAreaChecklists.key, seed.key),
          eq(legalAreaChecklists.version, "1"),
        ),
      });
      if (exists) continue;
      await tx.insert(legalAreaChecklists).values({
        organizationId: null,
        moduleId,
        key: seed.key,
        title: seed.title,
        version: "1",
        status: "active",
        items: [...seed.items],
        isSystem: true,
      });
    }
  });
}

async function syncAllModuleFeatures(db: AppDatabase): Promise<void> {
  const modules = await db.select().from(legalAreaModules);
  for (const mod of modules) {
    await syncModuleFeaturesToDb(db, mod.id, mod.key);
  }
}

export async function syncModuleFeaturesToDb(
  db: AppDatabase,
  moduleId: string,
  moduleKey: LegalAreaModuleKey,
): Promise<void> {
  const expected = getFeaturesForArea(moduleKey);
  if (expected.length === 0) return;

  const rows = await db
    .select({ featureKey: legalAreaFeatureConfig.featureKey })
    .from(legalAreaFeatureConfig)
    .where(eq(legalAreaFeatureConfig.moduleId, moduleId));

  const present = new Set(rows.map((r) => r.featureKey));
  const missing = expected.filter((f) => !present.has(f));
  if (missing.length === 0) return;

  await db.insert(legalAreaFeatureConfig).values(
    missing.map((featureKey) => ({
      moduleId,
      featureKey,
      active: true,
    })),
  );
}

export async function resolveModuleByKey(db: AppDatabase, key: LegalAreaModuleKey) {
  await ensureLegalAreaCatalog(db);
  const row = await db.query.legalAreaModules.findFirst({
    where: eq(legalAreaModules.key, key),
  });
  return row ?? null;
}

export async function resolveModulesByKeys(db: AppDatabase, keys: LegalAreaModuleKey[]) {
  await ensureLegalAreaCatalog(db);
  if (keys.length === 0) return [];
  return db.select().from(legalAreaModules).where(inArray(legalAreaModules.key, keys));
}
