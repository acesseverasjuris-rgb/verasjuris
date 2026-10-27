import { z } from "zod";

const uuidSchema = z.string().uuid("O identificador não é válido.");
const optionalUuid = uuidSchema.optional();
const nullableUuid = uuidSchema.nullable().optional();
const datetime = z.string().datetime();

const ownerType = z.enum([
  "organization",
  "legal_matter",
  "judicial_process",
  "administrative_process",
  "client",
  "intake",
]);

const documentStatus = z.enum(["draft", "active", "archived"]);
const confidentiality = z.enum(["normal", "restricted", "confidential"]);

const aclPrincipalType = z.enum(["user", "membership", "role", "organization"]);
const aclPermission = z.enum([
  "read",
  "download",
  "upload_version",
  "update_metadata",
  "share",
  "archive",
  "delete",
]);

const documentKind = z.enum([
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
]);
const legalContext = z.enum([
  "client",
  "matter",
  "judicial",
  "administrative",
  "internal",
  "other",
]);
const evidentiaryRole = z.enum(["none", "evidence", "supporting", "rebuttal", "reference"]);

export const createDocumentSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(8000).optional(),
  ownerType,
  ownerId: uuidSchema,
  categoryId: optionalUuid,
  folderId: optionalUuid,
  confidentialityLevel: confidentiality.optional(),
  status: z.enum(["draft", "active"]).optional(),
  documentKind: documentKind.optional(),
  legalContext: legalContext.optional(),
  evidentiaryRole: evidentiaryRole.optional(),
  retentionUntil: datetime.optional(),
  legalHold: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateDocumentSchema = z
  .object({
    title: z.string().trim().min(1).max(300).optional(),
    description: z.string().trim().max(8000).nullable().optional(),
    categoryId: nullableUuid,
    folderId: nullableUuid,
    confidentialityLevel: confidentiality.optional(),
    status: z.enum(["draft", "active"]).optional(),
    documentKind: documentKind.optional(),
    legalContext: legalContext.optional(),
    evidentiaryRole: evidentiaryRole.optional(),
    retentionUntil: datetime.nullable().optional(),
    legalHold: z.boolean().optional(),
    metadata: z.record(z.unknown()).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const documentListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: documentStatus.optional(),
  categoryId: optionalUuid,
  ownerType: ownerType.optional(),
  ownerId: optionalUuid,
  folderId: optionalUuid,
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const createDocumentCategorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(500).optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  active: z.boolean().optional(),
});

export const createDocumentFolderSchema = z.object({
  name: z.string().trim().min(1).max(160),
  parentFolderId: optionalUuid,
  ownerType,
  ownerId: uuidSchema,
});

export const updateDocumentFolderSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    parentFolderId: nullableUuid,
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createDocumentAclSchema = z.object({
  principalType: aclPrincipalType,
  principalId: uuidSchema,
  permission: aclPermission,
});

export const uploadDocumentVersionFieldsSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});
