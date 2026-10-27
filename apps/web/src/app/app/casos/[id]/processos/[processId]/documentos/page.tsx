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
import { CSRF_HEADER } from "@verasjuris/security/constants";
import { getActiveOrgId } from "../../../../../../../lib/productivity";

type Doc = {
  id: string;
  title: string;
  documentKind: string;
  status: string;
};

export default function ProcessoDocumentosPage() {
  const params = useParams<{ id: string; processId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    void (async () => {
      const orgId = await getActiveOrgId();
      if (!orgId) {
        setError("Nenhuma organização ativa.");
        setLoading(false);
        return;
      }
      const response = await fetch(
        `/api/v1/organizations/${orgId}/judicial-processes/${params.processId}/dossier`,
        { headers: { [CSRF_HEADER]: "1" }, cache: "no-store" },
      );
      const body = (await response.json()) as {
        dossier?: { documents: Doc[]; note: string };
        error?: { message: string };
      };
      if (!response.ok) {
        setError(body.error?.message ?? "Não foi possível carregar o dossiê processual.");
        setLoading(false);
        return;
      }
      setDocs(body.dossier?.documents ?? []);
      setNote(body.dossier?.note ?? "");
      setLoading(false);
    })();
  }, [params.processId]);

  if (loading) return <LoadingState label="Carregando documentos…" />;
  if (error) return <ErrorState title="Erro">{error}</ErrorState>;

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Casos", href: "/app/casos" },
          { label: "Caso", href: `/app/casos/${params.id}` },
          { label: "Processos", href: `/app/casos/${params.id}/processos` },
          {
            label: "Processo",
            href: `/app/casos/${params.id}/processos/${params.processId}`,
          },
          { label: "Documentos" },
        ]}
      />
      <PageHeader title="Documentos do processo" description="Projeção do dossiê judicial." />
      <Alert tone="info" title="Projeção">
        {note}
      </Alert>
      {docs.length === 0 ? (
        <EmptyState title="Nenhum documento">
          Cadastre documentos no processo ou vincule-os ao dossiê.
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
