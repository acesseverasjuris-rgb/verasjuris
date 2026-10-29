import {
  addTrackCourseSchema,
  createCourseLessonSchema,
  createCourseModuleSchema,
  createEducationCategorySchema,
  createEducationCourseSchema,
  createEducationLibraryItemSchema,
  createEducationQuestionSchema,
  createEducationQuizSchema,
  createEnrollmentSchema,
  createLearningTrackSchema,
  createLessonContentSchema,
  educationAiAssistSchema,
  educationCourseListQuerySchema,
  educationEnrollmentListQuerySchema,
  educationLibraryListQuerySchema,
  educationTrackListQuerySchema,
  issueCertificateSchema,
  parseInput,
  publishEducationCourseSchema,
  registerEducationInstructorSchema,
  revokeCertificateSchema,
  submitQuizAttemptSchema,
  updateEducationCourseSchema,
  updateEducationQuizSchema,
  updateLessonContentSchema,
  upsertLessonProgressSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { meta, readAccount, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  addCourseToTrack,
  createCourseLesson,
  createCourseModule,
  createEducationCategory,
  createEducationCourse,
  createEducationQuestion,
  createEducationQuiz,
  createEnrollment,
  createLearningTrack,
  createLessonContent,
  createLibraryItem,
  getEducationQuizAdmin,
  getLessonPublic,
  getMyEnrollment,
  getPublishedCourse,
  getPublishedCourseBySlug,
  getQuizForLearner,
  issueCertificate,
  listCourseModulesPublic,
  listEducationCategories,
  listInstructorCertificates,
  listInstructorCourses,
  listInstructorStudents,
  listModuleLessonsPublic,
  listMyCertificates,
  listMyEnrollments,
  listPublishedCourses,
  listPublishedLibrary,
  listPublishedTracks,
  publishEducationCourse,
  publishLessonContentVersion,
  registerInstructor,
  revokeCertificate,
  runEducationAiAssist,
  submitQuizAttempt,
  updateEducationCourse,
  updateEducationQuiz,
  updateEnrollmentProgress,
  verifyCertificatePublic,
  type EducationModuleDeps,
} from "./service.js";

type Params = {
  organizationId?: string;
  courseId?: string;
  moduleId?: string;
  lessonId?: string;
  contentId?: string;
  enrollmentId?: string;
  certificateId?: string;
  quizId?: string;
  trackId?: string;
  slug?: string;
  code?: string;
  feature?: string;
};

function educationDeps(deps: ApiDeps): EducationModuleDeps {
  return {
    paymentProvider: deps.paymentProvider,
    aiGateway: deps.aiGateway,
  };
}

export async function registerEducationRoutes(app: FastifyInstance, deps: ApiDeps) {
  const orgRoot = "/organizations/:organizationId/education";
  const org = (params: Params) => parseInput(uuidSchema, params.organizationId);
  const moduleDeps = () => educationDeps(deps);

  /* ---- Public / learner ---- */

  app.get("/education/categories", async () => listEducationCategories(deps.db));

  app.get("/education/courses", async (request) => {
    const account = await readAccount(deps, request);
    const query = parseInput(educationCourseListQuerySchema, request.query ?? {});
    return listPublishedCourses(deps.db, account, {
      q: query.q,
      level: query.level,
      categoryId: query.categoryId,
      instructorId: query.instructorId,
      organizationId: query.organizationId,
      limit: query.limit,
      offset: query.offset,
    });
  });

  app.get("/education/courses/by-slug/:slug", async (request) => {
    const account = await readAccount(deps, request);
    const params = request.params as Params;
    return getPublishedCourseBySlug(deps.db, account, String(params.slug ?? ""));
  });

  app.get("/education/courses/:courseId", async (request) => {
    const account = await readAccount(deps, request);
    const params = request.params as Params;
    return getPublishedCourse(deps.db, account, parseInput(uuidSchema, params.courseId));
  });

  app.get("/education/courses/:courseId/modules", async (request) => {
    const account = await readAccount(deps, request);
    const params = request.params as Params;
    return listCourseModulesPublic(deps.db, account, parseInput(uuidSchema, params.courseId));
  });

  app.get("/education/modules/:moduleId/lessons", async (request) => {
    const account = await readAccount(deps, request);
    const params = request.params as Params;
    return listModuleLessonsPublic(deps.db, account, parseInput(uuidSchema, params.moduleId));
  });

  app.get("/education/lessons/:lessonId", async (request) => {
    const account = await readAccount(deps, request);
    const params = request.params as Params;
    return getLessonPublic(deps.db, account, parseInput(uuidSchema, params.lessonId), moduleDeps());
  });

  app.get("/education/tracks", async (request) => {
    const account = await readAccount(deps, request);
    const query = parseInput(educationTrackListQuerySchema, request.query ?? {});
    return listPublishedTracks(deps.db, account, {
      q: query.q,
      legalAreaId: query.legalAreaId,
      organizationId: query.organizationId,
      limit: query.limit,
      offset: query.offset,
    });
  });

  app.get("/education/library", async (request) => {
    const account = await readAccount(deps, request);
    const query = parseInput(educationLibraryListQuerySchema, request.query ?? {});
    return listPublishedLibrary(deps.db, account, {
      q: query.q,
      itemType: query.itemType,
      categoryId: query.categoryId,
      organizationId: query.organizationId,
      limit: query.limit,
      offset: query.offset,
    });
  });

  app.post("/education/enrollments", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createEnrollmentSchema, request.body);
    const result = await createEnrollment(deps.db, account, input, meta(request), moduleDeps());
    return reply.status(201).send(result);
  });

  app.get("/education/enrollments", async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(educationEnrollmentListQuerySchema, request.query ?? {});
    return listMyEnrollments(deps.db, account, {
      courseId: query.courseId,
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    });
  });

  app.get("/education/enrollments/:enrollmentId", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getMyEnrollment(deps.db, account, parseInput(uuidSchema, params.enrollmentId));
  });

  app.patch("/education/enrollments/:enrollmentId/progress", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(upsertLessonProgressSchema, request.body);
    return updateEnrollmentProgress(
      deps.db,
      account,
      parseInput(uuidSchema, params.enrollmentId),
      input,
      meta(request),
    );
  });

  app.get("/education/certificates", async (request) => {
    const account = await requireAccount(deps, request);
    return listMyCertificates(deps.db, account);
  });

  app.get("/education/certificates/verify/:code", async (request) => {
    const params = request.params as Params;
    return verifyCertificatePublic(deps.db, String(params.code ?? ""));
  });

  app.get("/education/quizzes/:quizId", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getQuizForLearner(deps.db, account, parseInput(uuidSchema, params.quizId));
  });

  app.post("/education/quizzes/:quizId/attempts", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(submitQuizAttemptSchema, request.body);
    const result = await submitQuizAttempt(
      deps.db,
      account,
      parseInput(uuidSchema, params.quizId),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post("/education/ai/:feature", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(educationAiAssistSchema, request.body ?? {});
    return runEducationAiAssist(
      deps.db,
      account,
      String(params.feature ?? ""),
      input,
      moduleDeps(),
    );
  });

  /* ---- Org / instructor ---- */

  app.post(`${orgRoot}/categories`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createEducationCategorySchema, request.body);
    const result = await createEducationCategory(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${orgRoot}/courses`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createEducationCourseSchema, request.body);
    const result = await createEducationCourse(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.patch(`${orgRoot}/courses/:courseId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(updateEducationCourseSchema, request.body ?? {});
    return updateEducationCourse(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.courseId),
      input,
      meta(request),
    );
  });

  app.post(`${orgRoot}/courses/:courseId/publish`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(publishEducationCourseSchema, request.body ?? {});
    return publishEducationCourse(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.courseId),
      input,
      meta(request),
    );
  });

  app.post(`${orgRoot}/courses/:courseId/modules`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(createCourseModuleSchema, request.body);
    const result = await createCourseModule(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.courseId),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${orgRoot}/modules/:moduleId/lessons`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(createCourseLessonSchema, request.body);
    const result = await createCourseLesson(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.moduleId),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${orgRoot}/lessons/:lessonId/contents`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(createLessonContentSchema, request.body);
    const result = await createLessonContent(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.lessonId),
      input,
      meta(request),
      moduleDeps(),
    );
    return reply.status(201).send(result);
  });

  app.post(`${orgRoot}/contents/:contentId/versions`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(updateLessonContentSchema, request.body ?? {});
    const result = await publishLessonContentVersion(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.contentId),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${orgRoot}/tracks`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createLearningTrackSchema, request.body);
    const result = await createLearningTrack(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${orgRoot}/tracks/:trackId/courses`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(addTrackCourseSchema, request.body);
    const result = await addCourseToTrack(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.trackId),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${orgRoot}/library`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createEducationLibraryItemSchema, request.body);
    const result = await createLibraryItem(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${orgRoot}/instructor/register`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(registerEducationInstructorSchema, request.body ?? {});
    const result = await registerInstructor(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${orgRoot}/instructor/courses`, async (request) => {
    const account = await requireAccount(deps, request);
    return listInstructorCourses(deps.db, account, org(request.params as Params));
  });

  app.get(`${orgRoot}/instructor/students`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(educationEnrollmentListQuerySchema, request.query ?? {});
    return listInstructorStudents(deps.db, account, org(request.params as Params), {
      courseId: query.courseId,
      limit: query.limit,
      offset: query.offset,
    });
  });

  app.get(`${orgRoot}/instructor/certificates`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(educationEnrollmentListQuerySchema, request.query ?? {});
    return listInstructorCertificates(deps.db, account, org(request.params as Params), {
      limit: query.limit,
      offset: query.offset,
    });
  });

  app.post(`${orgRoot}/certificates/issue`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(issueCertificateSchema, request.body);
    const result = await issueCertificate(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${orgRoot}/certificates/:certificateId/revoke`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(revokeCertificateSchema, request.body ?? {});
    return revokeCertificate(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.certificateId),
      input,
      meta(request),
    );
  });

  app.post(`${orgRoot}/quizzes`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createEducationQuizSchema, request.body);
    const result = await createEducationQuiz(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${orgRoot}/quizzes/:quizId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getEducationQuizAdmin(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.quizId),
    );
  });

  app.patch(`${orgRoot}/quizzes/:quizId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(updateEducationQuizSchema, request.body ?? {});
    return updateEducationQuiz(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.quizId),
      input,
      meta(request),
    );
  });

  app.post(`${orgRoot}/quizzes/:quizId/questions`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(createEducationQuestionSchema, request.body);
    const result = await createEducationQuestion(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.quizId),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });
}
