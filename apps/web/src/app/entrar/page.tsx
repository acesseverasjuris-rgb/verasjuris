import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "../../components/auth-forms";
import { BrandMark } from "../../components/brand-mark";
import { getSession } from "../../lib/session";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage() {
  const session = await getSession();
  if (session.state === "authenticated") redirect("/app");
  return (
    <>
      <header className="vj-public-header">
        <a href="/">
          <BrandMark />
        </a>
      </header>
      <main className="vj-page" id="conteudo">
        <div className="vj-card vj-panel">
          <h1 className="vj-title">Entrar</h1>
          <p>Use o e-mail e a senha da sua conta VerasJuris.</p>
          {session.state === "unavailable" ? <p role="status">{session.message}</p> : null}
          <LoginForm />
          <p>
            Ainda não tem conta? <a href="/cadastro">Criar conta</a>
          </p>
        </div>
      </main>
    </>
  );
}
