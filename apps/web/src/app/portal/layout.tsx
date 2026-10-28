import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { BrandMark } from "../../components/brand-mark";
import { PortalShell } from "../../components/portal-shell";
import { activeOrganizationId, getSession } from "../../lib/session";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (session.state === "anonymous") redirect("/entrar");
  if (session.state === "unavailable") {
    return (
      <main className="vj-page" id="conteudo">
        <h1 className="vj-title">Não foi possível carregar sua sessão.</h1>
        <p>{session.message}</p>
      </main>
    );
  }
  const activeId = await activeOrganizationId(session.account);
  const organization =
    session.account.memberships.find((item) => item.organizationId === activeId) ?? null;

  return (
    <PortalShell
      brand={<BrandMark variant="negative" />}
      userName={session.account.user.displayName}
      email={session.account.user.email}
      organization={organization}
      organizations={session.account.memberships}
    >
      {children}
    </PortalShell>
  );
}
