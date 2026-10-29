"use client";

import {
  Alert,
  Breadcrumb,
  Button,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
} from "@verasjuris/ui";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EducationMediaBanner, ModulesNav } from "../../../../components/education-ui";
import {
  educationErrorMessage,
  fetchCourseModules,
  fetchEducationCourse,
  fetchLesson,
  fetchModuleLessons,
  fetchMyEnrollments,
  isApiFailure,
  patchEnrollmentProgress,
  postEducationAiAssist,
  type EducationContentBlock,
  type EducationCourse,
  type EducationEnrollment,
  type EducationLesson,
  type EducationModule,
} from "../../../../lib/education";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function CoursePlayerPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const org = useOrgContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [course, setCourse] = useState<EducationCourse | null>(null);
  const [modules, setModules] = useState<EducationModule[]>([]);
  const [lessonsByModule, setLessonsByModule] = useState<Record<string, EducationLesson[]>>({});
  const [enrollment, setEnrollment] = useState<EducationEnrollment | null>(null);
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
  const [contents, setContents] = useState<EducationContentBlock[]>([]);
  const [lessonLoading, setLessonLoading] = useState(false);
  const [mediaUnavailable, setMediaUnavailable] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiReply, setAiReply] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  const flatLessons = useMemo(() => {
    const list: EducationLesson[] = [];
    for (const mod of modules) {
      for (const lesson of lessonsByModule[mod.id] ?? []) list.push(lesson);
    }
    return list;
  }, [modules, lessonsByModule]);

  const currentIndex = flatLessons.findIndex((l) => l.id === currentLessonId);
  const nextLesson = currentIndex >= 0 ? flatLessons[currentIndex + 1] : undefined;
  const currentLesson = flatLessons.find((l) => l.id === currentLessonId) ?? null;

  const loadLesson = useCallback(async (lessonId: string) => {
    setLessonLoading(true);
    setCurrentLessonId(lessonId);
    const res = await fetchLesson(lessonId);
    if (isApiFailure(res)) {
      setError(educationErrorMessage(res));
      setContents([]);
    } else {
      setContents(res.contents);
      setMediaUnavailable(
        res.contents.some(
          (c) => c.mediaStatus === "NOT_CONFIGURED" || c.mediaProviderKey === "not_configured",
        ),
      );
    }
    setLessonLoading(false);
  }, []);

  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;
    void (async () => {
      const courseRes = await fetchEducationCourse(courseId);
      if (cancelled) return;
      if (isApiFailure(courseRes)) {
        if (courseRes.httpStatus === 404) setNotFound(true);
        else setError(educationErrorMessage(courseRes));
        setLoading(false);
        return;
      }
      setCourse(courseRes.course);

      const [mods, enrollments] = await Promise.all([
        fetchCourseModules(courseId),
        fetchMyEnrollments({ courseId, limit: 5 }),
      ]);
      if (cancelled) return;
      if (isApiFailure(mods)) {
        setError(educationErrorMessage(mods));
        setLoading(false);
        return;
      }
      setModules(mods.items);
      const map: Record<string, EducationLesson[]> = {};
      const firstLessons: EducationLesson[] = [];
      for (const mod of mods.items) {
        const lessons = await fetchModuleLessons(mod.id);
        const items = isApiFailure(lessons) ? [] : lessons.items;
        map[mod.id] = items;
        firstLessons.push(...items);
      }
      setLessonsByModule(map);
      if (!isApiFailure(enrollments)) {
        setEnrollment(
          enrollments.items.find((e) => e.status === "active") ?? enrollments.items[0] ?? null,
        );
      }
      setLoading(false);
      if (firstLessons[0]) void loadLesson(firstLessons[0].id);
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId, loadLesson]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight" && nextLesson) {
        e.preventDefault();
        void loadLesson(nextLesson.id);
      }
      if (e.key === "ArrowLeft" && currentIndex > 0) {
        e.preventDefault();
        const prev = flatLessons[currentIndex - 1];
        if (prev) void loadLesson(prev.id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nextLesson, currentIndex, flatLessons, loadLesson]);

  async function markComplete() {
    if (!enrollment || !currentLessonId) return;
    const res = await patchEnrollmentProgress(enrollment.id, {
      lessonId: currentLessonId,
      status: "completed",
      progressPercent: 100,
    });
    if (isApiFailure(res)) setError(educationErrorMessage(res));
  }

  if (notFound) {
    return <ErrorState title="Curso não encontrado">Não encontramos este curso.</ErrorState>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Educação", href: "/educacao" },
          { label: "Meus cursos", href: "/educacao/meus-cursos" },
          { label: course?.title ?? "Player" },
        ]}
      />
      <PageHeader
        title={course?.title ?? "Player do curso"}
        description="Navegue pelos módulos. Use as setas ← → do teclado para mudar de aula."
      />
      {loading ? <LoadingState label="Carregando player…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && course ? (
        <div className="vj-split">
          <aside>
            {modules.length === 0 ? (
              <EmptyState title="Sem conteúdo">Este curso ainda não tem módulos.</EmptyState>
            ) : (
              <ModulesNav
                modules={modules}
                lessonsByModule={lessonsByModule}
                currentLessonId={currentLessonId}
                onSelectLesson={(id) => void loadLesson(id)}
              />
            )}
          </aside>
          <div className="vj-stack">
            <EducationMediaBanner unavailable={mediaUnavailable} />
            {!enrollment ? (
              <Alert tone="warning" title="Matrícula">
                Você não possui matrícula ativa neste curso.{" "}
                <a href={`/educacao/cursos/${course.slug}`}>Matricular-se</a>
              </Alert>
            ) : (
              <p className="vj-meta">
                Progresso da matrícula {enrollment.id.slice(0, 8)}… · situação {enrollment.status}
              </p>
            )}
            {lessonLoading ? <LoadingState label="Carregando aula…" /> : null}
            {currentLesson && !lessonLoading ? (
              <article className="vj-stack" aria-labelledby="lesson-title">
                <h2 id="lesson-title" className="vj-subtitle">
                  {currentLesson.title}
                </h2>
                {currentLesson.description ? <p>{currentLesson.description}</p> : null}
                {contents.length === 0 ? (
                  <EmptyState title="Sem conteúdo">Esta aula ainda não tem blocos.</EmptyState>
                ) : (
                  contents.map((block) => (
                    <section
                      key={block.id}
                      className="vj-stack"
                      aria-label={`Bloco ${block.blockType}`}
                    >
                      {block.bodyText ? <div className="vj-prose">{block.bodyText}</div> : null}
                      {block.blockType.includes("video") || block.blockType.includes("audio") ? (
                        block.mediaStatus === "NOT_CONFIGURED" ||
                        block.mediaProviderKey === "not_configured" ? (
                          <Alert tone="warning" title="Mídia indisponível">
                            Provedor de mídia NOT_CONFIGURED.
                          </Alert>
                        ) : block.externalMediaRef ? (
                          <p className="vj-meta">Referência de mídia: {block.externalMediaRef}</p>
                        ) : (
                          <p className="vj-meta">Mídia sem referência externa.</p>
                        )
                      ) : null}
                      {block.documentId ? (
                        <p>
                          <a href={`/app/documentos`}>
                            Material (documento {block.documentId.slice(0, 8)}…)
                          </a>
                        </p>
                      ) : null}
                    </section>
                  ))
                )}
                <div className="vj-inline-actions">
                  <Button type="button" disabled={!enrollment} onClick={() => void markComplete()}>
                    Marcar aula como concluída
                  </Button>
                  {nextLesson ? (
                    <Button type="button" onClick={() => void loadLesson(nextLesson.id)}>
                      Próxima aula: {nextLesson.title}
                    </Button>
                  ) : (
                    <span className="vj-meta">Fim do curso</span>
                  )}
                </div>
              </article>
            ) : null}

            <section className="vj-stack" aria-labelledby="ai-assist-title">
              <h2 id="ai-assist-title" className="vj-subtitle">
                Assistência de IA (stub)
              </h2>
              <p className="vj-meta">
                Painel opcional. Depende de provedor de IA e permissões da organização.
              </p>
              <form
                className="vj-stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!org.orgId || !aiPrompt.trim()) return;
                  setAiBusy(true);
                  setAiReply(null);
                  void postEducationAiAssist("tutor", {
                    organizationId: org.orgId,
                    prompt: aiPrompt.trim(),
                    courseId,
                    lessonId: currentLessonId ?? undefined,
                  }).then((res) => {
                    setAiBusy(false);
                    if (isApiFailure(res)) setAiReply(educationErrorMessage(res));
                    else setAiReply(JSON.stringify(res, null, 2));
                  });
                }}
              >
                <div className="vj-stack">
                  <label htmlFor="education-ai-prompt">Pergunta</label>
                  <Input
                    id="education-ai-prompt"
                    value={aiPrompt}
                    onChange={(ev) => setAiPrompt(ev.target.value)}
                    aria-label="Pergunta para assistência de IA"
                  />
                </div>
                <Button type="submit" disabled={aiBusy || !org.orgId}>
                  {aiBusy ? "Consultando…" : "Perguntar"}
                </Button>
              </form>
              {aiReply ? (
                <pre className="vj-meta" style={{ whiteSpace: "pre-wrap" }}>
                  {aiReply}
                </pre>
              ) : null}
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
