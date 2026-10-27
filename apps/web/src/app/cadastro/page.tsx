import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RegisterForm } from "../../components/auth-forms";
import { BrandMark } from "../../components/brand-mark";
import { getSession } from "../../lib/session";

export const metadata: Metadata = { title: "Criar conta" };

export default async function RegisterPage() {
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
          <h1 className="vj-title">Criar conta</h1>
          <p>
            A conta é a sua identidade principal. Papéis e organizações ficam ligados a ela depois.
          </p>
          <RegisterForm />
          <p>
            Já tem conta? <a href="/entrar">Entrar</a>
          </p>
        </div>
      </main>
    </>
  );
}
