"use client";

import { EmptyState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import {
  fetchOwnVerificationCases,
  isApiFailure,
  type VerificationCase,
} from "../../../../lib/professional-verification";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function VerificacoesProfissionaisPage() {
  const org = useOrgContext();
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<VerificationCase[]>([]);

  useEffect(() => {
    if (!org.orgId) {
      setLoading(false);
      return;
    }
    void fetchOwnVerificationCases(org.orgId)
      .then((res) => {
        if (!isApiFailure(res)) setCases(res.cases);
      })
      .finally(() => setLoading(false));
  }, [org.orgId]);

  if (loading) return <LoadingState label="Carregando…" />;
  if (!org.orgId) return <EmptyState title="Selecione uma organização">Nenhum item.</EmptyState>;

  return (
    <>
      <PageHeader title="Casos de verificação" description="Lista operacional de casos." />
      {cases.length === 0 ? (
        <EmptyState title="Sem casos">Nenhum caso de verificação.</EmptyState>
      ) : (
        <ul className="vj-stack">
          {cases.map((c) => (
            <li key={c.id}>
              {c.verificationType} — {c.status}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
