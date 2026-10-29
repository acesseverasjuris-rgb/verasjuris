import type { ReactNode } from "react";
import { BrandMark } from "../../components/brand-mark";
import { getSession } from "../../lib/session";

export const dynamic = "force-dynamic";

export default async function PlanosPublicLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  const signedIn = session.state === "authenticated";

  return (
    <div className="vj-shell vj-shell-public">
      <header className="vj-topbar">
        <a href="/" className="vj-brand-text">
          <BrandMark variant="positive" />
        </a>
        <nav className="vj-nav-inline" aria-label="Planos">
          <a href="/planos" aria-current="page">
            Planos
          </a>
          {signedIn ? <a href="/app/financeiro">Financeiro</a> : null}
          {signedIn ? <a href="/app">Painel</a> : <a href="/entrar?redirect=/planos">Entrar</a>}
        </nav>
      </header>
      {children}
    </div>
  );
}
