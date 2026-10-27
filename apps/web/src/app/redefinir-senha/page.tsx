import type { Metadata } from "next";
import { ConfirmResetForm } from "../../components/auth-forms";
import { BrandMark } from "../../components/brand-mark";

export const metadata: Metadata = { title: "Redefinir senha" };

export default async function ResetPasswordPage({
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
          <h1 className="vj-title">Redefinir senha</h1>
          <p>
            Defina uma nova senha com pelo menos 12 caracteres. As sessões anteriores serão
            encerradas.
          </p>
          <ConfirmResetForm token={params.token ?? ""} />
        </div>
      </main>
    </>
  );
}
