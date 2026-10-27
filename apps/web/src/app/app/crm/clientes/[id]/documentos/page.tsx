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
  fetchClientDossier,
  getActiveOrgId,
  isApiFailure,
} from "../../../../../../lib/productivity";

export default function ClienteDocumentosPage() {
  const params = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [docs, setDocs] = useState<
    Array<{ id: string; title: string; documentKind: string; status: string }>
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
      const data = await fetchClientDossier(orgId, params.id);
      if (isApiFailure(data)) {
        setError(apiErrorMessage(data, "Não foi possível carregar os documentos do cliente."));
        setLoading(false);
        return;
      }
      setDocs(data.dossier.documents);
      setNote(data.dossier.note);
      setLoading(false);
    })();
  }, [params.id]);

  if (loading) return <LoadingState label="Carregando documentos…" />;
  if (error) return <ErrorState title="Erro">{error}</ErrorState>;

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "CRM", href: "/app/crm" },
          { label: "Clientes", href: "/app/crm/clientes" },
          { label: "Cliente", href: `/app/crm/clientes/${params.id}` },
          { label: "Documentos" },
        ]}
      />
      <PageHeader
        title="Documentos do cliente"
        description="Projeção documental (ownerType=client)."
      />
      <Alert tone="info" title="Dossiê do cliente">
        {note}
      </Alert>
      {docs.length === 0 ? (
        <EmptyState title="Nenhum documento">
          Cadastre documentos com dono cliente para aparecerem aqui.
        </EmptyState>
      ) : (
        <ul className="vj-list">
          {docs.map((doc) => (
            <li key={doc.id}>
              <strong>{doc.title}</strong> <Badge>{doc.documentKind}</Badge>{" "}
              <span className="vj-meta">{doc.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
