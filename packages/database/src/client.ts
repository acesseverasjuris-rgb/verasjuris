import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { schema } from "./schema/index.js";

export type AppDatabase = PostgresJsDatabase<typeof schema>;

export function createDatabase(
  connectionString: string,
  max = 10,
): {
  db: AppDatabase;
  close: () => Promise<void>;
} {
  const client = postgres(connectionString, { max, connect_timeout: 10 });
  const db = drizzle(client, { schema });
  return {
    db,
    close: async () => {
      await client.end({ timeout: 5 });
    },
  };
}

export function isUniqueViolation(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if ("code" in current && current.code === "23505") return true;
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
}
