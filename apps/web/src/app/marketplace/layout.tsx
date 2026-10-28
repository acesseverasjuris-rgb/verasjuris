import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { BrandMark } from "../../components/brand-mark";
import { getSession } from "../../lib/session";

export const dynamic = "force-dynamic";

export default async function MarketplacePublicLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (session.state === "anonymous") redirect("/entrar?redirect=/marketplace");
  if (session.state === "unavailable") {
    return (
      <main className="vj-page" id="conteudo">
        <h1 className="vj-title">Não foi possível carregar sua sessão.</h1>
        <p>{session.message}</p>
      </main>
    );
  }
  return (
    <div className="vj-shell vj-shell-public">
      <header className="vj-topbar">
        <a href="/marketplace" className="vj-brand-text">
          <BrandMark variant="positive" />
        </a>
        <nav className="vj-nav-inline" aria-label="Marketplace">
          <a href="/marketplace/profissionais">Profissionais</a>
          <a href="/marketplace/solicitacoes">Solicitações</a>
          <a href="/app/marketplace">Área profissional</a>
          <a href="/app">Painel</a>
        </nav>
      </header>
      <main className="vj-page" id="conteudo">
        {children}
      </main>
    </div>
  );
}
