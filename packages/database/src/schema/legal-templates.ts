import { relations } from "drizzle-orm";
import {
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
import { documentKindEnum } from "./documents.js";
import { organizationMembers, organizations } from "./identity.js";
import { legalAreas } from "./intake.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const legalDocumentTemplateScopeEnum = pgEnum("legal_document_template_scope", [
  "system",
  "organization",
]);

export const legalDocumentTemplateTypeEnum = pgEnum("legal_document_template_type", [
  "initial_petition",
  "defense",
  "reply",
  "motion",
  "appeal",
  "counter_arguments",
  "legal_opinion",
  "administrative_request",
  "contract",
  "notice",
  "power_of_attorney",
  "declaration",
  "settlement",
  "other",
]);

export const legalDocumentTemplateVersionStatusEnum = pgEnum(
  "legal_document_template_version_status",
  ["draft", "review", "approved", "active", "deprecated", "archived"],
);

export const legalDocumentTemplateContentFormatEnum = pgEnum(
  "legal_document_template_content_format",
  ["html", "markdown", "plain_text", "structured"],
);

/**
 * Modelo de documento jurídico.
 * organizationId null + scope=system = template institucional VerasJuris.
 */
export const legalDocumentTemplates = pgTable(
  "legal_document_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    scope: legalDocumentTemplateScopeEnum("scope").notNull().default("organization"),
    templateType: legalDocumentTemplateTypeEnum("template_type").notNull().default("other"),
    name: text("name").notNull(),
    description: text("description"),
    legalAreaId: uuid("legal_area_id").references(() => legalAreas.id, { onDelete: "set null" }),
    jurisdiction: text("jurisdiction"),
    documentKind: documentKindEnum("document_kind").notNull().default("other"),
    /** Ponteiro para versão ativa; sem FK para evitar ciclo com versions. */
    currentVersionId: uuid("current_version_id"),
    active: boolean("active").notNull().default(true),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("legal_document_templates_org_idx").on(table.organizationId),
    index("legal_document_templates_scope_idx").on(table.scope),
    index("legal_document_templates_type_idx").on(table.templateType),
    index("legal_document_templates_active_idx").on(table.active),
    index("legal_document_templates_area_idx").on(table.legalAreaId),
  ],
);

/** Conteúdo imutável após uso/ativação — alteração gera nova versão. */
export const legalDocumentTemplateVersions = pgTable(
  "legal_document_template_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => legalDocumentTemplates.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    content: text("content").notNull(),
    contentFormat: legalDocumentTemplateContentFormatEnum("content_format")
      .notNull()
      .default("html"),
    variableSchema: jsonb("variable_schema").$type<Record<string, unknown>>().notNull().default({}),
    sectionSchema: jsonb("section_schema").$type<Record<string, unknown>>(),
    status: legalDocumentTemplateVersionStatusEnum("status").notNull().default("draft"),
    changelog: text("changelog"),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    approvedByMembershipId: uuid("approved_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    activatedAt: timestamp("activated_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    uniqueIndex("legal_document_template_versions_template_version_unique").on(
      table.templateId,
      table.version,
    ),
    index("legal_document_template_versions_template_idx").on(table.templateId),
    index("legal_document_template_versions_status_idx").on(table.status),
  ],
);

export const legalDocumentTemplatesRelations = relations(
  legalDocumentTemplates,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [legalDocumentTemplates.organizationId],
      references: [organizations.id],
    }),
    legalArea: one(legalAreas, {
      fields: [legalDocumentTemplates.legalAreaId],
      references: [legalAreas.id],
    }),
    versions: many(legalDocumentTemplateVersions),
  }),
);

export const legalDocumentTemplateVersionsRelations = relations(
  legalDocumentTemplateVersions,
  ({ one }) => ({
    template: one(legalDocumentTemplates, {
      fields: [legalDocumentTemplateVersions.templateId],
      references: [legalDocumentTemplates.id],
    }),
  }),
);
