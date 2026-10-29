"use client";

import {
  Breadcrumb,
  Button,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
} from "@verasjuris/ui";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../../components/ai-ui";
import { CourseStatusBadge, EDUCATION_APP_TABS } from "../../../../../components/education-ui";
import {
  EDUCATION_LEVEL_LABELS,
  EDUCATION_VISIBILITY_LABELS,
  createCourseLesson,
  createCourseModule,
  educationErrorMessage,
  fetchCourseModules,
  fetchEducationCourse,
  fetchInstructorCourses,
  fetchModuleLessons,
  formatMoneyCents,
  hasEducationPermission,
  isApiFailure,
  publishEducationCourse,
  type EducationCourse,
  type EducationLesson,
  type EducationModule,
} from "../../../../../lib/education";
import { useOrgContext } from "../../../../../lib/use-org-context";

export default function AppCursoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const org = useOrgContext();
  const can = hasEducationPermission(org.permissions, "read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [course, setCourse] = useState<EducationCourse | null>(null);
  const [modules, setModules] = useState<EducationModule[]>([]);
  const [lessonsByModule, setLessonsByModule] = useState<Record<string, EducationLesson[]>>({});
  const [moduleTitle, setModuleTitle] = useState("");
  const [lessonTitle, setLessonTitle] = useState("");
  const [targetModuleId, setTargetModuleId] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!id || !org.orgId) return;
    setError(null);
    const instructor = await fetchInstructorCourses(org.orgId);
    let found: EducationCourse | null = null;
    if (!isApiFailure(instructor)) {
      found = instructor.items.find((c) => c.id === id) ?? null;
    }
    if (!found) {
      const pub = await fetchEducationCourse(id);
      if (!isApiFailure(pub)) found = pub.course;
      else if (pub.httpStatus === 404) {
        setNotFound(true);
        setLoading(false);
        return;
      } else {
        setError(educationErrorMessage(pub));
        setLoading(false);
        return;
      }
    }
    if (!found) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setCourse(found);
    setNotFound(false);

    if (found.status === "published") {
      const mods = await fetchCourseModules(id);
      if (!isApiFailure(mods)) {
        setModules(mods.items);
        const map: Record<string, EducationLesson[]> = {};
        await Promise.all(
          mods.items.map(async (m) => {
            const lessons = await fetchModuleLessons(m.id);
            map[m.id] = isApiFailure(lessons) ? [] : lessons.items;
          }),
        );
        setLessonsByModule(map);
        if (mods.items[0]) setTargetModuleId((prev) => prev || mods.items[0]!.id);
      }
    }
    setLoading(false);
  }, [id, org.orgId]);

  useEffect(() => {
    if (!org.ready || !can || !org.orgId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      await reload();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, can, org.orgId, reload]);

  if (org.ready && !can) {
    return <NoPermission>Sem permissão para ver este curso.</NoPermission>;
  }

  if (notFound) {
    return <ErrorState title="Curso não encontrado">Não encontramos este curso.</ErrorState>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Educação", href: "/app/educacao" },
          { label: "Cursos", href: "/app/educacao/cursos" },
          { label: course?.title ?? "Curso" },
        ]}
      />
      <PageHeader
        title={course?.title ?? "Curso"}
        description={course?.shortDescription ?? course?.description ?? undefined}
        actions={
          course &&
          hasEducationPermission(org.permissions, "course.publish") &&
          course.status !== "published" ? (
            <Button
              type="button"
              disabled={busy || !org.orgId}
              onClick={() => {
                if (!org.orgId || !course) return;
                setBusy(true);
                void publishEducationCourse(org.orgId, course.id).then(async (res) => {
                  setBusy(false);
                  if (isApiFailure(res)) setError(educationErrorMessage(res));
                  else {
                    setCourse(res.course);
                    await reload();
                  }
                });
              }}
            >
              Publicar
            </Button>
          ) : null
        }
      />
      <SectionTabs label="Seções" items={EDUCATION_APP_TABS} current="/app/educacao/cursos" />
      {loading ? <LoadingState label="Carregando curso…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {course && !loading ? (
        <>
          <p className="vj-meta">
            {EDUCATION_LEVEL_LABELS[course.level] ?? course.level} ·{" "}
            {EDUCATION_VISIBILITY_LABELS[course.visibility] ?? course.visibility} ·{" "}
            {course.priceCents != null && course.priceCents > 0
              ? formatMoneyCents(course.priceCents)
              : "Gratuito"}{" "}
            · <CourseStatusBadge status={course.status} />
          </p>
          <section className="vj-stack">
            <h2 className="vj-subtitle">Módulos e aulas</h2>
            {modules.length === 0 ? (
              <EmptyState title="Sem módulos listados">
                {course.status === "published"
                  ? "Adicione o primeiro módulo abaixo."
                  : "A listagem pública de módulos fica disponível após publicação. Você já pode criar módulos/aulas abaixo."}
              </EmptyState>
            ) : (
              <ul className="vj-stack">
                {modules.map((m) => (
                  <li key={m.id}>
                    <strong>{m.title}</strong>
                    <ul>
                      {(lessonsByModule[m.id] ?? []).map((l) => (
                        <li key={l.id}>
                          {l.title} ({l.lessonType}) — {l.status}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {hasEducationPermission(org.permissions, "lesson.manage") && org.orgId ? (
            <section className="vj-stack">
              <h2 className="vj-subtitle">Adicionar módulo</h2>
              <form
                className="vj-inline-actions"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!org.orgId || !moduleTitle.trim()) return;
                  setBusy(true);
                  void createCourseModule(org.orgId, course.id, {
                    title: moduleTitle.trim(),
                  }).then((res) => {
                    setBusy(false);
                    if (isApiFailure(res)) setError(educationErrorMessage(res));
                    else {
                      setModuleTitle("");
                      setModules((prev) => [...prev, res.module]);
                      setLessonsByModule((prev) => ({ ...prev, [res.module.id]: [] }));
                      setTargetModuleId(res.module.id);
                    }
                  });
                }}
              >
                <Input
                  aria-label="Título do módulo"
                  value={moduleTitle}
                  onChange={(ev) => setModuleTitle(ev.target.value)}
                  required
                />
                <Button type="submit" disabled={busy}>
                  Adicionar módulo
                </Button>
              </form>
              {modules.length > 0 ? (
                <>
                  <h2 className="vj-subtitle">Adicionar aula</h2>
                  <form
                    className="vj-stack"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!org.orgId || !targetModuleId || !lessonTitle.trim()) return;
                      setBusy(true);
                      void createCourseLesson(org.orgId, targetModuleId, {
                        title: lessonTitle.trim(),
                        lessonType: "text",
                        status: "draft",
                      }).then((res) => {
                        setBusy(false);
                        if (isApiFailure(res)) setError(educationErrorMessage(res));
                        else {
                          setLessonTitle("");
                          setLessonsByModule((prev) => ({
                            ...prev,
                            [targetModuleId]: [...(prev[targetModuleId] ?? []), res.lesson],
                          }));
                        }
                      });
                    }}
                  >
                    <label className="vj-stack">
                      <span>Módulo</span>
                      <select
                        className="vj-input"
                        value={targetModuleId}
                        onChange={(ev) => setTargetModuleId(ev.target.value)}
                      >
                        {modules.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Input
                      aria-label="Título da aula"
                      value={lessonTitle}
                      onChange={(ev) => setLessonTitle(ev.target.value)}
                      required
                    />
                    <Button type="submit" disabled={busy}>
                      Adicionar aula
                    </Button>
                  </form>
                </>
              ) : null}
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
