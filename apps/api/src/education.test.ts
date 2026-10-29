import { AIGateway } from "@verasjuris/ai";
import { DeterministicTestAIProvider } from "@verasjuris/ai/testing";
import {
  courseEnrollments,
  educationCertificates,
  lessonProgress,
  seedReferenceData,
} from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { bootstrapEtapa6, type Etapa6Setup } from "./etapa6.fixtures.js";
import { call, registerVerified } from "./test-helpers.js";

describe("Etapa 20 — Educação Jurídica API", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  const aiProvider = new DeterministicTestAIProvider({
    text: "Resumo assistivo de estudo. Não altera progresso.",
  });
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let s: Etapa6Setup;
  let learner: string;
  let learnerUserId: string;
  let ownerUserId: string;

  const orgEdu = (org?: string) => `/v1/organizations/${org ?? s.orgA}/education`;

  async function registerInstructor(cookie = s.ownerA) {
    const res = await call(
      app,
      "POST",
      `${orgEdu()}/instructor/register`,
      {
        bio: "Instrutor de direito",
        qualifications: "OAB/SP",
        publicProfile: true,
      },
      cookie,
    );
    expect(res.statusCode).toBe(201);
    return res.json<{ instructor: { id: string; profileId: string } }>().instructor;
  }

  async function createPublishedCourse(opts?: {
    title?: string;
    visibility?: string;
    priceCents?: number | null;
    optionalLesson?: boolean;
    withQuiz?: boolean;
  }) {
    const title = opts?.title ?? `Curso ${Date.now()}`;
    const created = await call(
      app,
      "POST",
      `${orgEdu()}/courses`,
      {
        title,
        description: "Curso de teste completo",
        visibility: opts?.visibility ?? "authenticated",
        priceCents: opts?.priceCents ?? null,
        certificateEnabled: true,
        level: "beginner",
      },
      s.ownerA,
    );
    expect(created.statusCode).toBe(201);
    const course = created.json<{ course: { id: string; slug: string } }>().course;

    const mod = await call(
      app,
      "POST",
      `${orgEdu()}/courses/${course.id}/modules`,
      { title: "Módulo 1", position: 0 },
      s.ownerA,
    );
    expect(mod.statusCode).toBe(201);
    const moduleId = mod.json<{ module: { id: string } }>().module.id;

    let quizId: string | undefined;
    let correctOptionId: string | undefined;
    let questionId: string | undefined;
    if (opts?.withQuiz) {
      const quiz = await call(
        app,
        "POST",
        `${orgEdu()}/quizzes`,
        {
          courseId: course.id,
          title: "Quiz final",
          passingScorePercent: 50,
        },
        s.ownerA,
      );
      expect(quiz.statusCode).toBe(201);
      quizId = quiz.json<{ quiz: { id: string } }>().quiz.id;
      const question = await call(
        app,
        "POST",
        `${orgEdu()}/quizzes/${quizId}/questions`,
        {
          prompt: "Qual é a Constituição vigente?",
          points: 1,
          options: [
            { label: "CF/1988", position: 0, isCorrect: true },
            { label: "CF/1967", position: 1, isCorrect: false },
          ],
        },
        s.ownerA,
      );
      expect(question.statusCode).toBe(201);
      const q = question.json<{
        question: {
          id: string;
          options: Array<{ id: string; isCorrect?: boolean; label: string }>;
        };
      }>().question;
      questionId = q.id;
      correctOptionId = q.options.find((o) => o.isCorrect)?.id;
    }

    const lessonRequired = await call(
      app,
      "POST",
      `${orgEdu()}/modules/${moduleId}/lessons`,
      {
        title: "Aula obrigatória",
        lessonType: opts?.withQuiz ? "quiz" : "text",
        required: true,
        status: "published",
        position: 0,
        quizId,
      },
      s.ownerA,
    );
    expect(lessonRequired.statusCode).toBe(201);
    const requiredLessonId = lessonRequired.json<{ lesson: { id: string } }>().lesson.id;

    const content = await call(
      app,
      "POST",
      `${orgEdu()}/lessons/${requiredLessonId}/contents`,
      {
        blockType: "text",
        bodyText: "Conteúdo da aula obrigatória.",
        position: 0,
      },
      s.ownerA,
    );
    expect(content.statusCode).toBe(201);
    const contentId = content.json<{ content: { id: string } }>().content.id;

    const version = await call(
      app,
      "POST",
      `${orgEdu()}/contents/${contentId}/versions`,
      { bodyText: "Conteúdo v2 publicado." },
      s.ownerA,
    );
    expect(version.statusCode).toBe(201);

    let optionalLessonId: string | undefined;
    if (opts?.optionalLesson) {
      const optional = await call(
        app,
        "POST",
        `${orgEdu()}/modules/${moduleId}/lessons`,
        {
          title: "Aula opcional",
          lessonType: "text",
          required: false,
          status: "published",
          position: 1,
        },
        s.ownerA,
      );
      expect(optional.statusCode).toBe(201);
      optionalLessonId = optional.json<{ lesson: { id: string } }>().lesson.id;
    }

    const published = await call(
      app,
      "POST",
      `${orgEdu()}/courses/${course.id}/publish`,
      { visibility: opts?.visibility ?? "authenticated" },
      s.ownerA,
    );
    expect(published.statusCode).toBe(200);

    return {
      courseId: course.id,
      slug: course.slug,
      moduleId,
      requiredLessonId,
      optionalLessonId,
      contentId,
      quizId,
      questionId,
      correctOptionId,
    };
  }

  beforeAll(async () => {
    database = await started;
    await seedReferenceData(database.db);
    app = await buildApp({
      db: database.db,
      logger: false,
      webOrigin: "http://127.0.0.1:3000",
      isProduction: false,
      email,
      aiGateway: new AIGateway({ ai: true }, { provider: aiProvider }),
    });
    s = await bootstrapEtapa6(app, email, "education");
    ownerUserId = (await call(app, "GET", "/v1/auth/session", undefined, s.ownerA)).json<{
      account: { user: { id: string } };
    }>().account.user.id;

    learner = await registerVerified(app, email, {
      displayName: "Aluno Education",
      email: "aluno.education@exemplo.com",
    });
    learnerUserId = (await call(app, "GET", "/v1/auth/session", undefined, learner)).json<{
      account: { user: { id: string } };
    }>().account.user.id;
    await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/members`,
      { email: "aluno.education@exemplo.com" },
      s.ownerA,
    );
  });

  afterAll(async () => {
    await app?.close();
    await database?.close();
  });

  it("cria curso, módulo, aula e versão de conteúdo; publica", async () => {
    const instructor = await registerInstructor();
    expect(instructor.profileId).toBe(ownerUserId);

    const again = await registerInstructor();
    expect(again.id).toBe(instructor.id);

    const built = await createPublishedCourse({ title: "Processo Civil Essencial" });
    expect(built.courseId).toBeTruthy();
    expect(built.contentId).toBeTruthy();

    const listed = await call(
      app,
      "GET",
      `/v1/education/courses?organizationId=${s.orgA}`,
      undefined,
      learner,
    );
    expect(listed.statusCode).toBe(200);
    expect(
      listed.json<{ items: Array<{ id: string }> }>().items.some((c) => c.id === built.courseId),
    ).toBe(true);
  });

  it("matrícula gratuita, progresso start/complete e conclusão derivada", async () => {
    const built = await createPublishedCourse({
      title: "Curso Progresso",
      optionalLesson: true,
    });

    const enroll = await call(
      app,
      "POST",
      "/v1/education/enrollments",
      { courseId: built.courseId, source: "free" },
      learner,
    );
    expect(enroll.statusCode).toBe(201);
    const enrollment = enroll.json<{ enrollment: { id: string; status: string } }>().enrollment;
    expect(enrollment.status).toBe("active");

    const start = await call(
      app,
      "PATCH",
      `/v1/education/enrollments/${enrollment.id}/progress`,
      { lessonId: built.requiredLessonId, status: "in_progress", progressPercent: 10 },
      learner,
    );
    expect(start.statusCode).toBe(200);
    expect(start.json<{ progress: { status: string } }>().progress.status).toBe("in_progress");

    const complete = await call(
      app,
      "PATCH",
      `/v1/education/enrollments/${enrollment.id}/progress`,
      { lessonId: built.requiredLessonId, status: "completed" },
      learner,
    );
    expect(complete.statusCode).toBe(200);
    const body = complete.json<{
      progress: { status: string; completedAt: string | null };
      courseProgress: { completed: boolean; completedRequired: number; totalRequired: number };
      enrollment: { status: string };
    }>();
    expect(body.progress.status).toBe("completed");
    expect(body.courseProgress.completed).toBe(true);
    expect(body.courseProgress.totalRequired).toBe(1);
    expect(body.enrollment.status).toBe("completed");

    const dup = await call(
      app,
      "PATCH",
      `/v1/education/enrollments/${enrollment.id}/progress`,
      { lessonId: built.requiredLessonId, status: "completed" },
      learner,
    );
    expect(dup.statusCode).toBe(200);
    const again = dup.json<{ progress: { completedAt: string | null } }>().progress;
    expect(again.completedAt).toBe(body.progress.completedAt);

    const rows = await database.db.query.lessonProgress.findMany({
      where: eq(lessonProgress.enrollmentId, enrollment.id),
    });
    expect(rows.filter((r) => r.lessonId === built.requiredLessonId)).toHaveLength(1);
  });

  it("aula opcional não bloqueia conclusão; só aulas required contam", async () => {
    const built = await createPublishedCourse({
      title: "Curso Opcional",
      optionalLesson: true,
    });
    const enroll = await call(
      app,
      "POST",
      "/v1/education/enrollments",
      { courseId: built.courseId, source: "free" },
      learner,
    );
    const enrollmentId = enroll.json<{ enrollment: { id: string } }>().enrollment.id;

    const onlyRequired = await call(
      app,
      "PATCH",
      `/v1/education/enrollments/${enrollmentId}/progress`,
      { lessonId: built.requiredLessonId, status: "completed" },
      learner,
    );
    expect(onlyRequired.statusCode).toBe(200);
    expect(
      onlyRequired.json<{
        courseProgress: { completed: boolean };
        enrollment: { status: string };
      }>().courseProgress.completed,
    ).toBe(true);
    expect(onlyRequired.json<{ enrollment: { status: string } }>().enrollment.status).toBe(
      "completed",
    );
  });

  it("quiz sem gabarito antes do submit; após submit tem correctness", async () => {
    const built = await createPublishedCourse({
      title: "Curso Quiz",
      withQuiz: true,
    });
    expect(built.quizId).toBeTruthy();
    expect(built.correctOptionId).toBeTruthy();

    const enroll = await call(
      app,
      "POST",
      "/v1/education/enrollments",
      { courseId: built.courseId, source: "free" },
      learner,
    );
    const enrollmentId = enroll.json<{ enrollment: { id: string } }>().enrollment.id;

    const before = await call(
      app,
      "GET",
      `/v1/education/quizzes/${built.quizId}`,
      undefined,
      learner,
    );
    expect(before.statusCode).toBe(200);
    const quizBefore = before.json<{
      quiz: {
        questions: Array<{ options: Array<Record<string, unknown>>; explanation?: string }>;
      };
    }>().quiz;
    for (const q of quizBefore.questions) {
      expect(q.explanation).toBeUndefined();
      for (const opt of q.options) {
        expect(opt).not.toHaveProperty("isCorrect");
      }
    }

    const submit = await call(
      app,
      "POST",
      `/v1/education/quizzes/${built.quizId}/attempts`,
      {
        answers: [{ questionId: built.questionId!, optionId: built.correctOptionId! }],
      },
      learner,
    );
    expect(submit.statusCode).toBe(201);
    const attempt = submit.json<{
      attempt: { passed: boolean; scorePercent: number };
      quiz: { questions: Array<{ options: Array<{ isCorrect?: boolean }> }> };
      answers: Array<{ isCorrect: boolean | null }>;
    }>();
    expect(attempt.attempt.passed).toBe(true);
    expect(attempt.answers[0]?.isCorrect).toBe(true);
    expect(attempt.quiz.questions[0]?.options.some((o) => o.isCorrect === true)).toBe(true);

    await call(
      app,
      "PATCH",
      `/v1/education/enrollments/${enrollmentId}/progress`,
      { lessonId: built.requiredLessonId, status: "completed" },
      learner,
    );
  });

  it("certificado só após conclusão; verify público sem PII extra; códigos não sequenciais", async () => {
    const built = await createPublishedCourse({ title: "Curso Cert A" });
    const enroll = await call(
      app,
      "POST",
      "/v1/education/enrollments",
      { courseId: built.courseId, source: "free" },
      learner,
    );
    const enrollmentId = enroll.json<{ enrollment: { id: string } }>().enrollment.id;

    const early = await call(
      app,
      "POST",
      `${orgEdu()}/certificates/issue`,
      { enrollmentId },
      s.ownerA,
    );
    expect(early.statusCode).toBeGreaterThanOrEqual(400);

    await call(
      app,
      "PATCH",
      `/v1/education/enrollments/${enrollmentId}/progress`,
      { lessonId: built.requiredLessonId, status: "completed" },
      learner,
    );

    const issued = await call(
      app,
      "POST",
      `${orgEdu()}/certificates/issue`,
      { enrollmentId },
      s.ownerA,
    );
    expect(issued.statusCode).toBe(201);
    const certA = issued.json<{
      certificate: { id: string; verificationCode: string; certificateNumber: string };
    }>().certificate;

    const builtB = await createPublishedCourse({ title: "Curso Cert B" });
    const enrollB = await call(
      app,
      "POST",
      "/v1/education/enrollments",
      { courseId: builtB.courseId, source: "free" },
      learner,
    );
    const enrollmentB = enrollB.json<{ enrollment: { id: string } }>().enrollment.id;
    await call(
      app,
      "PATCH",
      `/v1/education/enrollments/${enrollmentB}/progress`,
      { lessonId: builtB.requiredLessonId, status: "completed" },
      learner,
    );
    const issuedB = await call(
      app,
      "POST",
      `${orgEdu()}/certificates/issue`,
      { enrollmentId: enrollmentB },
      s.ownerA,
    );
    const certB = issuedB.json<{
      certificate: { verificationCode: string };
    }>().certificate;

    expect(certA.verificationCode).not.toBe(certB.verificationCode);
    expect(certA.verificationCode).toMatch(/^[a-f0-9]{32}$/);
    expect(Number.parseInt(certA.verificationCode, 16)).not.toBe(
      Number.parseInt(certB.verificationCode, 16) - 1,
    );

    const verify = await call(
      app,
      "GET",
      `/v1/education/certificates/verify/${certA.verificationCode}`,
    );
    expect(verify.statusCode).toBe(200);
    const publicPayload = verify.json<Record<string, unknown>>();
    expect(publicPayload.valid).toBe(true);
    expect(publicPayload.courseTitle).toBeTruthy();
    expect(publicPayload.displayName).toBeTruthy();
    expect(publicPayload).not.toHaveProperty("userId");
    expect(publicPayload).not.toHaveProperty("email");
    expect(publicPayload).not.toHaveProperty("enrollmentId");
    expect(JSON.stringify(publicPayload)).not.toContain(learnerUserId);
    expect(JSON.stringify(publicPayload)).not.toContain("aluno.education@exemplo.com");
  });

  it("curso pago → pending_payment sem acesso ao conteúdo", async () => {
    const built = await createPublishedCourse({
      title: "Curso Pago",
      visibility: "paid",
      priceCents: 19900,
    });

    const enroll = await call(
      app,
      "POST",
      "/v1/education/enrollments",
      { courseId: built.courseId, source: "purchase" },
      learner,
    );
    expect(enroll.statusCode).toBe(201);
    const enrollment = enroll.json<{ enrollment: { id: string; status: string } }>().enrollment;
    expect(enrollment.status).toBe("pending_payment");

    const progress = await call(
      app,
      "PATCH",
      `/v1/education/enrollments/${enrollment.id}/progress`,
      { lessonId: built.requiredLessonId, status: "completed" },
      learner,
    );
    expect(progress.statusCode).toBeGreaterThanOrEqual(400);

    const lesson = await call(
      app,
      "GET",
      `/v1/education/lessons/${built.requiredLessonId}`,
      undefined,
      s.outsider,
    );
    expect(lesson.statusCode).toBe(404);
  });

  it("cross-tenant e não autorizado → 404", async () => {
    const built = await createPublishedCourse({ title: "Curso Isolado" });

    const foreignCourse = await call(
      app,
      "POST",
      `${orgEdu(s.orgB)}/courses`,
      { title: "Curso Org B" },
      s.ownerB,
    );
    expect(foreignCourse.statusCode).toBe(201);
    const courseB = foreignCourse.json<{ course: { id: string } }>().course.id;

    const crossPublish = await call(
      app,
      "POST",
      `${orgEdu()}/courses/${courseB}/publish`,
      {},
      s.ownerA,
    );
    expect(crossPublish.statusCode).toBe(404);

    const crossGet = await call(
      app,
      "GET",
      `/v1/education/lessons/${built.requiredLessonId}`,
      undefined,
      s.outsider,
    );
    expect(crossGet.statusCode).toBe(404);

    const unauth = await call(app, "GET", `/v1/education/lessons/${built.requiredLessonId}`);
    expect(unauth.statusCode).toBe(404);
  });

  it("AI assist não marca progresso nem emite certificado", async () => {
    const built = await createPublishedCourse({ title: "Curso AI" });
    const enroll = await call(
      app,
      "POST",
      "/v1/education/enrollments",
      { courseId: built.courseId, source: "free" },
      learner,
    );
    const enrollmentId = enroll.json<{ enrollment: { id: string } }>().enrollment.id;

    const assist = await call(
      app,
      "POST",
      "/v1/education/ai/study_tips",
      {
        organizationId: s.orgA,
        prompt: "Dicas para estudar processo civil",
        courseId: built.courseId,
        lessonId: built.requiredLessonId,
      },
      learner,
    );
    expect(assist.statusCode).toBe(200);
    const payload = assist.json<{ assistiveOnly: boolean; text: string }>();
    expect(payload.assistiveOnly).toBe(true);
    expect(payload.text.length).toBeGreaterThan(0);

    const progressRows = await database.db.query.lessonProgress.findMany({
      where: eq(lessonProgress.enrollmentId, enrollmentId),
    });
    expect(progressRows).toHaveLength(0);

    const enrollment = await database.db.query.courseEnrollments.findFirst({
      where: eq(courseEnrollments.id, enrollmentId),
    });
    expect(enrollment?.status).toBe("active");

    const certs = await database.db.query.educationCertificates.findMany({
      where: eq(educationCertificates.enrollmentId, enrollmentId),
    });
    expect(certs).toHaveLength(0);
  });
});
