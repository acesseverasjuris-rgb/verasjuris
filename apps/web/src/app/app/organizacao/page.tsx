import { SESSION_COOKIE } from "@verasjuris/security/constants";
import { Breadcrumb, ErrorState, PageHeader } from "@verasjuris/ui";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { RenameOrganizationForm } from "../../../components/organization-forms";
import { activeOrganizationId, getSession } from "../../../lib/session";
import { apiInternalUrl } from "../../../lib/types";

export const dynamic = "force-dynamic";

export default async function OrganizationPage() {
  const session = await getSession();
  if (session.state !== "authenticated") redirect("/entrar");
  const activeId = await activeOrganizationId(session.account);
  if (!activeId) redirect("/app");
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const response = await fetch(`${apiInternalUrl()}/v1/organizations/${activeId}`, {
    headers: { cookie: `${SESSION_COOKIE}=${token ?? ""}` },
    cache: "no-store",
  });
  if (response.status === 403) {
    return (
      <ErrorState title="Você não pode alterar esta organização.">
        A consulta não foi autorizada. Nenhum dado foi modificado.
      </ErrorState>
    );
  }
  if (!response.ok) {
    return (
      <ErrorState title="Não encontramos a organização ativa.">
        O contexto selecionado não está disponível para esta conta. Nada foi alterado.
      </ErrorState>
    );
  }
  const body = (await response.json()) as {
    organization: { id: string; name: string; slug: string; permissions: string[] };
  };
  const canUpdate = body.organization.permissions.includes("organization.update");
  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Painel", href: "/app" }, { label: "Organização" }]} />
      <PageHeader
        title="Organização"
        description="Dados cadastrais do contexto de trabalho. Esta tela não representa um registro na OAB nem um processo."
        eyebrow={body.organization.slug}
      />
      {canUpdate ? (
        <section className="vj-card">
          <RenameOrganizationForm
            organizationId={body.organization.id}
            name={body.organization.name}
          />
        </section>
      ) : (
        <section className="vj-card">
          <h2 className="vj-section-title">{body.organization.name}</h2>
          <p>Você pode consultar esta organização. A alteração do nome exige outra permissão.</p>
        </section>
      )}
    </div>
  );
}
