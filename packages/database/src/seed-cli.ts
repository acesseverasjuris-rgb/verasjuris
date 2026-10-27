import { loadDotEnv, parseSeedEnv } from "@verasjuris/config";
import { createDatabase } from "./client.js";
import { seed } from "./seed.js";

async function main(): Promise<void> {
  loadDotEnv();
  const env = parseSeedEnv(process.env);
  const database = createDatabase(env.DATABASE_URL, 1);
  try {
    await seed(database.db);
  } finally {
    await database.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "falha desconhecida";
  console.error(`Não foi possível executar o seed. ${message}`);
  process.exitCode = 1;
});
