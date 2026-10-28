import { Alert, Badge } from "@verasjuris/ui";
import {
  COMMUNICATION_CATEGORY_LABELS,
  COMMUNICATION_CHANNEL_LABELS,
  COMMUNICATION_MESSAGE_STATUS_LABELS,
  COMMUNICATION_NOT_CONFIGURED_MESSAGE,
  formatDateTime,
  isChannelNotConfigured,
  type ChannelHealth,
  type CommunicationMessage,
  type CommunicationProvidersStatus,
  type CommunicationTemplate,
} from "../lib/communication";

export const COMUNICACAO_TABS = [
  { href: "/app/comunicacao", label: "Visão geral" },
  { href: "/app/comunicacao/templates", label: "Modelos" },
  { href: "/app/comunicacao/historico", label: "Histórico" },
  { href: "/app/comunicacao/preferencias", label: "Preferências" },
];

type Tone = "neutral" | "success" | "warning" | "error";

function statusTone(status: string): Tone {
  if (status === "sent" || status === "delivered") return "success";
  if (status === "queued" || status === "sending" || status === "draft") return "warning";
  if (status === "failed" || status === "not_configured") return "error";
  return "neutral";
}

export function CommunicationProvidersBanner({
  status,
}: {
  status: CommunicationProvidersStatus | null;
}) {
  if (!status) return null;
  const channels: Array<{ key: keyof CommunicationProvidersStatus; label: string }> = [
    { key: "email", label: "E-mail" },
    { key: "sms", label: "SMS" },
    { key: "whatsapp", label: "WhatsApp" },
    { key: "push", label: "Push" },
  ];
  const notConfigured = channels.filter((c) =>
    isChannelNotConfigured(status[c.key] as ChannelHealth),
  );
  if (notConfigured.length === 0) return null;
  return (
    <Alert tone="warning" title="Canais de comunicação">
      {COMMUNICATION_NOT_CONFIGURED_MESSAGE}
      <ul className="vj-stack" style={{ marginTop: "0.5rem" }}>
        {notConfigured.map((c) => (
          <li key={c.key}>
            {c.label}: NOT_CONFIGURED ({(status[c.key] as ChannelHealth)?.status ?? "desconhecido"})
          </li>
        ))}
      </ul>
    </Alert>
  );
}

export function CommunicationMessagesTable({
  items,
  caption,
}: {
  items: CommunicationMessage[];
  caption: string;
}) {
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Canal</th>
            <th scope="col">Categoria</th>
            <th scope="col">Situação</th>
            <th scope="col">Destinatário</th>
            <th scope="col">Criada</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{COMMUNICATION_CHANNEL_LABELS[item.channel] ?? item.channel}</td>
              <td>{COMMUNICATION_CATEGORY_LABELS[item.category] ?? item.category}</td>
              <td>
                <Badge tone={statusTone(item.status)}>
                  {COMMUNICATION_MESSAGE_STATUS_LABELS[item.status] ?? item.status}
                </Badge>
              </td>
              <td>
                <span className="vj-meta">
                  {item.recipientType} · {item.recipientId.slice(0, 8)}…
                </span>
              </td>
              <td>{formatDateTime(item.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CommunicationTemplatesTable({
  items,
  caption,
}: {
  items: CommunicationTemplate[];
  caption: string;
}) {
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Nome</th>
            <th scope="col">Chave</th>
            <th scope="col">Canal</th>
            <th scope="col">Ativo</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>{item.key}</td>
              <td>{COMMUNICATION_CHANNEL_LABELS[item.channel] ?? item.channel}</td>
              <td>{item.active ? "Sim" : "Não"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
