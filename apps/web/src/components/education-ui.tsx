import { Alert, Badge, EmptyState } from "@verasjuris/ui";
import {
  EDUCATION_CERTIFICATE_STATUS_LABELS,
  EDUCATION_COURSE_STATUS_LABELS,
  EDUCATION_ENROLLMENT_STATUS_LABELS,
  EDUCATION_LEVEL_LABELS,
  EDUCATION_LESSON_TYPE_LABELS,
  EDUCATION_PROGRESS_STATUS_LABELS,
  EDUCATION_VISIBILITY_LABELS,
  formatDateTime,
  formatMoneyCents,
  type EducationCertificate,
  type EducationCourse,
  type EducationEnrollment,
  type EducationLibraryItem,
  type EducationLesson,
  type EducationModule,
  type EducationTrack,
} from "../lib/education";

export const EDUCATION_PUBLIC_TABS = [
  { href: "/educacao", label: "Visão geral" },
  { href: "/educacao/cursos", label: "Cursos" },
  { href: "/educacao/trilhas", label: "Trilhas" },
  { href: "/educacao/biblioteca", label: "Biblioteca" },
  { href: "/educacao/meus-cursos", label: "Meus cursos" },
  { href: "/educacao/certificados", label: "Certificados" },
];

export const EDUCATION_APP_TABS = [
  { href: "/app/educacao", label: "Visão geral" },
  { href: "/app/educacao/cursos", label: "Cursos" },
  { href: "/app/educacao/aulas", label: "Aulas" },
  { href: "/app/educacao/trilhas", label: "Trilhas" },
  { href: "/app/educacao/biblioteca", label: "Biblioteca" },
  { href: "/app/educacao/alunos", label: "Alunos" },
  { href: "/app/educacao/certificados", label: "Certificados" },
];

function tone(status: string): "neutral" | "success" | "warning" | "error" {
  if (
    status === "published" ||
    status === "issued" ||
    status === "completed" ||
    status === "active"
  ) {
    return "success";
  }
  if (
    status === "draft" ||
    status === "under_review" ||
    status === "pending_payment" ||
    status === "in_progress" ||
    status === "not_started"
  ) {
    return "warning";
  }
  if (
    status === "revoked" ||
    status === "cancelled" ||
    status === "expired" ||
    status === "archived" ||
    status === "suspended"
  ) {
    return "error";
  }
  return "neutral";
}

export function StatusTextBadge({
  status,
  labels,
}: {
  status: string;
  labels: Record<string, string>;
}) {
  return (
    <Badge tone={tone(status)}>
      <span className="vj-visually-hidden">Situação: </span>
      {labels[status] ?? status}
    </Badge>
  );
}

export function EducationMediaBanner({ unavailable }: { unavailable?: boolean }) {
  if (!unavailable) return null;
  return (
    <Alert tone="warning" title="Mídia / streaming">
      Provedor de mídia não configurado (NOT_CONFIGURED). Conteúdo de vídeo/áudio externo fica
      indisponível até a configuração.
    </Alert>
  );
}

export function CourseStatusBadge({ status }: { status: string }) {
  return <StatusTextBadge status={status} labels={EDUCATION_COURSE_STATUS_LABELS} />;
}

export function EnrollmentStatusBadge({ status }: { status: string }) {
  return <StatusTextBadge status={status} labels={EDUCATION_ENROLLMENT_STATUS_LABELS} />;
}

export function CertificateStatusBadge({ status }: { status: string }) {
  return <StatusTextBadge status={status} labels={EDUCATION_CERTIFICATE_STATUS_LABELS} />;
}

export function ProgressStatusBadge({ status }: { status: string }) {
  return <StatusTextBadge status={status} labels={EDUCATION_PROGRESS_STATUS_LABELS} />;
}

export function CoursesTable({
  items,
  baseHref = "/educacao/cursos",
  useSlug = true,
}: {
  items: EducationCourse[];
  baseHref?: string;
  useSlug?: boolean;
}) {
  if (items.length === 0) {
    return <EmptyState title="Nenhum curso">Nenhum curso encontrado nesta visão.</EmptyState>;
  }
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">Cursos de educação jurídica</caption>
        <thead>
          <tr>
            <th scope="col">Título</th>
            <th scope="col">Nível</th>
            <th scope="col">Visibilidade</th>
            <th scope="col">Situação</th>
            <th scope="col">Preço</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const href = useSlug ? `${baseHref}/${item.slug}` : `${baseHref}/${item.id}`;
            return (
              <tr key={item.id}>
                <td>
                  <a href={href}>{item.title}</a>
                </td>
                <td>{EDUCATION_LEVEL_LABELS[item.level] ?? item.level}</td>
                <td>{EDUCATION_VISIBILITY_LABELS[item.visibility] ?? item.visibility}</td>
                <td>
                  <CourseStatusBadge status={item.status} />
                </td>
                <td>
                  {item.priceCents != null && item.priceCents > 0
                    ? formatMoneyCents(item.priceCents)
                    : "Gratuito"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function CoursesCards({
  items,
  baseHref = "/educacao/cursos",
}: {
  items: EducationCourse[];
  baseHref?: string;
}) {
  if (items.length === 0) {
    return <EmptyState title="Nenhum curso">Publique cursos para exibi-los aqui.</EmptyState>;
  }
  return (
    <ul className="vj-card-grid">
      {items.map((item) => (
        <li key={item.id} className="vj-card">
          <h3 className="vj-card-title">
            <a href={`${baseHref}/${item.slug}`}>{item.title}</a>
          </h3>
          <p className="vj-meta">{item.shortDescription ?? item.description ?? "—"}</p>
          <p className="vj-meta">
            {EDUCATION_LEVEL_LABELS[item.level] ?? item.level}
            {item.estimatedDurationMinutes ? ` · ${item.estimatedDurationMinutes} min` : ""}
            {" · "}
            {item.priceCents != null && item.priceCents > 0
              ? formatMoneyCents(item.priceCents)
              : "Gratuito"}
          </p>
          <CourseStatusBadge status={item.status} />
        </li>
      ))}
    </ul>
  );
}

export function EnrollmentsTable({
  items,
  courseHref = "/educacao/aprender",
}: {
  items: EducationEnrollment[];
  courseHref?: string;
}) {
  if (items.length === 0) {
    return (
      <EmptyState title="Nenhuma matrícula">Você ainda não está matriculado em cursos.</EmptyState>
    );
  }
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">Matrículas</caption>
        <thead>
          <tr>
            <th scope="col">Curso</th>
            <th scope="col">Origem</th>
            <th scope="col">Situação</th>
            <th scope="col">Matriculado em</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <a href={`${courseHref}/${item.courseId}`}>{item.courseId.slice(0, 8)}…</a>
              </td>
              <td>{item.source}</td>
              <td>
                <EnrollmentStatusBadge status={item.status} />
              </td>
              <td>{formatDateTime(item.enrolledAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CertificatesTable({
  items,
  verifyBase = "/educacao/certificados/verificar",
}: {
  items: EducationCertificate[];
  verifyBase?: string;
}) {
  if (items.length === 0) {
    return <EmptyState title="Nenhum certificado">Nenhum certificado emitido.</EmptyState>;
  }
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">Certificados</caption>
        <thead>
          <tr>
            <th scope="col">Número</th>
            <th scope="col">Código</th>
            <th scope="col">Situação</th>
            <th scope="col">Emitido em</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.certificateNumber}</td>
              <td>
                <a href={`${verifyBase}/${item.verificationCode}`}>{item.verificationCode}</a>
              </td>
              <td>
                <CertificateStatusBadge status={item.status} />
              </td>
              <td>{item.issuedAt ? formatDateTime(item.issuedAt) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TracksList({ items }: { items: EducationTrack[] }) {
  if (items.length === 0) {
    return <EmptyState title="Nenhuma trilha">Nenhuma trilha publicada.</EmptyState>;
  }
  return (
    <ul className="vj-card-grid">
      {items.map((item) => (
        <li key={item.id} className="vj-card">
          <h3 className="vj-card-title">{item.title}</h3>
          <p className="vj-meta">{item.description ?? "—"}</p>
          <StatusTextBadge status={item.status} labels={EDUCATION_COURSE_STATUS_LABELS} />
        </li>
      ))}
    </ul>
  );
}

export function LibraryList({ items }: { items: EducationLibraryItem[] }) {
  if (items.length === 0) {
    return <EmptyState title="Biblioteca vazia">Nenhum item na biblioteca jurídica.</EmptyState>;
  }
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">Biblioteca jurídica</caption>
        <thead>
          <tr>
            <th scope="col">Título</th>
            <th scope="col">Tipo</th>
            <th scope="col">Fonte</th>
            <th scope="col">Link</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.title}</td>
              <td>{item.itemType}</td>
              <td>{item.source}</td>
              <td>
                {item.externalUrl ? (
                  <a href={item.externalUrl} rel="noopener noreferrer" target="_blank">
                    Abrir
                  </a>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ModulesNav({
  modules,
  lessonsByModule,
  currentLessonId,
  onSelectLesson,
}: {
  modules: EducationModule[];
  lessonsByModule: Record<string, EducationLesson[]>;
  currentLessonId?: string | null;
  onSelectLesson?: (lessonId: string) => void;
}) {
  return (
    <nav aria-label="Módulos e aulas do curso">
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }} className="vj-stack">
        {modules.map((mod) => (
          <li key={mod.id}>
            <h3 className="vj-subtitle">{mod.title}</h3>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {(lessonsByModule[mod.id] ?? []).map((lesson) => {
                const active = lesson.id === currentLessonId;
                return (
                  <li key={lesson.id}>
                    <button
                      type="button"
                      className={`vj-button ${active ? "vj-button-primary" : "vj-button-secondary"}`}
                      aria-current={active ? "true" : undefined}
                      onClick={() => onSelectLesson?.(lesson.id)}
                    >
                      {lesson.title}
                      <span className="vj-meta">
                        {" "}
                        ({EDUCATION_LESSON_TYPE_LABELS[lesson.lessonType] ?? lesson.lessonType})
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
}
