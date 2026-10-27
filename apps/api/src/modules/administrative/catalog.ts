import {
  administrativeBodies,
  SEED_ADMIN_DEV_SOURCE,
  SEED_ADMINISTRATIVE_BODIES,
  type AppDatabase,
} from "@verasjuris/database";
import { eq } from "drizzle-orm";

type CatalogDb = Pick<AppDatabase, "query" | "insert">;

export async function ensureAdministrativeReferenceCatalog(db: CatalogDb): Promise<void> {
  for (const body of SEED_ADMINISTRATIVE_BODIES) {
    const existing = await db.query.administrativeBodies.findFirst({
      where: eq(administrativeBodies.name, body.name),
    });
    if (!existing) {
      await db.insert(administrativeBodies).values({
        code: body.code,
        name: body.name,
        acronym: body.acronym,
        bodyType: body.bodyType,
        jurisdiction: body.jurisdiction,
        stateCode: body.stateCode,
        source: SEED_ADMIN_DEV_SOURCE,
        active: true,
      });
    }
  }
}

/** @deprecated alias — use ensureAdministrativeReferenceCatalog */
export const ensureAdministrativeBodiesCatalog = ensureAdministrativeReferenceCatalog;
