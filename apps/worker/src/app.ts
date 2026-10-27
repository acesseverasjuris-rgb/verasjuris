import { buildHealthReport } from "@verasjuris/config";
import type { AppDatabase } from "@verasjuris/database";
import { createJobQueueFromEnv, type JobQueue, type JobQueueEnv } from "@verasjuris/events";
import { sql } from "drizzle-orm";
import Fastify, { type FastifyBaseLogger, LogController } from "fastify";
import type { Logger } from "pino";

export async function checkDatabase(db: AppDatabase): Promise<"ok" | "unavailable"> {
  try {
    await db.execute(sql`select 1`);
    return "ok";
  } catch {
    return "unavailable";
  }
}

/**
 * Worker health app.
 *
 * Fila: padrão `not_configured` (sem fallback silencioso).
 * Com `FEATURE_LOCAL_QUEUE=true|1` ou `LOCAL_QUEUE=enabled`, usa `LocalInProcessQueueProvider`
 * (enqueue/processNext reais no processo — não é broker distribuído).
 */
export async function buildWorkerApp(options: {
  checkDatabase: () => Promise<"ok" | "unavailable">;
  logger: Logger | boolean;
  /** Injeta fila (testes) ou deriva do env. */
  queue?: JobQueue;
  env?: JobQueueEnv;
}) {
  const app = Fastify({
    ...(typeof options.logger === "boolean"
      ? { logger: options.logger }
      : { loggerInstance: options.logger as FastifyBaseLogger }),
    logController: new LogController({ disableRequestLogging: true }),
  });
  const queue = options.queue ?? createJobQueueFromEnv(options.env ?? {});
  app.get("/health", async (_request, reply) => {
    const database = await options.checkDatabase();
    const body = buildHealthReport({ database, queue: queue.status });
    return reply.status(database === "ok" ? 200 : 503).send(body);
  });
  return app;
}
