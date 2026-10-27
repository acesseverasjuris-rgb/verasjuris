import type { Metadata } from "next";
import { VerifyEmailForm } from "../../components/auth-forms";
import { BrandMark } from "../../components/brand-mark";

export const metadata: Metadata = { title: "Verificar e-mail" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return (
    <>
      <header className="vj-public-header">
        <a href="/">
          <BrandMark />
        </a>
      </header>
      <main className="vj-page" id="conteudo">
        <div className="vj-card vj-panel">
          <h1 className="vj-title">Verificar e-mail</h1>
          <p>
            Confirme o endereço da sua conta. Se o envio por e-mail não estiver configurado neste
            ambiente, use o fluxo de desenvolvimento documentado.
          </p>
          <VerifyEmailForm initialToken={params.token ?? ""} />
        </div>
      </main>
    </>
  );
}
