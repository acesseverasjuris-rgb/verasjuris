"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import { CoursesTable, EDUCATION_APP_TABS } from "../../../../components/education-ui";
import {
  educationErrorMessage,
  fetchInstructorCourses,
  hasEducationPermission,
  isApiFailure,
  type EducationCourse,
} from "../../../../lib/education";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function AppEducacaoCursosPage() {
  const org = useOrgContext();
  const can = hasEducationPermission(org.permissions, "read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<EducationCourse[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchInstructorCourses(org.orgId!);
      if (cancelled) return;
      if (isApiFailure(res)) setError(educationErrorMessage(res));
      else setItems(res.items);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) {
    return <NoPermission>Sem permissão para listar cursos.</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Educação", href: "/app/educacao" }, { label: "Cursos" }]} />
      <PageHeader
        title="Cursos"
        description="Cursos da organização sob sua instrução."
        actions={
          hasEducationPermission(org.permissions, "course.create") ? (
            <a className="vj-button vj-button-primary" href="/app/educacao/cursos/novo">
              Novo curso
            </a>
          ) : null
        }
      />
      <SectionTabs label="Seções" items={EDUCATION_APP_TABS} current="/app/educacao/cursos" />
      {loading ? <LoadingState label="Carregando cursos…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? (
        <CoursesTable items={items} baseHref="/app/educacao/cursos" useSlug={false} />
      ) : null}
    </div>
  );
}
