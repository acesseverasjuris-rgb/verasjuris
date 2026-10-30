"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  NoPermission,
  SectionTabs,
  StatusLabel,
  VENDOR_TABS,
  controlTabsForPermissions,
} from "../../../../../components/control-ui";
import {
  CONTROL_VENDOR_STATUS_LABELS,
  controlErrorMessage,
  fetchControlVendor,
  formatDateTime,
  hasControlPermission,
  isApiFailure,
  type ControlVendor,
} from "../../../../../lib/control";
import { useOrgContext } from "../../../../../lib/use-org-context";

export default function FornecedorDetailPage() {
  const org = useOrgContext();
  const params = useParams<{ id: string }>();
  const vendorId = params?.id;
  const can =
    hasControlPermission(org.permissions, "vendor.read") ||
    hasControlPermission(org.permissions, "read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vendor, setVendor] = useState<ControlVendor | null>(null);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can || !vendorId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchControlVendor(org.orgId!, vendorId);
      if (cancelled) return;
      if (isApiFailure(res)) setError(controlErrorMessage(res));
      else setVendor(res.vendor);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can, vendorId]);

  if (org.ready && !can) {
    return <NoPermission>Sem permissão para fornecedores (control.vendor.read).</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Control", href: "/app/control" },
          { label: "Fornecedores", href: "/app/control/fornecedores" },
          { label: vendor?.name ?? "Detalhe" },
        ]}
      />
      <PageHeader
        title={vendor?.name ?? "Fornecedor"}
        description="Detalhe do ciclo de vida do fornecedor."
      />
      <SectionTabs
        label="Control"
        items={controlTabsForPermissions(org.permissions)}
        current="/app/control/fornecedores"
      />
      <SectionTabs label="Fornecedores" items={VENDOR_TABS} current="/app/control/fornecedores" />
      {loading ? <LoadingState label="Carregando…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && !vendor ? (
        <EmptyState title="Fornecedor não encontrado">Verifique o identificador.</EmptyState>
      ) : null}
      {!loading && !error && vendor ? (
        <dl className="vj-stack">
          <div>
            <dt className="vj-muted">Status</dt>
            <dd>
              <StatusLabel status={vendor.status} labels={CONTROL_VENDOR_STATUS_LABELS} />
            </dd>
          </div>
          <div>
            <dt className="vj-muted">Categoria</dt>
            <dd>{vendor.category ?? "—"}</dd>
          </div>
          <div>
            <dt className="vj-muted">Nível de risco</dt>
            <dd>{vendor.riskLevel ?? "—"}</dd>
          </div>
          <div>
            <dt className="vj-muted">Atualizado em</dt>
            <dd>{formatDateTime(vendor.updatedAt)}</dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}
