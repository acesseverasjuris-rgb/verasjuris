import { crmLossReasons, DEFAULT_LOSS_REASONS, type AppDatabase } from "@verasjuris/database";
import { and, eq } from "drizzle-orm";

export async function ensureLossReasonsCatalog(
  db: Pick<AppDatabase, "query" | "insert">,
  organizationId: string,
): Promise<void> {
  for (const reason of DEFAULT_LOSS_REASONS) {
    const existing = await db.query.crmLossReasons.findFirst({
      where: and(
        eq(crmLossReasons.organizationId, organizationId),
        eq(crmLossReasons.slug, reason.slug),
      ),
    });
    if (!existing) {
      await db.insert(crmLossReasons).values({
        organizationId,
        slug: reason.slug,
        name: reason.name,
        sortOrder: reason.sortOrder,
        isSystem: true,
        active: true,
      });
    }
  }
}
