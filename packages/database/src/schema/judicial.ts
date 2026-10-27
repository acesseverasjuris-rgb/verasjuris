import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { crmClients, crmContacts } from "./crm.js";
import { organizationMembers, organizations, users } from "./identity.js";
import { legalMatterParties, legalMatters } from "./matters.js";
import { lawyerProfiles } from "./profiles.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const judicialProcessStatusEnum = pgEnum("judicial_process_status", [
  "active",
  "suspended",
  "closed",
  "archived",
]);

export const judicialConfidentialityEnum = pgEnum("judicial_confidentiality_level", [
  "public",
  "restricted",
  "secret",
]);

export const judicialDataSourceEnum = pgEnum("judicial_data_source", [
  "manual",
  "document",
  "court_provider",
  "import",
]);

export const courtBranchEnum = pgEnum("court_branch", [
  "constitutional",
  "ordinary",
  "labor",
  "electoral",
  "military",
  "other",
]);

export const courtJurisdictionLevelEnum = pgEnum("court_jurisdiction_level", [
  "supreme",
  "superior",
  "federal_regional",
  "state",
  "labor_regional",
  "electoral_regional",
  "military",
  "other",
]);

export const courtUnitTypeEnum = pgEnum("court_unit_type", [
  "vara",
  "turma",
  "camara",
  "secao",
  "juizado",
  "other",
]);

export const judicialPartyRoleEnum = pgEnum("judicial_party_procedural_role", [
  "author",
  "defendant",
  "appellant",
  "appellee",
  "exequente",
  "executado",
  "impetrante",
  "coatora",
  "third_party",
  "interested",
  "other",
]);

export const judicialPartySideEnum = pgEnum("judicial_party_side", [
  "active",
  "passive",
  "neutral",
  "other",
]);

export const judicialLawyerRepresentationEnum = pgEnum("judicial_lawyer_representation", [
  "counsel",
  "correspondent",
  "public_defender",
  "prosecutor",
  "other",
]);

export const judicialHearingTypeEnum = pgEnum("judicial_hearing_type", [
  "conciliation",
  "instruction",
  "judgment",
  "una",
  "other",
]);

export const judicialHearingStatusEnum = pgEnum("judicial_hearing_status", [
  "scheduled",
  "confirmed",
  "rescheduled",
  "held",
  "cancelled",
]);

export const judicialHearingLocationEnum = pgEnum("judicial_hearing_location_type", [
  "in_person",
  "remote",
  "hybrid",
  "undetermined",
]);

export const judicialDecisionTypeEnum = pgEnum("judicial_decision_type", [
  "interlocutory",
  "sentence",
  "acordao",
  "despacho",
  "other",
]);

export const judicialAppealStatusEnum = pgEnum("judicial_appeal_status", [
  "draft",
  "planned",
  "filed",
  "pending",
  "decided",
  "withdrawn",
  "not_filed",
]);

export const judicialEnforcementTypeEnum = pgEnum("judicial_enforcement_type", [
  "compliance",
  "execution",
  "provisional",
  "other",
]);

export const judicialEnforcementStatusEnum = pgEnum("judicial_enforcement_status", [
  "planned",
  "active",
  "suspended",
  "ended",
]);

/** Catálogo global de referência — não tenant-specific (ADR 037). */
export const courts = pgTable(
  "courts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    acronym: text("acronym").notNull(),
    branch: courtBranchEnum("branch").notNull().default("ordinary"),
    jurisdictionLevel: courtJurisdictionLevelEnum("jurisdiction_level").notNull().default("state"),
    stateCode: text("state_code"),
    active: boolean("active").notNull().default(true),
    source: text("source").notNull().default("seed_dev"),
    sourceVersion: text("source_version"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("courts_code_unique").on(table.code),
    uniqueIndex("courts_acronym_unique").on(table.acronym),
  ],
);

export const judicialDistricts = pgTable(
  "judicial_districts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    stateCode: text("state_code").notNull(),
    tribunalId: uuid("tribunal_id").references(() => courts.id, { onDelete: "set null" }),
    active: boolean("active").notNull().default(true),
    source: text("source").notNull().default("seed_dev"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("judicial_districts_name_state_unique").on(table.name, table.stateCode),
    index("judicial_districts_tribunal_idx").on(table.tribunalId),
  ],
);

export const courtUnits = pgTable(
  "court_units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tribunalId: uuid("tribunal_id")
      .notNull()
      .references(() => courts.id, { onDelete: "cascade" }),
    code: text("code"),
    name: text("name").notNull(),
    unitType: courtUnitTypeEnum("unit_type").notNull().default("vara"),
    districtId: uuid("district_id").references(() => judicialDistricts.id, {
      onDelete: "set null",
    }),
    active: boolean("active").notNull().default(true),
    source: text("source").notNull().default("seed_dev"),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("court_units_tribunal_idx").on(table.tribunalId),
    uniqueIndex("court_units_tribunal_name_unique").on(table.tribunalId, table.name),
  ],
);

export const proceduralClasses = pgTable(
  "procedural_classes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code"),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
    source: text("source").notNull().default("seed_dev"),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [uniqueIndex("procedural_classes_name_unique").on(table.name)],
);

export const proceduralSubjects = pgTable(
  "procedural_subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code"),
    name: text("name").notNull(),
    parentId: uuid("parent_id"),
    active: boolean("active").notNull().default(true),
    source: text("source").notNull().default("seed_dev"),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("procedural_subjects_name_unique").on(table.name),
    index("procedural_subjects_parent_idx").on(table.parentId),
  ],
);

/** Catálogo global de fases genéricas (não legislação completa). */
export const judicialPhaseCatalog = pgTable(
  "judicial_phase_catalog",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    source: text("source").notNull().default("seed_dev"),
    ...timestamps,
  },
  (table) => [uniqueIndex("judicial_phase_catalog_slug_unique").on(table.slug)],
);

export const judicialProcesses = pgTable(
  "judicial_processes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id")
      .notNull()
      .references(() => legalMatters.id, { onDelete: "cascade" }),
    cnjNumber: text("cnj_number").notNull(),
    cnjNumberNormalized: text("cnj_number_normalized").notNull(),
    tribunalId: uuid("tribunal_id")
      .notNull()
      .references(() => courts.id, { onDelete: "restrict" }),
    courtUnitId: uuid("court_unit_id").references(() => courtUnits.id, { onDelete: "set null" }),
    /** Fallback textual quando unidade oficial não cadastrada. */
    courtUnitText: text("court_unit_text"),
    districtId: uuid("district_id").references(() => judicialDistricts.id, {
      onDelete: "set null",
    }),
    districtText: text("district_text"),
    proceduralClassId: uuid("procedural_class_id").references(() => proceduralClasses.id, {
      onDelete: "set null",
    }),
    primarySubjectId: uuid("primary_subject_id").references(() => proceduralSubjects.id, {
      onDelete: "set null",
    }),
    status: judicialProcessStatusEnum("status").notNull().default("active"),
    currentPhaseId: uuid("current_phase_id").references(() => judicialPhaseCatalog.id, {
      onDelete: "set null",
    }),
    filingDate: timestamp("filing_date", { withTimezone: true, mode: "date" }),
    distributionDate: timestamp("distribution_date", { withTimezone: true, mode: "date" }),
    confidentialityLevel: judicialConfidentialityEnum("confidentiality_level")
      .notNull()
      .default("public"),
    source: judicialDataSourceEnum("source").notNull().default("manual"),
    sourceReference: text("source_reference"),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true, mode: "date" }),
    lastMovementAt: timestamp("last_movement_at", { withTimezone: true, mode: "date" }),
    closedAt: timestamp("closed_at", { withTimezone: true, mode: "date" }),
    closureReason: text("closure_reason"),
    closureSource: judicialDataSourceEnum("closure_source"),
    closureNotes: text("closure_notes"),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("judicial_processes_org_cnj_unique").on(
      table.organizationId,
      table.cnjNumberNormalized,
    ),
    index("judicial_processes_org_idx").on(table.organizationId),
    index("judicial_processes_matter_idx").on(table.legalMatterId),
    index("judicial_processes_org_status_idx").on(table.organizationId, table.status),
    index("judicial_processes_tribunal_idx").on(table.tribunalId),
  ],
);

export const judicialProcessSubjects = pgTable(
  "judicial_process_subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    judicialProcessId: uuid("judicial_process_id")
      .notNull()
      .references(() => judicialProcesses.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => proceduralSubjects.id, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("judicial_process_subjects_unique").on(table.judicialProcessId, table.subjectId),
    index("judicial_process_subjects_org_idx").on(table.organizationId),
  ],
);

export const judicialProcessParties = pgTable(
  "judicial_process_parties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    judicialProcessId: uuid("judicial_process_id")
      .notNull()
      .references(() => judicialProcesses.id, { onDelete: "cascade" }),
    matterPartyId: uuid("matter_party_id").references(() => legalMatterParties.id, {
      onDelete: "set null",
    }),
    clientId: uuid("client_id").references(() => crmClients.id, { onDelete: "set null" }),
    contactId: uuid("contact_id").references(() => crmContacts.id, { onDelete: "set null" }),
    displayName: text("display_name").notNull(),
    documentNormalized: text("document_normalized"),
    proceduralRole: judicialPartyRoleEnum("procedural_role").notNull().default("other"),
    side: judicialPartySideEnum("side").notNull().default("other"),
    isPrimary: boolean("is_primary").notNull().default(false),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    index("judicial_process_parties_org_idx").on(table.organizationId),
    index("judicial_process_parties_process_idx").on(table.judicialProcessId),
  ],
);

export const judicialProcessLawyers = pgTable(
  "judicial_process_lawyers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    judicialProcessId: uuid("judicial_process_id")
      .notNull()
      .references(() => judicialProcesses.id, { onDelete: "cascade" }),
    partyId: uuid("party_id").references(() => judicialProcessParties.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    professionalProfileId: uuid("professional_profile_id").references(() => lawyerProfiles.userId, {
      onDelete: "set null",
    }),
    displayName: text("display_name").notNull(),
    oabNumber: text("oab_number"),
    oabState: text("oab_state"),
    /** OAB informada ≠ verificada. */
    oabVerificationStatus: text("oab_verification_status").notNull().default("unverified"),
    representationType: judicialLawyerRepresentationEnum("representation_type")
      .notNull()
      .default("counsel"),
    active: boolean("active").notNull().default(true),
    source: judicialDataSourceEnum("source").notNull().default("manual"),
    ...timestamps,
  },
  (table) => [
    index("judicial_process_lawyers_org_idx").on(table.organizationId),
    index("judicial_process_lawyers_process_idx").on(table.judicialProcessId),
  ],
);

export const judicialProcessPhaseHistory = pgTable(
  "judicial_process_phase_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    judicialProcessId: uuid("judicial_process_id")
      .notNull()
      .references(() => judicialProcesses.id, { onDelete: "cascade" }),
    phaseId: uuid("phase_id")
      .notNull()
      .references(() => judicialPhaseCatalog.id, { onDelete: "restrict" }),
    changedAt: timestamp("changed_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    notes: text("notes"),
    actorMembershipId: uuid("actor_membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("judicial_process_phase_history_process_idx").on(
      table.judicialProcessId,
      table.changedAt,
    ),
  ],
);

export const judicialMovements = pgTable(
  "judicial_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    judicialProcessId: uuid("judicial_process_id")
      .notNull()
      .references(() => judicialProcesses.id, { onDelete: "cascade" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull(),
    sequence: integer("sequence"),
    title: text("title").notNull(),
    description: text("description"),
    movementCode: text("movement_code"),
    source: judicialDataSourceEnum("source").notNull().default("manual"),
    sourceReference: text("source_reference"),
    capturedAt: timestamp("captured_at", { withTimezone: true, mode: "date" }),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("judicial_movements_process_occurred_idx").on(table.judicialProcessId, table.occurredAt),
    index("judicial_movements_org_idx").on(table.organizationId),
  ],
);

export const judicialHearings = pgTable(
  "judicial_hearings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    judicialProcessId: uuid("judicial_process_id")
      .notNull()
      .references(() => judicialProcesses.id, { onDelete: "cascade" }),
    type: judicialHearingTypeEnum("type").notNull().default("other"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true, mode: "date" }).notNull(),
    timezone: text("timezone").notNull().default("America/Sao_Paulo"),
    locationType: judicialHearingLocationEnum("location_type").notNull().default("undetermined"),
    locationText: text("location_text"),
    meetingUrl: text("meeting_url"),
    status: judicialHearingStatusEnum("status").notNull().default("scheduled"),
    notes: text("notes"),
    resultSummary: text("result_summary"),
    source: judicialDataSourceEnum("source").notNull().default("manual"),
    ...timestamps,
  },
  (table) => [
    index("judicial_hearings_process_idx").on(table.judicialProcessId, table.scheduledAt),
    index("judicial_hearings_org_idx").on(table.organizationId),
  ],
);

export const judicialDecisions = pgTable(
  "judicial_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    judicialProcessId: uuid("judicial_process_id")
      .notNull()
      .references(() => judicialProcesses.id, { onDelete: "cascade" }),
    decisionType: judicialDecisionTypeEnum("decision_type").notNull().default("other"),
    decidedAt: timestamp("decided_at", { withTimezone: true, mode: "date" }),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
    title: text("title").notNull(),
    summary: text("summary"),
    outcome: text("outcome"),
    source: judicialDataSourceEnum("source").notNull().default("manual"),
    sourceReference: text("source_reference"),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("judicial_decisions_process_idx").on(table.judicialProcessId),
    index("judicial_decisions_org_idx").on(table.organizationId),
  ],
);

export const judicialAppeals = pgTable(
  "judicial_appeals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    judicialProcessId: uuid("judicial_process_id")
      .notNull()
      .references(() => judicialProcesses.id, { onDelete: "cascade" }),
    parentDecisionId: uuid("parent_decision_id").references(() => judicialDecisions.id, {
      onDelete: "set null",
    }),
    appealType: text("appeal_type").notNull(),
    appellantPartyId: uuid("appellant_party_id").references(() => judicialProcessParties.id, {
      onDelete: "set null",
    }),
    appelleePartyId: uuid("appellee_party_id").references(() => judicialProcessParties.id, {
      onDelete: "set null",
    }),
    filedAt: timestamp("filed_at", { withTimezone: true, mode: "date" }),
    protocolReference: text("protocol_reference"),
    status: judicialAppealStatusEnum("status").notNull().default("draft"),
    resultDecisionId: uuid("result_decision_id").references(() => judicialDecisions.id, {
      onDelete: "set null",
    }),
    source: judicialDataSourceEnum("source").notNull().default("manual"),
    ...timestamps,
  },
  (table) => [
    index("judicial_appeals_process_idx").on(table.judicialProcessId),
    index("judicial_appeals_org_idx").on(table.organizationId),
  ],
);

export const judicialEnforcements = pgTable(
  "judicial_enforcements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    judicialProcessId: uuid("judicial_process_id")
      .notNull()
      .references(() => judicialProcesses.id, { onDelete: "cascade" }),
    type: judicialEnforcementTypeEnum("type").notNull().default("compliance"),
    status: judicialEnforcementStatusEnum("status").notNull().default("planned"),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true, mode: "date" }),
    summary: text("summary"),
    source: judicialDataSourceEnum("source").notNull().default("manual"),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("judicial_enforcements_process_idx").on(table.judicialProcessId),
    index("judicial_enforcements_org_idx").on(table.organizationId),
  ],
);

export const judicialProcessTimelineEvents = pgTable(
  "judicial_process_timeline_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    judicialProcessId: uuid("judicial_process_id")
      .notNull()
      .references(() => judicialProcesses.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id")
      .notNull()
      .references(() => legalMatters.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    /** Data do fato jurídico/processual. */
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull(),
    /** Data de inserção no sistema. */
    recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    source: judicialDataSourceEnum("source").notNull().default("manual"),
    actorMembershipId: uuid("actor_membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("judicial_process_timeline_process_idx").on(table.judicialProcessId, table.occurredAt),
    index("judicial_process_timeline_matter_idx").on(table.legalMatterId, table.occurredAt),
    index("judicial_process_timeline_org_idx").on(table.organizationId),
  ],
);

/** Seed mínimo de desenvolvimento — NÃO é catálogo oficial CNJ. */
export const SEED_COURTS = [
  {
    code: "STF",
    name: "Supremo Tribunal Federal",
    acronym: "STF",
    branch: "constitutional" as const,
    jurisdictionLevel: "supreme" as const,
    stateCode: null,
  },
  {
    code: "STJ",
    name: "Superior Tribunal de Justiça",
    acronym: "STJ",
    branch: "ordinary" as const,
    jurisdictionLevel: "superior" as const,
    stateCode: null,
  },
  {
    code: "TJSP",
    name: "Tribunal de Justiça do Estado de São Paulo",
    acronym: "TJSP",
    branch: "ordinary" as const,
    jurisdictionLevel: "state" as const,
    stateCode: "SP",
  },
  {
    code: "TRT2",
    name: "Tribunal Regional do Trabalho da 2ª Região",
    acronym: "TRT-2",
    branch: "labor" as const,
    jurisdictionLevel: "labor_regional" as const,
    stateCode: "SP",
  },
] as const;

export const SEED_PROCEDURAL_CLASSES = [
  { code: "1116", name: "Procedimento Comum Cível" },
  { code: "436", name: "Procedimento do Juizado Especial Cível" },
  { code: "985", name: "Ação Trabalhista - Rito Ordinário" },
  { code: "120", name: "Mandado de Segurança Cível" },
] as const;

export const SEED_PROCEDURAL_SUBJECTS = [
  { code: "899", name: "Direito Civil" },
  { code: "195", name: "Direito do Trabalho" },
  { code: "14", name: "Direito Administrativo" },
  { code: "1156", name: "Benefícios em Espécie" },
] as const;

export const SEED_JUDICIAL_PHASES = [
  { slug: "conhecimento", name: "Conhecimento", sortOrder: 10 },
  { slug: "recurso", name: "Recurso", sortOrder: 20 },
  { slug: "cumprimento", name: "Cumprimento", sortOrder: 30 },
  { slug: "execucao", name: "Execução", sortOrder: 40 },
  { slug: "encerramento", name: "Encerramento", sortOrder: 50 },
] as const;

export const SEED_DEV_SOURCE = "seed_dev";
export const SEED_DEV_VERSION = "2026-10-etapa3.1";

export const courtsRelations = relations(courts, ({ many }) => ({
  units: many(courtUnits),
}));

export const courtUnitsRelations = relations(courtUnits, ({ one }) => ({
  tribunal: one(courts, { fields: [courtUnits.tribunalId], references: [courts.id] }),
  district: one(judicialDistricts, {
    fields: [courtUnits.districtId],
    references: [judicialDistricts.id],
  }),
}));

export const judicialProcessesRelations = relations(judicialProcesses, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [judicialProcesses.organizationId],
    references: [organizations.id],
  }),
  matter: one(legalMatters, {
    fields: [judicialProcesses.legalMatterId],
    references: [legalMatters.id],
  }),
  tribunal: one(courts, { fields: [judicialProcesses.tribunalId], references: [courts.id] }),
  courtUnit: one(courtUnits, {
    fields: [judicialProcesses.courtUnitId],
    references: [courtUnits.id],
  }),
  district: one(judicialDistricts, {
    fields: [judicialProcesses.districtId],
    references: [judicialDistricts.id],
  }),
  proceduralClass: one(proceduralClasses, {
    fields: [judicialProcesses.proceduralClassId],
    references: [proceduralClasses.id],
  }),
  currentPhase: one(judicialPhaseCatalog, {
    fields: [judicialProcesses.currentPhaseId],
    references: [judicialPhaseCatalog.id],
  }),
  parties: many(judicialProcessParties),
  lawyers: many(judicialProcessLawyers),
  movements: many(judicialMovements),
  hearings: many(judicialHearings),
  decisions: many(judicialDecisions),
  appeals: many(judicialAppeals),
  enforcements: many(judicialEnforcements),
  subjects: many(judicialProcessSubjects),
}));

export const judicialProcessPartiesRelations = relations(judicialProcessParties, ({ one }) => ({
  process: one(judicialProcesses, {
    fields: [judicialProcessParties.judicialProcessId],
    references: [judicialProcesses.id],
  }),
}));

export const judicialProcessLawyersRelations = relations(judicialProcessLawyers, ({ one }) => ({
  process: one(judicialProcesses, {
    fields: [judicialProcessLawyers.judicialProcessId],
    references: [judicialProcesses.id],
  }),
}));

export const judicialMovementsRelations = relations(judicialMovements, ({ one }) => ({
  process: one(judicialProcesses, {
    fields: [judicialMovements.judicialProcessId],
    references: [judicialProcesses.id],
  }),
}));

export const judicialHearingsRelations = relations(judicialHearings, ({ one }) => ({
  process: one(judicialProcesses, {
    fields: [judicialHearings.judicialProcessId],
    references: [judicialProcesses.id],
  }),
}));

export const judicialDecisionsRelations = relations(judicialDecisions, ({ one }) => ({
  process: one(judicialProcesses, {
    fields: [judicialDecisions.judicialProcessId],
    references: [judicialProcesses.id],
  }),
}));

export const judicialAppealsRelations = relations(judicialAppeals, ({ one }) => ({
  process: one(judicialProcesses, {
    fields: [judicialAppeals.judicialProcessId],
    references: [judicialProcesses.id],
  }),
}));

export const judicialEnforcementsRelations = relations(judicialEnforcements, ({ one }) => ({
  process: one(judicialProcesses, {
    fields: [judicialEnforcements.judicialProcessId],
    references: [judicialProcesses.id],
  }),
}));

export const judicialProcessSubjectsRelations = relations(judicialProcessSubjects, ({ one }) => ({
  process: one(judicialProcesses, {
    fields: [judicialProcessSubjects.judicialProcessId],
    references: [judicialProcesses.id],
  }),
  subject: one(proceduralSubjects, {
    fields: [judicialProcessSubjects.subjectId],
    references: [proceduralSubjects.id],
  }),
}));

export const judicialProcessTimelineEventsRelations = relations(
  judicialProcessTimelineEvents,
  ({ one }) => ({
    process: one(judicialProcesses, {
      fields: [judicialProcessTimelineEvents.judicialProcessId],
      references: [judicialProcesses.id],
    }),
  }),
);
