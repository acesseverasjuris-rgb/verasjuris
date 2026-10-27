import type { Metadata } from "next";
import { RequestResetForm } from "../../components/auth-forms";
import { BrandMark } from "../../components/brand-mark";

export const metadata: Metadata = { title: "Recuperar conta" };

export default function RecoverPage() {
  return (
    <>
      <header className="vj-public-header">
        <a href="/">
          <BrandMark />
        </a>
      </header>
      <main className="vj-page" id="conteudo">
        <div className="vj-card vj-panel">
          <h1 className="vj-title">Recuperar conta</h1>
          <p>
            Informe o e-mail da conta. A resposta é sempre neutra e não confirma se o endereço
            existe.
          </p>
          <RequestResetForm />
          <p>
            <a href="/entrar">Voltar para entrar</a>
          </p>
        </div>
      </main>
    </>
  );
}
