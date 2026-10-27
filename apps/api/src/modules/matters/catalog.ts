import { DEFAULT_DEMAND_TYPES, legalDemandTypes, type AppDatabase } from "@verasjuris/database";
import { and, eq } from "drizzle-orm";

export async function ensureDemandTypesCatalog(
  db: Pick<AppDatabase, "query" | "insert">,
  organizationId: string,
): Promise<void> {
  for (const demandType of DEFAULT_DEMAND_TYPES) {
    const existing = await db.query.legalDemandTypes.findFirst({
      where: and(
        eq(legalDemandTypes.organizationId, organizationId),
        eq(legalDemandTypes.slug, demandType.slug),
      ),
    });
    if (!existing) {
      await db.insert(legalDemandTypes).values({
        organizationId,
        slug: demandType.slug,
        name: demandType.name,
        sortOrder: demandType.sortOrder,
        isSystem: true,
      });
    }
  }
}
