import { SESSION_COOKIE } from "@verasjuris/security/constants";
import { Breadcrumb, ErrorState, PageHeader } from "@verasjuris/ui";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { activeOrganizationId, getSession } from "../../../lib/session";
import { actionLabel, apiInternalUrl } from "../../../lib/types";

export const dynamic = "force-dynamic";

type AuditRow = {
  id: string;
  occurredAt: string;
  action: string;
  resourceType: string;
  actorDisplayName: string | null;
};

export default async function AuditPage() {
  const session = await getSession();
  if (session.state !== "authenticated") redirect("/entrar");
  const activeId = await activeOrganizationId(session.account);
  if (!activeId) redirect("/app");
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const response = await fetch(`${apiInternalUrl()}/v1/organizations/${activeId}/audit`, {
    headers: { cookie: `${SESSION_COOKIE}=${token ?? ""}` },
    cache: "no-store",
  });
  if (response.status === 403) {
    return (
      <ErrorState title="Você não pode consultar a auditoria.">
        A permissão é verificada no servidor. Nenhum registro foi alterado.
      </ErrorState>
    );
  }
  if (!response.ok) {
    return (
      <ErrorState title="Não foi possível carregar a auditoria.">
        Nenhum registro foi alterado.
      </ErrorState>
    );
  }
  const body = (await response.json()) as { events: AuditRow[] };
  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Painel", href: "/app" }, { label: "Auditoria" }]} />
      <PageHeader
        title="Auditoria"
        description="Registro do que foi feito nesta organização. Este histórico não representa decisão jurídica nem protocolo."
      />
      {body.events.length === 0 ? (
        <p>Ainda não há eventos desta organização.</p>
      ) : (
        <div className="vj-table-wrap">
          <table className="vj-table">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Ação</th>
                <th>Quem</th>
                <th>Código</th>
              </tr>
            </thead>
            <tbody>
              {body.events.map((event) => (
                <tr key={event.id}>
                  <td data-label="Quando">{new Date(event.occurredAt).toLocaleString("pt-BR")}</td>
                  <td data-label="Ação">{actionLabel(event.action)}</td>
                  <td data-label="Quem">{event.actorDisplayName ?? "Não identificado"}</td>
                  <td data-label="Código" className="vj-technical">
                    {event.action}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
