import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));
const fromRoot = (relative: string) => path.join(root, relative);

export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
  ssr: {
    noExternal: [/@verasjuris\//],
  },
  resolve: {
    alias: [
      {
        find: "@verasjuris/database/testing",
        replacement: fromRoot("packages/database/src/testing.ts"),
      },
      { find: "@verasjuris/database", replacement: fromRoot("packages/database/src/index.ts") },
      { find: "@verasjuris/validation", replacement: fromRoot("packages/validation/src/index.ts") },
      {
        find: "@verasjuris/security/constants",
        replacement: fromRoot("packages/security/src/constants.ts"),
      },
      { find: "@verasjuris/security", replacement: fromRoot("packages/security/src/index.ts") },
      { find: "@verasjuris/config", replacement: fromRoot("packages/config/src/index.ts") },
      { find: "@verasjuris/types", replacement: fromRoot("packages/types/src/index.ts") },
      { find: "@verasjuris/events", replacement: fromRoot("packages/events/src/index.ts") },
      { find: "@verasjuris/audit", replacement: fromRoot("packages/audit/src/index.ts") },
      { find: "@verasjuris/auth", replacement: fromRoot("packages/auth/src/index.ts") },
      { find: "@verasjuris/ai/testing", replacement: fromRoot("packages/ai/src/testing.ts") },
      { find: "@verasjuris/ai", replacement: fromRoot("packages/ai/src/index.ts") },
      {
        find: "@verasjuris/calculations",
        replacement: fromRoot("packages/calculations/src/index.ts"),
      },
      { find: "@verasjuris/email", replacement: fromRoot("packages/email/src/index.ts") },
      { find: "@verasjuris/storage", replacement: fromRoot("packages/storage/src/index.ts") },
      {
        find: "@verasjuris/notifications",
        replacement: fromRoot("packages/notifications/src/index.ts"),
      },
    ],
  },
});
