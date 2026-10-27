import {
  DEFAULT_CRM_CHANNELS,
  DEFAULT_CRM_SOURCES,
  crmChannels,
  crmSources,
  type AppDatabase,
} from "@verasjuris/database";
import { and, eq } from "drizzle-orm";

export async function ensureCrmCatalog(
  db: Pick<AppDatabase, "query" | "insert">,
  organizationId: string,
): Promise<void> {
  for (const source of DEFAULT_CRM_SOURCES) {
    const existing = await db.query.crmSources.findFirst({
      where: and(eq(crmSources.organizationId, organizationId), eq(crmSources.key, source.key)),
    });
    if (!existing) {
      await db.insert(crmSources).values({
        organizationId,
        key: source.key,
        name: source.name,
        isSystem: true,
      });
    }
  }
  for (const channel of DEFAULT_CRM_CHANNELS) {
    const existing = await db.query.crmChannels.findFirst({
      where: and(eq(crmChannels.organizationId, organizationId), eq(crmChannels.key, channel.key)),
    });
    if (!existing) {
      await db.insert(crmChannels).values({
        organizationId,
        key: channel.key,
        name: channel.name,
        isSystem: true,
      });
    }
  }
}
