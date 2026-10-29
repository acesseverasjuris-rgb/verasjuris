import { randomBytes } from "node:crypto";
import type { AIGateway, EducationMediaProvider, PaymentProvider } from "@verasjuris/ai";
import { NotConfiguredEducationMediaProvider } from "@verasjuris/ai";
import { recordAudit } from "@verasjuris/audit";
import {
  policyCertificate,
  policyEducationAccess,
  policyEducationCourseManage,
  policyEnrollment,
  policyLesson,
  policyLibraryItem,
  type SessionAccount,
} from "@verasjuris/auth";
import {
  courseEnrollments,
  courseLessons,
  courseModules,
  educationAnswers,
  educationAttempts,
  educationCategories,
  educationCertificates,
  educationCourses,
  educationInstructors,
  educationLibraryItems,
  educationQuestionOptions,
  educationQuestions,
  educationQuizzes,
  isUniqueViolation,
  learningTrackCourses,
  learningTracks,
  lessonContents,
  lessonContentVersions,
  lessonProgress,
  profiles,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { slugifyName } from "@verasjuris/validation";
import { and, asc, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { authorize, escapeLike, iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";

type DbTx = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];
type Db = AppDatabase | DbTx;

export type EducationModuleDeps = {
  paymentProvider?: PaymentProvider;
  aiGateway?: AIGateway;
  educationMediaProvider?: EducationMediaProvider;
};

const FREE_ENROLLMENT_SOURCES = new Set(["free", "admin", "organization", "promotion"]);
const ACCESS_STATUSES = new Set(["active", "completed"]);

function mediaProvider(deps?: EducationModuleDeps): EducationMediaProvider {
  return deps?.educationMediaProvider ?? new NotConfiguredEducationMediaProvider();
}

export function slugify(title: string): string {
  return slugifyName(title);
}

function sanitizeText(value: string): string {
  // Remove C0 control chars (except TAB/LF/CR) and DEL without embedding them in a regex literal.
  return Array.from(value)
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      if (code === 0x09 || code === 0x0a || code === 0x0d) return true;
      return code >= 0x20 && code !== 0x7f;
    })
    .join("")
    .trim();
}

function now() {
  return new Date();
}

function conflict(message: string): never {
  throw new AppError("CONFLICT", message);
}

function notFound(message = "Não encontramos este recurso."): never {
  throw new AppError("NOT_FOUND", message);
}

function isPaidCourse(course: typeof educationCourses.$inferSelect): boolean {
  return course.visibility === "paid" || (course.priceCents != null && course.priceCents > 0);
}

function enrollmentNeedsPayment(
  course: typeof educationCourses.$inferSelect,
  source: string,
): boolean {
  return isPaidCourse(course) && !FREE_ENROLLMENT_SOURCES.has(source);
}

function assertEnrollmentAccess(enrollment: typeof courseEnrollments.$inferSelect) {
  if (enrollment.status === "pending_payment") {
    throw new AppError(
      "AUTHORIZATION_ERROR",
      "A matrícula aguarda confirmação de pagamento. O acesso ao conteúdo ainda não foi liberado.",
    );
  }
  if (!ACCESS_STATUSES.has(enrollment.status)) {
    throw new AppError("AUTHORIZATION_ERROR", "Esta matrícula não permite acesso ao curso.");
  }
}

async function requireCourseInOrg(db: Db, organizationId: string, courseId: string) {
  const row = await db.query.educationCourses.findFirst({
    where: and(
      eq(educationCourses.id, courseId),
      eq(educationCourses.organizationId, organizationId),
    ),
  });
  if (!row) notFound("Não encontramos este curso.");
  return row;
}

async function requireModuleInOrg(db: Db, organizationId: string, moduleId: string) {
  const row = await db.query.courseModules.findFirst({
    where: eq(courseModules.id, moduleId),
    with: { course: true },
  });
  if (!row || row.course.organizationId !== organizationId) {
    notFound("Não encontramos este módulo.");
  }
  return row;
}

async function requireLessonInOrg(db: Db, organizationId: string, lessonId: string) {
  const row = await db.query.courseLessons.findFirst({
    where: eq(courseLessons.id, lessonId),
    with: { module: { with: { course: true } } },
  });
  if (!row || row.module.course.organizationId !== organizationId) {
    notFound("Não encontramos esta aula.");
  }
  return row;
}

async function requireQuizInOrg(db: Db, organizationId: string, quizId: string) {
  const row = await db.query.educationQuizzes.findFirst({
    where: eq(educationQuizzes.id, quizId),
  });
  if (!row) notFound("Não encontramos este quiz.");
  if (row.courseId) {
    await requireCourseInOrg(db, organizationId, row.courseId);
    return row;
  }
  if (row.lessonId) {
    await requireLessonInOrg(db, organizationId, row.lessonId);
    return row;
  }
  notFound("Não encontramos este quiz.");
}

function serializeCategory(row: typeof educationCategories.$inferSelect) {
  return {
    id: row.id,
    parentId: row.parentId,
    key: row.key,
    name: row.name,
    description: row.description,
    legalAreaModuleId: row.legalAreaModuleId,
    position: row.position,
    active: row.active,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function serializeCourse(row: typeof educationCourses.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    instructorId: row.instructorId,
    categoryId: row.categoryId,
    title: row.title,
    slug: row.slug,
    description: row.description,
    shortDescription: row.shortDescription,
    level: row.level,
    language: row.language,
    estimatedDurationMinutes: row.estimatedDurationMinutes,
    status: row.status,
    visibility: row.visibility,
    coverDocumentId: row.coverDocumentId,
    priceCents: row.priceCents,
    currency: row.currency,
    certificateEnabled: row.certificateEnabled,
    completionRuleJson: row.completionRuleJson,
    publishedAt: iso(row.publishedAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function serializeModule(row: typeof courseModules.$inferSelect) {
  return {
    id: row.id,
    courseId: row.courseId,
    title: row.title,
    description: row.description,
    position: row.position,
    releaseRule: row.releaseRule,
    active: row.active,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function serializeLesson(row: typeof courseLessons.$inferSelect) {
  return {
    id: row.id,
    moduleId: row.moduleId,
    title: row.title,
    description: row.description,
    lessonType: row.lessonType,
    position: row.position,
    estimatedDurationMinutes: row.estimatedDurationMinutes,
    required: row.required,
    previewAllowed: row.previewAllowed,
    status: row.status,
    quizId: row.quizId,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function serializeContentBlock(
  row: typeof lessonContents.$inferSelect,
  version?: typeof lessonContentVersions.$inferSelect | null,
  options?: { mediaConfigured?: boolean },
) {
  const mediaConfigured =
    options?.mediaConfigured !== false && row.mediaProviderKey !== "not_configured";
  const isMediaRef =
    row.blockType === "video_reference" ||
    row.blockType === "audio_reference" ||
    row.blockType === "embed";
  return {
    id: row.id,
    lessonId: row.lessonId,
    blockType: row.blockType,
    position: row.position,
    currentVersionId: row.currentVersionId,
    documentId: row.documentId,
    mediaProviderKey: mediaConfigured ? row.mediaProviderKey : "not_configured",
    externalMediaRef: isMediaRef && !mediaConfigured ? null : row.externalMediaRef,
    mediaStatus:
      isMediaRef && !mediaConfigured ? "NOT_CONFIGURED" : mediaConfigured ? "ready" : null,
    licenseNote: row.licenseNote,
    active: row.active,
    bodyText: version?.bodyText ?? null,
    payloadJson: version?.payloadJson ?? null,
    version: version?.version ?? null,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function serializeEnrollment(row: typeof courseEnrollments.$inferSelect) {
  return {
    id: row.id,
    courseId: row.courseId,
    userId: row.userId,
    organizationId: row.organizationId,
    source: row.source,
    status: row.status,
    enrolledAt: iso(row.enrolledAt),
    startedAt: iso(row.startedAt),
    completedAt: iso(row.completedAt),
    expiresAt: iso(row.expiresAt),
    invoiceId: row.invoiceId,
    paymentIntentId: row.paymentIntentId,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function serializeProgress(row: typeof lessonProgress.$inferSelect) {
  return {
    id: row.id,
    enrollmentId: row.enrollmentId,
    lessonId: row.lessonId,
    status: row.status,
    progressPercent: row.progressPercent,
    startedAt: iso(row.startedAt),
    completedAt: iso(row.completedAt),
    lastPositionMetadata: row.lastPositionMetadata,
    contentVersionId: row.contentVersionId,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function serializeCertificate(row: typeof educationCertificates.$inferSelect) {
  return {
    id: row.id,
    enrollmentId: row.enrollmentId,
    userId: row.userId,
    courseId: row.courseId,
    certificateNumber: row.certificateNumber,
    verificationCode: row.verificationCode,
    issuedAt: iso(row.issuedAt),
    revokedAt: iso(row.revokedAt),
    status: row.status,
    documentId: row.documentId,
    pdfGenerationStatus: row.pdfGenerationStatus,
    metadata: row.metadata,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function serializeTrack(row: typeof learningTracks.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    title: row.title,
    slug: row.slug,
    description: row.description,
    legalAreaId: row.legalAreaId,
    status: row.status,
    visibility: row.visibility,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function serializeLibraryItem(row: typeof educationLibraryItems.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    title: row.title,
    slug: row.slug,
    description: row.description,
    itemType: row.itemType,
    source: row.source,
    licenseNote: row.licenseNote,
    externalUrl: row.externalUrl,
    documentId: row.documentId,
    visibility: row.visibility,
    categoryId: row.categoryId,
    active: row.active,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function serializeQuiz(
  row: typeof educationQuizzes.$inferSelect,
  questions?: Array<{
    question: typeof educationQuestions.$inferSelect;
    options: Array<typeof educationQuestionOptions.$inferSelect>;
  }>,
  options?: { includeAnswerKey?: boolean },
) {
  const includeAnswerKey = options?.includeAnswerKey === true;
  return {
    id: row.id,
    courseId: row.courseId,
    lessonId: row.lessonId,
    title: row.title,
    description: row.description,
    passingScorePercent: row.passingScorePercent,
    maxAttempts: row.maxAttempts,
    shuffleQuestions: row.shuffleQuestions,
    active: row.active,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    questions: questions?.map(({ question, options: opts }) => ({
      id: question.id,
      prompt: question.prompt,
      position: question.position,
      points: question.points,
      explanation: includeAnswerKey ? question.explanation : undefined,
      options: opts.map((opt) => ({
        id: opt.id,
        label: opt.label,
        position: opt.position,
        ...(includeAnswerKey ? { isCorrect: opt.isCorrect } : {}),
      })),
    })),
  };
}

function canViewPublishedCourse(
  course: typeof educationCourses.$inferSelect,
  account: SessionAccount | null,
): boolean {
  if (course.status !== "published") return false;
  if (course.visibility === "public" || course.visibility === "paid") return true;
  if (!account) return false;
  if (course.visibility === "authenticated") return true;
  if (course.visibility === "organization_only") {
    return Boolean(
      course.organizationId &&
        account.memberships.some((m) => m.organizationId === course.organizationId),
    );
  }
  return false;
}

async function loadRequiredLessons(db: Db, courseId: string) {
  const modules = await db.query.courseModules.findMany({
    where: and(eq(courseModules.courseId, courseId), eq(courseModules.active, true)),
    orderBy: asc(courseModules.position),
    with: {
      lessons: {
        where: eq(courseLessons.required, true),
        orderBy: asc(courseLessons.position),
      },
    },
  });
  return modules.flatMap((m) => m.lessons);
}

export async function computeCourseProgress(db: Db, enrollmentId: string) {
  const enrollment = await db.query.courseEnrollments.findFirst({
    where: eq(courseEnrollments.id, enrollmentId),
  });
  if (!enrollment) notFound("Não encontramos esta matrícula.");

  const requiredLessons = await loadRequiredLessons(db, enrollment.courseId);
  const totalRequired = requiredLessons.length;
  if (totalRequired === 0) {
    return {
      enrollmentId,
      totalRequired: 0,
      completedRequired: 0,
      progressPercent: 100,
      completed: true,
      pendingQuizLessonIds: [] as string[],
    };
  }

  const progressRows = await db.query.lessonProgress.findMany({
    where: and(
      eq(lessonProgress.enrollmentId, enrollmentId),
      eq(lessonProgress.status, "completed"),
    ),
  });
  const completedLessonIds = new Set(progressRows.map((p) => p.lessonId));

  const quizLessonIds = requiredLessons
    .filter((l) => l.quizId || l.lessonType === "quiz")
    .map((l) => l.id);
  const pendingQuizLessonIds: string[] = [];

  if (quizLessonIds.length > 0) {
    const quizIds = requiredLessons
      .filter((l) => l.quizId)
      .map((l) => l.quizId!)
      .filter(Boolean);
    const passedAttempts =
      quizIds.length > 0
        ? await db.query.educationAttempts.findMany({
            where: and(
              eq(educationAttempts.enrollmentId, enrollmentId),
              eq(educationAttempts.passed, true),
              inArray(educationAttempts.quizId, quizIds),
            ),
          })
        : [];
    const passedQuizIds = new Set(passedAttempts.map((a) => a.quizId));
    for (const lesson of requiredLessons) {
      if (!lesson.quizId) continue;
      if (!passedQuizIds.has(lesson.quizId)) {
        pendingQuizLessonIds.push(lesson.id);
      }
    }
  }

  const completedRequired = requiredLessons.filter(
    (l) => completedLessonIds.has(l.id) && !pendingQuizLessonIds.includes(l.id),
  ).length;
  const progressPercent = Math.min(100, Math.round((completedRequired / totalRequired) * 100));
  const completed = completedRequired >= totalRequired && pendingQuizLessonIds.length === 0;

  return {
    enrollmentId,
    totalRequired,
    completedRequired,
    progressPercent,
    completed,
    pendingQuizLessonIds,
  };
}

async function maybeCompleteEnrollment(
  db: Db,
  account: SessionAccount,
  enrollment: typeof courseEnrollments.$inferSelect,
  meta: RequestMeta,
) {
  const progress = await computeCourseProgress(db, enrollment.id);
  if (!progress.completed || enrollment.status === "completed") {
    return { enrollment, progress, justCompleted: false };
  }

  const [updated] = await db
    .update(courseEnrollments)
    .set({
      status: "completed",
      completedAt: now(),
      updatedAt: now(),
    })
    .where(eq(courseEnrollments.id, enrollment.id))
    .returning();

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId: enrollment.organizationId,
    action: "education.course_completed",
    resourceType: "course_enrollment",
    resourceId: enrollment.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    metadata: { courseId: enrollment.courseId, progressPercent: progress.progressPercent },
  });

  return { enrollment: updated!, progress, justCompleted: true };
}

export async function issueCertificate(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: { enrollmentId: string; metadata?: Record<string, unknown> },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyCertificate(access, "education.certificate.issue"),
  );

  const enrollment = await db.query.courseEnrollments.findFirst({
    where: eq(courseEnrollments.id, input.enrollmentId),
  });
  if (!enrollment || enrollment.organizationId !== organizationId) {
    notFound("Não encontramos esta matrícula.");
  }
  if (enrollment.status !== "completed") {
    throw new AppError(
      "CONFLICT",
      "O certificado só pode ser emitido após a conclusão da matrícula.",
    );
  }

  const course = await requireCourseInOrg(db, organizationId, enrollment.courseId);
  if (!course.certificateEnabled) {
    throw new AppError("CONFLICT", "Este curso não habilita certificados.");
  }

  const progress = await computeCourseProgress(db, enrollment.id);
  if (!progress.completed) {
    throw new AppError("CONFLICT", "As regras de conclusão do curso ainda não foram satisfeitas.");
  }

  const existing = await db.query.educationCertificates.findFirst({
    where: and(
      eq(educationCertificates.enrollmentId, enrollment.id),
      eq(educationCertificates.status, "issued"),
    ),
  });
  if (existing) {
    return { certificate: serializeCertificate(existing) };
  }

  const verificationCode = randomBytes(16).toString("hex");
  const certificateNumber = `EDU-${randomBytes(6).toString("hex").toUpperCase()}`;

  try {
    const [row] = await db
      .insert(educationCertificates)
      .values({
        enrollmentId: enrollment.id,
        userId: enrollment.userId,
        courseId: enrollment.courseId,
        certificateNumber,
        verificationCode,
        status: "issued",
        pdfGenerationStatus: "PDF_GENERATION_NOT_CONFIGURED",
        metadata: input.metadata ?? null,
      })
      .returning();

    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "education.certificate_issued",
      resourceType: "education_certificate",
      resourceId: row!.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      metadata: { enrollmentId: enrollment.id, courseId: enrollment.courseId },
    });

    return { certificate: serializeCertificate(row!) };
  } catch (error) {
    if (isUniqueViolation(error)) {
      const again = await db.query.educationCertificates.findFirst({
        where: eq(educationCertificates.enrollmentId, enrollment.id),
      });
      if (again) return { certificate: serializeCertificate(again) };
    }
    throw error;
  }
}

/* -------------------------------------------------------------------------- */
/* Public / learner                                                            */
/* -------------------------------------------------------------------------- */

export async function listEducationCategories(db: AppDatabase) {
  const rows = await db.query.educationCategories.findMany({
    where: eq(educationCategories.active, true),
    orderBy: [asc(educationCategories.position), asc(educationCategories.name)],
  });
  return { items: rows.map(serializeCategory) };
}

export async function listPublishedCourses(
  db: AppDatabase,
  account: SessionAccount | null,
  query: {
    q?: string;
    level?: string;
    categoryId?: string;
    instructorId?: string;
    organizationId?: string;
    limit: number;
    offset: number;
  },
) {
  const orgIds = account?.memberships.map((m) => m.organizationId) ?? [];
  const visibilityFilter = account
    ? or(
        inArray(educationCourses.visibility, ["public", "authenticated", "paid"]),
        orgIds.length > 0
          ? and(
              eq(educationCourses.visibility, "organization_only"),
              inArray(educationCourses.organizationId, orgIds),
            )
          : undefined,
      )
    : inArray(educationCourses.visibility, ["public", "paid"]);

  const conditions = [
    eq(educationCourses.status, "published"),
    visibilityFilter,
    query.level ? eq(educationCourses.level, query.level as never) : undefined,
    query.categoryId ? eq(educationCourses.categoryId, query.categoryId) : undefined,
    query.instructorId ? eq(educationCourses.instructorId, query.instructorId) : undefined,
    query.organizationId ? eq(educationCourses.organizationId, query.organizationId) : undefined,
    query.q ? ilike(educationCourses.title, `%${escapeLike(query.q)}%`) : undefined,
  ].filter(Boolean);

  const rows = await db.query.educationCourses.findMany({
    where: and(...conditions),
    orderBy: [desc(educationCourses.publishedAt), desc(educationCourses.createdAt)],
    limit: query.limit,
    offset: query.offset,
  });

  return {
    items: rows.filter((c) => canViewPublishedCourse(c, account)).map(serializeCourse),
  };
}

export async function getPublishedCourse(
  db: AppDatabase,
  account: SessionAccount | null,
  courseId: string,
) {
  const row = await db.query.educationCourses.findFirst({
    where: eq(educationCourses.id, courseId),
  });
  if (!row || !canViewPublishedCourse(row, account)) {
    notFound("Não encontramos este curso.");
  }
  return { course: serializeCourse(row) };
}

export async function getPublishedCourseBySlug(
  db: AppDatabase,
  account: SessionAccount | null,
  slug: string,
) {
  const row = await db.query.educationCourses.findFirst({
    where: eq(educationCourses.slug, slug),
  });
  if (!row || !canViewPublishedCourse(row, account)) {
    notFound("Não encontramos este curso.");
  }
  return { course: serializeCourse(row) };
}

export async function listCourseModulesPublic(
  db: AppDatabase,
  account: SessionAccount | null,
  courseId: string,
) {
  const course = await db.query.educationCourses.findFirst({
    where: eq(educationCourses.id, courseId),
  });
  if (!course || !canViewPublishedCourse(course, account)) {
    notFound("Não encontramos este curso.");
  }
  const rows = await db.query.courseModules.findMany({
    where: and(eq(courseModules.courseId, courseId), eq(courseModules.active, true)),
    orderBy: asc(courseModules.position),
  });
  return { items: rows.map(serializeModule) };
}

export async function listModuleLessonsPublic(
  db: AppDatabase,
  account: SessionAccount | null,
  moduleId: string,
) {
  const mod = await db.query.courseModules.findFirst({
    where: eq(courseModules.id, moduleId),
    with: { course: true },
  });
  if (!mod || !canViewPublishedCourse(mod.course, account)) {
    notFound("Não encontramos este módulo.");
  }
  const rows = await db.query.courseLessons.findMany({
    where: and(eq(courseLessons.moduleId, moduleId), eq(courseLessons.status, "published")),
    orderBy: asc(courseLessons.position),
  });
  return { items: rows.map(serializeLesson) };
}

export async function getLessonPublic(
  db: AppDatabase,
  account: SessionAccount | null,
  lessonId: string,
  deps?: EducationModuleDeps,
) {
  const lesson = await db.query.courseLessons.findFirst({
    where: eq(courseLessons.id, lessonId),
    with: {
      module: { with: { course: true } },
      contents: {
        where: eq(lessonContents.active, true),
        orderBy: asc(lessonContents.position),
      },
    },
  });
  if (!lesson) notFound("Não encontramos esta aula.");

  const course = lesson.module.course;
  const previewOk = lesson.previewAllowed && canViewPublishedCourse(course, account);
  let hasAccess = previewOk;

  if (account && !hasAccess) {
    const enrollment = await db.query.courseEnrollments.findFirst({
      where: and(
        eq(courseEnrollments.courseId, course.id),
        eq(courseEnrollments.userId, account.user.id),
      ),
    });
    if (enrollment && ACCESS_STATUSES.has(enrollment.status)) {
      hasAccess = true;
    } else if (
      course.organizationId &&
      account.memberships.some((m) => m.organizationId === course.organizationId)
    ) {
      // Org members with education.read can preview published content structure.
      try {
        authorize(account, course.organizationId, (access) =>
          policyEducationAccess(access, "education.read"),
        );
        hasAccess = lesson.status === "published" || lesson.previewAllowed;
      } catch {
        hasAccess = false;
      }
    }
  }

  if (!hasAccess || (lesson.status !== "published" && !previewOk)) {
    notFound("Não encontramos esta aula.");
  }

  const mediaConfigured = mediaProvider(deps).id !== "not_configured";
  const contents = [];
  for (const block of lesson.contents) {
    const version = block.currentVersionId
      ? await db.query.lessonContentVersions.findFirst({
          where: eq(lessonContentVersions.id, block.currentVersionId),
        })
      : null;
    contents.push(serializeContentBlock(block, version, { mediaConfigured }));
  }

  let quiz = null;
  if (lesson.quizId) {
    const quizRow = await db.query.educationQuizzes.findFirst({
      where: eq(educationQuizzes.id, lesson.quizId),
      with: {
        questions: {
          orderBy: asc(educationQuestions.position),
          with: {
            options: { orderBy: asc(educationQuestionOptions.position) },
          },
        },
      },
    });
    if (quizRow) {
      quiz = serializeQuiz(
        quizRow,
        quizRow.questions.map((q) => ({ question: q, options: q.options })),
        { includeAnswerKey: false },
      );
    }
  }

  return {
    lesson: serializeLesson(lesson),
    contents,
    quiz,
  };
}

export async function listPublishedTracks(
  db: AppDatabase,
  account: SessionAccount | null,
  query: {
    q?: string;
    legalAreaId?: string;
    organizationId?: string;
    limit: number;
    offset: number;
  },
) {
  const orgIds = account?.memberships.map((m) => m.organizationId) ?? [];
  const visibilityFilter = account
    ? or(
        inArray(learningTracks.visibility, ["public", "authenticated", "paid"]),
        orgIds.length > 0
          ? and(
              eq(learningTracks.visibility, "organization_only"),
              inArray(learningTracks.organizationId, orgIds),
            )
          : undefined,
      )
    : inArray(learningTracks.visibility, ["public", "paid"]);

  const rows = await db.query.learningTracks.findMany({
    where: and(
      eq(learningTracks.status, "published"),
      visibilityFilter,
      query.legalAreaId ? eq(learningTracks.legalAreaId, query.legalAreaId) : undefined,
      query.organizationId ? eq(learningTracks.organizationId, query.organizationId) : undefined,
      query.q ? ilike(learningTracks.title, `%${escapeLike(query.q)}%`) : undefined,
    ),
    orderBy: desc(learningTracks.createdAt),
    limit: query.limit,
    offset: query.offset,
  });
  return { items: rows.map(serializeTrack) };
}

export async function listPublishedLibrary(
  db: AppDatabase,
  account: SessionAccount | null,
  query: {
    q?: string;
    itemType?: string;
    categoryId?: string;
    organizationId?: string;
    limit: number;
    offset: number;
  },
) {
  const orgIds = account?.memberships.map((m) => m.organizationId) ?? [];
  const visibilityFilter = account
    ? or(
        inArray(educationLibraryItems.visibility, ["public", "authenticated", "paid"]),
        orgIds.length > 0
          ? and(
              eq(educationLibraryItems.visibility, "organization_only"),
              inArray(educationLibraryItems.organizationId, orgIds),
            )
          : undefined,
      )
    : eq(educationLibraryItems.visibility, "public");

  const rows = await db.query.educationLibraryItems.findMany({
    where: and(
      eq(educationLibraryItems.active, true),
      visibilityFilter,
      query.itemType ? eq(educationLibraryItems.itemType, query.itemType as never) : undefined,
      query.categoryId ? eq(educationLibraryItems.categoryId, query.categoryId) : undefined,
      query.organizationId
        ? eq(educationLibraryItems.organizationId, query.organizationId)
        : undefined,
      query.q ? ilike(educationLibraryItems.title, `%${escapeLike(query.q)}%`) : undefined,
    ),
    orderBy: desc(educationLibraryItems.createdAt),
    limit: query.limit,
    offset: query.offset,
  });
  return { items: rows.map(serializeLibraryItem) };
}

export async function createEnrollment(
  db: AppDatabase,
  account: SessionAccount,
  input: {
    courseId: string;
    userId?: string;
    organizationId?: string;
    source?: string;
    status?: "active" | "pending_payment";
    expiresAt?: string;
    invoiceId?: string;
    paymentIntentId?: string;
  },
  meta: RequestMeta,
  deps?: EducationModuleDeps,
) {
  const targetUserId = input.userId ?? account.user.id;
  const course = await db.query.educationCourses.findFirst({
    where: eq(educationCourses.id, input.courseId),
  });
  if (!course || course.status !== "published") {
    notFound("Não encontramos este curso.");
  }

  const organizationId = input.organizationId ?? course.organizationId ?? undefined;
  if (organizationId) {
    if (targetUserId !== account.user.id) {
      authorize(account, organizationId, (access) =>
        policyEnrollment(access, "education.enrollment.manage"),
      );
    } else {
      // Self-enroll: membership optional for public/paid courses.
      const member = account.memberships.find((m) => m.organizationId === organizationId);
      if (member) {
        authorize(account, organizationId, (access) => policyEnrollment(access, "education.read"));
      } else if (course.visibility === "organization_only" || course.visibility === "private") {
        notFound("Não encontramos este curso.");
      }
    }
  } else if (targetUserId !== account.user.id) {
    throw new AppError("AUTHORIZATION_ERROR", "Você só pode matricular a si mesmo neste curso.");
  }

  if (!canViewPublishedCourse(course, account) && targetUserId === account.user.id) {
    // Private org course with manage permission already checked above.
    if (!organizationId) notFound("Não encontramos este curso.");
  }

  const source = input.source ?? (isPaidCourse(course) ? "purchase" : "free");
  let status: "active" | "pending_payment" =
    input.status ?? (enrollmentNeedsPayment(course, source) ? "pending_payment" : "active");
  if (enrollmentNeedsPayment(course, source) && status === "active" && !input.paymentIntentId) {
    status = "pending_payment";
  }

  let paymentIntentId = input.paymentIntentId ?? null;
  if (status === "pending_payment" && !paymentIntentId && deps?.paymentProvider) {
    const intent = await deps.paymentProvider.createPaymentIntent({
      amountCents: course.priceCents ?? 0,
      currency: course.currency,
      description: `Matrícula: ${course.title}`,
      referenceType: "education_enrollment",
      referenceId: course.id,
      customerReference: targetUserId,
      metadata: { courseId: course.id, userId: targetUserId },
    });
    paymentIntentId = intent.externalIntentId;
    // Provider not configured → keep pending_payment without inventing paid access.
  }

  try {
    const [row] = await db
      .insert(courseEnrollments)
      .values({
        courseId: course.id,
        userId: targetUserId,
        organizationId: organizationId ?? null,
        source: source as never,
        status,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        invoiceId: input.invoiceId ?? null,
        paymentIntentId,
        startedAt: status === "active" ? now() : null,
      })
      .returning();

    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId: organizationId ?? null,
      action: "education.enrollment_created",
      resourceType: "course_enrollment",
      resourceId: row!.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      metadata: { courseId: course.id, status, enrollmentSource: source },
    });

    return { enrollment: serializeEnrollment(row!) };
  } catch (error) {
    if (isUniqueViolation(error)) {
      conflict("Você já está matriculado neste curso.");
    }
    throw error;
  }
}

export async function listMyEnrollments(
  db: AppDatabase,
  account: SessionAccount,
  query: { courseId?: string; status?: string; limit: number; offset: number },
) {
  const rows = await db.query.courseEnrollments.findMany({
    where: and(
      eq(courseEnrollments.userId, account.user.id),
      query.courseId ? eq(courseEnrollments.courseId, query.courseId) : undefined,
      query.status ? eq(courseEnrollments.status, query.status as never) : undefined,
    ),
    orderBy: desc(courseEnrollments.enrolledAt),
    limit: query.limit,
    offset: query.offset,
  });
  return { items: rows.map(serializeEnrollment) };
}

export async function getMyEnrollment(
  db: AppDatabase,
  account: SessionAccount,
  enrollmentId: string,
) {
  const row = await db.query.courseEnrollments.findFirst({
    where: eq(courseEnrollments.id, enrollmentId),
  });
  if (!row || row.userId !== account.user.id) {
    notFound("Não encontramos esta matrícula.");
  }
  const progress = await computeCourseProgress(db, row.id);
  return { enrollment: serializeEnrollment(row), progress };
}

export async function updateEnrollmentProgress(
  db: AppDatabase,
  account: SessionAccount,
  enrollmentId: string,
  input: {
    lessonId: string;
    status?: "not_started" | "in_progress" | "completed";
    progressPercent?: number;
    lastPositionMetadata?: Record<string, unknown>;
    contentVersionId?: string;
  },
  meta: RequestMeta,
) {
  const enrollment = await db.query.courseEnrollments.findFirst({
    where: eq(courseEnrollments.id, enrollmentId),
  });
  if (!enrollment || enrollment.userId !== account.user.id) {
    notFound("Não encontramos esta matrícula.");
  }
  assertEnrollmentAccess(enrollment);

  const lesson = await db.query.courseLessons.findFirst({
    where: eq(courseLessons.id, input.lessonId),
    with: { module: true },
  });
  if (!lesson || lesson.module.courseId !== enrollment.courseId) {
    notFound("Não encontramos esta aula neste curso.");
  }

  const nextStatus =
    input.status ??
    (input.progressPercent !== undefined && input.progressPercent >= 100
      ? "completed"
      : "in_progress");
  const progressPercent =
    nextStatus === "completed"
      ? 100
      : (input.progressPercent ?? (nextStatus === "in_progress" ? 1 : 0));

  const existing = await db.query.lessonProgress.findFirst({
    where: and(
      eq(lessonProgress.enrollmentId, enrollmentId),
      eq(lessonProgress.lessonId, input.lessonId),
    ),
  });

  const startedAt = existing?.startedAt ?? (nextStatus !== "not_started" ? now() : null);
  const completedAt =
    nextStatus === "completed" ? (existing?.completedAt ?? now()) : (existing?.completedAt ?? null);

  let row: typeof lessonProgress.$inferSelect;
  if (existing) {
    const [updated] = await db
      .update(lessonProgress)
      .set({
        status: nextStatus,
        progressPercent,
        startedAt,
        completedAt: nextStatus === "completed" ? completedAt : null,
        lastPositionMetadata: input.lastPositionMetadata ?? existing.lastPositionMetadata,
        contentVersionId: input.contentVersionId ?? existing.contentVersionId,
        updatedAt: now(),
      })
      .where(eq(lessonProgress.id, existing.id))
      .returning();
    row = updated!;
  } else {
    const [created] = await db
      .insert(lessonProgress)
      .values({
        enrollmentId,
        lessonId: input.lessonId,
        status: nextStatus,
        progressPercent,
        startedAt,
        completedAt: nextStatus === "completed" ? completedAt : null,
        lastPositionMetadata: input.lastPositionMetadata ?? null,
        contentVersionId: input.contentVersionId ?? null,
      })
      .returning();
    row = created!;
  }

  if (!enrollment.startedAt && nextStatus !== "not_started") {
    await db
      .update(courseEnrollments)
      .set({ startedAt: now(), updatedAt: now() })
      .where(eq(courseEnrollments.id, enrollment.id));
  }

  if (nextStatus === "in_progress" && (!existing || existing.status === "not_started")) {
    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId: enrollment.organizationId,
      action: "education.lesson_started",
      resourceType: "lesson_progress",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      metadata: { enrollmentId, lessonId: input.lessonId },
    });
  }

  if (nextStatus === "completed" && existing?.status !== "completed") {
    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId: enrollment.organizationId,
      action: "education.lesson_completed",
      resourceType: "lesson_progress",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      metadata: { enrollmentId, lessonId: input.lessonId },
    });
  }

  const completion = await maybeCompleteEnrollment(db, account, enrollment, meta);

  return {
    progress: serializeProgress(row),
    courseProgress: completion.progress,
    enrollment: serializeEnrollment(completion.enrollment),
  };
}

export async function listMyCertificates(db: AppDatabase, account: SessionAccount) {
  const rows = await db.query.educationCertificates.findMany({
    where: eq(educationCertificates.userId, account.user.id),
    orderBy: desc(educationCertificates.issuedAt),
  });
  return { items: rows.map(serializeCertificate) };
}

export async function verifyCertificatePublic(db: AppDatabase, code: string) {
  const row = await db.query.educationCertificates.findFirst({
    where: eq(educationCertificates.verificationCode, code),
  });
  if (!row) notFound("Não encontramos este certificado.");

  const course = await db.query.educationCourses.findFirst({
    where: eq(educationCourses.id, row.courseId),
  });
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, row.userId),
  });

  return {
    valid: row.status === "issued",
    status: row.status,
    courseTitle: course?.title ?? null,
    displayName: profile?.displayName ?? null,
    issuedAt: iso(row.issuedAt),
    revokedAt: iso(row.revokedAt),
    certificateNumber: row.certificateNumber,
  };
}

export async function getQuizForLearner(db: AppDatabase, account: SessionAccount, quizId: string) {
  const quiz = await db.query.educationQuizzes.findFirst({
    where: and(eq(educationQuizzes.id, quizId), eq(educationQuizzes.active, true)),
    with: {
      questions: {
        orderBy: asc(educationQuestions.position),
        with: { options: { orderBy: asc(educationQuestionOptions.position) } },
      },
    },
  });
  if (!quiz) notFound("Não encontramos este quiz.");

  if (quiz.courseId) {
    const enrollment = await db.query.courseEnrollments.findFirst({
      where: and(
        eq(courseEnrollments.courseId, quiz.courseId),
        eq(courseEnrollments.userId, account.user.id),
      ),
    });
    if (!enrollment || !ACCESS_STATUSES.has(enrollment.status)) {
      notFound("Não encontramos este quiz.");
    }
  }

  return {
    quiz: serializeQuiz(
      quiz,
      quiz.questions.map((q) => ({ question: q, options: q.options })),
      { includeAnswerKey: false },
    ),
  };
}

export async function submitQuizAttempt(
  db: AppDatabase,
  account: SessionAccount,
  quizId: string,
  input: {
    answers: Array<{ questionId: string; optionId?: string; freeText?: string }>;
  },
  meta: RequestMeta,
) {
  const quiz = await db.query.educationQuizzes.findFirst({
    where: and(eq(educationQuizzes.id, quizId), eq(educationQuizzes.active, true)),
    with: {
      questions: {
        orderBy: asc(educationQuestions.position),
        with: { options: { orderBy: asc(educationQuestionOptions.position) } },
      },
    },
  });
  if (!quiz || !quiz.courseId) notFound("Não encontramos este quiz.");

  const enrollment = await db.query.courseEnrollments.findFirst({
    where: and(
      eq(courseEnrollments.courseId, quiz.courseId),
      eq(courseEnrollments.userId, account.user.id),
    ),
  });
  if (!enrollment) notFound("Não encontramos este quiz.");
  assertEnrollmentAccess(enrollment);

  if (quiz.maxAttempts != null) {
    const prior = await db.query.educationAttempts.findMany({
      where: and(
        eq(educationAttempts.quizId, quizId),
        eq(educationAttempts.enrollmentId, enrollment.id),
        inArray(educationAttempts.status, ["submitted", "graded"]),
      ),
    });
    if (prior.length >= quiz.maxAttempts) {
      conflict("Limite de tentativas do quiz atingido.");
    }
  }

  const questionMap = new Map(quiz.questions.map((q) => [q.id, q]));
  let earned = 0;
  let possible = 0;
  const graded: Array<{
    questionId: string;
    optionId: string | null;
    freeText: string | null;
    isCorrect: boolean | null;
    points: number;
  }> = [];

  for (const question of quiz.questions) {
    possible += question.points;
    const answer = input.answers.find((a) => a.questionId === question.id);
    const option = answer?.optionId
      ? question.options.find((o) => o.id === answer.optionId)
      : undefined;
    const isCorrect = option ? option.isCorrect : null;
    if (isCorrect) earned += question.points;
    graded.push({
      questionId: question.id,
      optionId: option?.id ?? null,
      freeText: answer?.freeText ?? null,
      isCorrect,
      points: question.points,
    });
    if (answer && !questionMap.has(answer.questionId)) {
      throw new AppError("VALIDATION_ERROR", "Resposta inválida para este quiz.");
    }
  }

  const scorePercent = possible === 0 ? 0 : Math.round((earned / possible) * 100);
  const passed = scorePercent >= quiz.passingScorePercent;

  const result = await db.transaction(async (tx) => {
    const [attempt] = await tx
      .insert(educationAttempts)
      .values({
        quizId,
        enrollmentId: enrollment.id,
        userId: account.user.id,
        status: "graded",
        scorePercent,
        passed,
        submittedAt: now(),
      })
      .returning();

    if (graded.length > 0) {
      await tx.insert(educationAnswers).values(
        graded.map((g) => ({
          attemptId: attempt!.id,
          questionId: g.questionId,
          optionId: g.optionId,
          freeText: g.freeText,
          isCorrect: g.isCorrect,
        })),
      );
    }

    return attempt!;
  });

  return {
    attempt: {
      id: result.id,
      quizId: result.quizId,
      enrollmentId: result.enrollmentId,
      status: result.status,
      scorePercent: result.scorePercent,
      passed: result.passed,
      submittedAt: iso(result.submittedAt),
      createdAt: iso(result.createdAt),
    },
    quiz: serializeQuiz(
      quiz,
      quiz.questions.map((q) => ({ question: q, options: q.options })),
      { includeAnswerKey: true },
    ),
    answers: graded,
  };
}

export async function runEducationAiAssist(
  _db: AppDatabase,
  account: SessionAccount,
  feature: string,
  input: {
    organizationId: string;
    prompt: string;
    courseId?: string;
    lessonId?: string;
    context?: string;
  },
  deps: EducationModuleDeps,
) {
  if (!deps.aiGateway) {
    throw new AppError(
      "AI_PROVIDER_NOT_CONFIGURED",
      "Assistência de IA educacional não está configurada.",
    );
  }

  const allowed = new Set([
    "summarize_lesson",
    "study_tips",
    "explain_concept",
    "quiz_practice",
    "outline",
  ]);
  if (!allowed.has(feature)) {
    throw new AppError("VALIDATION_ERROR", "Recurso de IA educacional não suportado.");
  }

  authorize(account, input.organizationId, (access) =>
    policyEducationAccess(access, "education.read"),
  );

  const payload = [
    `Feature: ${feature}.`,
    "Não atribua progresso, não emita certificados e não invente jurisprudência.",
    input.courseId ? `courseId=${input.courseId}` : null,
    input.lessonId ? `lessonId=${input.lessonId}` : null,
    input.context ? `Contexto:\n${sanitizeText(input.context)}` : null,
    `Pedido:\n${sanitizeText(input.prompt)}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  // Assistive only — never mutates progress or certificates.
  const result = await deps.aiGateway.complete({
    userId: account.user.id,
    organizationId: input.organizationId,
    feature: `education.${feature}`,
    promptVersion: "1",
    input: payload,
  });

  return {
    feature,
    assistiveOnly: true,
    text: result.data,
    usage: result.usage ?? null,
    model: result.model ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/* Org / instructor                                                            */
/* -------------------------------------------------------------------------- */

export async function createEducationCategory(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    parentId?: string;
    key?: string;
    name: string;
    description?: string;
    legalAreaModuleId?: string;
    position?: number;
    active?: boolean;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyEducationCourseManage(access, "education.course.create"),
  );

  const name = sanitizeText(input.name);
  const key = input.key ?? slugify(name);

  try {
    const [row] = await db
      .insert(educationCategories)
      .values({
        parentId: input.parentId ?? null,
        key,
        name,
        description: input.description ? sanitizeText(input.description) : null,
        legalAreaModuleId: input.legalAreaModuleId ?? null,
        position: input.position ?? 0,
        active: input.active ?? true,
      })
      .returning();
    return { category: serializeCategory(row!) };
  } catch (error) {
    if (isUniqueViolation(error)) conflict("Já existe uma categoria com esta chave.");
    throw error;
  }
}

export async function createEducationCourse(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    instructorId?: string;
    categoryId?: string;
    title: string;
    slug?: string;
    description?: string;
    shortDescription?: string;
    level?: string;
    language?: string;
    estimatedDurationMinutes?: number;
    status?: "draft" | "under_review";
    visibility?: string;
    coverDocumentId?: string;
    priceCents?: number | null;
    currency?: string;
    certificateEnabled?: boolean;
    completionRuleJson?: Record<string, unknown>;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyEducationCourseManage(access, "education.course.create"),
  );

  const title = sanitizeText(input.title);
  const courseSlug = input.slug ?? slugify(title);

  try {
    const [row] = await db
      .insert(educationCourses)
      .values({
        organizationId,
        instructorId: input.instructorId ?? null,
        categoryId: input.categoryId ?? null,
        title,
        slug: courseSlug,
        description: input.description ? sanitizeText(input.description) : null,
        shortDescription: input.shortDescription ? sanitizeText(input.shortDescription) : null,
        level: (input.level as never) ?? "beginner",
        language: input.language ?? "pt-BR",
        estimatedDurationMinutes: input.estimatedDurationMinutes ?? null,
        status: input.status ?? "draft",
        visibility: (input.visibility as never) ?? "private",
        coverDocumentId: input.coverDocumentId ?? null,
        priceCents: input.priceCents ?? null,
        currency: input.currency ?? "BRL",
        certificateEnabled: input.certificateEnabled ?? true,
        completionRuleJson: input.completionRuleJson ?? null,
      })
      .returning();

    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "education.course_created",
      resourceType: "education_course",
      resourceId: row!.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
    });

    return { course: serializeCourse(row!) };
  } catch (error) {
    if (isUniqueViolation(error)) conflict("Já existe um curso com este slug.");
    throw error;
  }
}

export async function updateEducationCourse(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  courseId: string,
  input: Record<string, unknown>,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyEducationCourseManage(access, "education.course.update"),
  );
  await requireCourseInOrg(db, organizationId, courseId);

  const patch: Partial<typeof educationCourses.$inferInsert> = { updatedAt: now() };
  if (typeof input.title === "string") patch.title = sanitizeText(input.title);
  if (typeof input.slug === "string") patch.slug = input.slug;
  if (typeof input.description === "string") patch.description = sanitizeText(input.description);
  if (typeof input.shortDescription === "string") {
    patch.shortDescription = sanitizeText(input.shortDescription);
  }
  if (input.level !== undefined) patch.level = input.level as never;
  if (typeof input.language === "string") patch.language = input.language;
  if (input.estimatedDurationMinutes !== undefined) {
    patch.estimatedDurationMinutes = input.estimatedDurationMinutes as number | null;
  }
  if (input.status !== undefined) patch.status = input.status as never;
  if (input.visibility !== undefined) patch.visibility = input.visibility as never;
  if (input.instructorId !== undefined) patch.instructorId = input.instructorId as string | null;
  if (input.categoryId !== undefined) patch.categoryId = input.categoryId as string | null;
  if (input.coverDocumentId !== undefined) {
    patch.coverDocumentId = input.coverDocumentId as string | null;
  }
  if (input.priceCents !== undefined) patch.priceCents = input.priceCents as number | null;
  if (typeof input.currency === "string") patch.currency = input.currency;
  if (typeof input.certificateEnabled === "boolean") {
    patch.certificateEnabled = input.certificateEnabled;
  }
  if (input.completionRuleJson !== undefined) {
    patch.completionRuleJson = input.completionRuleJson as Record<string, unknown> | null;
  }

  try {
    const [row] = await db
      .update(educationCourses)
      .set(patch)
      .where(
        and(eq(educationCourses.id, courseId), eq(educationCourses.organizationId, organizationId)),
      )
      .returning();
    return { course: serializeCourse(row!) };
  } catch (error) {
    if (isUniqueViolation(error)) conflict("Já existe um curso com este slug.");
    throw error;
  }
}

export async function publishEducationCourse(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  courseId: string,
  input: { visibility?: string },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyEducationCourseManage(access, "education.course.publish"),
  );
  const course = await requireCourseInOrg(db, organizationId, courseId);

  const [row] = await db
    .update(educationCourses)
    .set({
      status: "published",
      visibility: (input.visibility as never) ?? course.visibility,
      publishedAt: course.publishedAt ?? now(),
      updatedAt: now(),
    })
    .where(eq(educationCourses.id, courseId))
    .returning();

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "education.course_published",
    resourceType: "education_course",
    resourceId: courseId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });

  return { course: serializeCourse(row!) };
}

export async function createCourseModule(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  courseId: string,
  input: {
    title: string;
    description?: string;
    position?: number;
    releaseRule?: string;
    active?: boolean;
  },
  _meta: RequestMeta,
) {
  authorize(account, organizationId, (access) => policyLesson(access, "education.lesson.manage"));
  await requireCourseInOrg(db, organizationId, courseId);

  try {
    const [row] = await db
      .insert(courseModules)
      .values({
        courseId,
        title: sanitizeText(input.title),
        description: input.description ? sanitizeText(input.description) : null,
        position: input.position ?? 0,
        releaseRule: (input.releaseRule as never) ?? "immediate",
        active: input.active ?? true,
      })
      .returning();
    return { module: serializeModule(row!) };
  } catch (error) {
    if (isUniqueViolation(error)) conflict("Já existe um módulo nesta posição.");
    throw error;
  }
}

export async function createCourseLesson(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  moduleId: string,
  input: {
    title: string;
    description?: string;
    lessonType?: string;
    position?: number;
    estimatedDurationMinutes?: number;
    required?: boolean;
    previewAllowed?: boolean;
    status?: string;
    quizId?: string;
  },
  _meta: RequestMeta,
) {
  authorize(account, organizationId, (access) => policyLesson(access, "education.lesson.manage"));
  await requireModuleInOrg(db, organizationId, moduleId);

  try {
    const [row] = await db
      .insert(courseLessons)
      .values({
        moduleId,
        title: sanitizeText(input.title),
        description: input.description ? sanitizeText(input.description) : null,
        lessonType: (input.lessonType as never) ?? "text",
        position: input.position ?? 0,
        estimatedDurationMinutes: input.estimatedDurationMinutes ?? null,
        required: input.required ?? true,
        previewAllowed: input.previewAllowed ?? false,
        status: (input.status as never) ?? "draft",
        quizId: input.quizId ?? null,
      })
      .returning();
    return { lesson: serializeLesson(row!) };
  } catch (error) {
    if (isUniqueViolation(error)) conflict("Já existe uma aula nesta posição.");
    throw error;
  }
}

export async function createLessonContent(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  lessonId: string,
  input: {
    blockType: string;
    position?: number;
    documentId?: string;
    mediaProviderKey?: string;
    externalMediaRef?: string;
    licenseNote?: string;
    bodyText?: string;
    payloadJson?: Record<string, unknown>;
    active?: boolean;
  },
  meta: RequestMeta,
  deps?: EducationModuleDeps,
) {
  authorize(account, organizationId, (access) => policyLesson(access, "education.lesson.manage"));
  await requireLessonInOrg(db, organizationId, lessonId);

  const provider = mediaProvider(deps);
  const mediaProviderKey =
    input.mediaProviderKey ?? (provider.id !== "not_configured" ? provider.id : "not_configured");

  const result = await db.transaction(async (tx) => {
    const [content] = await tx
      .insert(lessonContents)
      .values({
        lessonId,
        blockType: input.blockType as never,
        position: input.position ?? 0,
        documentId: input.documentId ?? null,
        mediaProviderKey,
        externalMediaRef: input.externalMediaRef ?? null,
        licenseNote: input.licenseNote ? sanitizeText(input.licenseNote) : null,
        active: input.active ?? true,
      })
      .returning();

    const [version] = await tx
      .insert(lessonContentVersions)
      .values({
        contentId: content!.id,
        version: 1,
        bodyText: input.bodyText ? sanitizeText(input.bodyText) : null,
        payloadJson: input.payloadJson ?? null,
        publishedAt: now(),
        createdByUserId: account.user.id,
      })
      .returning();

    const [updated] = await tx
      .update(lessonContents)
      .set({ currentVersionId: version!.id, updatedAt: now() })
      .where(eq(lessonContents.id, content!.id))
      .returning();

    return { content: updated!, version: version! };
  });

  return {
    content: serializeContentBlock(result.content, result.version, {
      mediaConfigured: mediaProviderKey !== "not_configured",
    }),
  };
}

export async function publishLessonContentVersion(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  contentId: string,
  input: { bodyText?: string; payloadJson?: Record<string, unknown> },
  _meta: RequestMeta,
) {
  authorize(account, organizationId, (access) => policyLesson(access, "education.lesson.manage"));

  const content = await db.query.lessonContents.findFirst({
    where: eq(lessonContents.id, contentId),
    with: { lesson: { with: { module: { with: { course: true } } } } },
  });
  if (!content || content.lesson.module.course.organizationId !== organizationId) {
    notFound("Não encontramos este conteúdo.");
  }

  const latest = await db.query.lessonContentVersions.findFirst({
    where: eq(lessonContentVersions.contentId, contentId),
    orderBy: desc(lessonContentVersions.version),
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  const result = await db.transaction(async (tx) => {
    const [version] = await tx
      .insert(lessonContentVersions)
      .values({
        contentId,
        version: nextVersion,
        bodyText: input.bodyText ? sanitizeText(input.bodyText) : (latest?.bodyText ?? null),
        payloadJson: input.payloadJson ?? latest?.payloadJson ?? null,
        publishedAt: now(),
        createdByUserId: account.user.id,
      })
      .returning();

    const [updated] = await tx
      .update(lessonContents)
      .set({ currentVersionId: version!.id, updatedAt: now() })
      .where(eq(lessonContents.id, contentId))
      .returning();

    return { content: updated!, version: version! };
  });

  return {
    content: serializeContentBlock(result.content, result.version, {
      mediaConfigured: result.content.mediaProviderKey !== "not_configured",
    }),
  };
}

export async function createLearningTrack(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    title: string;
    slug?: string;
    description?: string;
    legalAreaId?: string;
    status?: "draft" | "under_review";
    visibility?: string;
  },
  _meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyEducationCourseManage(access, "education.track.manage"),
  );

  const title = sanitizeText(input.title);
  const trackSlug = input.slug ?? slugify(title);

  try {
    const [row] = await db
      .insert(learningTracks)
      .values({
        organizationId,
        title,
        slug: trackSlug,
        description: input.description ? sanitizeText(input.description) : null,
        legalAreaId: input.legalAreaId ?? null,
        status: input.status ?? "draft",
        visibility: (input.visibility as never) ?? "private",
      })
      .returning();
    return { track: serializeTrack(row!) };
  } catch (error) {
    if (isUniqueViolation(error)) conflict("Já existe uma trilha com este slug.");
    throw error;
  }
}

export async function addCourseToTrack(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  trackId: string,
  input: {
    courseId: string;
    position?: number;
    required?: boolean;
    prerequisiteCourseId?: string;
  },
  _meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyEducationCourseManage(access, "education.track.manage"),
  );

  const track = await db.query.learningTracks.findFirst({
    where: and(eq(learningTracks.id, trackId), eq(learningTracks.organizationId, organizationId)),
  });
  if (!track) notFound("Não encontramos esta trilha.");
  await requireCourseInOrg(db, organizationId, input.courseId);

  try {
    const [row] = await db
      .insert(learningTrackCourses)
      .values({
        trackId,
        courseId: input.courseId,
        position: input.position ?? 0,
        required: input.required ?? true,
        prerequisiteCourseId: input.prerequisiteCourseId ?? null,
      })
      .returning();
    return {
      item: {
        id: row!.id,
        trackId: row!.trackId,
        courseId: row!.courseId,
        position: row!.position,
        required: row!.required,
        prerequisiteCourseId: row!.prerequisiteCourseId,
        createdAt: iso(row!.createdAt),
      },
    };
  } catch (error) {
    if (isUniqueViolation(error)) conflict("Este curso já está na trilha.");
    throw error;
  }
}

export async function createLibraryItem(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    title: string;
    slug?: string;
    description?: string;
    itemType?: string;
    source?: string;
    licenseNote?: string;
    externalUrl?: string;
    documentId?: string;
    visibility?: string;
    categoryId?: string;
    active?: boolean;
  },
  _meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyLibraryItem(access, "education.library.manage"),
  );

  const title = sanitizeText(input.title);
  const itemSlug = input.slug ?? slugify(title);

  try {
    const [row] = await db
      .insert(educationLibraryItems)
      .values({
        organizationId,
        title,
        slug: itemSlug,
        description: input.description ? sanitizeText(input.description) : null,
        itemType: (input.itemType as never) ?? "document",
        source: (input.source as never) ?? "authored_internally",
        licenseNote: input.licenseNote ? sanitizeText(input.licenseNote) : null,
        externalUrl: input.externalUrl ?? null,
        documentId: input.documentId ?? null,
        visibility: (input.visibility as never) ?? "authenticated",
        categoryId: input.categoryId ?? null,
        active: input.active ?? true,
      })
      .returning();
    return { item: serializeLibraryItem(row!) };
  } catch (error) {
    if (isUniqueViolation(error)) conflict("Já existe um item com este slug.");
    throw error;
  }
}

export async function registerInstructor(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: { bio?: string; qualifications?: string; publicProfile?: boolean },
  _meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyEducationCourseManage(access, "education.course.create"),
  );

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, account.user.id),
  });
  if (!profile) {
    throw new AppError("NOT_FOUND", "Perfil do usuário não encontrado.");
  }

  const existing = await db.query.educationInstructors.findFirst({
    where: eq(educationInstructors.profileId, account.user.id),
  });
  if (existing) {
    const [row] = await db
      .update(educationInstructors)
      .set({
        bio: input.bio ? sanitizeText(input.bio) : existing.bio,
        qualifications: input.qualifications
          ? sanitizeText(input.qualifications)
          : existing.qualifications,
        publicProfile: input.publicProfile ?? existing.publicProfile,
        active: true,
        updatedAt: now(),
      })
      .where(eq(educationInstructors.id, existing.id))
      .returning();
    return {
      instructor: {
        id: row!.id,
        profileId: row!.profileId,
        bio: row!.bio,
        qualifications: row!.qualifications,
        active: row!.active,
        publicProfile: row!.publicProfile,
        verifiedEducatorStatus: row!.verifiedEducatorStatus,
        createdAt: iso(row!.createdAt),
        updatedAt: iso(row!.updatedAt),
      },
    };
  }

  const [row] = await db
    .insert(educationInstructors)
    .values({
      profileId: account.user.id,
      bio: input.bio ? sanitizeText(input.bio) : null,
      qualifications: input.qualifications ? sanitizeText(input.qualifications) : null,
      publicProfile: input.publicProfile ?? false,
      active: true,
    })
    .returning();

  return {
    instructor: {
      id: row!.id,
      profileId: row!.profileId,
      bio: row!.bio,
      qualifications: row!.qualifications,
      active: row!.active,
      publicProfile: row!.publicProfile,
      verifiedEducatorStatus: row!.verifiedEducatorStatus,
      createdAt: iso(row!.createdAt),
      updatedAt: iso(row!.updatedAt),
    },
  };
}

export async function listInstructorCourses(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  authorize(account, organizationId, (access) => policyEducationAccess(access, "education.read"));

  const instructor = await db.query.educationInstructors.findFirst({
    where: eq(educationInstructors.profileId, account.user.id),
  });
  if (!instructor) return { items: [] };

  const rows = await db.query.educationCourses.findMany({
    where: and(
      eq(educationCourses.organizationId, organizationId),
      eq(educationCourses.instructorId, instructor.id),
    ),
    orderBy: desc(educationCourses.createdAt),
  });
  return { items: rows.map(serializeCourse) };
}

export async function listInstructorStudents(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { courseId?: string; limit: number; offset: number },
) {
  authorize(account, organizationId, (access) =>
    policyEnrollment(access, "education.enrollment.manage"),
  );

  const instructor = await db.query.educationInstructors.findFirst({
    where: eq(educationInstructors.profileId, account.user.id),
  });
  if (!instructor) return { items: [] };

  const courses = await db.query.educationCourses.findMany({
    where: and(
      eq(educationCourses.organizationId, organizationId),
      eq(educationCourses.instructorId, instructor.id),
      query.courseId ? eq(educationCourses.id, query.courseId) : undefined,
    ),
  });
  const courseIds = courses.map((c) => c.id);
  if (courseIds.length === 0) return { items: [] };

  const rows = await db.query.courseEnrollments.findMany({
    where: inArray(courseEnrollments.courseId, courseIds),
    orderBy: desc(courseEnrollments.enrolledAt),
    limit: query.limit,
    offset: query.offset,
  });
  return { items: rows.map(serializeEnrollment) };
}

export async function listInstructorCertificates(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { limit: number; offset: number },
) {
  authorize(account, organizationId, (access) => policyCertificate(access, "education.read"));

  const instructor = await db.query.educationInstructors.findFirst({
    where: eq(educationInstructors.profileId, account.user.id),
  });
  if (!instructor) return { items: [] };

  const courses = await db.query.educationCourses.findMany({
    where: and(
      eq(educationCourses.organizationId, organizationId),
      eq(educationCourses.instructorId, instructor.id),
    ),
  });
  const courseIds = courses.map((c) => c.id);
  if (courseIds.length === 0) return { items: [] };

  const rows = await db.query.educationCertificates.findMany({
    where: inArray(educationCertificates.courseId, courseIds),
    orderBy: desc(educationCertificates.issuedAt),
    limit: query.limit,
    offset: query.offset,
  });
  return { items: rows.map(serializeCertificate) };
}

export async function revokeCertificate(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  certificateId: string,
  input: { reason?: string },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyCertificate(access, "education.certificate.revoke"),
  );

  const cert = await db.query.educationCertificates.findFirst({
    where: eq(educationCertificates.id, certificateId),
    with: { course: true },
  });
  if (!cert || cert.course.organizationId !== organizationId) {
    notFound("Não encontramos este certificado.");
  }
  if (cert.status === "revoked") {
    return { certificate: serializeCertificate(cert) };
  }

  const [row] = await db
    .update(educationCertificates)
    .set({
      status: "revoked",
      revokedAt: now(),
      updatedAt: now(),
      metadata: {
        ...(cert.metadata ?? {}),
        revokeReason: input.reason ?? null,
      },
    })
    .where(eq(educationCertificates.id, certificateId))
    .returning();

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "education.certificate_revoked",
    resourceType: "education_certificate",
    resourceId: certificateId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    metadata: { reason: input.reason ?? null },
  });

  return { certificate: serializeCertificate(row!) };
}

export async function createEducationQuiz(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    courseId?: string;
    lessonId?: string;
    title: string;
    description?: string;
    passingScorePercent?: number;
    maxAttempts?: number;
    shuffleQuestions?: boolean;
    active?: boolean;
  },
  _meta: RequestMeta,
) {
  authorize(account, organizationId, (access) => policyLesson(access, "education.lesson.manage"));
  if (input.courseId) await requireCourseInOrg(db, organizationId, input.courseId);
  if (input.lessonId) await requireLessonInOrg(db, organizationId, input.lessonId);

  const [row] = await db
    .insert(educationQuizzes)
    .values({
      courseId: input.courseId ?? null,
      lessonId: input.lessonId ?? null,
      title: sanitizeText(input.title),
      description: input.description ? sanitizeText(input.description) : null,
      passingScorePercent: input.passingScorePercent ?? 70,
      maxAttempts: input.maxAttempts ?? null,
      shuffleQuestions: input.shuffleQuestions ?? false,
      active: input.active ?? true,
    })
    .returning();

  if (input.lessonId) {
    await db
      .update(courseLessons)
      .set({ quizId: row!.id, updatedAt: now() })
      .where(eq(courseLessons.id, input.lessonId));
  }

  return { quiz: serializeQuiz(row!) };
}

export async function updateEducationQuiz(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  quizId: string,
  input: Record<string, unknown>,
  _meta: RequestMeta,
) {
  authorize(account, organizationId, (access) => policyLesson(access, "education.lesson.manage"));
  await requireQuizInOrg(db, organizationId, quizId);

  const patch: Partial<typeof educationQuizzes.$inferInsert> = { updatedAt: now() };
  if (typeof input.title === "string") patch.title = sanitizeText(input.title);
  if (typeof input.description === "string") patch.description = sanitizeText(input.description);
  if (input.passingScorePercent !== undefined) {
    patch.passingScorePercent = input.passingScorePercent as number;
  }
  if (input.maxAttempts !== undefined) patch.maxAttempts = input.maxAttempts as number | null;
  if (typeof input.shuffleQuestions === "boolean") patch.shuffleQuestions = input.shuffleQuestions;
  if (typeof input.active === "boolean") patch.active = input.active;
  if (input.courseId !== undefined) patch.courseId = input.courseId as string | null;
  if (input.lessonId !== undefined) patch.lessonId = input.lessonId as string | null;

  const [row] = await db
    .update(educationQuizzes)
    .set(patch)
    .where(eq(educationQuizzes.id, quizId))
    .returning();
  return { quiz: serializeQuiz(row!) };
}

export async function createEducationQuestion(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  quizId: string,
  input: {
    prompt: string;
    position?: number;
    points?: number;
    explanation?: string;
    options?: Array<{ label: string; position?: number; isCorrect?: boolean }>;
  },
  _meta: RequestMeta,
) {
  authorize(account, organizationId, (access) => policyLesson(access, "education.lesson.manage"));
  await requireQuizInOrg(db, organizationId, quizId);

  const result = await db.transaction(async (tx) => {
    const [question] = await tx
      .insert(educationQuestions)
      .values({
        quizId,
        prompt: sanitizeText(input.prompt),
        position: input.position ?? 0,
        points: input.points ?? 1,
        explanation: input.explanation ? sanitizeText(input.explanation) : null,
      })
      .returning();

    let options: Array<typeof educationQuestionOptions.$inferSelect> = [];
    if (input.options && input.options.length > 0) {
      options = await tx
        .insert(educationQuestionOptions)
        .values(
          input.options.map((opt, idx) => ({
            questionId: question!.id,
            label: sanitizeText(opt.label),
            position: opt.position ?? idx,
            isCorrect: opt.isCorrect ?? false,
          })),
        )
        .returning();
    }

    return { question: question!, options };
  });

  return {
    question: {
      id: result.question.id,
      quizId: result.question.quizId,
      prompt: result.question.prompt,
      position: result.question.position,
      points: result.question.points,
      explanation: result.question.explanation,
      options: result.options.map((o) => ({
        id: o.id,
        label: o.label,
        position: o.position,
        isCorrect: o.isCorrect,
      })),
      createdAt: iso(result.question.createdAt),
      updatedAt: iso(result.question.updatedAt),
    },
  };
}

export async function getEducationQuizAdmin(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  quizId: string,
) {
  authorize(account, organizationId, (access) => policyLesson(access, "education.lesson.manage"));
  await requireQuizInOrg(db, organizationId, quizId);

  const quiz = await db.query.educationQuizzes.findFirst({
    where: eq(educationQuizzes.id, quizId),
    with: {
      questions: {
        orderBy: asc(educationQuestions.position),
        with: { options: { orderBy: asc(educationQuestionOptions.position) } },
      },
    },
  });
  if (!quiz) notFound("Não encontramos este quiz.");

  return {
    quiz: serializeQuiz(
      quiz,
      quiz.questions.map((q) => ({ question: q, options: q.options })),
      { includeAnswerKey: true },
    ),
  };
}
