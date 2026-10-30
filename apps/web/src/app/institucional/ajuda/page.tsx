import { Breadcrumb, PageHeader } from "@verasjuris/ui";

export default function Page() {
  return (
    <main className="vj-page" id="conteudo">
      <div className="vj-stack">
        <Breadcrumb items={[{ label: "Início", href: "/" }, { label: "Central de Ajuda" }]} />
        <PageHeader title="Central de Ajuda" description="Orientação de uso da plataforma." />
        <p className="vj-draft-banner" role="status">
          RASCUNHO — conteúdo institucional sem aprovação jurídica final.
        </p>
        <div className="vj-prose">
          <p>Página institucional versionável. Conteúdo definitivo será publicado após revisão.</p>
        </div>
      </div>
    </main>
  );
}
