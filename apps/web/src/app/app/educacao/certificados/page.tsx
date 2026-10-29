"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import { CertificatesTable, EDUCATION_APP_TABS } from "../../../../components/education-ui";
import {
  educationErrorMessage,
  fetchInstructorCertificates,
  hasEducationPermission,
  isApiFailure,
  type EducationCertificate,
} from "../../../../lib/education";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function AppCertificadosPage() {
  const org = useOrgContext();
  const can =
    hasEducationPermission(org.permissions, "read") ||
    hasEducationPermission(org.permissions, "certificate.issue");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<EducationCertificate[]>([]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchInstructorCertificates(org.orgId!, { limit: 100 });
      if (cancelled) return;
      if (isApiFailure(res)) setError(educationErrorMessage(res));
      else setItems(res.items);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) {
    return <NoPermission>Sem permissão para certificados.</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[{ label: "Educação", href: "/app/educacao" }, { label: "Certificados" }]}
      />
      <PageHeader
        title="Certificados"
        description="Certificados emitidos. Verificação pública em /educacao/certificados/verificar."
      />
      <SectionTabs label="Seções" items={EDUCATION_APP_TABS} current="/app/educacao/certificados" />
      {loading ? <LoadingState label="Carregando certificados…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? <CertificatesTable items={items} /> : null}
    </div>
  );
}
