"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { SectionTabs } from "../../components/ai-ui";
import { CoursesCards, EDUCATION_PUBLIC_TABS, TracksList } from "../../components/education-ui";
import {
  educationErrorMessage,
  fetchEducationCourses,
  fetchEducationTracks,
  isApiFailure,
  type EducationCourse,
  type EducationTrack,
} from "../../lib/education";

export default function EducacaoHomePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courses, setCourses] = useState<EducationCourse[]>([]);
  const [tracks, setTracks] = useState<EducationTrack[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [c, t] = await Promise.all([
        fetchEducationCourses({ limit: 8 }),
        fetchEducationTracks({ limit: 6 }),
      ]);
      if (cancelled) return;
      if (isApiFailure(c)) setError(educationErrorMessage(c));
      else setCourses(c.items);
      if (!isApiFailure(t)) setTracks(t.items);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Educação jurídica" }]} />
      <PageHeader
        title="Educação jurídica"
        description="Cursos, trilhas e biblioteca para formação jurídica contínua."
      />
      <SectionTabs label="Seções" items={EDUCATION_PUBLIC_TABS} current="/educacao" />
      {loading ? <LoadingState label="Carregando…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? (
        <>
          <section className="vj-stack">
            <h2 className="vj-subtitle">Cursos em destaque</h2>
            <CoursesCards items={courses} />
          </section>
          <section className="vj-stack">
            <h2 className="vj-subtitle">Trilhas</h2>
            <TracksList items={tracks} />
          </section>
        </>
      ) : null}
    </div>
  );
}
