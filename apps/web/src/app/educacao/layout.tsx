import type { ReactNode } from "react";
import { BrandMark } from "../../components/brand-mark";
import { getSession } from "../../lib/session";

export const dynamic = "force-dynamic";

export default async function EducacaoPublicLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  const signedIn = session.state === "authenticated";

  return (
    <div className="vj-shell vj-shell-public">
      <header className="vj-topbar">
        <a href="/educacao" className="vj-brand-text">
          <BrandMark variant="positive" />
        </a>
        <nav className="vj-nav-inline" aria-label="Educação jurídica">
          <a href="/educacao/cursos">Cursos</a>
          <a href="/educacao/trilhas">Trilhas</a>
          <a href="/educacao/biblioteca">Biblioteca</a>
          {signedIn ? <a href="/educacao/meus-cursos">Meus cursos</a> : null}
          {signedIn ? <a href="/educacao/certificados">Certificados</a> : null}
          <a href="/educacao/certificados/verificar">Verificar certificado</a>
          {signedIn ? <a href="/app/educacao">Área do instrutor</a> : null}
          {signedIn ? <a href="/app">Painel</a> : <a href="/entrar?redirect=/educacao">Entrar</a>}
        </nav>
      </header>
      <main className="vj-page" id="conteudo">
        {children}
      </main>
    </div>
  );
}
