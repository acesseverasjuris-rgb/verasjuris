import { Alert, Badge } from "@verasjuris/ui";
import {
  formatDateTime,
  PORTAL_ACCESS_DENIED_MESSAGE,
  PORTAL_MATTER_STATUS_LABELS,
  PORTAL_REQUEST_STATUS_LABELS,
  PORTAL_THREAD_STATUS_LABELS,
  type PortalClientRequest,
  type PortalContract,
  type PortalDocument,
  type PortalMatterSummary,
  type PortalMessage,
  type PortalPayment,
  type PortalThread,
} from "../lib/client-portal";
import { formatMoneyCents } from "../lib/auctions";

export const PORTAL_NAV = [
  { href: "/portal", label: "Painel" },
  { href: "/portal/casos", label: "Casos" },
  { href: "/portal/documentos", label: "Documentos" },
  { href: "/portal/mensagens", label: "Mensagens" },
  { href: "/portal/contratos", label: "Contratos" },
  { href: "/portal/pagamentos", label: "Pagamentos" },
  { href: "/portal/solicitacoes", label: "Solicitações" },
  { href: "/portal/agenda", label: "Agenda" },
  { href: "/portal/notificacoes", label: "Notificações" },
  { href: "/portal/advogado-online", label: "Advogado Online" },
  { href: "/portal/perfil", label: "Perfil" },
] as const;

type Tone = "neutral" | "success" | "warning" | "error";

function statusTone(status: string): Tone {
  if (status === "resolved" || status === "signed" || status === "active" || status === "paid") {
    return "success";
  }
  if (
    status === "open" ||
    status === "pending" ||
    status === "waiting_client" ||
    status === "overdue"
  ) {
    return "warning";
  }
  if (status === "cancelled" || status === "failed") return "error";
  return "neutral";
}

export function PortalAccessDenied({ message }: { message?: string }) {
  return (
    <Alert tone="warning" title="Acesso ao portal">
      {message ?? PORTAL_ACCESS_DENIED_MESSAGE}
    </Alert>
  );
}

export function PortalDashboardCards({
  counts,
}: {
  counts: {
    caseCount: number;
    openRequests: number;
    openDocumentRequests: number;
    openThreads: number;
    pendingPayments: number;
  };
}) {
  const items = [
    { label: "Casos", value: counts.caseCount, href: "/portal/casos" },
    { label: "Solicitações abertas", value: counts.openRequests, href: "/portal/solicitacoes" },
    {
      label: "Pedidos de documento",
      value: counts.openDocumentRequests,
      href: "/portal/documentos",
    },
    { label: "Conversas abertas", value: counts.openThreads, href: "/portal/mensagens" },
    { label: "Pagamentos pendentes", value: counts.pendingPayments, href: "/portal/pagamentos" },
  ];
  return (
    <div
      className="vj-split"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 14rem), 1fr))" }}
    >
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          className="vj-card vj-stack"
          style={{ textDecoration: "none" }}
        >
          <h2 className="vj-section-title">{item.label}</h2>
          <p className="vj-title">{item.value}</p>
        </a>
      ))}
    </div>
  );
}

export function PortalCasesTable({ items }: { items: PortalMatterSummary[] }) {
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">Seus casos</caption>
        <thead>
          <tr>
            <th scope="col">Título</th>
            <th scope="col">Situação</th>
            <th scope="col">Atualizado</th>
            <th scope="col">Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.title}</td>
              <td>
                <Badge tone={statusTone(item.status)}>
                  {PORTAL_MATTER_STATUS_LABELS[item.status] ?? item.status}
                </Badge>
              </td>
              <td>{item.updatedAt ? formatDateTime(item.updatedAt) : "—"}</td>
              <td>
                <a href={`/portal/casos/${item.id}`}>Abrir</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PortalDocumentsList({ items }: { items: PortalDocument[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="vj-stack">
      {items.map((doc) => (
        <li key={doc.id} className="vj-card">
          <strong>{doc.title}</strong>{" "}
          <span className="vj-meta">{doc.documentKind ?? "documento"}</span>
        </li>
      ))}
    </ul>
  );
}

export function PortalContractsTable({ items }: { items: PortalContract[] }) {
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">Contratos visíveis</caption>
        <thead>
          <tr>
            <th scope="col">Título</th>
            <th scope="col">Tipo</th>
            <th scope="col">Situação</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id}>
              <td>{c.title}</td>
              <td>{c.contractType}</td>
              <td>
                <Badge tone={statusTone(c.status)}>{c.status}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PortalPaymentsTable({ items }: { items: PortalPayment[] }) {
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">Pagamentos</caption>
        <thead>
          <tr>
            <th scope="col">Descrição</th>
            <th scope="col">Valor</th>
            <th scope="col">Vencimento</th>
            <th scope="col">Situação</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id}>
              <td>{p.description}</td>
              <td>{formatMoneyCents(p.amountCents)}</td>
              <td>{p.dueAt ? formatDateTime(p.dueAt) : "—"}</td>
              <td>
                <Badge tone={statusTone(p.status)}>{p.status}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PortalRequestsTable({ items }: { items: PortalClientRequest[] }) {
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">Solicitações</caption>
        <thead>
          <tr>
            <th scope="col">Título</th>
            <th scope="col">Situação</th>
            <th scope="col">Criada em</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id}>
              <td>{r.title}</td>
              <td>
                <Badge tone={statusTone(r.status)}>
                  {PORTAL_REQUEST_STATUS_LABELS[r.status] ?? r.status}
                </Badge>
              </td>
              <td>{r.createdAt ? formatDateTime(r.createdAt) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PortalThreadList({
  threads,
  selectedId,
  onSelect,
}: {
  threads: PortalThread[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="vj-stack" role="listbox" aria-label="Conversas">
      {threads.map((thread) => {
        const selected = thread.id === selectedId;
        return (
          <div key={thread.id}>
            <button
              type="button"
              role="option"
              aria-selected={selected}
              className={`vj-card vj-stack ${selected ? "vj-card-highlight" : ""}`}
              style={{ width: "100%", textAlign: "left", cursor: "pointer" }}
              onClick={() => onSelect(thread.id)}
            >
              <strong>{thread.subject}</strong>
              <span className="vj-meta">
                {PORTAL_THREAD_STATUS_LABELS[thread.status] ?? thread.status}
                {thread.updatedAt ? ` · ${formatDateTime(thread.updatedAt)}` : ""}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function PortalMessageThread({ messages }: { messages: PortalMessage[] }) {
  return (
    <div
      className="vj-stack"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      aria-label="Mensagens da conversa"
      style={{ maxHeight: "24rem", overflowY: "auto" }}
    >
      {messages.map((message) => (
        <article
          key={message.id}
          className={`vj-card ${message.senderType === "client" ? "vj-message-own" : "vj-message-other"}`}
          aria-label={message.senderType === "client" ? "Sua mensagem" : "Mensagem do escritório"}
        >
          <p>{message.body}</p>
          {message.createdAt ? (
            <time className="vj-meta" dateTime={message.createdAt}>
              {formatDateTime(message.createdAt)}
            </time>
          ) : null}
        </article>
      ))}
    </div>
  );
}
