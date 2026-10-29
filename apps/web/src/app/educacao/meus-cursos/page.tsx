"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { SectionTabs } from "../../../components/ai-ui";
import { EDUCATION_PUBLIC_TABS, EnrollmentsTable } from "../../../components/education-ui";
import {
  educationErrorMessage,
  fetchMyEnrollments,
  isApiFailure,
  type EducationEnrollment,
} from "../../../lib/education";

export default function MeusCursosPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<EducationEnrollment[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetchMyEnrollments({ limit: 50 });
      if (cancelled) return;
      if (isApiFailure(res)) {
        if (res.httpStatus === 401) {
          setError("Faça login para ver suas matrículas.");
        } else setError(educationErrorMessage(res));
      } else setItems(res.items);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Educação", href: "/educacao" }, { label: "Meus cursos" }]} />
      <PageHeader
        title="Meus cursos"
        description="Matrículas ativas e histórico de aprendizagem."
      />
      <SectionTabs label="Seções" items={EDUCATION_PUBLIC_TABS} current="/educacao/meus-cursos" />
      {loading ? <LoadingState label="Carregando matrículas…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? <EnrollmentsTable items={items} /> : null}
    </div>
  );
}
