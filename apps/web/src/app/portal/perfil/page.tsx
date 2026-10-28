"use client";

import { Breadcrumb, PageHeader } from "@verasjuris/ui";
import { PortalAccessDenied } from "../../../components/client-portal-ui";
import { usePortalContext } from "../../../lib/use-portal-context";

export default function PortalPerfilPage() {
  const portal = usePortalContext();
  const breadcrumb = [{ label: "Portal", href: "/portal" }, { label: "Perfil" }];

  if (portal.ready && !portal.linked) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <PortalAccessDenied message={portal.deniedMessage ?? undefined} />
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader title="Perfil" description="Dados do seu vínculo como cliente." />
      {portal.context ? (
        <dl className="vj-card vj-stack">
          <div>
            <dt className="vj-meta">ID do cliente</dt>
            <dd>{portal.context.clientId}</dd>
          </div>
          <div>
            <dt className="vj-meta">Organização</dt>
            <dd>{portal.context.organizationId}</dd>
          </div>
          <div>
            <dt className="vj-meta">Usuário</dt>
            <dd>{portal.context.userId}</dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}
