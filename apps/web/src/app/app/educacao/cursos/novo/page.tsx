"use client";

import { Breadcrumb, Button, ErrorState, Input, PageHeader } from "@verasjuris/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { NoPermission, SectionTabs } from "../../../../../components/ai-ui";
import { EDUCATION_APP_TABS } from "../../../../../components/education-ui";
import {
  createEducationCourse,
  educationErrorMessage,
  hasEducationPermission,
  isApiFailure,
  registerInstructor,
} from "../../../../../lib/education";
import { useOrgContext } from "../../../../../lib/use-org-context";

export default function NovoCursoPage() {
  const org = useOrgContext();
  const router = useRouter();
  const can = hasEducationPermission(org.permissions, "course.create");
  const [title, setTitle] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [level, setLevel] = useState("beginner");
  const [visibility, setVisibility] = useState("private");
  const [priceCents, setPriceCents] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (org.ready && !can) {
    return <NoPermission>Sem permissão para criar cursos (education.course.create).</NoPermission>;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!org.orgId) return;
    setSaving(true);
    setError(null);
    await registerInstructor(org.orgId, { publicProfile: false });
    const res = await createEducationCourse(org.orgId, {
      title: title.trim(),
      shortDescription: shortDescription.trim() || undefined,
      level,
      visibility,
      status: "draft",
      priceCents: priceCents ? Number(priceCents) : null,
      currency: "BRL",
    });
    setSaving(false);
    if (isApiFailure(res)) {
      setError(educationErrorMessage(res));
      return;
    }
    router.push(`/app/educacao/cursos/${res.course.id}`);
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Educação", href: "/app/educacao" },
          { label: "Cursos", href: "/app/educacao/cursos" },
          { label: "Novo" },
        ]}
      />
      <PageHeader
        title="Novo curso"
        description="Cria um rascunho. Publique quando o conteúdo estiver pronto."
      />
      <SectionTabs label="Seções" items={EDUCATION_APP_TABS} current="/app/educacao/cursos" />
      {error ? <ErrorState title="Erro ao criar">{error}</ErrorState> : null}
      <form className="vj-stack" onSubmit={onSubmit}>
        <div className="vj-stack">
          <label htmlFor="course-title">Título</label>
          <Input
            id="course-title"
            name="title"
            required
            minLength={3}
            value={title}
            onChange={(ev) => setTitle(ev.target.value)}
            aria-required="true"
          />
        </div>
        <div className="vj-stack">
          <label htmlFor="course-summary">Resumo</label>
          <Input
            id="course-summary"
            name="shortDescription"
            value={shortDescription}
            onChange={(ev) => setShortDescription(ev.target.value)}
          />
        </div>
        <div className="vj-stack">
          <label htmlFor="course-level">Nível</label>
          <select
            id="course-level"
            className="vj-input"
            name="level"
            value={level}
            onChange={(ev) => setLevel(ev.target.value)}
          >
            <option value="beginner">Iniciante</option>
            <option value="intermediate">Intermediário</option>
            <option value="advanced">Avançado</option>
            <option value="expert">Especialista</option>
          </select>
        </div>
        <div className="vj-stack">
          <label htmlFor="course-visibility">Visibilidade</label>
          <select
            id="course-visibility"
            className="vj-input"
            name="visibility"
            value={visibility}
            onChange={(ev) => setVisibility(ev.target.value)}
          >
            <option value="private">Privado</option>
            <option value="organization_only">Somente organização</option>
            <option value="authenticated">Autenticado</option>
            <option value="public">Público</option>
            <option value="paid">Pago</option>
          </select>
        </div>
        <div className="vj-stack">
          <label htmlFor="course-price">Preço (centavos)</label>
          <Input
            id="course-price"
            name="priceCents"
            type="number"
            min={0}
            value={priceCents}
            onChange={(ev) => setPriceCents(ev.target.value)}
          />
        </div>
        <Button type="submit" disabled={saving || !org.orgId}>
          {saving ? "Salvando…" : "Criar rascunho"}
        </Button>
      </form>
    </div>
  );
}
