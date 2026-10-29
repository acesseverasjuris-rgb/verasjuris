"use client";

import { Breadcrumb, Button, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SectionTabs } from "../../../../components/ai-ui";
import { CourseStatusBadge, EDUCATION_PUBLIC_TABS } from "../../../../components/education-ui";
import {
  EDUCATION_LEVEL_LABELS,
  EDUCATION_VISIBILITY_LABELS,
  createEnrollment,
  educationErrorMessage,
  fetchCourseModules,
  fetchEducationCourseBySlug,
  fetchModuleLessons,
  formatMoneyCents,
  isApiFailure,
  type EducationCourse,
  type EducationModule,
} from "../../../../lib/education";

export default function CursoPublicoPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [course, setCourse] = useState<EducationCourse | null>(null);
  const [modules, setModules] = useState<EducationModule[]>([]);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    void (async () => {
      const res = await fetchEducationCourseBySlug(slug);
      if (cancelled) return;
      if (isApiFailure(res)) {
        if (res.httpStatus === 404) setNotFound(true);
        else setError(educationErrorMessage(res));
        setLoading(false);
        return;
      }
      setCourse(res.course);
      const mods = await fetchCourseModules(res.course.id);
      if (!isApiFailure(mods)) setModules(mods.items);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (notFound) {
    return <ErrorState title="Curso não encontrado">Não encontramos este curso.</ErrorState>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Educação", href: "/educacao" },
          { label: "Cursos", href: "/educacao/cursos" },
          { label: course?.title ?? "Curso" },
        ]}
      />
      <PageHeader
        title={course?.title ?? "Curso"}
        description={course?.shortDescription ?? course?.description ?? undefined}
        actions={
          course ? (
            <Button
              type="button"
              disabled={enrolling}
              onClick={() => {
                setEnrolling(true);
                void createEnrollment({
                  courseId: course.id,
                  source: course.priceCents && course.priceCents > 0 ? "purchase" : "free",
                  status: course.priceCents && course.priceCents > 0 ? "pending_payment" : "active",
                }).then((res) => {
                  setEnrolling(false);
                  if (isApiFailure(res)) {
                    setError(educationErrorMessage(res));
                    return;
                  }
                  if (
                    res.enrollment.status === "pending_payment" &&
                    res.enrollment.paymentIntentId
                  ) {
                    router.push(`/checkout/${res.enrollment.paymentIntentId}`);
                    return;
                  }
                  router.push(`/educacao/aprender/${course.id}`);
                });
              }}
            >
              {enrolling ? "Matriculando…" : "Matricular-se"}
            </Button>
          ) : null
        }
      />
      <SectionTabs label="Seções" items={EDUCATION_PUBLIC_TABS} current="/educacao/cursos" />
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
          {course.description ? <p>{course.description}</p> : null}
          <section className="vj-stack">
            <h2 className="vj-subtitle">Conteúdo</h2>
            {modules.length === 0 ? (
              <p className="vj-meta">Módulos ainda não disponíveis.</p>
            ) : (
              <ModulesOutline modules={modules} />
            )}
          </section>
          <p>
            <a className="vj-button vj-button-secondary" href={`/educacao/aprender/${course.id}`}>
              Ir para o player
            </a>
          </p>
        </>
      ) : null}
    </div>
  );
}

function ModulesOutline({ modules }: { modules: EducationModule[] }) {
  const [lessons, setLessons] = useState<Record<string, string[]>>({});
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const map: Record<string, string[]> = {};
      for (const m of modules) {
        const res = await fetchModuleLessons(m.id);
        map[m.id] = isApiFailure(res) ? [] : res.items.map((l) => l.title);
      }
      if (!cancelled) setLessons(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [modules]);
  return (
    <ul className="vj-stack">
      {modules.map((m) => (
        <li key={m.id}>
          <strong>{m.title}</strong>
          <ul>
            {(lessons[m.id] ?? []).map((title) => (
              <li key={title}>{title}</li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
