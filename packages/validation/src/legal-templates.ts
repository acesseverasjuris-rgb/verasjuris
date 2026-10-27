import { z } from "zod";

const uuid = z.string().uuid("O identificador não é válido.");
const optionalUuid = uuid.optional();
const limit = z.coerce.number().int().min(1).max(100).default(20);
const offset = z.coerce.number().int().min(0).max(10_000).default(0);

export const LEGAL_TEMPLATE_SCOPES = ["system", "organization"] as const;

export const LEGAL_TEMPLATE_TYPES = [
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
] as const;

export const LEGAL_TEMPLATE_DOCUMENT_KINDS = [
  "identification",
  "evidence",
  "contract",
  "petition",
  "decision",
  "report",
  "power_of_attorney",
  "administrative",
  "correspondence",
  "other",
] as const;

export const LEGAL_TEMPLATE_VERSION_STATUSES = [
  "draft",
  "review",
  "approved",
  "active",
  "deprecated",
  "archived",
] as const;

export const LEGAL_TEMPLATE_CONTENT_FORMATS = [
  "html",
  "markdown",
  "plain_text",
  "structured",
] as const;

export const TEMPLATE_VARIABLE_FIELD_TYPES = [
  "text",
  "long_text",
  "number",
  "money",
  "date",
  "boolean",
  "select",
  "multi_select",
  "party",
  "client",
  "lawyer",
  "organization",
  "process",
  "document",
  "citation",
  "list",
  "table",
] as const;

export const templateVariableFieldSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-zA-Z][a-zA-Z0-9_.]*$/, "Chave de variável inválida."),
  label: z.string().trim().min(1).max(200),
  type: z.enum(TEMPLATE_VARIABLE_FIELD_TYPES),
  required: z.boolean().default(false),
  default: z.unknown().optional(),
  validation: z.record(z.unknown()).optional(),
  source: z.string().trim().max(120).optional(),
  helpText: z.string().trim().max(500).optional(),
});

export const createLegalTemplateSchema = z.object({
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(4000).optional(),
  templateType: z.enum(LEGAL_TEMPLATE_TYPES).default("other"),
  documentKind: z.enum(LEGAL_TEMPLATE_DOCUMENT_KINDS).default("other"),
  legalAreaId: optionalUuid,
  jurisdiction: z.string().trim().max(120).optional(),
  content: z.string().min(1).max(500_000),
  contentFormat: z.enum(LEGAL_TEMPLATE_CONTENT_FORMATS).default("html"),
  variableSchema: z
    .object({
      fields: z.array(templateVariableFieldSchema).max(200).default([]),
    })
    .default({ fields: [] }),
  sectionSchema: z.record(z.unknown()).optional(),
  changelog: z.string().trim().max(2000).optional(),
});

export const updateLegalTemplateSchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(4000).nullable().optional(),
    templateType: z.enum(LEGAL_TEMPLATE_TYPES).optional(),
    documentKind: z.enum(LEGAL_TEMPLATE_DOCUMENT_KINDS).optional(),
    legalAreaId: uuid.nullable().optional(),
    jurisdiction: z.string().trim().max(120).nullable().optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createLegalTemplateVersionSchema = z.object({
  content: z.string().min(1).max(500_000),
  contentFormat: z.enum(LEGAL_TEMPLATE_CONTENT_FORMATS).default("html"),
  variableSchema: z
    .object({
      fields: z.array(templateVariableFieldSchema).max(200).default([]),
    })
    .default({ fields: [] }),
  sectionSchema: z.record(z.unknown()).optional(),
  changelog: z.string().trim().max(2000).optional(),
});

export const legalTemplateListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  scope: z.enum(LEGAL_TEMPLATE_SCOPES).optional(),
  templateType: z.enum(LEGAL_TEMPLATE_TYPES).optional(),
  documentKind: z.enum(LEGAL_TEMPLATE_DOCUMENT_KINDS).optional(),
  legalAreaId: optionalUuid,
  active: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  includeSystem: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  limit,
  offset,
});

export const legalTemplateVersionTransitionSchema = z.object({
  status: z.enum(["review", "approved", "active", "deprecated", "archived"]),
});

export const previewLegalTemplateVersionSchema = z.object({
  context: z.record(z.unknown()).default({}),
});
