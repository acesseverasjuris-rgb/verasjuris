"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../components/ai-ui";
import {
  CoursesTable,
  EDUCATION_APP_TABS,
  EnrollmentsTable,
} from "../../../components/education-ui";
import {
  educationErrorMessage,
  fetchInstructorCourses,
  fetchInstructorStudents,
  hasEducationPermission,
  isApiFailure,
  type EducationCourse,
  type EducationEnrollment,
} from "../../../lib/education";
import { useOrgContext } from "../../../lib/use-org-context";

export default function AppEducacaoPage() {
  const org = useOrgContext();
  const can = hasEducationPermission(org.permissions, "read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courses, setCourses] = useState<EducationCourse[]>([]);
  const [students, setStudents] = useState<EducationEnrollment[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [c, s] = await Promise.all([
        fetchInstructorCourses(org.orgId!),
        hasEducationPermission(org.permissions, "enrollment.manage")
          ? fetchInstructorStudents(org.orgId!, { limit: 5 })
          : Promise.resolve({ items: [] as EducationEnrollment[] }),
      ]);
      if (cancelled) return;
      if (isApiFailure(c)) setError(educationErrorMessage(c));
      else setCourses(c.items);
      if (!isApiFailure(s)) setStudents(s.items);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can, org.permissions]);

  if (org.ready && !can) {
    return <NoPermission>Sem permissão para educação jurídica (education.read).</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Painel", href: "/app" }, { label: "Educação" }]} />
      <PageHeader
        title="Educação jurídica"
        description="Gestão de cursos, aulas, trilhas, biblioteca e certificados."
        actions={
          hasEducationPermission(org.permissions, "course.create") ? (
            <a className="vj-button vj-button-primary" href="/app/educacao/cursos/novo">
              Novo curso
            </a>
          ) : null
        }
      />
      <SectionTabs label="Seções" items={EDUCATION_APP_TABS} current="/app/educacao" />
      {loading ? <LoadingState label="Carregando educação…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? (
        <>
          <section className="vj-stack">
            <h2 className="vj-subtitle">Meus cursos (instrutor)</h2>
            {courses.length === 0 ? (
              <EmptyState title="Sem cursos">
                Cadastre-se como instrutor e crie o primeiro curso.
              </EmptyState>
            ) : (
              <CoursesTable items={courses} baseHref="/app/educacao/cursos" useSlug={false} />
            )}
          </section>
          {hasEducationPermission(org.permissions, "enrollment.manage") ? (
            <section className="vj-stack">
              <h2 className="vj-subtitle">Alunos recentes</h2>
              <EnrollmentsTable items={students} courseHref="/app/educacao/cursos" />
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
