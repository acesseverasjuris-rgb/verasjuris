import { Breadcrumb, PageHeader } from "@verasjuris/ui";
import type { ReactNode } from "react";

export function DraftPolicyPage({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <main className="vj-page" id="conteudo">
      <div className="vj-stack">
        <Breadcrumb
          items={[
            { label: "Início", href: "/" },
            { label: "Políticas", href: "/politicas/privacidade" },
            { label: title },
          ]}
        />
        <PageHeader title={title} description={description} />
        <p className="vj-draft-banner" role="status">
          RASCUNHO — conteúdo institucional sem aprovação jurídica final. Não tratar como política
          publicada.
        </p>
        <div className="vj-prose">
          {children ?? (
            <p>
              Este documento é um placeholder versionável (status DRAFT). A versão oficial será
              publicada após revisão jurídica e compliance.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
