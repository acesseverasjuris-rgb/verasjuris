"use client";

import {
  Alert,
  Breadcrumb,
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  PageHeader,
  Select,
  Textarea,
} from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, NotConfiguredNotice, SectionTabs } from "../../../components/ai-ui";
import { RESEARCH_TABS, ResearchHitCard, SourceOriginBadge } from "../../../components/research-ui";
import {
  createCitation,
  hasCitationPermission,
  isApiFailure as isCitationFailure,
} from "../../../lib/citations";
import {
  executeResearch,
  fetchResearchProviderStatus,
  fetchSavedResearchList,
  hasResearchPermission,
  isApiFailure,
  RESEARCH_PROVIDER_NOT_CONFIGURED_MESSAGE,
  RESEARCH_SOURCE_TYPE_LABELS,
  researchErrorMessage,
  saveResearch,
  type ExecuteResearchResult,
  type ResearchHit,
  type ResearchProviderStatus,
  type ResearchSourceType,
  type SavedResearch,
} from "../../../lib/legal-research";
import { useOrgContext } from "../../../lib/use-org-context";

export default function PesquisaHubPage() {
  const org = useOrgContext();
  const canRead = hasResearchPermission(org.permissions, "read");
  const canExecute = hasResearchPermission(org.permissions, "execute");
  const canSave = hasResearchPermission(org.permissions, "save");
  const canCite = hasCitationPermission(org.permissions, "create");

  const [query, setQuery] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [provider, setProvider] = useState<ResearchProviderStatus | null>(null);
  const [result, setResult] = useState<ExecuteResearchResult | null>(null);
  const [saved, setSaved] = useState<SavedResearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const [saveNotes, setSaveNotes] = useState("");
  const [citingId, setCitingId] = useState<string | null>(null);
  const [citeMsg, setCiteMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!org.ready) return;
    if (!org.orgId || !canRead) {
      setLoading(false);
      return;
    }
    const orgId = org.orgId;
    let cancelled = false;
    void (async () => {
      const [statusData, savedData] = await Promise.all([
        fetchResearchProviderStatus(orgId),
        fetchSavedResearchList(orgId, { limit: 10 }),
      ]);
      if (cancelled) return;
      if (!isApiFailure(statusData)) setProvider(statusData);
      if (!isApiFailure(savedData)) setSaved(savedData.items);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, canRead]);

  const breadcrumb = [{ label: "Painel", href: "/app" }, { label: "Pesquisa jurídica" }];

  async function onSearch(event: React.FormEvent) {
    event.preventDefault();
    if (!org.orgId || !canExecute) return;
    const trimmed = query.trim();
    if (trimmed.length < 1) {
      setError("Informe um termo de pesquisa.");
      return;
    }
    setSearching(true);
    setError(null);
    setNotice(null);
    setCiteMsg(null);
    const data = await executeResearch(org.orgId, {
      query: trimmed,
      sourceTypes: sourceType ? [sourceType as ResearchSourceType] : undefined,
      filters: sourceType ? { sourceType: sourceType as ResearchSourceType } : undefined,
    });
    if (isApiFailure(data)) {
      setError(researchErrorMessage(data, "Não foi possível executar a pesquisa."));
      setResult(null);
    } else {
      setResult(data);
      if (data.status === "not_configured" || data.message) {
        setNotice(data.message ?? RESEARCH_PROVIDER_NOT_CONFIGURED_MESSAGE);
      }
    }
    setSearching(false);
  }

  async function onCite(hit: ResearchHit) {
    if (!org.orgId || !canCite) return;
    setCitingId(hit.sourceId);
    setCiteMsg(null);
    const data = await createCitation(org.orgId, {
      sourceType: hit.sourceType as
        | "legislation"
        | "case_law"
        | "summary"
        | "theme"
        | "precedent"
        | "doctrine"
        | "internal_document",
      sourceId: hit.sourceId,
      title: hit.title,
      sourceUrl: hit.sourceUrl ?? undefined,
      excerpt: hit.excerpt ?? undefined,
    });
    if (isCitationFailure(data)) {
      setCiteMsg(researchErrorMessage(data, "Não foi possível gerar a citação."));
    } else {
      setCiteMsg(
        `Citação gerada (${data.citation.verificationStatus.replaceAll("_", " ")}). Texto pronto para copiar.`,
      );
      if (typeof navigator !== "undefined" && data.citation.copyText) {
        void navigator.clipboard?.writeText(data.citation.copyText).catch(() => undefined);
      }
    }
    setCitingId(null);
  }

  async function onSave() {
    if (!org.orgId || !canSave || !result) return;
    if (saveName.trim().length < 2) {
      setError("Informe um nome para salvar a pesquisa.");
      return;
    }
    setSearching(true);
    const data = await saveResearch(org.orgId, {
      name: saveName.trim(),
      query: result.query.query,
      queryId: result.query.id,
      notes: saveNotes.trim() || undefined,
      selectedResultIds: result.results.map((hit) => hit.sourceId),
    });
    if (isApiFailure(data)) {
      setError(researchErrorMessage(data, "Não foi possível salvar a pesquisa."));
    } else {
      setSaved((prev) => [data.saved, ...prev]);
      setSaveName("");
      setSaveNotes("");
      setCiteMsg("Pesquisa salva.");
    }
    setSearching(false);
  }

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar pesquisa jurídica.</NoPermission>
      </div>
    );
  }

  const providerConfigured = provider?.status === "configured" || provider?.status === "ok";

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Pesquisa jurídica"
        description="Consulte o catálogo local e, quando configurado, fontes externas. Resultados trazem selo de verificação — nunca tratados como oficiais sem prova."
      />
      <SectionTabs label="Seções de pesquisa" items={RESEARCH_TABS} current="/app/pesquisa" />

      {loading || !org.ready ? <LoadingState label="Carregando pesquisa" /> : null}

      {provider && !providerConfigured ? (
        <NotConfiguredNotice message={RESEARCH_PROVIDER_NOT_CONFIGURED_MESSAGE}>
          O catálogo local da organização permanece disponível. Nenhum resultado fictício é exibido.
        </NotConfiguredNotice>
      ) : null}

      {providerConfigured ? (
        <Alert tone="info" title="FONTE · Provedor configurado">
          Provedor: {provider?.provider}. Catálogo local:{" "}
          {provider?.localCatalogAvailable ? "disponível" : "indisponível"}.
        </Alert>
      ) : null}

      <nav className="vj-card vj-stack" aria-label="Catálogos">
        <h2 className="vj-section-title">Catálogos</h2>
        <div className="vj-inline-actions">
          {RESEARCH_TABS.filter((tab) => tab.href !== "/app/pesquisa").map((tab) => (
            <ButtonLink key={tab.href} href={tab.href} variant="secondary">
              {tab.label}
            </ButtonLink>
          ))}
        </div>
      </nav>

      {canExecute ? (
        <form
          className="vj-card vj-stack"
          aria-label="Executar pesquisa"
          onSubmit={(e) => void onSearch(e)}
        >
          <h2 className="vj-section-title">Pesquisar</h2>
          <FormField id="pesquisa-q" label="Termo">
            <Input
              id="pesquisa-q"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Assunto, número, ementa…"
              autoComplete="off"
              required
            />
          </FormField>
          <FormField id="pesquisa-tipo" label="Tipo de fonte (opcional)">
            <Select
              id="pesquisa-tipo"
              value={sourceType}
              onChange={(event) => setSourceType(event.target.value)}
            >
              <option value="">Todos os tipos disponíveis</option>
              {Object.entries(RESEARCH_SOURCE_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
          <Button type="submit" disabled={searching}>
            {searching ? "Pesquisando…" : "Executar pesquisa"}
          </Button>
        </form>
      ) : (
        <Alert tone="info" title="Somente leitura">
          Você pode consultar catálogos, mas não executar novas pesquisas.
        </Alert>
      )}

      {error ? <ErrorState title="Pesquisa">{error}</ErrorState> : null}
      {notice ? (
        <Alert tone="info" title="Aviso do provedor">
          {notice}
        </Alert>
      ) : null}
      {citeMsg ? (
        <Alert tone="success" title="Atualização">
          {citeMsg}
        </Alert>
      ) : null}

      {result ? (
        <section className="vj-stack" aria-labelledby="pesquisa-resultados">
          <div className="vj-header-actions">
            <h2 id="pesquisa-resultados" className="vj-section-title">
              Resultados
            </h2>
            <SourceOriginBadge provider={result.provider} />
          </div>
          {result.results.length === 0 ? (
            <EmptyState title="Nenhum resultado">
              Nada encontrado no catálogo local para este termo. Nenhum dado de exemplo é inventado.
            </EmptyState>
          ) : (
            <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {result.results.map((hit) => (
                <li key={`${hit.sourceType}-${hit.sourceId}`}>
                  <ResearchHitCard
                    hit={hit}
                    canCite={canCite}
                    citing={citingId === hit.sourceId}
                    onCite={() => void onCite(hit)}
                  />
                </li>
              ))}
            </ul>
          )}

          {canSave && result.results.length > 0 ? (
            <div className="vj-card vj-stack">
              <h3 className="vj-section-title">AÇÃO · Salvar pesquisa</h3>
              <FormField id="save-name" label="Nome">
                <Input
                  id="save-name"
                  value={saveName}
                  onChange={(event) => setSaveName(event.target.value)}
                  autoComplete="off"
                />
              </FormField>
              <FormField id="save-notes" label="Notas (opcional)">
                <Textarea
                  id="save-notes"
                  value={saveNotes}
                  onChange={(event) => setSaveNotes(event.target.value)}
                  rows={2}
                />
              </FormField>
              <Button
                type="button"
                variant="secondary"
                disabled={searching}
                onClick={() => void onSave()}
              >
                Salvar pesquisa
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      {!loading && saved.length > 0 ? (
        <section className="vj-card vj-stack" aria-labelledby="pesquisas-salvas">
          <h2 id="pesquisas-salvas" className="vj-section-title">
            Pesquisas salvas
          </h2>
          <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {saved.map((item) => (
              <li key={item.id} className="vj-inline-actions">
                <strong>{item.name}</strong>
                <span className="vj-meta">{item.query}</span>
                {item.legalMatterId ? (
                  <a href={`/app/casos/${item.legalMatterId}`}>Ver caso</a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
