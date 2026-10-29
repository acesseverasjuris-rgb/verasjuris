"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { SectionTabs } from "../../../components/ai-ui";
import { CertificatesTable, EDUCATION_PUBLIC_TABS } from "../../../components/education-ui";
import {
  educationErrorMessage,
  fetchMyCertificates,
  isApiFailure,
  type EducationCertificate,
} from "../../../lib/education";

export default function MeusCertificadosPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<EducationCertificate[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetchMyCertificates();
      if (cancelled) return;
      if (isApiFailure(res)) {
        if (res.httpStatus === 401) setError("Faça login para ver seus certificados.");
        else setError(educationErrorMessage(res));
      } else setItems(res.items);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Educação", href: "/educacao" }, { label: "Certificados" }]} />
      <PageHeader
        title="Meus certificados"
        description="Certificados emitidos. Verificação pública disponível para qualquer código."
        actions={
          <a className="vj-button vj-button-secondary" href="/educacao/certificados/verificar">
            Verificar código
          </a>
        }
      />
      <SectionTabs label="Seções" items={EDUCATION_PUBLIC_TABS} current="/educacao/certificados" />
      {loading ? <LoadingState label="Carregando certificados…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? <CertificatesTable items={items} /> : null}
    </div>
  );
}
