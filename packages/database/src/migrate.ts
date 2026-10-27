import { loadDotEnv, parseApiEnv } from "@verasjuris/config";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDatabase } from "./client.js";

export function migrationsFolder(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../drizzle");
}

export async function migrateDatabase(connectionString: string): Promise<void> {
  const database = createDatabase(connectionString, 1);
  try {
    await migrate(database.db, { migrationsFolder: migrationsFolder() });
  } finally {
    await database.close();
  }
}

async function main(): Promise<void> {
  loadDotEnv();
  const env = parseApiEnv(process.env);
  await migrateDatabase(env.DATABASE_URL);
  console.info("Migrations aplicadas.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "falha desconhecida";
    console.error(`Não foi possível aplicar as migrations. ${message}`);
    process.exitCode = 1;
  });
}
