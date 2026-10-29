"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import { EDUCATION_APP_TABS } from "../../../../components/education-ui";
import {
  educationErrorMessage,
  fetchCourseModules,
  fetchInstructorCourses,
  fetchModuleLessons,
  hasEducationPermission,
  isApiFailure,
  type EducationCourse,
  type EducationLesson,
} from "../../../../lib/education";
import { useOrgContext } from "../../../../lib/use-org-context";

type LessonRow = EducationLesson & { courseTitle: string; moduleTitle: string; courseId: string };

export default function AppAulasPage() {
  const org = useOrgContext();
  const can =
    hasEducationPermission(org.permissions, "read") ||
    hasEducationPermission(org.permissions, "lesson.manage");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<LessonRow[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const coursesRes = await fetchInstructorCourses(org.orgId!);
      if (cancelled) return;
      if (isApiFailure(coursesRes)) {
        setError(educationErrorMessage(coursesRes));
        setLoading(false);
        return;
      }
      const published = coursesRes.items.filter((c: EducationCourse) => c.status === "published");
      const collected: LessonRow[] = [];
      for (const course of published) {
        const mods = await fetchCourseModules(course.id);
        if (isApiFailure(mods)) continue;
        for (const mod of mods.items) {
          const lessons = await fetchModuleLessons(mod.id);
          if (isApiFailure(lessons)) continue;
          for (const lesson of lessons.items) {
            collected.push({
              ...lesson,
              courseTitle: course.title,
              moduleTitle: mod.title,
              courseId: course.id,
            });
          }
        }
      }
      if (!cancelled) {
        setRows(collected);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) {
    return <NoPermission>Sem permissão para gerenciar aulas.</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Educação", href: "/app/educacao" }, { label: "Aulas" }]} />
      <PageHeader
        title="Aulas"
        description="Aulas dos cursos publicados. Para rascunhos, use a página do curso."
      />
      <SectionTabs label="Seções" items={EDUCATION_APP_TABS} current="/app/educacao/aulas" />
      {loading ? <LoadingState label="Carregando aulas…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && rows.length === 0 ? (
        <EmptyState title="Nenhuma aula">Publique um curso com módulos e aulas.</EmptyState>
      ) : null}
      {!loading && !error && rows.length > 0 ? (
        <div className="vj-table-wrap">
          <table className="vj-table">
            <caption className="vj-visually-hidden">Aulas</caption>
            <thead>
              <tr>
                <th scope="col">Curso</th>
                <th scope="col">Módulo</th>
                <th scope="col">Aula</th>
                <th scope="col">Tipo</th>
                <th scope="col">Situação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <a href={`/app/educacao/cursos/${row.courseId}`}>{row.courseTitle}</a>
                  </td>
                  <td>{row.moduleTitle}</td>
                  <td>{row.title}</td>
                  <td>{row.lessonType}</td>
                  <td>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
