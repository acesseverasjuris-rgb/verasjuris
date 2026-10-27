"use client";

import {
  Alert,
  Badge,
  Breadcrumb,
  ButtonLink,
  EmptyState,
  ErrorState,
  FormField,
  LoadingState,
  PageHeader,
  Select,
} from "@verasjuris/ui";
import { useCallback, useEffect, useState } from "react";
import {
  apiErrorMessage,
  fetchDeadlines,
  getActiveMembership,
  getActiveOrgId,
  hasPermission,
  isApiFailure,
  type DeadlineSummary,
} from "../../../lib/productivity";

export default function PrazosPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [canRead, setCanRead] = useState(true);
  const [canCreate, setCanCreate] = useState(false);
  const [items, setItems] = useState<DeadlineSummary[]>([]);
  const [status, setStatus] = useState("");
  const [holiday, setHoliday] = useState("NOT_CONFIGURED");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (activeId: string) => {
      setLoading(true);
      const data = await fetchDeadlines(activeId, { status: status || undefined, limit: 100 });
      if (isApiFailure(data)) {
        setError(apiErrorMessage(data, "Não foi possível listar os prazos."));
        setLoading(false);
        return;
      }
      setItems(data.deadlines);
      setHoliday(data.holidayCalendar);
      setLoading(false);
    },
    [status],
  );

  useEffect(() => {
    void (async () => {
      const [activeId, membership] = await Promise.all([getActiveOrgId(), getActiveMembership()]);
      if (!activeId) {
        setError("Nenhuma organização ativa.");
        setLoading(false);
        return;
      }
      setCanRead(hasPermission(membership?.permissions, "deadline.read"));
      setCanCreate(hasPermission(membership?.permissions, "deadline.create"));
      if (!hasPermission(membership?.permissions, "deadline.read")) {
        setLoading(false);
        return;
      }
      setOrgId(activeId);
      await load(activeId);
    })();
  }, [load]);

  if (!canRead) {
    return <EmptyState title="Sem permissão">Sem acesso a prazos.</EmptyState>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Painel", href: "/app" }, { label: "Prazos" }]} />
      <PageHeader
        title="Prazos"
        description="Prazos jurídicos/operacionais centrais. Distintos de tarefas e de SLA."
        actions={
          canCreate ? <ButtonLink href="/app/prazos/novo">Novo prazo</ButtonLink> : undefined
        }
      />
      <Alert tone="info" title="Sugerido × confirmado">
        Prazos calculados entram como sugeridos. Só trate como definitivo após confirmação humana.
        Calendário de feriados: {holiday}.
      </Alert>
      <form
        className="vj-inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (orgId) void load(orgId);
        }}
      >
        <FormField id="status" label="Status">
          <Select id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos</option>
            <option value="suggested">Sugerido</option>
            <option value="pending_confirmation">Pendente de confirmação</option>
            <option value="confirmed">Confirmado</option>
            <option value="completed">Concluído</option>
            <option value="cancelled">Cancelado</option>
          </Select>
        </FormField>
        <button type="submit" className="vj-button vj-button-secondary">
          Filtrar
        </button>
      </form>
      {loading ? <LoadingState label="Carregando prazos…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && items.length === 0 ? (
        <EmptyState title="Nenhum prazo">Ainda não há prazos neste filtro.</EmptyState>
      ) : null}
      <ul className="vj-list">
        {items.map((d) => (
          <li key={d.id}>
            <a href={`/app/prazos/${d.id}`}>
              <strong>{d.title}</strong>
            </a>{" "}
            <Badge>{d.status}</Badge>
            <span className="vj-meta">
              {" "}
              ·{" "}
              {d.confirmedDueAt
                ? `confirmado ${new Date(d.confirmedDueAt).toLocaleDateString("pt-BR")}`
                : d.calculatedDueAt
                  ? `sugerido ${new Date(d.calculatedDueAt).toLocaleDateString("pt-BR")}`
                  : "sem data"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
