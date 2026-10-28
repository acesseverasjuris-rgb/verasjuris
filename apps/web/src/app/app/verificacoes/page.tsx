"use client";

import { EmptyState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import {
  fetchVerificationProvidersStatus,
  isApiFailure,
} from "../../../lib/professional-verification";
import { useOrgContext } from "../../../lib/use-org-context";

export default function VerificacoesPage() {
  const org = useOrgContext();
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<Record<string, string>>({});

  useEffect(() => {
    void fetchVerificationProvidersStatus()
      .then((res) => {
        if (!isApiFailure(res)) {
          setStatuses({
            oab: res.oab.status,
            cpf: res.cpf.status,
            document: res.document.status,
            biometric: res.biometric.status,
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState label="Carregando verificações…" />;
  if (!org.orgId) return <EmptyState title="Selecione uma organização">Nenhum item.</EmptyState>;

  return (
    <>
      <PageHeader
        title="Verificações profissionais"
        description="OAB informada ≠ verificada. CPF format ≠ identidade. Biometria NOT_CONFIGURED sem provider."
      />
      <ul className="vj-stack">
        {Object.entries(statuses).map(([k, v]) => (
          <li key={k}>
            {k}: {v}
          </li>
        ))}
      </ul>
    </>
  );
}
