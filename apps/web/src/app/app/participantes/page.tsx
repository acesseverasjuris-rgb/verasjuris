import { SESSION_COOKIE } from "@verasjuris/security/constants";
import { Breadcrumb, ErrorState, PageHeader } from "@verasjuris/ui";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  AddMemberForm,
  ChangeRoleForm,
  InvitationActions,
  InviteMemberForm,
} from "../../../components/organization-forms";
import { activeOrganizationId, getSession } from "../../../lib/session";
import { apiInternalUrl, roleLabel } from "../../../lib/types";

export const dynamic = "force-dynamic";

type Member = {
  membershipId: string;
  displayName: string;
  email: string;
  status: string;
  roles: string[];
};

export default async function MembersPage() {
  const session = await getSession();
  if (session.state !== "authenticated") redirect("/entrar");
  const activeId = await activeOrganizationId(session.account);
  if (!activeId) redirect("/app");
  const membership = session.account.memberships.find((item) => item.organizationId === activeId);
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const response = await fetch(`${apiInternalUrl()}/v1/organizations/${activeId}/members`, {
    headers: { cookie: `${SESSION_COOKIE}=${token ?? ""}` },
    cache: "no-store",
  });
  if (response.status === 403) {
    return (
      <ErrorState title="Você não pode consultar os participantes.">
        Nenhum dado foi exibido ou alterado.
      </ErrorState>
    );
  }
  if (!response.ok) {
    return (
      <ErrorState title="Não foi possível listar os participantes.">
        A lista anterior, se existia, não foi alterada.
      </ErrorState>
    );
  }
  const body = (await response.json()) as { members: Member[] };
  const canManage = membership?.permissions.includes("member.manage") ?? false;
  const canInvite = membership?.permissions.includes("member.invite") ?? false;
  const canAssign = membership?.permissions.includes("role.assign") ?? false;
  const invitationsResponse = canInvite
    ? await fetch(`${apiInternalUrl()}/v1/organizations/${activeId}/invitations`, {
        headers: { cookie: `${SESSION_COOKIE}=${token ?? ""}` },
        cache: "no-store",
      })
    : null;
  const invitations = invitationsResponse?.ok
    ? (
        (await invitationsResponse.json()) as {
          invitations: Array<{
            id: string;
            email: string;
            roleKey: string;
            expiresAt: string;
            expired: boolean;
          }>;
        }
      ).invitations
    : [];
  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Painel", href: "/app" }, { label: "Participantes" }]} />
      <PageHeader
        title="Participantes"
        description="Pessoas com acesso a esta organização. Incluir alguém não verifica inscrição profissional."
      />
      {canInvite ? (
        <section className="vj-card">
          <h2 className="vj-section-title">Convidar participante</h2>
          <InviteMemberForm organizationId={activeId} />
          {invitations.length > 0 ? (
            <ul>
              {invitations.map((invitation) => (
                <li key={invitation.id}>
                  {invitation.email} · {roleLabel(invitation.roleKey)} ·{" "}
                  {invitation.expired ? "expirado" : "pendente"}
                  <InvitationActions organizationId={activeId} invitationId={invitation.id} />
                </li>
              ))}
            </ul>
          ) : (
            <p>Nenhum convite pendente.</p>
          )}
        </section>
      ) : null}
      {canManage ? (
        <section className="vj-card">
          <h2 className="vj-section-title">Incluir conta existente</h2>
          <AddMemberForm organizationId={activeId} />
        </section>
      ) : null}
      {body.members.length === 0 ? (
        <p>Nenhum participante ativo foi encontrado.</p>
      ) : (
        <div className="vj-table-wrap">
          <table className="vj-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Papel</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {body.members.map((member) => (
                <tr key={member.membershipId}>
                  <td data-label="Nome">{member.displayName}</td>
                  <td data-label="E-mail">{member.email}</td>
                  <td data-label="Papel">
                    {canAssign ? (
                      <ChangeRoleForm
                        organizationId={activeId}
                        membershipId={member.membershipId}
                        role={member.roles[0] ?? "member"}
                      />
                    ) : (
                      member.roles.map(roleLabel).join(", ")
                    )}
                  </td>
                  <td data-label="Situação">
                    {member.status === "active" ? "Ativo" : member.status}
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
