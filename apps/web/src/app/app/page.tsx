import { SESSION_COOKIE } from "@verasjuris/security/constants";
import { Alert, Breadcrumb, EmptyState, PageHeader } from "@verasjuris/ui";
import { cookies } from "next/headers";
import { CreateOrganizationForm } from "../../components/organization-forms";
import { activeOrganizationId, getSession } from "../../lib/session";
import { actionLabel, apiInternalUrl } from "../../lib/types";

export const dynamic = "force-dynamic";

type AccountEvent = { id: string; occurredAt: string; action: string };

async function fetchJson<T>(path: string, token: string): Promise<T | null> {
  const response = await fetch(`${apiInternalUrl()}${path}`, {
    headers: { cookie: `${SESSION_COOKIE}=${token}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as T;
}

export default async function DashboardPage() {
  const session = await getSession();
  if (session.state !== "authenticated") return null;
  const activeId = await activeOrganizationId(session.account);
  const organization =
    session.account.memberships.find((item) => item.organizationId === activeId) ?? null;
  const permissions = new Set(organization?.permissions ?? []);
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  let events: AccountEvent[] = [];
  let taskTotal: number | null = null;
  let calendarUpcoming: number | null = null;
  let deadlineSuggested: number | null = null;
  let deadlineConfirmed: number | null = null;

  if (token) {
    const audit = await fetchJson<{ events: AccountEvent[] }>("/v1/account/audit", token);
    events = audit?.events ?? [];
    if (organization) {
      if (permissions.has("task.read")) {
        const tasks = await fetchJson<{ total: number }>(
          `/v1/organizations/${organization.organizationId}/tasks/overview`,
          token,
        );
        if (tasks) taskTotal = tasks.total;
      }
      if (permissions.has("calendar.read")) {
        const calendar = await fetchJson<{ upcomingWeek: number }>(
          `/v1/organizations/${organization.organizationId}/calendar/overview`,
          token,
        );
        if (calendar) calendarUpcoming = calendar.upcomingWeek;
      }
      if (permissions.has("deadline.read")) {
        const deadlines = await fetchJson<{ suggested: number; confirmed: number }>(
          `/v1/organizations/${organization.organizationId}/deadlines/overview`,
          token,
        );
        if (deadlines) {
          deadlineSuggested = deadlines.suggested;
          deadlineConfirmed = deadlines.confirmed;
        }
      }
    }
  }

  const verification =
    session.account.professionalVerificationStatus === "not_submitted"
      ? "Verificação profissional não enviada. Nesta versão não há envio de documentos nem validação de inscrição."
      : `Situação da verificação: ${session.account.professionalVerificationStatus}.`;

  const hasProductivity =
    taskTotal !== null || calendarUpcoming !== null || deadlineSuggested !== null;

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Painel" }]} />
      <PageHeader
        eyebrow={organization ? organization.organizationName : "Conta sem organização"}
        title="Painel"
        description="Contagens reais da organização ativa. Sem indicadores inventados."
      />
      {organization ? (
        <section className="vj-card">
          <h2 className="vj-section-title">Contexto ativo</h2>
          <p>
            {organization.organizationName}
            <span className="vj-technical"> · {organization.organizationSlug}</span>
          </p>
          <p>{verification}</p>
        </section>
      ) : (
        <EmptyState title="Nenhuma organização ativa">
          Sua conta está pronta. Crie uma organização para definir o contexto de trabalho.
          <CreateOrganizationForm />
        </EmptyState>
      )}
      {organization && hasProductivity ? (
        <section className="vj-card">
          <h2 className="vj-section-title">Produtividade</h2>
          <Alert tone="info" title="Escopo">
            Contagens vindas da API. Agenda sem sync Google/Outlook. Prazos sugeridos ≠ confirmados.
            Feriados NOT_CONFIGURED.
          </Alert>
          <ul>
            {taskTotal !== null ? (
              <li>
                Tarefas: <strong>{taskTotal}</strong>
              </li>
            ) : null}
            {calendarUpcoming !== null ? (
              <li>
                Compromissos (7 dias): <strong>{calendarUpcoming}</strong>
              </li>
            ) : null}
            {deadlineSuggested !== null ? (
              <li>
                Prazos sugeridos: <strong>{deadlineSuggested}</strong>
              </li>
            ) : null}
            {deadlineConfirmed !== null ? (
              <li>
                Prazos confirmados: <strong>{deadlineConfirmed}</strong>
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}
      <section className="vj-card">
        <h2 className="vj-section-title">Registros da sua conta</h2>
        {events.length === 0 ? (
          <p>Ainda não há registros de conta para mostrar.</p>
        ) : (
          <ul>
            {events.map((event) => (
              <li key={event.id}>
                {actionLabel(event.action)}
                <span className="vj-meta">
                  {" "}
                  · {new Date(event.occurredAt).toLocaleString("pt-BR")} ·{" "}
                </span>
                <span className="vj-technical">{event.action}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
