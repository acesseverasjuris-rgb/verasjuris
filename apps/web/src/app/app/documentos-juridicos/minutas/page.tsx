"use client";

import {
  Breadcrumb,
  ButtonLink,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  PageHeader,
  Select,
} from "@verasjuris/ui";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import { DraftListTable } from "../../../../components/legal-draft-ui";
import { DOCUMENTOS_JURIDICOS_TABS } from "../../../../components/legal-template-ui";
import {
  LEGAL_DRAFT_STATUS_LABELS,
  aiErrorMessage,
  fetchLegalDrafts,
  hasLegalDraftPermission,
  isApiFailure,
  type LegalDraftSummary,
} from "../../../../lib/legal-drafts";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function MinutasListPage() {
  const org = useOrgContext();
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") ?? "";
  const canRead = hasLegalDraftPermission(org.permissions, "read");
  const canCreate = hasLegalDraftPermission(org.permissions, "create");

  const [q, setQ] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [items, setItems] = useState<LegalDraftSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (orgId: string, filters: { q: string; status: string }) => {
    setLoading(true);
    setError(null);
    const data = await fetchLegalDrafts(orgId, {
      q: filters.q || undefined,
      status: filters.status || undefined,
      limit: 50,
    });
    if (isApiFailure(data)) {
      setError(aiErrorMessage(data, "Não foi possível listar as minutas."));
      setItems([]);
    } else {
      setItems(data.items);
      setTotal(data.total);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!org.ready) return;
    if (!org.orgId || !canRead) {
      setLoading(false);
      return;
    }
    void load(org.orgId, { q: "", status: initialStatus });
  }, [org.ready, org.orgId, canRead, load, initialStatus]);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Documentos jurídicos", href: "/app/documentos-juridicos" },
    { label: "Minutas" },
  ];

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar minutas.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Minutas"
        description="Workflow: rascunho → revisão humana → aprovação → protocolo manual → confirmação."
        actions={
          canCreate ? (
            <ButtonLink href="/app/documentos-juridicos/minutas/nova" variant="primary">
              Nova minuta
            </ButtonLink>
          ) : null
        }
      />
      <SectionTabs
        label="Seções de documentos jurídicos"
        items={DOCUMENTOS_JURIDICOS_TABS}
        current="/app/documentos-juridicos/minutas"
      />

      <form
        className="vj-card vj-stack"
        onSubmit={(event) => {
          event.preventDefault();
          if (org.orgId) void load(org.orgId, { q, status });
        }}
      >
        <div className="vj-split">
          <FormField id="draft-q" label="Buscar">
            <Input
              id="draft-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoComplete="off"
            />
          </FormField>
          <FormField id="draft-status" label="Situação">
            <Select id="draft-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todas</option>
              {Object.entries(LEGAL_DRAFT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <button type="submit" className="vj-button vj-button-secondary">
          Filtrar
        </button>
      </form>

      {loading || !org.ready ? <LoadingState label="Carregando minutas" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState title="Nenhuma minuta">
          Crie uma minuta a partir de um modelo ou em branco.
        </EmptyState>
      ) : null}
      {!loading && items.length > 0 ? (
        <>
          <p className="vj-meta">{total} minuta(s)</p>
          <DraftListTable items={items} caption="Lista de minutas" />
        </>
      ) : null}
    </div>
  );
}
