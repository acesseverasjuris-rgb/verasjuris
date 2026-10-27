import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandMark } from "../../components/brand-mark";
import { InviteForm } from "../../components/invite-form";

export const metadata: Metadata = { title: "Convite" };

export default function InvitePage() {
  return (
    <>
      <header className="vj-public-header">
        <a href="/">
          <BrandMark />
        </a>
      </header>
      <main className="vj-page" id="conteudo">
        <div className="vj-card vj-panel vj-stack">
          <h1 className="vj-title">Convite</h1>
          <Suspense fallback={<p role="status">Carregando convite…</p>}>
            <InviteForm />
          </Suspense>
        </div>
      </main>
    </>
  );
}
