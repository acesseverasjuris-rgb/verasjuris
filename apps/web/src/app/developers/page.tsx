import { Breadcrumb, PageHeader } from "@verasjuris/ui";

const SCOPES = [
  { scope: "matters:read", description: "Ler casos autorizados" },
  { scope: "documents:read", description: "Ler metadados de documentos" },
  { scope: "finance:read", description: "Ler leituras financeiras não sensíveis" },
  { scope: "webhooks:manage", description: "Registrar endpoints de webhook" },
];

export default function DevelopersPage() {
  return (
    <main className="vj-page" id="conteudo">
      <div className="vj-stack">
        <Breadcrumb items={[{ label: "Início", href: "/" }, { label: "Desenvolvedores" }]} />
        <PageHeader
          title="Desenvolvedores"
          description="API pública versionada, escopos e webhooks."
        />
        <section className="vj-card">
          <h2 className="vj-section-title">OpenAPI</h2>
          <p>
            Especificação: <a href="/api/v1/public/openapi.json">/api/v1/public/openapi.json</a>{" "}
            (quando o gateway público estiver configurado). Documentação em{" "}
            <code>docs/PUBLIC_API.md</code>.
          </p>
        </section>
        <section className="vj-card">
          <h2 className="vj-section-title">Autenticação</h2>
          <p>
            Credenciais de API usam hash-only (prefixo + secretHash). Nunca envie o secret em logs
            ou frontend.
          </p>
        </section>
        <section className="vj-card vj-table-cards">
          <h2 className="vj-section-title">Escopos (amostra)</h2>
          <div className="vj-table-wrap">
            <table className="vj-table">
              <caption className="vj-visually-hidden">Escopos da API pública</caption>
              <thead>
                <tr>
                  <th scope="col">Escopo</th>
                  <th scope="col">Descrição</th>
                </tr>
              </thead>
              <tbody>
                {SCOPES.map((row) => (
                  <tr key={row.scope}>
                    <td data-label="Escopo">
                      <code>{row.scope}</code>
                    </td>
                    <td data-label="Descrição">{row.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
