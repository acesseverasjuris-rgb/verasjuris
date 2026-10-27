import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { crmClients } from "./crm.js";
import { documents } from "./documents.js";
import { organizationMembers, organizations } from "./identity.js";
import { judicialProcesses } from "./judicial.js";
import { legalMatters } from "./matters.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const laborClientRoleEnum = pgEnum("labor_client_role", ["employee", "employer", "other"]);

export const laborCaseStatusEnum = pgEnum("labor_case_status", [
  "draft",
  "active",
  "suspended",
  "closed",
  "archived",
]);

export const employmentContractStatusEnum = pgEnum("employment_contract_status", [
  "draft",
  "active",
  "suspended",
  "terminated",
  "cancelled",
  "archived",
]);

export const employmentContractSourceEnum = pgEnum("employment_contract_source", [
  "manual",
  "document",
  "import",
  "provider",
  "not_configured",
]);

export const employmentContractHistoryKindEnum = pgEnum("employment_contract_history_kind", [
  "job_title",
  "salary",
  "schedule",
  "workplace",
  "suspension",
  "leave",
  "contract_change",
  "other",
]);

export const workTimeRecordSourceEnum = pgEnum("work_time_record_source", [
  "manual",
  "import",
  "provider",
  "not_configured",
]);

export const laborRemunerationItemTypeEnum = pgEnum("labor_remuneration_item_type", [
  "salary",
  "commission",
  "gratification",
  "additional",
  "bonus",
  "tip",
  "variable",
  "benefit",
  "deduction",
  "other",
]);

export const vacationPeriodStatusEnum = pgEnum("vacation_period_status", [
  "accruing",
  "available",
  "scheduled",
  "enjoyed",
  "sold",
  "paid",
  "cancelled",
]);

export const fgtsReviewStatusEnum = pgEnum("fgts_review_status", [
  "unreviewed",
  "accepted",
  "rejected",
  "needs_review",
]);

export const employmentTerminationStatusEnum = pgEnum("employment_termination_status", [
  "draft",
  "calculated",
  "review_required",
  "reviewed",
  "finalized",
  "cancelled",
]);

export const laborClaimItemStatusEnum = pgEnum("labor_claim_item_status", [
  "draft",
  "active",
  "withdrawn",
  "settled",
  "rejected",
  "superseded",
]);

export const laborRuleSetStatusEnum = pgEnum("labor_rule_set_status", [
  "draft",
  "active",
  "deprecated",
  "archived",
]);

export const laborCalculationStatusEnum = pgEnum("labor_calculation_status", [
  "draft",
  "calculated",
  "review_required",
  "reviewed",
  "approved",
  "superseded",
]);

export const laborLiquidationStatusEnum = pgEnum("labor_liquidation_status", [
  "draft",
  "calculated",
  "review_required",
  "reviewed",
  "approved",
  "superseded",
  "cancelled",
]);

export const laborCases = pgTable(
  "labor_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => crmClients.id, { onDelete: "restrict" }),
    legalMatterId: uuid("legal_matter_id")
      .notNull()
      .references(() => legalMatters.id, { onDelete: "cascade" }),
    judicialProcessId: uuid("judicial_process_id").references(() => judicialProcesses.id, {
      onDelete: "set null",
    }),
    responsibleMembershipId: uuid("responsible_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    clientRole: laborClientRoleEnum("client_role").notNull().default("employee"),
    status: laborCaseStatusEnum("status").notNull().default("draft"),
    notes: text("notes"),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("labor_cases_org_idx").on(table.organizationId),
    index("labor_cases_org_client_idx").on(table.organizationId, table.clientId),
    index("labor_cases_org_status_idx").on(table.organizationId, table.status),
    index("labor_cases_matter_idx").on(table.legalMatterId),
    index("labor_cases_judicial_idx").on(table.judicialProcessId),
    index("labor_cases_responsible_idx").on(table.responsibleMembershipId),
  ],
);

export const employmentContracts = pgTable(
  "employment_contracts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    laborCaseId: uuid("labor_case_id")
      .notNull()
      .references(() => laborCases.id, { onDelete: "cascade" }),
    employeeClientId: uuid("employee_client_id").references(() => crmClients.id, {
      onDelete: "set null",
    }),
    employerName: text("employer_name").notNull(),
    employerDocument: text("employer_document"),
    admissionDate: timestamp("admission_date", { withTimezone: true, mode: "date" }).notNull(),
    terminationDate: timestamp("termination_date", { withTimezone: true, mode: "date" }),
    contractType: text("contract_type"),
    jobTitle: text("job_title"),
    workplace: text("workplace"),
    salaryCents: bigint("salary_cents", { mode: "number" }).notNull().default(0),
    remunerationStructure: jsonb("remuneration_structure").$type<Record<string, unknown>>(),
    weeklyHours: integer("weekly_hours"),
    status: employmentContractStatusEnum("status").notNull().default("draft"),
    source: employmentContractSourceEnum("source").notNull().default("manual"),
    ...timestamps,
  },
  (table) => [
    index("employment_contracts_org_idx").on(table.organizationId),
    index("employment_contracts_case_idx").on(table.laborCaseId),
    index("employment_contracts_org_status_idx").on(table.organizationId, table.status),
    index("employment_contracts_admission_idx").on(table.admissionDate),
    index("employment_contracts_employee_idx").on(table.employeeClientId),
  ],
);

export const employmentContractHistory = pgTable(
  "employment_contract_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => employmentContracts.id, { onDelete: "cascade" }),
    kind: employmentContractHistoryKindEnum("kind").notNull().default("other"),
    effectiveFrom: timestamp("effective_from", { withTimezone: true, mode: "date" }).notNull(),
    effectiveTo: timestamp("effective_to", { withTimezone: true, mode: "date" }),
    previousValue: jsonb("previous_value").$type<Record<string, unknown>>(),
    newValue: jsonb("new_value").$type<Record<string, unknown>>(),
    notes: text("notes"),
    source: employmentContractSourceEnum("source").notNull().default("manual"),
    actorMembershipId: uuid("actor_membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("employment_contract_history_org_idx").on(table.organizationId),
    index("employment_contract_history_contract_idx").on(table.contractId, table.effectiveFrom),
  ],
);

export const workSchedules = pgTable(
  "work_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    laborCaseId: uuid("labor_case_id")
      .notNull()
      .references(() => laborCases.id, { onDelete: "cascade" }),
    contractId: uuid("contract_id").references(() => employmentContracts.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    weeklyHours: integer("weekly_hours"),
    schedulePattern: jsonb("schedule_pattern").$type<Record<string, unknown>>(),
    includesNightShift: boolean("includes_night_shift").notNull().default(false),
    includesOvertimeBank: boolean("includes_overtime_bank").notNull().default(false),
    effectiveFrom: timestamp("effective_from", { withTimezone: true, mode: "date" }),
    effectiveTo: timestamp("effective_to", { withTimezone: true, mode: "date" }),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("work_schedules_org_idx").on(table.organizationId),
    index("work_schedules_case_idx").on(table.laborCaseId),
    index("work_schedules_contract_idx").on(table.contractId),
  ],
);

export const workTimeRecords = pgTable(
  "work_time_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    laborCaseId: uuid("labor_case_id")
      .notNull()
      .references(() => laborCases.id, { onDelete: "cascade" }),
    contractId: uuid("contract_id").references(() => employmentContracts.id, {
      onDelete: "set null",
    }),
    scheduleId: uuid("schedule_id").references(() => workSchedules.id, { onDelete: "set null" }),
    workDate: timestamp("work_date", { withTimezone: true, mode: "date" }).notNull(),
    clockInAt: timestamp("clock_in_at", { withTimezone: true, mode: "date" }),
    clockOutAt: timestamp("clock_out_at", { withTimezone: true, mode: "date" }),
    breakMinutes: integer("break_minutes"),
    overtimeMinutes: integer("overtime_minutes"),
    nightMinutes: integer("night_minutes"),
    notes: text("notes"),
    source: workTimeRecordSourceEnum("source").notNull().default("manual"),
    ...timestamps,
  },
  (table) => [
    index("work_time_records_org_idx").on(table.organizationId),
    index("work_time_records_case_idx").on(table.laborCaseId),
    index("work_time_records_date_idx").on(table.organizationId, table.workDate),
    index("work_time_records_contract_idx").on(table.contractId),
  ],
);

export const laborRemunerationItems = pgTable(
  "labor_remuneration_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    laborCaseId: uuid("labor_case_id")
      .notNull()
      .references(() => laborCases.id, { onDelete: "cascade" }),
    contractId: uuid("contract_id").references(() => employmentContracts.id, {
      onDelete: "set null",
    }),
    itemType: laborRemunerationItemTypeEnum("item_type").notNull().default("other"),
    description: text("description").notNull(),
    competence: text("competence"),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull().default(0),
    isCredit: boolean("is_credit").notNull().default(true),
    source: employmentContractSourceEnum("source").notNull().default("manual"),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [
    index("labor_remuneration_items_org_idx").on(table.organizationId),
    index("labor_remuneration_items_case_idx").on(table.laborCaseId),
    index("labor_remuneration_items_competence_idx").on(table.organizationId, table.competence),
    index("labor_remuneration_items_type_idx").on(table.organizationId, table.itemType),
  ],
);

export const vacationPeriods = pgTable(
  "vacation_periods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    laborCaseId: uuid("labor_case_id")
      .notNull()
      .references(() => laborCases.id, { onDelete: "cascade" }),
    contractId: uuid("contract_id").references(() => employmentContracts.id, {
      onDelete: "set null",
    }),
    accrualStart: timestamp("accrual_start", { withTimezone: true, mode: "date" }).notNull(),
    accrualEnd: timestamp("accrual_end", { withTimezone: true, mode: "date" }).notNull(),
    concessionStart: timestamp("concession_start", { withTimezone: true, mode: "date" }),
    concessionEnd: timestamp("concession_end", { withTimezone: true, mode: "date" }),
    enjoyedDays: integer("enjoyed_days").notNull().default(0),
    soldDays: integer("sold_days").notNull().default(0),
    paymentDate: timestamp("payment_date", { withTimezone: true, mode: "date" }),
    amountCents: bigint("amount_cents", { mode: "number" }),
    status: vacationPeriodStatusEnum("status").notNull().default("accruing"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("vacation_periods_org_idx").on(table.organizationId),
    index("vacation_periods_case_idx").on(table.laborCaseId),
    index("vacation_periods_org_status_idx").on(table.organizationId, table.status),
    index("vacation_periods_accrual_idx").on(table.accrualStart, table.accrualEnd),
  ],
);

export const fgtsRecords = pgTable(
  "fgts_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    laborCaseId: uuid("labor_case_id")
      .notNull()
      .references(() => laborCases.id, { onDelete: "cascade" }),
    contractId: uuid("contract_id").references(() => employmentContracts.id, {
      onDelete: "set null",
    }),
    competence: text("competence").notNull(),
    baseAmountCents: bigint("base_amount_cents", { mode: "number" }).notNull().default(0),
    dueAmountCents: bigint("due_amount_cents", { mode: "number" }).notNull().default(0),
    paidAmountCents: bigint("paid_amount_cents", { mode: "number" }),
    paymentDate: timestamp("payment_date", { withTimezone: true, mode: "date" }),
    source: employmentContractSourceEnum("source").notNull().default("manual"),
    reviewStatus: fgtsReviewStatusEnum("review_status").notNull().default("unreviewed"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("fgts_records_org_idx").on(table.organizationId),
    index("fgts_records_case_idx").on(table.laborCaseId),
    index("fgts_records_competence_idx").on(table.organizationId, table.competence),
    index("fgts_records_review_idx").on(table.organizationId, table.reviewStatus),
  ],
);

export const employmentTerminations = pgTable(
  "employment_terminations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    laborCaseId: uuid("labor_case_id")
      .notNull()
      .references(() => laborCases.id, { onDelete: "cascade" }),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => employmentContracts.id, { onDelete: "cascade" }),
    terminationType: text("termination_type").notNull(),
    noticeType: text("notice_type"),
    noticeStart: timestamp("notice_start", { withTimezone: true, mode: "date" }),
    noticeEnd: timestamp("notice_end", { withTimezone: true, mode: "date" }),
    terminationDate: timestamp("termination_date", { withTimezone: true, mode: "date" }).notNull(),
    reason: text("reason"),
    lastSalaryCents: bigint("last_salary_cents", { mode: "number" }),
    status: employmentTerminationStatusEnum("status").notNull().default("draft"),
    source: employmentContractSourceEnum("source").notNull().default("manual"),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [
    index("employment_terminations_org_idx").on(table.organizationId),
    index("employment_terminations_case_idx").on(table.laborCaseId),
    index("employment_terminations_contract_idx").on(table.contractId),
    index("employment_terminations_org_status_idx").on(table.organizationId, table.status),
    index("employment_terminations_date_idx").on(table.terminationDate),
  ],
);

export const laborClaimItems = pgTable(
  "labor_claim_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    laborCaseId: uuid("labor_case_id")
      .notNull()
      .references(() => laborCases.id, { onDelete: "cascade" }),
    claimType: text("claim_type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    amountCents: bigint("amount_cents", { mode: "number" }),
    periodStart: timestamp("period_start", { withTimezone: true, mode: "date" }),
    periodEnd: timestamp("period_end", { withTimezone: true, mode: "date" }),
    status: laborClaimItemStatusEnum("status").notNull().default("draft"),
    facts: text("facts"),
    evidenceNotes: text("evidence_notes"),
    calculationId: uuid("calculation_id"),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    index("labor_claim_items_org_idx").on(table.organizationId),
    index("labor_claim_items_case_idx").on(table.laborCaseId),
    index("labor_claim_items_org_status_idx").on(table.organizationId, table.status),
    index("labor_claim_items_type_idx").on(table.organizationId, table.claimType),
  ],
);

export const laborRuleSets = pgTable(
  "labor_rule_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    version: text("version").notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true, mode: "date" }).notNull(),
    effectiveTo: timestamp("effective_to", { withTimezone: true, mode: "date" }),
    source: text("source").notNull().default("system_seed"),
    sourceUrl: text("source_url"),
    status: laborRuleSetStatusEnum("status").notNull().default("draft"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    locked: boolean("locked").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("labor_rule_sets_key_version_unique").on(table.key, table.version),
    index("labor_rule_sets_status_idx").on(table.status),
    index("labor_rule_sets_effective_idx").on(table.effectiveFrom, table.effectiveTo),
  ],
);

export const laborCalculations = pgTable(
  "labor_calculations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    laborCaseId: uuid("labor_case_id")
      .notNull()
      .references(() => laborCases.id, { onDelete: "cascade" }),
    calculationType: text("calculation_type").notNull(),
    referenceDate: timestamp("reference_date", { withTimezone: true, mode: "date" }).notNull(),
    ruleSetId: uuid("rule_set_id").references(() => laborRuleSets.id, { onDelete: "restrict" }),
    ruleSetVersion: text("rule_set_version").notNull(),
    inputSnapshot: jsonb("input_snapshot").$type<Record<string, unknown>>().notNull().default({}),
    resultSnapshot: jsonb("result_snapshot").$type<Record<string, unknown>>(),
    status: laborCalculationStatusEnum("status").notNull().default("draft"),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    reviewedByMembershipId: uuid("reviewed_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("labor_calculations_org_idx").on(table.organizationId),
    index("labor_calculations_case_idx").on(table.laborCaseId),
    index("labor_calculations_org_status_idx").on(table.organizationId, table.status),
    index("labor_calculations_reference_idx").on(table.referenceDate),
    index("labor_calculations_rule_set_idx").on(table.ruleSetId),
  ],
);

export const laborLiquidations = pgTable(
  "labor_liquidations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    laborCaseId: uuid("labor_case_id")
      .notNull()
      .references(() => laborCases.id, { onDelete: "cascade" }),
    calculationId: uuid("calculation_id").references(() => laborCalculations.id, {
      onDelete: "set null",
    }),
    referenceDate: timestamp("reference_date", { withTimezone: true, mode: "date" }).notNull(),
    ruleSetVersion: text("rule_set_version"),
    itemsSnapshot: jsonb("items_snapshot").$type<unknown[]>(),
    periodsSnapshot: jsonb("periods_snapshot").$type<unknown[]>(),
    correctionIndex: text("correction_index"),
    interestRule: text("interest_rule"),
    contributionsCents: bigint("contributions_cents", { mode: "number" }).notNull().default(0),
    deductionsCents: bigint("deductions_cents", { mode: "number" }).notNull().default(0),
    totalPrincipalCents: bigint("total_principal_cents", { mode: "number" }).notNull().default(0),
    totalCorrectionCents: bigint("total_correction_cents", { mode: "number" }).notNull().default(0),
    totalInterestCents: bigint("total_interest_cents", { mode: "number" }).notNull().default(0),
    totalCents: bigint("total_cents", { mode: "number" }).notNull().default(0),
    status: laborLiquidationStatusEnum("status").notNull().default("draft"),
    notes: text("notes"),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    reviewedByMembershipId: uuid("reviewed_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("labor_liquidations_org_idx").on(table.organizationId),
    index("labor_liquidations_case_idx").on(table.laborCaseId),
    index("labor_liquidations_org_status_idx").on(table.organizationId, table.status),
    index("labor_liquidations_reference_idx").on(table.referenceDate),
  ],
);

export const laborCasesRelations = relations(laborCases, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [laborCases.organizationId],
    references: [organizations.id],
  }),
  client: one(crmClients, {
    fields: [laborCases.clientId],
    references: [crmClients.id],
  }),
  legalMatter: one(legalMatters, {
    fields: [laborCases.legalMatterId],
    references: [legalMatters.id],
  }),
  judicialProcess: one(judicialProcesses, {
    fields: [laborCases.judicialProcessId],
    references: [judicialProcesses.id],
  }),
  responsibleMembership: one(organizationMembers, {
    fields: [laborCases.responsibleMembershipId],
    references: [organizationMembers.id],
  }),
  contracts: many(employmentContracts),
  schedules: many(workSchedules),
  timeRecords: many(workTimeRecords),
  remunerationItems: many(laborRemunerationItems),
  vacations: many(vacationPeriods),
  fgtsRecords: many(fgtsRecords),
  terminations: many(employmentTerminations),
  claimItems: many(laborClaimItems),
  calculations: many(laborCalculations),
  liquidations: many(laborLiquidations),
}));

export const employmentContractsRelations = relations(employmentContracts, ({ one, many }) => ({
  laborCase: one(laborCases, {
    fields: [employmentContracts.laborCaseId],
    references: [laborCases.id],
  }),
  employeeClient: one(crmClients, {
    fields: [employmentContracts.employeeClientId],
    references: [crmClients.id],
  }),
  history: many(employmentContractHistory),
  terminations: many(employmentTerminations),
}));

export const employmentContractHistoryRelations = relations(
  employmentContractHistory,
  ({ one }) => ({
    contract: one(employmentContracts, {
      fields: [employmentContractHistory.contractId],
      references: [employmentContracts.id],
    }),
    document: one(documents, {
      fields: [employmentContractHistory.documentId],
      references: [documents.id],
    }),
  }),
);

export const workSchedulesRelations = relations(workSchedules, ({ one, many }) => ({
  laborCase: one(laborCases, {
    fields: [workSchedules.laborCaseId],
    references: [laborCases.id],
  }),
  contract: one(employmentContracts, {
    fields: [workSchedules.contractId],
    references: [employmentContracts.id],
  }),
  timeRecords: many(workTimeRecords),
}));

export const workTimeRecordsRelations = relations(workTimeRecords, ({ one }) => ({
  laborCase: one(laborCases, {
    fields: [workTimeRecords.laborCaseId],
    references: [laborCases.id],
  }),
  contract: one(employmentContracts, {
    fields: [workTimeRecords.contractId],
    references: [employmentContracts.id],
  }),
  schedule: one(workSchedules, {
    fields: [workTimeRecords.scheduleId],
    references: [workSchedules.id],
  }),
}));

export const laborRemunerationItemsRelations = relations(laborRemunerationItems, ({ one }) => ({
  laborCase: one(laborCases, {
    fields: [laborRemunerationItems.laborCaseId],
    references: [laborCases.id],
  }),
  contract: one(employmentContracts, {
    fields: [laborRemunerationItems.contractId],
    references: [employmentContracts.id],
  }),
}));

export const vacationPeriodsRelations = relations(vacationPeriods, ({ one }) => ({
  laborCase: one(laborCases, {
    fields: [vacationPeriods.laborCaseId],
    references: [laborCases.id],
  }),
  contract: one(employmentContracts, {
    fields: [vacationPeriods.contractId],
    references: [employmentContracts.id],
  }),
}));

export const fgtsRecordsRelations = relations(fgtsRecords, ({ one }) => ({
  laborCase: one(laborCases, {
    fields: [fgtsRecords.laborCaseId],
    references: [laborCases.id],
  }),
  contract: one(employmentContracts, {
    fields: [fgtsRecords.contractId],
    references: [employmentContracts.id],
  }),
}));

export const employmentTerminationsRelations = relations(employmentTerminations, ({ one }) => ({
  laborCase: one(laborCases, {
    fields: [employmentTerminations.laborCaseId],
    references: [laborCases.id],
  }),
  contract: one(employmentContracts, {
    fields: [employmentTerminations.contractId],
    references: [employmentContracts.id],
  }),
}));

export const laborClaimItemsRelations = relations(laborClaimItems, ({ one }) => ({
  laborCase: one(laborCases, {
    fields: [laborClaimItems.laborCaseId],
    references: [laborCases.id],
  }),
  document: one(documents, {
    fields: [laborClaimItems.documentId],
    references: [documents.id],
  }),
}));

export const laborRuleSetsRelations = relations(laborRuleSets, ({ many }) => ({
  calculations: many(laborCalculations),
}));

export const laborCalculationsRelations = relations(laborCalculations, ({ one, many }) => ({
  laborCase: one(laborCases, {
    fields: [laborCalculations.laborCaseId],
    references: [laborCases.id],
  }),
  ruleSet: one(laborRuleSets, {
    fields: [laborCalculations.ruleSetId],
    references: [laborRuleSets.id],
  }),
  liquidations: many(laborLiquidations),
}));

export const laborLiquidationsRelations = relations(laborLiquidations, ({ one }) => ({
  laborCase: one(laborCases, {
    fields: [laborLiquidations.laborCaseId],
    references: [laborCases.id],
  }),
  calculation: one(laborCalculations, {
    fields: [laborLiquidations.calculationId],
    references: [laborCalculations.id],
  }),
}));
