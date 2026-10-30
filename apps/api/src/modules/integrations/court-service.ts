import type { CourtIntegrationProvider } from "@verasjuris/ai";
import type { SessionAccount } from "@verasjuris/auth";
import { policyIntegration } from "@verasjuris/auth";
import type { AppDatabase } from "@verasjuris/database";
import { courtDataSources } from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, desc, eq } from "drizzle-orm";
import type { RequestMeta } from "../auth/service.js";
import { requireOrganizationPermission } from "../auth/routes.js";

function authorize(
  account: SessionAccount,
  organizationId: string,
  permission: "integration.read" | "integration.manage",
) {
  requireOrganizationPermission(account, organizationId, permission);
  const membership = account.memberships.find((m) => m.organizationId === organizationId)!;
  const decision = policyIntegration(
    {
      status: membership.membershipStatus,
      organizationStatus: membership.organizationStatus,
      permissions: membership.permissions,
      roles: membership.roles,
    },
    permission,
  );
  if (!decision.ok) throw new AppError(decision.code, decision.message);
}

export class CourtDataSourceService {
  constructor(
    private readonly db: AppDatabase,
    private readonly courtProvider: CourtIntegrationProvider,
  ) {}

  async list(account: SessionAccount, organizationId: string) {
    authorize(account, organizationId, "integration.read");
    const items = await this.db.query.courtDataSources.findMany({
      where: eq(courtDataSources.organizationId, organizationId),
      orderBy: [desc(courtDataSources.createdAt)],
    });
    return {
      items: items.map((row) => ({
        id: row.id,
        tribunal: row.tribunal,
        providerKey: row.providerKey,
        externalReference: row.externalReference,
        syncStatus: row.syncStatus,
        fetchedAt: row.fetchedAt?.toISOString() ?? null,
        confidence: row.confidence,
        source: row.source,
      })),
    };
  }

  async create(
    account: SessionAccount,
    organizationId: string,
    input: {
      tribunal: string;
      providerKey: string;
      externalReference: string;
      legalMatterId?: string;
      judicialProcessId?: string;
    },
    _meta: RequestMeta,
  ) {
    authorize(account, organizationId, "integration.manage");
    const [row] = await this.db
      .insert(courtDataSources)
      .values({
        organizationId,
        tribunal: input.tribunal,
        providerKey: input.providerKey,
        externalReference: input.externalReference,
        legalMatterId: input.legalMatterId ?? null,
        judicialProcessId: input.judicialProcessId ?? null,
        syncStatus: "pending",
      })
      .returning();
    return {
      source: {
        id: row!.id,
        tribunal: row!.tribunal,
        providerKey: row!.providerKey,
        externalReference: row!.externalReference,
        syncStatus: row!.syncStatus,
      },
    };
  }

  async sync(account: SessionAccount, organizationId: string, sourceId: string) {
    authorize(account, organizationId, "integration.manage");
    const row = await this.db.query.courtDataSources.findFirst({
      where: and(
        eq(courtDataSources.id, sourceId),
        eq(courtDataSources.organizationId, organizationId),
      ),
    });
    if (!row) throw new AppError("NOT_FOUND", "Fonte de dados judiciais não encontrada.");

    await this.db
      .update(courtDataSources)
      .set({ syncStatus: "syncing", updatedAt: new Date() })
      .where(eq(courtDataSources.id, sourceId));

    const health = await this.courtProvider.healthCheck();
    if (health.status === "not_configured" || this.courtProvider.id === "not_configured") {
      const [updated] = await this.db
        .update(courtDataSources)
        .set({
          syncStatus: "not_configured",
          source: this.courtProvider.id,
          metadata: { detail: health.detail ?? null },
          updatedAt: new Date(),
        })
        .where(eq(courtDataSources.id, sourceId))
        .returning();
      return {
        source: {
          id: updated!.id,
          syncStatus: updated!.syncStatus,
          fetchedAt: updated!.fetchedAt?.toISOString() ?? null,
        },
        providerStatus: "not_configured" as const,
      };
    }

    try {
      const process = await this.courtProvider.getProcess(row.externalReference);
      const syncStatus = process ? "synced" : "failed";
      const [updated] = await this.db
        .update(courtDataSources)
        .set({
          syncStatus,
          fetchedAt: process ? new Date() : row.fetchedAt,
          source: process?.providerKey ?? this.courtProvider.id,
          confidence: process ? "provider" : null,
          metadata: process ? { caseNumber: process.caseNumber } : { detail: "empty" },
          updatedAt: new Date(),
        })
        .where(eq(courtDataSources.id, sourceId))
        .returning();
      return {
        source: {
          id: updated!.id,
          syncStatus: updated!.syncStatus,
          fetchedAt: updated!.fetchedAt?.toISOString() ?? null,
        },
        providerStatus: syncStatus === "synced" ? ("ok" as const) : ("failed" as const),
      };
    } catch (error) {
      await this.db
        .update(courtDataSources)
        .set({ syncStatus: "failed", updatedAt: new Date() })
        .where(eq(courtDataSources.id, sourceId));
      throw error;
    }
  }
}
