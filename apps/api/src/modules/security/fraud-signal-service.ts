import type { SessionAccount } from "@verasjuris/auth";
import type { AppDatabase } from "@verasjuris/database";
import { securityEvents } from "@verasjuris/database";
import { desc, eq } from "drizzle-orm";
import { requireOrganizationPermission } from "../auth/routes.js";

/** Sinais de fraude registrados como security_events (payment_anomaly / api_abuse) — sem inventar scores. */
export class FraudSignalService {
  constructor(private readonly db: AppDatabase) {}

  async record(
    account: SessionAccount,
    organizationId: string,
    input: {
      signalType: "payment_anomaly" | "api_abuse" | "other";
      summary: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    requireOrganizationPermission(account, organizationId, "security.alert.manage");
    const [row] = await this.db
      .insert(securityEvents)
      .values({
        type: input.signalType,
        severity: "medium",
        organizationId,
        userId: account.user.id,
        metadata: { summary: input.summary, ...(input.metadata ?? {}), kind: "fraud_signal" },
      })
      .returning();
    return { signal: row };
  }

  async list(account: SessionAccount, organizationId: string) {
    requireOrganizationPermission(account, organizationId, "security.events.read");
    const items = await this.db.query.securityEvents.findMany({
      where: eq(securityEvents.organizationId, organizationId),
      orderBy: [desc(securityEvents.createdAt)],
      limit: 100,
    });
    return {
      items: items.filter((row) => {
        const meta = row.metadata as Record<string, unknown> | null;
        return (
          meta?.kind === "fraud_signal" ||
          row.type === "payment_anomaly" ||
          row.type === "api_abuse"
        );
      }),
    };
  }
}
