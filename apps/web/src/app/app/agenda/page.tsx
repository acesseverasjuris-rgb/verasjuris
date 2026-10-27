"use client";

import {
  Alert,
  Badge,
  Breadcrumb,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  PageHeader,
  Select,
} from "@verasjuris/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  apiErrorMessage,
  createCalendarEvent,
  fetchCalendarEvents,
  getActiveMembership,
  getActiveOrgId,
  hasPermission,
  isApiFailure,
  type CalendarEvent,
} from "../../../lib/productivity";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default function AgendaPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [canRead, setCanRead] = useState(true);
  const [canCreate, setCanCreate] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [view, setView] = useState<"day" | "week" | "month" | "list">("week");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncNote, setSyncNote] = useState("NOT_CONFIGURED");
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [conflict, setConflict] = useState<string | null>(null);

  const range = useMemo(() => {
    const now = startOfDay(new Date());
    if (view === "day") {
      const to = new Date(now);
      to.setDate(to.getDate() + 1);
      return { from: now.toISOString(), to: to.toISOString() };
    }
    if (view === "week") {
      const to = new Date(now);
      to.setDate(to.getDate() + 7);
      return { from: now.toISOString(), to: to.toISOString() };
    }
    if (view === "month") {
      const to = new Date(now);
      to.setMonth(to.getMonth() + 1);
      return { from: now.toISOString(), to: to.toISOString() };
    }
    return { from: undefined, to: undefined };
  }, [view]);

  const load = useCallback(
    async (activeId: string) => {
      setLoading(true);
      setError(null);
      const data = await fetchCalendarEvents(activeId, {
        from: range.from,
        to: range.to,
        limit: 200,
      });
      if (isApiFailure(data)) {
        setError(apiErrorMessage(data, "Não foi possível carregar a agenda."));
        setLoading(false);
        return;
      }
      setEvents(data.events);
      setSyncNote(data.externalSync);
      setLoading(false);
    },
    [range.from, range.to],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [activeId, membership] = await Promise.all([getActiveOrgId(), getActiveMembership()]);
      if (cancelled) return;
      if (!activeId) {
        setError("Nenhuma organização ativa.");
        setLoading(false);
        return;
      }
      setCanRead(hasPermission(membership?.permissions, "calendar.read"));
      setCanCreate(hasPermission(membership?.permissions, "calendar.create"));
      if (!hasPermission(membership?.permissions, "calendar.read")) {
        setLoading(false);
        return;
      }
      setOrgId(activeId);
      await load(activeId);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function onCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!orgId) return;
    setConflict(null);
    const result = await createCalendarEvent(orgId, {
      title,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      timezone: "America/Sao_Paulo",
    });
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível criar o compromisso."));
      return;
    }
    setConflict(result.conflictWarning);
    setTitle("");
    await load(orgId);
  }

  if (!canRead) {
    return (
      <EmptyState title="Sem permissão">Você não tem permissão para consultar a agenda.</EmptyState>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Painel", href: "/app" }, { label: "Agenda" }]} />
      <PageHeader
        title="Agenda"
        description="Compromissos internos. Fuso IANA (padrão America/Sao_Paulo)."
      />
      <Alert tone="info" title="Sincronização externa">
        Google Calendar / Outlook: {syncNote}. Não há sincronização fake nesta versão.
      </Alert>
      <FormField id="view" label="Visualização">
        <Select id="view" value={view} onChange={(e) => setView(e.target.value as typeof view)}>
          <option value="day">Dia</option>
          <option value="week">Semana</option>
          <option value="month">Mês</option>
          <option value="list">Lista</option>
        </Select>
      </FormField>
      {loading ? <LoadingState label="Carregando agenda…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error && events.length === 0 ? (
        <EmptyState title="Nenhum compromisso neste período">
          Crie um compromisso ou altere a visualização.
        </EmptyState>
      ) : null}
      <ul className="vj-list">
        {events.map((ev) => (
          <li key={ev.id}>
            <strong>{ev.title}</strong> <Badge>{ev.status}</Badge>
            <span className="vj-meta">
              {" "}
              · {new Date(ev.startsAt).toLocaleString("pt-BR")} ({ev.timezone})
            </span>
          </li>
        ))}
      </ul>
      {canCreate ? (
        <section className="vj-stack">
          <h2 className="vj-section-title">Novo compromisso</h2>
          {conflict ? (
            <Alert tone="warning" title="Conflito de horário">
              {conflict}
            </Alert>
          ) : null}
          <form className="vj-stack" onSubmit={(e) => void onCreate(e)}>
            <FormField id="title" label="Título">
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </FormField>
            <FormField id="starts" label="Início">
              <Input
                id="starts"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                required
              />
            </FormField>
            <FormField id="ends" label="Término">
              <Input
                id="ends"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                required
              />
            </FormField>
            <button type="submit" className="vj-button">
              Criar
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
