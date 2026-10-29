"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import { EDUCATION_APP_TABS, EnrollmentsTable } from "../../../../components/education-ui";
import {
  educationErrorMessage,
  fetchInstructorStudents,
  hasEducationPermission,
  isApiFailure,
  type EducationEnrollment,
} from "../../../../lib/education";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function AppAlunosPage() {
  const org = useOrgContext();
  const can = hasEducationPermission(org.permissions, "enrollment.manage");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<EducationEnrollment[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchInstructorStudents(org.orgId!, { limit: 100 });
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
    return (
      <NoPermission>
        Sem permissão para gerenciar alunos (education.enrollment.manage).
      </NoPermission>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Educação", href: "/app/educacao" }, { label: "Alunos" }]} />
      <PageHeader title="Alunos" description="Matrículas nos seus cursos." />
      <SectionTabs label="Seções" items={EDUCATION_APP_TABS} current="/app/educacao/alunos" />
      {loading ? <LoadingState label="Carregando alunos…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? (
        <EnrollmentsTable items={items} courseHref="/app/educacao/cursos" />
      ) : null}
    </div>
  );
}
