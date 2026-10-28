"use client";

import {
  Breadcrumb,
  ButtonLink,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@verasjuris/ui";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { NoPermission } from "../../../../components/ai-ui";
import { LegalAreaToolsList } from "../../../../components/legal-areas-ui";
import {
  LEGAL_AREA_HUB_LABELS,
  fetchLegalAreaModuleFeatures,
  hasLegalAreaPermission,
  isApiFailure,
  legalAreaKeyFromParam,
  matterCreateHrefForArea,
  toolsForLegalArea,
  type LegalAreaFeatureConfig,
  type LegalAreaModuleKey,
} from "../../../../lib/legal-areas";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function AreaJuridicaDetailPage() {
  const params = useParams<{ key: string }>();
  const areaKey = useMemo(() => legalAreaKeyFromParam(params.key), [params.key]);
  const org = useOrgContext();
  const canRead = hasLegalAreaPermission(org.permissions, "read");
  const canCreateMatter = org.permissions?.includes("matter.create") ?? false;

  const [features, setFeatures] = useState<LegalAreaFeatureConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!org.ready || !areaKey) {
      setLoading(false);
      return;
    }
    if (!org.orgId || !canRead) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const data = await fetchLegalAreaModuleFeatures(org.orgId!, areaKey);
      if (cancelled) return;
      if (!isApiFailure(data)) setFeatures(data.items);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, canRead, areaKey]);

  const label = areaKey ? LEGAL_AREA_HUB_LABELS[areaKey] : null;
  const tools = areaKey ? toolsForLegalArea(areaKey) : [];

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Áreas jurídicas", href: "/app/areas" },
    { label: label?.title ?? "Área" },
  ];

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar esta área.</NoPermission>
      </div>
    );
  }

  if (!areaKey) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <ErrorState title="Área inválida">Não reconhecemos esta chave de área jurídica.</ErrorState>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title={label?.title ?? areaKey}
        description={label?.description}
        actions={
          canCreateMatter ? (
            <ButtonLink
              href={matterCreateHrefForArea(areaKey as LegalAreaModuleKey)}
              variant="primary"
            >
              Novo caso com extensão
            </ButtonLink>
          ) : null
        }
      />
      {loading || !org.ready ? <LoadingState label="Carregando ferramentas" /> : null}

      <section className="vj-stack" aria-labelledby="area-tools">
        <h2 id="area-tools" className="vj-section-title">
          Ferramentas
        </h2>
        <LegalAreaToolsList tools={tools} />
      </section>

      <section className="vj-stack" aria-labelledby="area-features">
        <h2 id="area-features" className="vj-section-title">
          Recursos do módulo
        </h2>
        {features.length === 0 ? (
          <EmptyState title="Recursos padrão">
            Funcionalidades específicas aparecerão quando o módulo estiver sincronizado com a API.
          </EmptyState>
        ) : (
          <ul className="vj-stack">
            {features.map((f) => (
              <li key={f.id} className="vj-card">
                <strong>{f.featureKey}</strong>
                <span className="vj-meta">{f.active ? "Ativo" : "Inativo"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
