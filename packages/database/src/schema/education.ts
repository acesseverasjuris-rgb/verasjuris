/**
 * Etapa 20 — Educação Jurídica.
 * Domínio próprio. Reutiliza User/Profile/ProfessionalProfile, Document, AIGateway.
 * Media/streaming externo: NOT_CONFIGURED. Certificado ≠ ICP-Brasil.
 */
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
import { documents } from "./documents.js";
import { organizations, profiles, users } from "./identity.js";
import { legalAreas } from "./intake.js";
import { legalAreaModules } from "./legal-areas.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const educationCourseStatusEnum = pgEnum("education_course_status", [
  "draft",
  "under_review",
  "published",
  "unpublished",
  "archived",
]);

export const educationVisibilityEnum = pgEnum("education_visibility", [
  "public",
  "authenticated",
  "organization_only",
  "private",
  "paid",
]);

export const educationCourseLevelEnum = pgEnum("education_course_level", [
  "beginner",
  "intermediate",
  "advanced",
  "expert",
  "other",
]);

export const educationLessonTypeEnum = pgEnum("education_lesson_type", [
  "video",
  "text",
  "document",
  "audio",
  "quiz",
  "live",
  "assignment",
  "case_study",
  "other",
]);

export const educationLessonStatusEnum = pgEnum("education_lesson_status", [
  "draft",
  "published",
  "archived",
]);

export const educationContentBlockTypeEnum = pgEnum("education_content_block_type", [
  "text",
  "video_reference",
  "audio_reference",
  "document_reference",
  "embed",
  "quiz_reference",
  "exercise",
  "code",
  "external_link",
]);

export const educationEnrollmentSourceEnum = pgEnum("education_enrollment_source", [
  "free",
  "purchase",
  "subscription",
  "organization",
  "admin",
  "promotion",
  "other",
]);

export const educationEnrollmentStatusEnum = pgEnum("education_enrollment_status", [
  "active",
  "completed",
  "expired",
  "cancelled",
  "pending_payment",
  "suspended",
]);

export const educationProgressStatusEnum = pgEnum("education_progress_status", [
  "not_started",
  "in_progress",
  "completed",
]);

export const educationCertificateStatusEnum = pgEnum("education_certificate_status", [
  "issued",
  "revoked",
  "expired",
]);

export const educationLibraryItemTypeEnum = pgEnum("education_library_item_type", [
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
]);

export const educationLibrarySourceEnum = pgEnum("education_library_source", [
  "authored_internally",
  "licensed",
  "public_source",
  "external_link",
]);

export const educationReleaseRuleEnum = pgEnum("education_release_rule", [
  "immediate",
  "sequential",
  "date_gated",
  "manual",
]);

export const educationEducatorVerificationEnum = pgEnum("education_educator_verification", [
  "not_submitted",
  "pending",
  "approved",
  "rejected",
  "not_required",
]);

export const educationAttemptStatusEnum = pgEnum("education_attempt_status", [
  "in_progress",
  "submitted",
  "graded",
  "abandoned",
]);

export const educationCategories = pgTable(
  "education_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentId: uuid("parent_id"),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    legalAreaModuleId: uuid("legal_area_module_id").references(() => legalAreaModules.id, {
      onDelete: "set null",
    }),
    position: integer("position").notNull().default(0),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("education_categories_key_unique").on(table.key),
    index("education_categories_parent_idx").on(table.parentId),
  ],
);

export const educationInstructors = pgTable(
  "education_instructors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.userId, { onDelete: "cascade" }),
    bio: text("bio"),
    qualifications: text("qualifications"),
    active: boolean("active").notNull().default(true),
    publicProfile: boolean("public_profile").notNull().default(false),
    verifiedEducatorStatus: educationEducatorVerificationEnum("verified_educator_status")
      .notNull()
      .default("not_required"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("education_instructors_profile_unique").on(table.profileId),
    index("education_instructors_active_idx").on(table.active),
  ],
);

export const educationCourses = pgTable(
  "education_courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    instructorId: uuid("instructor_id").references(() => educationInstructors.id, {
      onDelete: "set null",
    }),
    categoryId: uuid("category_id").references(() => educationCategories.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    shortDescription: text("short_description"),
    level: educationCourseLevelEnum("level").notNull().default("beginner"),
    language: text("language").notNull().default("pt-BR"),
    estimatedDurationMinutes: integer("estimated_duration_minutes"),
    status: educationCourseStatusEnum("status").notNull().default("draft"),
    visibility: educationVisibilityEnum("visibility").notNull().default("private"),
    coverDocumentId: uuid("cover_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    priceCents: bigint("price_cents", { mode: "number" }),
    currency: text("currency").notNull().default("BRL"),
    certificateEnabled: boolean("certificate_enabled").notNull().default(true),
    completionRuleJson: jsonb("completion_rule_json").$type<Record<string, unknown>>(),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("education_courses_slug_unique").on(table.slug),
    index("education_courses_org_idx").on(table.organizationId),
    index("education_courses_status_idx").on(table.status),
    index("education_courses_visibility_idx").on(table.visibility),
    index("education_courses_instructor_idx").on(table.instructorId),
  ],
);

export const courseModules = pgTable(
  "course_modules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => educationCourses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    position: integer("position").notNull().default(0),
    releaseRule: educationReleaseRuleEnum("release_rule").notNull().default("immediate"),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    index("course_modules_course_idx").on(table.courseId),
    uniqueIndex("course_modules_course_position_unique").on(table.courseId, table.position),
  ],
);

export const courseLessons = pgTable(
  "course_lessons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => courseModules.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    lessonType: educationLessonTypeEnum("lesson_type").notNull().default("text"),
    position: integer("position").notNull().default(0),
    estimatedDurationMinutes: integer("estimated_duration_minutes"),
    required: boolean("required").notNull().default(true),
    previewAllowed: boolean("preview_allowed").notNull().default(false),
    status: educationLessonStatusEnum("status").notNull().default("draft"),
    quizId: uuid("quiz_id"),
    ...timestamps,
  },
  (table) => [
    index("course_lessons_module_idx").on(table.moduleId),
    uniqueIndex("course_lessons_module_position_unique").on(table.moduleId, table.position),
  ],
);

export const lessonContents = pgTable(
  "lesson_contents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => courseLessons.id, { onDelete: "cascade" }),
    blockType: educationContentBlockTypeEnum("block_type").notNull(),
    position: integer("position").notNull().default(0),
    currentVersionId: uuid("current_version_id"),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    mediaProviderKey: text("media_provider_key").notNull().default("not_configured"),
    externalMediaRef: text("external_media_ref"),
    licenseNote: text("license_note"),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    index("lesson_contents_lesson_idx").on(table.lessonId),
    uniqueIndex("lesson_contents_lesson_position_unique").on(table.lessonId, table.position),
  ],
);

export const lessonContentVersions = pgTable(
  "lesson_content_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contentId: uuid("content_id")
      .notNull()
      .references(() => lessonContents.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    bodyText: text("body_text"),
    payloadJson: jsonb("payload_json").$type<Record<string, unknown>>(),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("lesson_content_versions_content_version_unique").on(
      table.contentId,
      table.version,
    ),
    index("lesson_content_versions_content_idx").on(table.contentId),
  ],
);

export const learningTracks = pgTable(
  "learning_tracks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    legalAreaId: uuid("legal_area_id").references(() => legalAreas.id, { onDelete: "set null" }),
    status: educationCourseStatusEnum("status").notNull().default("draft"),
    visibility: educationVisibilityEnum("visibility").notNull().default("private"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("learning_tracks_slug_unique").on(table.slug),
    index("learning_tracks_org_idx").on(table.organizationId),
    index("learning_tracks_status_idx").on(table.status),
  ],
);

export const learningTrackCourses = pgTable(
  "learning_track_courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trackId: uuid("track_id")
      .notNull()
      .references(() => learningTracks.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => educationCourses.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    required: boolean("required").notNull().default(true),
    prerequisiteCourseId: uuid("prerequisite_course_id").references(() => educationCourses.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("learning_track_courses_track_course_unique").on(table.trackId, table.courseId),
    index("learning_track_courses_track_idx").on(table.trackId),
  ],
);

export const courseEnrollments = pgTable(
  "course_enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => educationCourses.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    source: educationEnrollmentSourceEnum("source").notNull().default("free"),
    status: educationEnrollmentStatusEnum("status").notNull().default("active"),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    invoiceId: uuid("invoice_id"),
    paymentIntentId: uuid("payment_intent_id"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("course_enrollments_course_user_unique").on(table.courseId, table.userId),
    index("course_enrollments_user_idx").on(table.userId),
    index("course_enrollments_org_idx").on(table.organizationId),
    index("course_enrollments_status_idx").on(table.status),
  ],
);

export const lessonProgress = pgTable(
  "lesson_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => courseEnrollments.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => courseLessons.id, { onDelete: "cascade" }),
    status: educationProgressStatusEnum("status").notNull().default("not_started"),
    progressPercent: integer("progress_percent").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    lastPositionMetadata: jsonb("last_position_metadata").$type<Record<string, unknown>>(),
    contentVersionId: uuid("content_version_id"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("lesson_progress_enrollment_lesson_unique").on(table.enrollmentId, table.lessonId),
    index("lesson_progress_enrollment_idx").on(table.enrollmentId),
    index("lesson_progress_status_idx").on(table.status),
  ],
);

export const educationQuizzes = pgTable(
  "education_quizzes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id").references(() => educationCourses.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id").references(() => courseLessons.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    passingScorePercent: integer("passing_score_percent").notNull().default(70),
    maxAttempts: integer("max_attempts"),
    shuffleQuestions: boolean("shuffle_questions").notNull().default(false),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    index("education_quizzes_course_idx").on(table.courseId),
    index("education_quizzes_lesson_idx").on(table.lessonId),
  ],
);

export const educationQuestions = pgTable(
  "education_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => educationQuizzes.id, { onDelete: "cascade" }),
    prompt: text("prompt").notNull(),
    position: integer("position").notNull().default(0),
    points: integer("points").notNull().default(1),
    explanation: text("explanation"),
    ...timestamps,
  },
  (table) => [
    index("education_questions_quiz_idx").on(table.quizId),
    uniqueIndex("education_questions_quiz_position_unique").on(table.quizId, table.position),
  ],
);

export const educationQuestionOptions = pgTable(
  "education_question_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => educationQuestions.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    position: integer("position").notNull().default(0),
    /** Nunca retornar ao aluno antes da submissão. */
    isCorrect: boolean("is_correct").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("education_question_options_question_idx").on(table.questionId),
    uniqueIndex("education_question_options_question_position_unique").on(
      table.questionId,
      table.position,
    ),
  ],
);

export const educationAttempts = pgTable(
  "education_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => educationQuizzes.id, { onDelete: "cascade" }),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => courseEnrollments.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: educationAttemptStatusEnum("status").notNull().default("in_progress"),
    scorePercent: integer("score_percent"),
    passed: boolean("passed"),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    submittedAt: timestamp("submitted_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("education_attempts_quiz_idx").on(table.quizId),
    index("education_attempts_enrollment_idx").on(table.enrollmentId),
    index("education_attempts_user_idx").on(table.userId),
  ],
);

export const educationAnswers = pgTable(
  "education_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => educationAttempts.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => educationQuestions.id, { onDelete: "cascade" }),
    optionId: uuid("option_id").references(() => educationQuestionOptions.id, {
      onDelete: "set null",
    }),
    freeText: text("free_text"),
    isCorrect: boolean("is_correct"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("education_answers_attempt_question_unique").on(table.attemptId, table.questionId),
    index("education_answers_attempt_idx").on(table.attemptId),
  ],
);

export const educationCertificates = pgTable(
  "education_certificates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => courseEnrollments.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => educationCourses.id, { onDelete: "cascade" }),
    certificateNumber: text("certificate_number").notNull(),
    verificationCode: text("verification_code").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    status: educationCertificateStatusEnum("status").notNull().default("issued"),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    pdfGenerationStatus: text("pdf_generation_status")
      .notNull()
      .default("PDF_GENERATION_NOT_CONFIGURED"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("education_certificates_number_unique").on(table.certificateNumber),
    uniqueIndex("education_certificates_verification_unique").on(table.verificationCode),
    uniqueIndex("education_certificates_enrollment_unique").on(table.enrollmentId),
    index("education_certificates_user_idx").on(table.userId),
    index("education_certificates_course_idx").on(table.courseId),
    index("education_certificates_status_idx").on(table.status),
  ],
);

export const educationLibraryItems = pgTable(
  "education_library_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    itemType: educationLibraryItemTypeEnum("item_type").notNull().default("document"),
    source: educationLibrarySourceEnum("source").notNull().default("authored_internally"),
    licenseNote: text("license_note"),
    externalUrl: text("external_url"),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    visibility: educationVisibilityEnum("visibility").notNull().default("authenticated"),
    categoryId: uuid("category_id").references(() => educationCategories.id, {
      onDelete: "set null",
    }),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("education_library_items_slug_unique").on(table.slug),
    index("education_library_items_org_idx").on(table.organizationId),
    index("education_library_items_type_idx").on(table.itemType),
    index("education_library_items_visibility_idx").on(table.visibility),
  ],
);

export const educationCategoriesRelations = relations(educationCategories, ({ one, many }) => ({
  parent: one(educationCategories, {
    fields: [educationCategories.parentId],
    references: [educationCategories.id],
    relationName: "education_category_tree",
  }),
  children: many(educationCategories, { relationName: "education_category_tree" }),
  courses: many(educationCourses),
  libraryItems: many(educationLibraryItems),
}));

export const educationInstructorsRelations = relations(educationInstructors, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [educationInstructors.profileId],
    references: [profiles.userId],
  }),
  courses: many(educationCourses),
}));

export const educationCoursesRelations = relations(educationCourses, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [educationCourses.organizationId],
    references: [organizations.id],
  }),
  instructor: one(educationInstructors, {
    fields: [educationCourses.instructorId],
    references: [educationInstructors.id],
  }),
  category: one(educationCategories, {
    fields: [educationCourses.categoryId],
    references: [educationCategories.id],
  }),
  modules: many(courseModules),
  enrollments: many(courseEnrollments),
  quizzes: many(educationQuizzes),
  certificates: many(educationCertificates),
}));

export const courseModulesRelations = relations(courseModules, ({ one, many }) => ({
  course: one(educationCourses, {
    fields: [courseModules.courseId],
    references: [educationCourses.id],
  }),
  lessons: many(courseLessons),
}));

export const courseLessonsRelations = relations(courseLessons, ({ one, many }) => ({
  module: one(courseModules, {
    fields: [courseLessons.moduleId],
    references: [courseModules.id],
  }),
  contents: many(lessonContents),
  progress: many(lessonProgress),
}));

export const lessonContentsRelations = relations(lessonContents, ({ one, many }) => ({
  lesson: one(courseLessons, {
    fields: [lessonContents.lessonId],
    references: [courseLessons.id],
  }),
  versions: many(lessonContentVersions),
}));

export const lessonContentVersionsRelations = relations(lessonContentVersions, ({ one }) => ({
  content: one(lessonContents, {
    fields: [lessonContentVersions.contentId],
    references: [lessonContents.id],
  }),
}));

export const learningTracksRelations = relations(learningTracks, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [learningTracks.organizationId],
    references: [organizations.id],
  }),
  legalArea: one(legalAreas, {
    fields: [learningTracks.legalAreaId],
    references: [legalAreas.id],
  }),
  courses: many(learningTrackCourses),
}));

export const learningTrackCoursesRelations = relations(learningTrackCourses, ({ one }) => ({
  track: one(learningTracks, {
    fields: [learningTrackCourses.trackId],
    references: [learningTracks.id],
  }),
  course: one(educationCourses, {
    fields: [learningTrackCourses.courseId],
    references: [educationCourses.id],
  }),
}));

export const courseEnrollmentsRelations = relations(courseEnrollments, ({ one, many }) => ({
  course: one(educationCourses, {
    fields: [courseEnrollments.courseId],
    references: [educationCourses.id],
  }),
  user: one(users, {
    fields: [courseEnrollments.userId],
    references: [users.id],
  }),
  progress: many(lessonProgress),
  certificates: many(educationCertificates),
  attempts: many(educationAttempts),
}));

export const lessonProgressRelations = relations(lessonProgress, ({ one }) => ({
  enrollment: one(courseEnrollments, {
    fields: [lessonProgress.enrollmentId],
    references: [courseEnrollments.id],
  }),
  lesson: one(courseLessons, {
    fields: [lessonProgress.lessonId],
    references: [courseLessons.id],
  }),
}));

export const educationQuizzesRelations = relations(educationQuizzes, ({ one, many }) => ({
  course: one(educationCourses, {
    fields: [educationQuizzes.courseId],
    references: [educationCourses.id],
  }),
  questions: many(educationQuestions),
  attempts: many(educationAttempts),
}));

export const educationQuestionsRelations = relations(educationQuestions, ({ one, many }) => ({
  quiz: one(educationQuizzes, {
    fields: [educationQuestions.quizId],
    references: [educationQuizzes.id],
  }),
  options: many(educationQuestionOptions),
}));

export const educationQuestionOptionsRelations = relations(educationQuestionOptions, ({ one }) => ({
  question: one(educationQuestions, {
    fields: [educationQuestionOptions.questionId],
    references: [educationQuestions.id],
  }),
}));

export const educationAttemptsRelations = relations(educationAttempts, ({ one, many }) => ({
  quiz: one(educationQuizzes, {
    fields: [educationAttempts.quizId],
    references: [educationQuizzes.id],
  }),
  enrollment: one(courseEnrollments, {
    fields: [educationAttempts.enrollmentId],
    references: [courseEnrollments.id],
  }),
  answers: many(educationAnswers),
}));

export const educationAnswersRelations = relations(educationAnswers, ({ one }) => ({
  attempt: one(educationAttempts, {
    fields: [educationAnswers.attemptId],
    references: [educationAttempts.id],
  }),
  question: one(educationQuestions, {
    fields: [educationAnswers.questionId],
    references: [educationQuestions.id],
  }),
}));

export const educationCertificatesRelations = relations(educationCertificates, ({ one }) => ({
  enrollment: one(courseEnrollments, {
    fields: [educationCertificates.enrollmentId],
    references: [courseEnrollments.id],
  }),
  course: one(educationCourses, {
    fields: [educationCertificates.courseId],
    references: [educationCourses.id],
  }),
  user: one(users, {
    fields: [educationCertificates.userId],
    references: [users.id],
  }),
}));

export const educationLibraryItemsRelations = relations(educationLibraryItems, ({ one }) => ({
  organization: one(organizations, {
    fields: [educationLibraryItems.organizationId],
    references: [organizations.id],
  }),
  category: one(educationCategories, {
    fields: [educationLibraryItems.categoryId],
    references: [educationCategories.id],
  }),
  document: one(documents, {
    fields: [educationLibraryItems.documentId],
    references: [documents.id],
  }),
}));
