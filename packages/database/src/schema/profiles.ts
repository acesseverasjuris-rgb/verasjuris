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
import { organizationMembers, organizations, users } from "./identity.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const profileVisibilityEnum = pgEnum("profile_visibility", [
  "public",
  "organization",
  "private",
  "internal",
]);

export const partnerCategoryEnum = pgEnum("partner_category", [
  "correspondent",
  "accountant",
  "expert",
  "translator",
  "dispatcher",
  "teacher",
  "specialist",
  "supplier",
  "other",
]);

export const employeeStatusEnum = pgEnum("employee_status", ["active", "inactive", "left"]);

/** Núcleo já existente em identity.professional_profiles — extensões abaixo. */

export const oabVerificationStatusEnum = pgEnum("oab_verification_status", [
  "informed",
  "pending_verification",
  "verified",
  "rejected",
  "expired",
  "not_configured",
]);

export const lawyerAvailabilityStatusEnum = pgEnum("lawyer_availability_status", [
  "available",
  "busy",
  "away",
  "offline",
]);

export const lawyerProfiles = pgTable("lawyer_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  professionalName: text("professional_name"),
  bio: text("bio"),
  oabNumber: text("oab_number"),
  oabUf: text("oab_uf"),
  oabSection: text("oab_section"),
  oabSubsection: text("oab_subsection"),
  inscriptionDate: timestamp("inscription_date", { withTimezone: true, mode: "date" }),
  declaredSituation: text("declared_situation"),
  /** OAB informado ≠ verificado. Default: informed se há número; senão not_configured. */
  oabVerificationStatus: oabVerificationStatusEnum("oab_verification_status")
    .notNull()
    .default("not_configured"),
  practiceAreas: text("practice_areas"),
  languages: text("languages"),
  remoteAvailable: boolean("remote_available").notNull().default(false),
  inPersonAvailable: boolean("in_person_available").notNull().default(false),
  serviceRegions: text("service_regions"),
  onlineServiceEnabled: boolean("online_service_enabled").notNull().default(false),
  serviceStates: text("service_states"),
  consultationModes: text("consultation_modes"),
  availabilityStatus: lawyerAvailabilityStatusEnum("availability_status")
    .notNull()
    .default("offline"),
  acceptsUrgent: boolean("accepts_urgent").notNull().default(false),
  consultationPriceCents: integer("consultation_price_cents"),
  /** Marketplace (Etapa 17) — distinto de Advogado Online. */
  marketplaceEnabled: boolean("marketplace_enabled").notNull().default(false),
  marketplaceHeadline: text("marketplace_headline"),
  marketplaceDescription: text("marketplace_description"),
  serviceCities: text("service_cities"),
  marketplaceCategories: text("marketplace_categories"),
  specialties: text("specialties"),
  responseTimeEstimate: text("response_time_estimate"),
  basePriceMinCents: integer("base_price_min_cents"),
  basePriceMaxCents: integer("base_price_max_cents"),
  marketplaceStatus: text("marketplace_status").notNull().default("draft"),
  visibility: profileVisibilityEnum("visibility").notNull().default("private"),
  ...timestamps,
});

export const partnerProfiles = pgTable("partner_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  category: partnerCategoryEnum("category").notNull().default("other"),
  presentation: text("presentation"),
  services: text("services"),
  regions: text("regions"),
  remoteAvailable: boolean("remote_available").notNull().default(false),
  inPersonAvailable: boolean("in_person_available").notNull().default(false),
  availabilityNotes: text("availability_notes"),
  publicInfo: text("public_info"),
  internalInfo: text("internal_info"),
  operationalStatus: text("operational_status").notNull().default("active"),
  visibility: profileVisibilityEnum("visibility").notNull().default("organization"),
  ...timestamps,
});

export const employeeProfiles = pgTable(
  "employee_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    membershipId: uuid("membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    jobTitle: text("job_title").notNull(),
    department: text("department"),
    internalCode: text("internal_code"),
    managerUserId: uuid("manager_user_id").references(() => users.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    status: employeeStatusEnum("status").notNull().default("active"),
    internalNotes: text("internal_notes"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("employee_profiles_org_user_unique").on(table.organizationId, table.userId),
    index("employee_profiles_org_idx").on(table.organizationId),
    index("employee_profiles_user_idx").on(table.userId),
  ],
);

/**
 * Vínculo opcional User ↔ Organization como "cliente autenticado".
 * Distinto de crm_clients (entidade comercial, pode existir sem conta).
 */
export const organizationClientUsers = pgTable(
  "organization_client_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    crmClientId: uuid("crm_client_id"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("organization_client_users_org_user_unique").on(table.organizationId, table.userId),
    index("organization_client_users_org_idx").on(table.organizationId),
  ],
);

export const lawyerProfilesRelations = relations(lawyerProfiles, ({ one }) => ({
  user: one(users, { fields: [lawyerProfiles.userId], references: [users.id] }),
}));

export const partnerProfilesRelations = relations(partnerProfiles, ({ one }) => ({
  user: one(users, { fields: [partnerProfiles.userId], references: [users.id] }),
}));

export const employeeProfilesRelations = relations(employeeProfiles, ({ one }) => ({
  organization: one(organizations, {
    fields: [employeeProfiles.organizationId],
    references: [organizations.id],
  }),
  user: one(users, { fields: [employeeProfiles.userId], references: [users.id] }),
}));
