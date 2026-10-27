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
} from "@verasjuris/ui";
import { useCallback, useEffect, useState } from "react";
import { NoPermission, SectionTabs, OPPORTUNITY_TABS } from "../../../components/ai-ui";
import { OpportunityTable } from "../../../components/opportunity-ui";
import { aiErrorMessage } from "../../../lib/ai";
import {
  BR_STATES,
  fetchOpportunities,
  hasOpportunityPermission,
  isApiFailure,
  OPPORTUNITY_SOURCE_LABELS,
  OPPORTUNITY_STATUS_LABELS,
  OPPORTUNITY_TYPE_LABELS,
  type PublicOpportunitySummary,
} from "../../../lib/public-opportunities";
import { useOrgContext } from "../../../lib/use-org-context";

type Filters = {
  q: string;
  type: string;
  status: string;
  stateCode: string;
  source: string;
  deadlineFrom: string;
  deadlineTo: string;
};

const EMPTY_FILTERS: Filters = {
  q: "",
  type: "",
  status: "",
  stateCode: "",
  source: "",
  deadlineFrom: "",
  deadlineTo: "",
};

export default function OportunidadesPublicasPage() {
  const org = useOrgContext();
  const canRead = hasOpportunityPermission(org.permissions, "read");
  const canCreate = hasOpportunityPermission(org.permissions, "create");

  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [source, setSource] = useState("");
  const [deadlineFrom, setDeadlineFrom] = useState("");
  const [deadlineTo, setDeadlineTo] = useState("");

  const [items, setItems] = useState<PublicOpportunitySummary[]>([]);
  const [total, setTotal] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (orgId: string, f: Filters) => {
    setLoading(true);
    setError(null);
    const data = await fetchOpportunities(orgId, {
      q: f.q.trim() || undefined,
      opportunityType: f.type || undefined,
      status: f.status || undefined,
      stateCode: f.stateCode || undefined,
      sourceProvider: f.source || undefined,
      deadlineFrom: f.deadlineFrom
        ? new Date(`${f.deadlineFrom}T00:00:00`).toISOString()
        : undefined,
      deadlineTo: f.deadlineTo ? new Date(`${f.deadlineTo}T23:59:59`).toISOString() : undefined,
      limit: 50,
    });
    if (isApiFailure(data)) {
      setError(aiErrorMessage(data, "Não foi possível listar as oportunidades."));
      setItems([]);
    } else {
      setItems(data.items);
      setTotal(data.total);
      setNotice(data.providerNotice);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!org.ready) return;
    if (!org.orgId || !canRead) {
      setLoading(false);
      return;
    }
    void load(org.orgId, EMPTY_FILTERS);
  }, [org.ready, org.orgId, canRead, load]);

  const breadcrumb = [{ label: "Painel", href: "/app" }, { label: "Oportunidades públicas" }];

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar oportunidades públicas.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Oportunidades públicas"
        description="Licitações, chamamentos e credenciamentos acompanhados pela organização. Os registros são cadastrados manualmente; confira sempre o edital na fonte original."
        actions={
          canCreate ? (
            <ButtonLink href="/app/oportunidades-publicas/nova">Cadastrar oportunidade</ButtonLink>
          ) : undefined
        }
      />
      <SectionTabs
        label="Seções de oportunidades"
        items={OPPORTUNITY_TABS}
        current="/app/oportunidades-publicas"
      />

      <form
        className="vj-card vj-stack"
        aria-label="Filtros de oportunidades"
        onSubmit={(event) => {
          event.preventDefault();
          if (org.orgId) {
            void load(org.orgId, { q, type, status, stateCode, source, deadlineFrom, deadlineTo });
          }
        }}
      >
        <FormField id="op-q" label="Busca">
          <Input
            id="op-q"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Título, objeto ou número do processo"
            autoComplete="off"
          />
        </FormField>
        <div className="vj-split">
          <FormField id="op-type" label="Tipo">
            <Select id="op-type" value={type} onChange={(event) => setType(event.target.value)}>
              <option value="">Todos</option>
              {Object.entries(OPPORTUNITY_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="op-status" label="Situação">
            <Select
              id="op-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Todas</option>
              {Object.entries(OPPORTUNITY_STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <div className="vj-split">
          <FormField id="op-state" label="UF">
            <Select
              id="op-state"
              value={stateCode}
              onChange={(event) => setStateCode(event.target.value)}
            >
              <option value="">Todas</option>
              {BR_STATES.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="op-source" label="Origem do cadastro">
            <Select
              id="op-source"
              value={source}
              onChange={(event) => setSource(event.target.value)}
            >
              <option value="">Todas</option>
              {Object.entries(OPPORTUNITY_SOURCE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <div className="vj-split">
          <FormField id="op-from" label="Prazo de proposta a partir de">
            <Input
              id="op-from"
              type="date"
              value={deadlineFrom}
              onChange={(event) => setDeadlineFrom(event.target.value)}
            />
          </FormField>
          <FormField id="op-to" label="Prazo de proposta até">
            <Input
              id="op-to"
              type="date"
              value={deadlineTo}
              onChange={(event) => setDeadlineTo(event.target.value)}
            />
          </FormField>
        </div>
        <div className="vj-form-actions">
          <Button type="submit" disabled={loading}>
            Filtrar
          </Button>
        </div>
      </form>

      {notice ? (
        <Alert tone="info" title="Fonte externa">
          {notice}
        </Alert>
      ) : null}
      {loading ? <LoadingState label="Carregando oportunidades" /> : null}
      {error ? <ErrorState title="Erro ao carregar oportunidades">{error}</ErrorState> : null}

      {!loading && !error && items.length === 0 ? (
        <EmptyState
          title="Nenhuma oportunidade cadastrada."
          action={
            canCreate ? (
              <ButtonLink href="/app/oportunidades-publicas/nova" variant="secondary">
                Cadastrar manualmente
              </ButtonLink>
            ) : undefined
          }
        >
          Não há integração com fontes externas neste ambiente. Cadastre uma oportunidade
          manualmente ou ajuste os filtros.
        </EmptyState>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <>
          <p className="vj-meta" aria-live="polite">
            {total} oportunidade{total === 1 ? "" : "s"}
          </p>
          <OpportunityTable items={items} caption="Oportunidades públicas" />
        </>
      ) : null}
    </div>
  );
}
