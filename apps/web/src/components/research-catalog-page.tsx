"use client";

import {
  Alert,
  Breadcrumb,
  Button,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  PageHeader,
} from "@verasjuris/ui";
import { useCallback, useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "./ai-ui";
import { CatalogResultList, RESEARCH_TABS } from "./research-ui";
import {
  createCitation,
  hasCitationPermission,
  isApiFailure as isCitationFailure,
} from "../lib/citations";
import type { AiApiFailure } from "../lib/ai";
import {
  catalogTitle,
  hasResearchPermission,
  isApiFailure,
  researchErrorMessage,
  type CatalogItem,
  type ResearchSourceType,
} from "../lib/legal-research";
import { useOrgContext } from "../lib/use-org-context";

type Fetcher = (
  orgId: string,
  query: { q?: string; court?: string; limit?: number },
) => Promise<{ items: CatalogItem[]; total: number } | AiApiFailure>;

export function ResearchCatalogPage({
  title,
  description,
  sourceType,
  href,
  emptyTitle,
  emptyDescription,
  fetchItems,
  showCourtFilter = false,
}: {
  title: string;
  description: string;
  sourceType: ResearchSourceType;
  href: string;
  emptyTitle: string;
  emptyDescription: string;
  fetchItems: Fetcher;
  showCourtFilter?: boolean;
}) {
  const org = useOrgContext();
  const canRead = hasResearchPermission(org.permissions, "read");
  const canCite = hasCitationPermission(org.permissions, "create");

  const [q, setQ] = useState("");
  const [court, setCourt] = useState("");
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [citingId, setCitingId] = useState<string | null>(null);
  const [citeMsg, setCiteMsg] = useState<string | null>(null);

  const load = useCallback(
    async (orgId: string, filters: { q: string; court: string }) => {
      setLoading(true);
      setError(null);
      const data = await fetchItems(orgId, {
        q: filters.q.trim() || undefined,
        court: filters.court.trim() || undefined,
        limit: 50,
      });
      if (isApiFailure(data)) {
        setError(researchErrorMessage(data, "Não foi possível carregar o catálogo."));
        setItems([]);
      } else {
        setItems(data.items);
        setTotal(data.total);
      }
      setLoading(false);
    },
    [fetchItems],
  );

  useEffect(() => {
    if (!org.ready) return;
    if (!org.orgId || !canRead) {
      setLoading(false);
      return;
    }
    void load(org.orgId, { q: "", court: "" });
  }, [org.ready, org.orgId, canRead, load]);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Pesquisa jurídica", href: "/app/pesquisa" },
    { label: title },
  ];

  async function onCite(item: CatalogItem) {
    if (!org.orgId || !canCite) return;
    setCitingId(item.id);
    setCiteMsg(null);
    const data = await createCitation(org.orgId, {
      sourceType: sourceType as
        | "legislation"
        | "case_law"
        | "summary"
        | "theme"
        | "precedent"
        | "doctrine"
        | "internal_document",
      sourceId: item.id,
      title: catalogTitle(item, sourceType),
      sourceUrl: item.sourceUrl ?? undefined,
      court: item.court ?? undefined,
      caseNumber: item.caseNumber ?? undefined,
      excerpt:
        (item.headnote as string | undefined) ??
        (item.text as string | undefined) ??
        (item.thesis as string | undefined) ??
        undefined,
    });
    if (isCitationFailure(data)) {
      setCiteMsg(researchErrorMessage(data, "Não foi possível gerar a citação."));
    } else {
      setCiteMsg(
        `Citação gerada — ${data.citation.verificationStatus.replaceAll("_", " ")}. Texto copiado quando permitido pelo navegador.`,
      );
      if (typeof navigator !== "undefined" && data.citation.copyText) {
        void navigator.clipboard?.writeText(data.citation.copyText).catch(() => undefined);
      }
    }
    setCitingId(null);
  }

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar este catálogo.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader title={title} description={description} />
      <SectionTabs label="Seções de pesquisa" items={RESEARCH_TABS} current={href} />

      <form
        className="vj-card vj-stack"
        aria-label={`Filtros de ${title.toLowerCase()}`}
        onSubmit={(event) => {
          event.preventDefault();
          if (org.orgId) void load(org.orgId, { q, court });
        }}
      >
        <FormField id={`${sourceType}-q`} label="Busca">
          <Input
            id={`${sourceType}-q`}
            value={q}
            onChange={(event) => setQ(event.target.value)}
            autoComplete="off"
            placeholder="Termo no catálogo"
          />
        </FormField>
        {showCourtFilter ? (
          <FormField id={`${sourceType}-court`} label="Tribunal / órgão">
            <Input
              id={`${sourceType}-court`}
              value={court}
              onChange={(event) => setCourt(event.target.value)}
              autoComplete="off"
            />
          </FormField>
        ) : null}
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>

      {citeMsg ? (
        <Alert tone="info" title="Citação">
          {citeMsg}
        </Alert>
      ) : null}
      {loading || !org.ready ? <LoadingState label="Carregando catálogo" /> : null}
      {error ? <ErrorState title="Erro ao carregar">{error}</ErrorState> : null}

      {!loading && !error && items.length === 0 ? (
        <EmptyState title={emptyTitle}>{emptyDescription}</EmptyState>
      ) : null}

      {!loading && items.length > 0 ? (
        <>
          <p className="vj-meta">
            FONTE · {total} registro(s) reais no catálogo. Selos de verificação nunca afirmam
            oficialidade sem prova.
          </p>
          <CatalogResultList
            items={items}
            sourceType={sourceType}
            emptyLabel={emptyDescription}
            canCite={canCite}
            citingId={citingId}
            onCite={(item) => void onCite(item)}
            caption={`Resultados de ${title}`}
          />
        </>
      ) : null}
    </div>
  );
}
