/**
 * @deprecated Prefer `@verasjuris/database` exports from `matters.ts`.
 * Mantido para imports legados (`legalCases` → `legalMatters`).
 */
export {
  legalCases,
  legalCasesRelations,
  legalMatterStatusEnum as legalCaseStatusEnum,
  legalMatters,
  legalMattersRelations,
  legalMatterStatusEnum,
} from "./matters.js";
