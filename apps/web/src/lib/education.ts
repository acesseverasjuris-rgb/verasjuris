import { CSRF_HEADER } from "@verasjuris/security/constants";
import type { AiApiFailure } from "./ai";
import { aiErrorMessage, formatDateTime, hasPermission, isApiFailure } from "./ai";
import { formatMoneyCents } from "./auctions";
import { getActiveMembership, getActiveOrgId } from "./crm";

export {
  getActiveMembership,
  getActiveOrgId,
  isApiFailure,
  aiErrorMessage,
  formatDateTime,
  formatMoneyCents,
};

export type EducationCourse = {
  id: string;
  organizationId?: string | null;
  instructorId?: string | null;
  categoryId?: string | null;
  title: string;
  slug: string;
  description?: string | null;
  shortDescription?: string | null;
  level: string;
  language: string;
  estimatedDurationMinutes?: number | null;
  status: string;
  visibility: string;
  coverDocumentId?: string | null;
  priceCents?: number | null;
  currency: string;
  certificateEnabled: boolean;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EducationModule = {
  id: string;
  courseId: string;
  title: string;
  description?: string | null;
  position: number;
  releaseRule: string;
  active: boolean;
};

export type EducationLesson = {
  id: string;
  moduleId: string;
  title: string;
  description?: string | null;
  lessonType: string;
  position: number;
  estimatedDurationMinutes?: number | null;
  required: boolean;
  previewAllowed: boolean;
  status: string;
  quizId?: string | null;
};

export type EducationContentBlock = {
  id: string;
  lessonId: string;
  blockType: string;
  position: number;
  bodyText?: string | null;
  mediaProviderKey?: string | null;
  mediaStatus?: string | null;
  externalMediaRef?: string | null;
  documentId?: string | null;
  licenseNote?: string | null;
  payloadJson?: Record<string, unknown> | null;
};

export type EducationEnrollment = {
  id: string;
  courseId: string;
  userId: string;
  organizationId?: string | null;
  source: string;
  status: string;
  enrolledAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  expiresAt?: string | null;
  invoiceId?: string | null;
  paymentIntentId?: string | null;
};

export type EducationProgress = {
  enrollmentId: string;
  totalRequired: number;
  completedRequired: number;
  progressPercent: number;
  completed: boolean;
  pendingQuizLessonIds?: string[];
};

export type EducationCertificate = {
  id: string;
  enrollmentId: string;
  userId: string;
  courseId: string;
  certificateNumber: string;
  verificationCode: string;
  issuedAt?: string | null;
  revokedAt?: string | null;
  status: string;
  documentId?: string | null;
  pdfGenerationStatus?: string | null;
};

export type EducationTrack = {
  id: string;
  organizationId?: string | null;
  title: string;
  slug: string;
  description?: string | null;
  legalAreaId?: string | null;
  status: string;
  visibility: string;
};

export type EducationLibraryItem = {
  id: string;
  organizationId?: string | null;
  title: string;
  slug: string;
  description?: string | null;
  itemType: string;
  source: string;
  licenseNote?: string | null;
  externalUrl?: string | null;
  documentId?: string | null;
  visibility: string;
  categoryId?: string | null;
  active: boolean;
};

export type EducationCategory = {
  id: string;
  key?: string | null;
  name: string;
  description?: string | null;
  parentId?: string | null;
  position?: number;
  active?: boolean;
};

export type CertificateVerifyResult = {
  valid: boolean;
  status: string;
  courseTitle?: string | null;
  displayName?: string | null;
  issuedAt?: string | null;
  revokedAt?: string | null;
  certificateNumber?: string | null;
};

export const EDUCATION_COURSE_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  under_review: "Em revisão",
  published: "Publicado",
  unpublished: "Despublicado",
  archived: "Arquivado",
};

export const EDUCATION_VISIBILITY_LABELS: Record<string, string> = {
  public: "Público",
  authenticated: "Autenticado",
  organization_only: "Somente organização",
  private: "Privado",
  paid: "Pago",
};

export const EDUCATION_LEVEL_LABELS: Record<string, string> = {
  beginner: "Iniciante",
  intermediate: "Intermediário",
  advanced: "Avançado",
  expert: "Especialista",
  other: "Outro",
};

export const EDUCATION_ENROLLMENT_STATUS_LABELS: Record<string, string> = {
  active: "Ativa",
  completed: "Concluída",
  expired: "Expirada",
  cancelled: "Cancelada",
  pending_payment: "Aguardando pagamento",
  suspended: "Suspensa",
};

export const EDUCATION_CERTIFICATE_STATUS_LABELS: Record<string, string> = {
  issued: "Emitido",
  revoked: "Revogado",
  expired: "Expirado",
};

export const EDUCATION_PROGRESS_STATUS_LABELS: Record<string, string> = {
  not_started: "Não iniciada",
  in_progress: "Em andamento",
  completed: "Concluída",
};

export const EDUCATION_LESSON_TYPE_LABELS: Record<string, string> = {
  video: "Vídeo",
  text: "Texto",
  document: "Documento",
  audio: "Áudio",
  quiz: "Quiz",
  live: "Ao vivo",
  assignment: "Tarefa",
  case_study: "Estudo de caso",
  other: "Outro",
};

export type EducationAction =
  | "read"
  | "course.create"
  | "course.update"
  | "course.publish"
  | "lesson.manage"
  | "track.manage"
  | "library.manage"
  | "enrollment.manage"
  | "certificate.issue"
  | "certificate.revoke";

const PERM: Record<EducationAction, string> = {
  read: "education.read",
  "course.create": "education.course.create",
  "course.update": "education.course.update",
  "course.publish": "education.course.publish",
  "lesson.manage": "education.lesson.manage",
  "track.manage": "education.track.manage",
  "library.manage": "education.library.manage",
  "enrollment.manage": "education.enrollment.manage",
  "certificate.issue": "education.certificate.issue",
  "certificate.revoke": "education.certificate.revoke",
};

export function hasEducationPermission(permissions: string[], action: EducationAction): boolean {
  return hasPermission(permissions, PERM[action]);
}

async function request<T>(path: string, init?: RequestInit): Promise<T | AiApiFailure> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        [CSRF_HEADER]: "1",
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch {
    return {
      error: {
        code: "NETWORK_ERROR",
        message: "Não foi possível falar com o serviço VerasJuris. Nenhuma alteração foi feita.",
      },
    };
  }
  const body = (await response.json().catch(() => ({}))) as T & AiApiFailure;
  if (!response.ok) {
    return {
      httpStatus: response.status,
      error: {
        code: body.error?.code ?? (response.status === 404 ? "NOT_FOUND" : "INTERNAL_ERROR"),
        message: body.error?.message ?? "Falha na requisição.",
        details: body.error?.details,
      },
    };
  }
  return body;
}

function orgPath(orgId: string, suffix: string): string {
  return `/api/v1/organizations/${orgId}/education${suffix}`;
}

function qs(query: Record<string, string | number | boolean | undefined | null>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function educationErrorMessage(failure: AiApiFailure): string {
  return aiErrorMessage(failure, "Falha na educação jurídica.");
}

/* ─── Learner / public ─── */

export async function fetchEducationCategories() {
  return request<{ items: EducationCategory[] }>("/api/v1/education/categories");
}

export async function fetchEducationCourses(
  query: Record<string, string | number | boolean | undefined> = {},
) {
  return request<{ items: EducationCourse[] }>(`/api/v1/education/courses${qs(query)}`);
}

export async function fetchEducationCourse(courseId: string) {
  return request<{ course: EducationCourse }>(`/api/v1/education/courses/${courseId}`);
}

export async function fetchEducationCourseBySlug(slug: string) {
  return request<{ course: EducationCourse }>(`/api/v1/education/courses/by-slug/${slug}`);
}

export async function fetchCourseModules(courseId: string) {
  return request<{ items: EducationModule[] }>(`/api/v1/education/courses/${courseId}/modules`);
}

export async function fetchModuleLessons(moduleId: string) {
  return request<{ items: EducationLesson[] }>(`/api/v1/education/modules/${moduleId}/lessons`);
}

export async function fetchLesson(lessonId: string) {
  return request<{
    lesson: EducationLesson;
    contents: EducationContentBlock[];
    quiz: unknown | null;
  }>(`/api/v1/education/lessons/${lessonId}`);
}

export async function fetchEducationTracks(
  query: Record<string, string | number | boolean | undefined> = {},
) {
  return request<{ items: EducationTrack[] }>(`/api/v1/education/tracks${qs(query)}`);
}

export async function fetchEducationLibrary(
  query: Record<string, string | number | boolean | undefined> = {},
) {
  return request<{ items: EducationLibraryItem[] }>(`/api/v1/education/library${qs(query)}`);
}

export async function createEnrollment(body: Record<string, unknown>) {
  return request<{ enrollment: EducationEnrollment }>("/api/v1/education/enrollments", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchMyEnrollments(
  query: Record<string, string | number | boolean | undefined> = {},
) {
  return request<{ items: EducationEnrollment[] }>(`/api/v1/education/enrollments${qs(query)}`);
}

export async function fetchMyEnrollment(enrollmentId: string) {
  return request<{ enrollment: EducationEnrollment; progress: EducationProgress }>(
    `/api/v1/education/enrollments/${enrollmentId}`,
  );
}

export async function patchEnrollmentProgress(enrollmentId: string, body: Record<string, unknown>) {
  return request(`/api/v1/education/enrollments/${enrollmentId}/progress`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function fetchMyCertificates() {
  return request<{ items: EducationCertificate[] }>("/api/v1/education/certificates");
}

export async function verifyCertificate(code: string) {
  return request<CertificateVerifyResult>(
    `/api/v1/education/certificates/verify/${encodeURIComponent(code)}`,
  );
}

export async function postEducationAiAssist(feature: string, body: Record<string, unknown>) {
  return request(`/api/v1/education/ai/${encodeURIComponent(feature)}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/* ─── Org / instructor ─── */

export async function createEducationCourse(orgId: string, body: Record<string, unknown>) {
  return request<{ course: EducationCourse }>(orgPath(orgId, "/courses"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateEducationCourse(
  orgId: string,
  courseId: string,
  body: Record<string, unknown>,
) {
  return request<{ course: EducationCourse }>(orgPath(orgId, `/courses/${courseId}`), {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function publishEducationCourse(
  orgId: string,
  courseId: string,
  body: Record<string, unknown> = {},
) {
  return request<{ course: EducationCourse }>(orgPath(orgId, `/courses/${courseId}/publish`), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function createCourseModule(
  orgId: string,
  courseId: string,
  body: Record<string, unknown>,
) {
  return request<{ module: EducationModule }>(orgPath(orgId, `/courses/${courseId}/modules`), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function createCourseLesson(
  orgId: string,
  moduleId: string,
  body: Record<string, unknown>,
) {
  return request<{ lesson: EducationLesson }>(orgPath(orgId, `/modules/${moduleId}/lessons`), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function createLearningTrack(orgId: string, body: Record<string, unknown>) {
  return request<{ track: EducationTrack }>(orgPath(orgId, "/tracks"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function createLibraryItem(orgId: string, body: Record<string, unknown>) {
  return request<{ item: EducationLibraryItem }>(orgPath(orgId, "/library"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function registerInstructor(orgId: string, body: Record<string, unknown> = {}) {
  return request(orgPath(orgId, "/instructor/register"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchInstructorCourses(orgId: string) {
  return request<{ items: EducationCourse[] }>(orgPath(orgId, "/instructor/courses"));
}

export async function fetchInstructorStudents(
  orgId: string,
  query: Record<string, string | number | boolean | undefined> = {},
) {
  return request<{ items: EducationEnrollment[] }>(
    orgPath(orgId, `/instructor/students${qs(query)}`),
  );
}

export async function fetchInstructorCertificates(
  orgId: string,
  query: Record<string, string | number | boolean | undefined> = {},
) {
  return request<{ items: EducationCertificate[] }>(
    orgPath(orgId, `/instructor/certificates${qs(query)}`),
  );
}

export async function issueCertificate(orgId: string, body: Record<string, unknown>) {
  return request<{ certificate: EducationCertificate }>(orgPath(orgId, "/certificates/issue"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function revokeCertificate(
  orgId: string,
  certificateId: string,
  body: Record<string, unknown> = {},
) {
  return request(orgPath(orgId, `/certificates/${certificateId}/revoke`), {
    method: "POST",
    body: JSON.stringify(body),
  });
}
