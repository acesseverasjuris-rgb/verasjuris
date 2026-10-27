import {
  createAiGatewayFromEnv,
  NotConfiguredAuctionBidProvider,
  NotConfiguredAuctionProvider,
  NotConfiguredOCRProvider,
  NotConfiguredPublicOpportunityProvider,
} from "@verasjuris/ai";
import { loadDotEnv, parseApiEnv, createLogger } from "@verasjuris/config";
import { assertReferenceData, createDatabase } from "@verasjuris/database";
import { createEmailProvider } from "@verasjuris/email";
import { createMalwareScanner, createStorageProvider } from "@verasjuris/storage";
import { buildApp } from "./app.js";

async function main(): Promise<void> {
  loadDotEnv();
  const env = parseApiEnv(process.env);
  const logger = createLogger("api", env.LOG_LEVEL);
  if (env.NODE_ENV === "production" && env.EMAIL_PROVIDER === "memory") {
    throw new Error(
      "EMAIL_PROVIDER=memory não é permitido em produção. Use not_configured até haver um provedor real.",
    );
  }
  const database = createDatabase(env.DATABASE_URL);
  try {
    await assertReferenceData(database.db);
  } catch (error) {
    logger.error(
      { message: error instanceof Error ? error.message : "dados de referência ausentes" },
      "A API não iniciou porque o banco não tem os papéis de referência.",
    );
    await database.close();
    process.exitCode = 1;
    return;
  }
  const app = await buildApp({
    db: database.db,
    logger,
    webOrigin: env.WEB_ORIGIN,
    isProduction: env.NODE_ENV === "production",
    email: createEmailProvider(env.EMAIL_PROVIDER),
    storage: createStorageProvider(env),
    malwareScanner: createMalwareScanner(env),
    documentMaxUploadBytes: env.DOCUMENT_MAX_UPLOAD_MB * 1024 * 1024,
    // Somente `not_configured` existe hoje (ver apiEnvSchema); nenhum provedor real é instanciado.
    aiGateway: createAiGatewayFromEnv({
      FEATURE_AI: process.env.FEATURE_AI,
      AI_PROVIDER: env.AI_PROVIDER,
      AI_DEFAULT_MODEL: env.AI_DEFAULT_MODEL,
      AI_REQUEST_TIMEOUT_MS: env.AI_REQUEST_TIMEOUT_MS,
      AI_MAX_RETRIES: env.AI_MAX_RETRIES,
      AI_MAX_INPUT_TOKENS: env.AI_MAX_INPUT_TOKENS,
    }),
    ocrProvider: new NotConfiguredOCRProvider(),
    publicOpportunityProvider: new NotConfiguredPublicOpportunityProvider(),
    auctionProvider: new NotConfiguredAuctionProvider(),
    auctionBidProvider: new NotConfiguredAuctionBidProvider(),
  });
  const shutdown = async () => {
    await app.close();
    await database.close();
  };
  process.on("SIGTERM", () => {
    void shutdown();
  });
  process.on("SIGINT", () => {
    void shutdown();
  });
  await app.listen({ host: env.API_HOST, port: env.API_PORT });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "falha desconhecida";
  console.error(`A API não iniciou. ${message}`);
  process.exitCode = 1;
});
