"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../../components/control-ui";
import { canAccessEnterprise } from "../../../../../lib/platform";
import { useOrgContext } from "../../../../../lib/use-org-context";

const TABS = [
  { href: "/app/configuracoes/enterprise", label: "Visão geral" },
  { href: "/app/configuracoes/enterprise/sso", label: "SSO" },
  { href: "/app/configuracoes/enterprise/scim", label: "SCIM" },
  { href: "/app/configuracoes/enterprise/dominio", label: "Domínio" },
  { href: "/app/configuracoes/enterprise/branding", label: "Branding" },
  { href: "/app/configuracoes/enterprise/politicas", label: "Políticas" },
  { href: "/app/configuracoes/enterprise/api", label: "API" },
  { href: "/app/configuracoes/enterprise/sla", label: "SLA" },
];

export default function Page() {
  const org = useOrgContext();
  const can = canAccessEnterprise(org.permissions);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("NOT_CONFIGURED");
  const [payload, setPayload] = useState<unknown>(null);

  useEffect(() => {
    if (!org.ready || !org.orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/v1/organizations/${org.orgId}/enterprise/sso`, {
          cache: "no-store",
        });
        if (cancelled) return;
        if (response.status === 404) {
          setStatus("NOT_CONFIGURED");
        } else if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as {
            error?: { message?: string };
          };
          setError(body.error?.message ?? "Falha ao carregar.");
        } else {
          const body = (await response.json()) as { status?: string };
          setStatus(body.status ?? "CONFIGURED");
          setPayload(body);
        }
      } catch {
        if (!cancelled) setError("Falha de rede.");
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) return <NoPermission>Sem permissão enterprise.</NoPermission>;

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Painel", href: "/app" },
          { label: "Enterprise", href: "/app/configuracoes/enterprise" },
          { label: "SSO" },
        ]}
      />
      <PageHeader
        title="SSO"
        description="Single Sign-On via SSOProvider. Default NOT_CONFIGURED."
      />
      <SectionTabs label="Enterprise" items={TABS} current="/app/configuracoes/enterprise/sso" />
      {loading ? <LoadingState label="Carregando…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? (
        <div className="vj-card vj-stack">
          <p>
            Status: <span className="vj-provider-status">{status}</span>
          </p>
          {payload ? (
            <pre className="vj-technical">{JSON.stringify(payload, null, 2)}</pre>
          ) : (
            <EmptyState title="NOT_CONFIGURED">
              Provider ou recurso ainda não configurado. Nenhum SDK fake.
            </EmptyState>
          )}
        </div>
      ) : null}
    </div>
  );
}
