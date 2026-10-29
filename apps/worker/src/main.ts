import { createLogger, loadDotEnv, parseWorkerEnv } from "@verasjuris/config";
import { createDatabase } from "@verasjuris/database";
import { createJobQueueFromEnv, LocalInProcessQueueProvider } from "@verasjuris/events";
import { createStorageProvider } from "@verasjuris/storage";
import { buildWorkerApp, checkDatabase } from "./app.js";
import { registerLocalAlertHandlers } from "./jobs/alert-handlers.js";
import { registerLocalTaxContractHandlers } from "./jobs/tax-contract-handlers.js";
import { registerLocalCommunicationHandlers } from "./jobs/communication-handlers.js";
import { registerLocalOnlineLawyerHandlers } from "./jobs/online-lawyer-handlers.js";
import { registerLocalMarketplaceHandlers } from "./jobs/marketplace-handlers.js";
import { registerLocalEducationFinanceHandlers } from "./jobs/education-finance-handlers.js";
import { registerLocalMonetizationTreasuryHandlers } from "./jobs/monetization-treasury-handlers.js";
import {
  createStorageReconciliationHandler,
  STORAGE_RECONCILIATION_JOB,
} from "./jobs/storage-reconciliation.js";

async function main(): Promise<void> {
  loadDotEnv();
  const env = parseWorkerEnv(process.env);
  const logger = createLogger("worker", env.LOG_LEVEL);
  const database = createDatabase(env.DATABASE_URL);
  // Produção: not_configured. Local: FEATURE_LOCAL_QUEUE=true|1 ou LOCAL_QUEUE=enabled.
  const queue = createJobQueueFromEnv(process.env);
  if (queue instanceof LocalInProcessQueueProvider) {
    registerLocalAlertHandlers(queue, database.db);
    registerLocalTaxContractHandlers(queue, database.db);
    registerLocalCommunicationHandlers(queue, database.db);
    registerLocalOnlineLawyerHandlers(queue, database.db);
    registerLocalMarketplaceHandlers(queue, database.db);
    registerLocalEducationFinanceHandlers(queue, database.db);
    registerLocalMonetizationTreasuryHandlers(queue, database.db);
    queue.registerHandler(
      STORAGE_RECONCILIATION_JOB,
      createStorageReconciliationHandler({
        db: database.db,
        storage: createStorageProvider(process.env),
      }),
    );
  }
  const app = await buildWorkerApp({
    logger,
    checkDatabase: () => checkDatabase(database.db),
    queue,
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
  await app.listen({ host: env.WORKER_HOST, port: env.WORKER_PORT });
  if (queue.status === "local_in_process") {
    logger.info(
      "Worker com LocalInProcessQueueProvider (FEATURE_LOCAL_QUEUE/LOCAL_QUEUE). Não é fila distribuída.",
    );
  } else {
    logger.info(
      "Worker em execução. A fila permanece não configurada; nenhum trabalho será agendado.",
    );
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "falha desconhecida";
  console.error(`O worker não iniciou. ${message}`);
  process.exitCode = 1;
});
