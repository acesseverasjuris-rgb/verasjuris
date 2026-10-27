import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AppDatabase } from "./client.js";
import { schema } from "./schema/index.js";

export async function createTestDatabase(): Promise<{
  db: AppDatabase;
  close: () => Promise<void>;
}> {
  const client = new PGlite();
  const raw = drizzle(client, { schema });
  const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../drizzle");
  await migrate(raw, { migrationsFolder });
  return {
    db: raw as unknown as AppDatabase,
    close: async () => {
      await client.close();
    },
  };
}
