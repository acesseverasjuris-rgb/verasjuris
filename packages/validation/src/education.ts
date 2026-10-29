import { z } from "zod";

const uuid = z.string().uuid("O identificador não é válido.");
const optionalUuid = uuid.optional();
const datetime = z.string().datetime({ offset: true });
const optionalDatetime = datetime.optional();
const cents = z
  .number()
  .int("Informe um valor inteiro em centavos.")
  .min(0)
  .max(Number.MAX_SAFE_INTEGER);
const currency = z.string().trim().length(3).default("BRL");
const slug = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Informe um slug válido (minúsculas, hífens).");

export const EDUCATION_COURSE_STATUSES = [
  "draft",
  "under_review",
  "published",
  "unpublished",
  "archived",
] as const;

export const EDUCATION_VISIBILITIES = [
  "public",
  "authenticated",
  "organization_only",
  "private",
  "paid",
] as const;

export const EDUCATION_COURSE_LEVELS = [
  "beginner",
  "intermediate",
  "advanced",
  "expert",
  "other",
] as const;

export const EDUCATION_LESSON_TYPES = [
  "video",
  "text",
  "document",
  "audio",
  "quiz",
  "live",
  "assignment",
  "case_study",
  "other",
] as const;

export const EDUCATION_LESSON_STATUSES = ["draft", "published", "archived"] as const;

export const EDUCATION_CONTENT_BLOCK_TYPES = [
  "text",
  "video_reference",
  "audio_reference",
  "document_reference",
  "embed",
  "quiz_reference",
  "exercise",
  "code",
  "external_link",
] as const;

export const EDUCATION_ENROLLMENT_SOURCES = [
  "free",
  "purchase",
  "subscription",
  "organization",
  "admin",
  "promotion",
  "other",
] as const;

export const EDUCATION_ENROLLMENT_STATUSES = [
  "active",
  "completed",
  "expired",
  "cancelled",
  "pending_payment",
  "suspended",
] as const;

export const EDUCATION_PROGRESS_STATUSES = ["not_started", "in_progress", "completed"] as const;

export const EDUCATION_CERTIFICATE_STATUSES = ["issued", "revoked", "expired"] as const;

export const EDUCATION_LIBRARY_ITEM_TYPES = [
  "book",
  "article",
  "guide",
  "case",
  "legislation_collection",
  "jurisprudence_collection",
  "video",
  "audio",
  "document",
  "other",
] as const;

export const EDUCATION_LIBRARY_SOURCES = [
  "authored_internally",
  "licensed",
  "public_source",
  "external_link",
] as const;

export const EDUCATION_RELEASE_RULES = ["immediate", "sequential", "date_gated", "manual"] as const;

export const EDUCATION_ATTEMPT_STATUSES = [
  "in_progress",
  "submitted",
  "graded",
  "abandoned",
] as const;

export const createEducationCategorySchema = z.object({
  parentId: optionalUuid,
  key: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Informe uma chave válida (minúsculas, hífens).")
    .optional(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  legalAreaModuleId: optionalUuid,
  position: z.number().int().min(0).max(10_000).default(0),
  active: z.boolean().default(true),
});

export const registerEducationInstructorSchema = z.object({
  bio: z.string().trim().max(4000).optional(),
  qualifications: z.string().trim().max(4000).optional(),
  publicProfile: z.boolean().default(false),
});

export const educationAiAssistSchema = z.object({
  organizationId: uuid,
  prompt: z.string().trim().min(3).max(8000),
  courseId: optionalUuid,
  lessonId: optionalUuid,
  context: z.string().trim().max(16_000).optional(),
});

export const createEducationCourseSchema = z.object({
  organizationId: optionalUuid,
  instructorId: optionalUuid,
  categoryId: optionalUuid,
  title: z.string().trim().min(3).max(200),
  slug: slug.optional(),
  description: z.string().trim().max(8000).optional(),
  shortDescription: z.string().trim().max(500).optional(),
  level: z.enum(EDUCATION_COURSE_LEVELS).default("beginner"),
  language: z.string().trim().min(2).max(16).default("pt-BR"),
  estimatedDurationMinutes: z.number().int().min(0).max(100_000).optional(),
  status: z.enum(["draft", "under_review"]).default("draft"),
  visibility: z.enum(EDUCATION_VISIBILITIES).default("private"),
  coverDocumentId: optionalUuid,
  priceCents: cents.nullable().optional(),
  currency,
  certificateEnabled: z.boolean().default(true),
  completionRuleJson: z.record(z.string(), z.unknown()).optional(),
});

export const updateEducationCourseSchema = createEducationCourseSchema
  .partial()
  .extend({
    status: z.enum(EDUCATION_COURSE_STATUSES).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const publishEducationCourseSchema = z.object({
  visibility: z.enum(EDUCATION_VISIBILITIES).optional(),
});

export const createCourseModuleSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(4000).optional(),
  position: z.number().int().min(0).max(10_000).default(0),
  releaseRule: z.enum(EDUCATION_RELEASE_RULES).default("immediate"),
  active: z.boolean().default(true),
});

export const updateCourseModuleSchema = createCourseModuleSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const createCourseLessonSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(4000).optional(),
  lessonType: z.enum(EDUCATION_LESSON_TYPES).default("text"),
  position: z.number().int().min(0).max(10_000).default(0),
  estimatedDurationMinutes: z.number().int().min(0).max(100_000).optional(),
  required: z.boolean().default(true),
  previewAllowed: z.boolean().default(false),
  status: z.enum(EDUCATION_LESSON_STATUSES).default("draft"),
  quizId: optionalUuid,
});

export const updateCourseLessonSchema = createCourseLessonSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const createLessonContentSchema = z.object({
  blockType: z.enum(EDUCATION_CONTENT_BLOCK_TYPES),
  position: z.number().int().min(0).max(10_000).default(0),
  documentId: optionalUuid,
  mediaProviderKey: z.string().trim().max(80).default("not_configured"),
  externalMediaRef: z.string().trim().max(500).optional(),
  licenseNote: z.string().trim().max(1000).optional(),
  bodyText: z.string().trim().max(50_000).optional(),
  payloadJson: z.record(z.string(), z.unknown()).optional(),
  active: z.boolean().default(true),
});

export const updateLessonContentSchema = createLessonContentSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const createLearningTrackSchema = z.object({
  organizationId: optionalUuid,
  title: z.string().trim().min(3).max(200),
  slug: slug.optional(),
  description: z.string().trim().max(8000).optional(),
  legalAreaId: optionalUuid,
  status: z.enum(["draft", "under_review"]).default("draft"),
  visibility: z.enum(EDUCATION_VISIBILITIES).default("private"),
});

export const updateLearningTrackSchema = createLearningTrackSchema
  .partial()
  .extend({
    status: z.enum(EDUCATION_COURSE_STATUSES).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const addTrackCourseSchema = z.object({
  courseId: uuid,
  position: z.number().int().min(0).max(10_000).default(0),
  required: z.boolean().default(true),
  prerequisiteCourseId: optionalUuid,
});

export const createEnrollmentSchema = z.object({
  courseId: uuid,
  userId: optionalUuid,
  organizationId: optionalUuid,
  source: z.enum(EDUCATION_ENROLLMENT_SOURCES).default("free"),
  status: z.enum(["active", "pending_payment"]).default("active"),
  expiresAt: optionalDatetime,
  invoiceId: optionalUuid,
  paymentIntentId: optionalUuid,
});

export const updateEnrollmentSchema = z
  .object({
    status: z.enum(EDUCATION_ENROLLMENT_STATUSES).optional(),
    startedAt: optionalDatetime,
    completedAt: optionalDatetime,
    expiresAt: optionalDatetime.nullable(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const upsertLessonProgressSchema = z.object({
  lessonId: uuid,
  status: z.enum(EDUCATION_PROGRESS_STATUSES).optional(),
  progressPercent: z.number().int().min(0).max(100).optional(),
  lastPositionMetadata: z.record(z.string(), z.unknown()).optional(),
  contentVersionId: optionalUuid,
});

export const createEducationLibraryItemSchema = z.object({
  organizationId: optionalUuid,
  title: z.string().trim().min(3).max(200),
  slug: slug.optional(),
  description: z.string().trim().max(8000).optional(),
  itemType: z.enum(EDUCATION_LIBRARY_ITEM_TYPES).default("document"),
  source: z.enum(EDUCATION_LIBRARY_SOURCES).default("authored_internally"),
  licenseNote: z.string().trim().max(1000).optional(),
  externalUrl: z.string().trim().url().max(2000).optional(),
  documentId: optionalUuid,
  visibility: z.enum(EDUCATION_VISIBILITIES).default("authenticated"),
  categoryId: optionalUuid,
  active: z.boolean().default(true),
});

export const updateEducationLibraryItemSchema = createEducationLibraryItemSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const issueCertificateSchema = z.object({
  enrollmentId: uuid,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const revokeCertificateSchema = z.object({
  reason: z.string().trim().min(3).max(1000).optional(),
});

export const createEducationQuizSchema = z.object({
  courseId: optionalUuid,
  lessonId: optionalUuid,
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(4000).optional(),
  passingScorePercent: z.number().int().min(0).max(100).default(70),
  maxAttempts: z.number().int().min(1).max(100).optional(),
  shuffleQuestions: z.boolean().default(false),
  active: z.boolean().default(true),
});

export const updateEducationQuizSchema = createEducationQuizSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const createEducationQuestionSchema = z.object({
  prompt: z.string().trim().min(3).max(4000),
  position: z.number().int().min(0).max(10_000).default(0),
  points: z.number().int().min(1).max(1000).default(1),
  explanation: z.string().trim().max(4000).optional(),
  options: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(1000),
        position: z.number().int().min(0).max(100).default(0),
        isCorrect: z.boolean().default(false),
      }),
    )
    .min(2)
    .max(20)
    .optional(),
});

export const submitQuizAttemptSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: uuid,
        optionId: optionalUuid,
        freeText: z.string().trim().max(4000).optional(),
      }),
    )
    .min(1)
    .max(200),
});

export const educationCourseListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(EDUCATION_COURSE_STATUSES).optional(),
  visibility: z.enum(EDUCATION_VISIBILITIES).optional(),
  level: z.enum(EDUCATION_COURSE_LEVELS).optional(),
  categoryId: optionalUuid,
  instructorId: optionalUuid,
  organizationId: optionalUuid,
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const educationEnrollmentListQuerySchema = z.object({
  courseId: optionalUuid,
  userId: optionalUuid,
  organizationId: optionalUuid,
  status: z.enum(EDUCATION_ENROLLMENT_STATUSES).optional(),
  source: z.enum(EDUCATION_ENROLLMENT_SOURCES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const educationLibraryListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  itemType: z.enum(EDUCATION_LIBRARY_ITEM_TYPES).optional(),
  source: z.enum(EDUCATION_LIBRARY_SOURCES).optional(),
  visibility: z.enum(EDUCATION_VISIBILITIES).optional(),
  categoryId: optionalUuid,
  organizationId: optionalUuid,
  active: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const educationTrackListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(EDUCATION_COURSE_STATUSES).optional(),
  visibility: z.enum(EDUCATION_VISIBILITIES).optional(),
  legalAreaId: optionalUuid,
  organizationId: optionalUuid,
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});
