"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import {
  fetchPublicStatus,
  isApiFailure,
  platformErrorMessage,
  type PublicStatus,
} from "../../lib/platform";

export default function StatusPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PublicStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetchPublicStatus();
      if (cancelled) return;
      if (isApiFailure(res)) {
        if (res.httpStatus === 404) {
          setData({
            overall: "unknown",
            components: [
              { name: "API", status: "NOT_CONFIGURED" },
              { name: "Web", status: "operational" },
              { name: "Worker", status: "unknown" },
            ],
            updatedAt: new Date().toISOString(),
          });
        } else setError(platformErrorMessage(res));
      } else setData(res);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="vj-page" id="conteudo">
      <div className="vj-stack">
        <Breadcrumb items={[{ label: "Início", href: "/" }, { label: "Status" }]} />
        <PageHeader
          title="Status do sistema"
          description="Disponibilidade pública. Sem inventar saúde de providers."
        />
        {loading ? <LoadingState label="Carregando status…" /> : null}
        {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
        {!loading && !error && data ? (
          <div className="vj-stack">
            <p>
              <span className="vj-status-dot" data-status={data.overall} />
              Situação geral: <strong>{data.overall}</strong>
              {data.updatedAt ? (
                <span className="vj-meta">
                  {" "}
                  · atualizado {new Date(data.updatedAt).toLocaleString("pt-BR")}
                </span>
              ) : null}
            </p>
            {data.components?.length ? (
              <div className="vj-table-wrap vj-table-cards">
                <table className="vj-table">
                  <caption className="vj-visually-hidden">Componentes do status</caption>
                  <thead>
                    <tr>
                      <th scope="col">Componente</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.components.map((item) => (
                      <tr key={item.name}>
                        <td data-label="Componente">{item.name}</td>
                        <td data-label="Status">
                          <span className="vj-status-dot" data-status={item.status} />
                          <span className="vj-provider-status">{item.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="Sem componentes">Nenhum componente publicado.</EmptyState>
            )}
          </div>
        ) : null}
      </div>
    </main>
  );
}
