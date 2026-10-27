export const PLATFORM_VERSION = "0.1.0";

export type DependencyCheck = "ok" | "unavailable";

export type QueueHealthStatus = "not_configured" | "local_in_process";

export type HealthReport = {
  status: "ok" | "unavailable";
  timestamp: string;
  version: string;
  checks: {
    database: DependencyCheck;
    queue?: QueueHealthStatus;
  };
};

export function buildHealthReport(input: {
  database: DependencyCheck;
  queue?: QueueHealthStatus;
}): HealthReport {
  return {
    status: input.database === "ok" ? "ok" : "unavailable",
    timestamp: new Date().toISOString(),
    version: PLATFORM_VERSION,
    checks: {
      database: input.database,
      ...(input.queue ? { queue: input.queue } : {}),
    },
  };
}
