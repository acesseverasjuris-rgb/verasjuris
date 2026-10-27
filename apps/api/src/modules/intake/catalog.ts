import { DEFAULT_LEGAL_AREAS, legalAreas, type AppDatabase } from "@verasjuris/database";
import { and, eq } from "drizzle-orm";

export async function ensureLegalAreasCatalog(
  db: Pick<AppDatabase, "query" | "insert">,
  organizationId: string,
): Promise<void> {
  for (const area of DEFAULT_LEGAL_AREAS) {
    const existing = await db.query.legalAreas.findFirst({
      where: and(eq(legalAreas.organizationId, organizationId), eq(legalAreas.slug, area.slug)),
    });
    if (!existing) {
      await db.insert(legalAreas).values({
        organizationId,
        slug: area.slug,
        name: area.name,
        sortOrder: area.sortOrder,
        isSystem: true,
      });
    }
  }
}
