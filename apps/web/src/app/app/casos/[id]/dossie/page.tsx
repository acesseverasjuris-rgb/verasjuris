"use client";

import {
  Alert,
  Badge,
  Breadcrumb,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@verasjuris/ui";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  apiErrorMessage,
  fetchMatterDossier,
  getActiveOrgId,
  isApiFailure,
} from "../../../../../lib/productivity";
import { fetchMatter } from "../../../../../lib/matters";

export default function CasoDossiePage() {
  const params = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matterTitle, setMatterTitle] = useState("Caso");
  const [docs, setDocs] = useState<
    Array<{
      id: string;
      title: string;
      documentKind: string;
      legalContext: string;
      evidentiaryRole: string;
      status: string;
    }>
  >([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    void (async () => {
      const orgId = await getActiveOrgId();
      if (!orgId) {
        setError("Nenhuma organização ativa.");
        setLoading(false);
        return;
      }
      const matter = await fetchMatter(orgId, params.id);
      if (!isApiFailure(matter)) {
        setMatterTitle(matter.matter.title);
      }
      const dossier = await fetchMatterDossier(orgId, params.id);
      if (isApiFailure(dossier)) {
        setError(apiErrorMessage(dossier, "Não foi possível carregar o dossiê."));
        setLoading(false);
        return;
      }
      setDocs(dossier.dossier.documents);
      setNote(dossier.dossier.note);
      setLoading(false);
    })();
  }, [params.id]);

  if (loading) return <LoadingState label="Carregando dossiê…" />;
  if (error) return <ErrorState title="Erro">{error}</ErrorState>;

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Painel", href: "/app" },
          { label: "Casos", href: "/app/casos" },
          { label: matterTitle, href: `/app/casos/${params.id}` },
          { label: "Dossiê" },
        ]}
      />
      <PageHeader
        title="Dossiê eletrônico"
        description="Projeção documental do caso — não há entidade Dossier persistida."
      />
      <Alert tone="info" title="Projeção">
        {note}
      </Alert>
      {docs.length === 0 ? (
        <EmptyState title="Nenhum documento no dossiê">
          Vincule documentos ao caso ou aos processos relacionados.
        </EmptyState>
      ) : (
        <ul className="vj-list">
          {docs.map((doc) => (
            <li key={doc.id}>
              <strong>{doc.title}</strong> <Badge>{doc.documentKind}</Badge>
              <span className="vj-meta">
                {" "}
                · {doc.legalContext} · {doc.evidentiaryRole} · {doc.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
