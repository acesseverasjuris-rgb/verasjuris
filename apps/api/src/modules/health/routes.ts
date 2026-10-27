import { buildHealthReport } from "@verasjuris/config";
import type { AppDatabase } from "@verasjuris/database";
import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

export async function checkDatabase(db: AppDatabase): Promise<"ok" | "unavailable"> {
  try {
    await db.execute(sql`select 1`);
    return "ok";
  } catch {
    return "unavailable";
  }
}

export function registerHealthRoutes(app: FastifyInstance, db: AppDatabase): void {
  const handler = async () => {
    const database = await checkDatabase(db);
    return { database, body: buildHealthReport({ database }) };
  };
  for (const path of ["/health", "/v1/health"]) {
    app.get(path, async (_request, reply) => {
      const result = await handler();
      return reply.status(result.database === "ok" ? 200 : 503).send(result.body);
    });
  }
}
