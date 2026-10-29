"use client";

import { Breadcrumb, ErrorState, Input, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { SectionTabs } from "../../../components/ai-ui";
import { CoursesCards, EDUCATION_PUBLIC_TABS } from "../../../components/education-ui";
import {
  educationErrorMessage,
  fetchEducationCourses,
  isApiFailure,
  type EducationCourse,
} from "../../../lib/education";

export default function EducacaoCursosPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<EducationCourse[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(() => {
      void (async () => {
        setLoading(true);
        const res = await fetchEducationCourses({ q: q || undefined, limit: 50 });
        if (cancelled) return;
        if (isApiFailure(res)) setError(educationErrorMessage(res));
        else {
          setError(null);
          setItems(res.items);
        }
        setLoading(false);
      })();
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [q]);

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Educação", href: "/educacao" }, { label: "Cursos" }]} />
      <PageHeader title="Cursos" description="Catálogo de cursos jurídicos publicados." />
      <SectionTabs label="Seções" items={EDUCATION_PUBLIC_TABS} current="/educacao/cursos" />
      <div className="vj-stack">
        <label htmlFor="education-course-search" className="vj-visually-hidden">
          Buscar cursos
        </label>
        <Input
          id="education-course-search"
          type="search"
          placeholder="Buscar por título…"
          value={q}
          onChange={(ev) => setQ(ev.target.value)}
          aria-label="Buscar cursos"
        />
      </div>
      {loading ? <LoadingState label="Carregando cursos…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? <CoursesCards items={items} /> : null}
    </div>
  );
}
