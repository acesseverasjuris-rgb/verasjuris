import {
  courts,
  judicialPhaseCatalog,
  proceduralClasses,
  proceduralSubjects,
  SEED_COURTS,
  SEED_DEV_SOURCE,
  SEED_DEV_VERSION,
  SEED_JUDICIAL_PHASES,
  SEED_PROCEDURAL_CLASSES,
  SEED_PROCEDURAL_SUBJECTS,
  type AppDatabase,
} from "@verasjuris/database";
import { eq } from "drizzle-orm";

type CatalogDb = Pick<AppDatabase, "query" | "insert">;

export async function ensureJudicialReferenceCatalog(db: CatalogDb): Promise<void> {
  for (const court of SEED_COURTS) {
    const existing = await db.query.courts.findFirst({
      where: eq(courts.code, court.code),
    });
    if (!existing) {
      await db.insert(courts).values({
        code: court.code,
        name: court.name,
        acronym: court.acronym,
        branch: court.branch,
        jurisdictionLevel: court.jurisdictionLevel,
        stateCode: court.stateCode,
        source: SEED_DEV_SOURCE,
        sourceVersion: SEED_DEV_VERSION,
      });
    }
  }

  for (const item of SEED_PROCEDURAL_CLASSES) {
    const existing = await db.query.proceduralClasses.findFirst({
      where: eq(proceduralClasses.name, item.name),
    });
    if (!existing) {
      await db.insert(proceduralClasses).values({
        code: item.code,
        name: item.name,
        source: SEED_DEV_SOURCE,
      });
    }
  }

  for (const item of SEED_PROCEDURAL_SUBJECTS) {
    const existing = await db.query.proceduralSubjects.findFirst({
      where: eq(proceduralSubjects.name, item.name),
    });
    if (!existing) {
      await db.insert(proceduralSubjects).values({
        code: item.code,
        name: item.name,
        source: SEED_DEV_SOURCE,
      });
    }
  }

  for (const phase of SEED_JUDICIAL_PHASES) {
    const existing = await db.query.judicialPhaseCatalog.findFirst({
      where: eq(judicialPhaseCatalog.slug, phase.slug),
    });
    if (!existing) {
      await db.insert(judicialPhaseCatalog).values({
        slug: phase.slug,
        name: phase.name,
        sortOrder: phase.sortOrder,
        source: SEED_DEV_SOURCE,
      });
    }
  }
}
