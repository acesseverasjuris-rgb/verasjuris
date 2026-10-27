export { createDatabase, isUniqueViolation, type AppDatabase } from "./client.js";
export type DatabaseExecutor = Pick<
  import("./client.js").AppDatabase,
  "insert" | "select" | "update" | "delete" | "query" | "execute"
>;
export { assertReferenceData, seed, seedDevelopmentUser, seedReferenceData } from "./seed.js";
export * from "./schema/index.js";
