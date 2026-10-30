import type { ObservabilityProvider, StatusPageProvider, BackupProvider } from "@verasjuris/ai";
import type { SessionAccount } from "@verasjuris/auth";
import type { AppDatabase } from "@verasjuris/database";
import { disasterRecoveryExercises, serviceSlos } from "@verasjuris/database";
import type { JobQueue } from "@verasjuris/events";
import { desc, eq } from "drizzle-orm";
import { requireOrganizationPermission } from "../auth/routes.js";
import { checkDatabase } from "../health/routes.js";

export class ObservabilityService {
  constructor(
    private readonly db: AppDatabase,
    private readonly observability?: ObservabilityProvider | null,
    private readonly statusPage?: StatusPageProvider | null,
    private readonly backup?: BackupProvider | null,
    private readonly jobQueue?: JobQueue | null,
  ) {}

  async live() {
    return { status: "ok" as const, checkedAt: new Date().toISOString() };
  }

  async ready() {
    const database = await checkDatabase(this.db);
    return {
      status: database === "ok" ? ("ok" as const) : ("unavailable" as const),
      database,
      checkedAt: new Date().toISOString(),
    };
  }

  async operationsDashboard(account: SessionAccount, organizationId: string) {
    requireOrganizationPermission(account, organizationId, "observability.read");
    const slos = await this.db.query.serviceSlos.findMany({
      where: eq(serviceSlos.organizationId, organizationId),
      orderBy: [desc(serviceSlos.updatedAt)],
      limit: 50,
    });
    const exercises = await this.db.query.disasterRecoveryExercises.findMany({
      where: eq(disasterRecoveryExercises.organizationId, organizationId),
      limit: 20,
    });

    let queueStats: { status: string; detail?: string } = {
      status: this.jobQueue?.status ?? "not_configured",
      detail: this.jobQueue ? undefined : "JobQueue não injetado.",
    };
    if (
      this.jobQueue &&
      "stats" in this.jobQueue &&
      typeof (this.jobQueue as { stats?: () => unknown }).stats === "function"
    ) {
      queueStats = { status: this.jobQueue.status, detail: "stats_available" };
    }

    let observabilityHealth = {
      status: "not_configured" as string,
      detail: "ObservabilityProvider não configurado.",
    };
    if (this.observability) {
      const h = await this.observability.healthCheck();
      observabilityHealth = {
        status: h.status,
        detail: h.detail ?? "ObservabilityProvider health sem detalhe.",
      };
    }

    return {
      jobs: queueStats,
      queues: queueStats,
      slos: slos.length ? slos : [],
      errors: {
        status: observabilityHealth.status,
        detail: observabilityHealth.detail,
      },
      disasterRecoveryExercises: exercises,
      providers: {
        observability: observabilityHealth,
        statusPage: this.statusPage
          ? await this.statusPage.healthCheck()
          : { status: "not_configured" },
        backup: this.backup ? await this.backup.healthCheck() : { status: "not_configured" },
      },
    };
  }

  async internalStatus() {
    const database = await checkDatabase(this.db);
    const live = await this.live();
    const ready = await this.ready();
    return {
      live,
      ready,
      database,
      checkedAt: new Date().toISOString(),
    };
  }
}
