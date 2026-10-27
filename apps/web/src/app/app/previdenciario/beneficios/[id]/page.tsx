"use client";

import {
  Alert,
  Breadcrumb,
  ButtonLink,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@verasjuris/ui";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../../components/ai-ui";
import {
  BenefitStatusBadge,
  PREVIDENCIARIO_TABS,
} from "../../../../../components/previdentiary-ui";
import {
  fetchBenefit,
  formatDateTime,
  hasPrevidentiaryPermission,
  isApiFailure,
  previdentiaryErrorMessage,
  type SocialSecurityBenefit,
} from "../../../../../lib/previdentiary";
import { useOrgContext } from "../../../../../lib/use-org-context";

export default function BeneficioDetailPage() {
  const params = useParams<{ id: string }>();
  const benefitId = params.id;
  const org = useOrgContext();
  const canRead = hasPrevidentiaryPermission(org.permissions, "read");

  const [benefit, setBenefit] = useState<SocialSecurityBenefit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (orgId: string) => {
      setLoading(true);
      setError(null);
      const data = await fetchBenefit(orgId, benefitId);
      if (isApiFailure(data)) {
        setError(previdentiaryErrorMessage(data, "Não foi possível carregar o benefício."));
        setBenefit(null);
      } else {
        setBenefit(data.benefit);
      }
      setLoading(false);
    },
    [benefitId],
  );

  useEffect(() => {
    if (!org.ready) return;
    if (!org.orgId || !canRead) {
      setLoading(false);
      return;
    }
    void load(org.orgId);
  }, [org.ready, org.orgId, canRead, load]);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Previdenciário", href: "/app/previdenciario" },
    { label: "Benefício" },
  ];

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar benefícios.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title={benefit?.nb ? `NB ${benefit.nb}` : "Benefício"}
        description="Cadastro interno — não afirma existência oficial no INSS."
        actions={
          benefit ? (
            <ButtonLink
              href={`/app/previdenciario/casos/${benefit.previdentiaryCaseId}`}
              variant="secondary"
            >
              Abrir caso
            </ButtonLink>
          ) : null
        }
      />
      <SectionTabs
        label="Seções previdenciárias"
        items={PREVIDENCIARIO_TABS}
        current="/app/previdenciario/casos"
      />

      <Alert tone="info" title="Sem dado oficial inventado">
        Este benefício é um registro interno VerasJuris. Não há consulta automática ao INSS neste
        ambiente.
      </Alert>

      {loading || !org.ready ? <LoadingState label="Carregando benefício" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}

      {benefit ? (
        <div className="vj-card vj-stack">
          <div className="vj-inline-actions">
            <BenefitStatusBadge status={benefit.status} />
            <span className="vj-meta">Fonte: {benefit.source ?? "manual"}</span>
          </div>
          <dl className="vj-stack">
            <div>
              <dt className="vj-meta">NB</dt>
              <dd className="vj-technical">{benefit.nb || "—"}</dd>
            </div>
            <div>
              <dt className="vj-meta">DER</dt>
              <dd>{benefit.der ? formatDateTime(benefit.der) : "—"}</dd>
            </div>
            <div>
              <dt className="vj-meta">DIB</dt>
              <dd>{benefit.dib ? formatDateTime(benefit.dib) : "—"}</dd>
            </div>
            <div>
              <dt className="vj-meta">DCB</dt>
              <dd>{benefit.dcb ? formatDateTime(benefit.dcb) : "—"}</dd>
            </div>
            <div>
              <dt className="vj-meta">Atualizado</dt>
              <dd>{formatDateTime(benefit.updatedAt)}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}
