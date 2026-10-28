import { Alert, Badge } from "@verasjuris/ui";
import {
  formatDateTime,
  formatMoneyCents,
  isProviderNotConfigured,
  ONLINE_CONSULTATION_STATUS_LABELS,
  ONLINE_LAWYER_NOT_CONFIGURED_MESSAGE,
  ONLINE_MATCH_STATUS_LABELS,
  ONLINE_MODE_LABELS,
  ONLINE_REQUEST_STATUS_LABELS,
  ONLINE_URGENCY_LABELS,
  type LawyerAvailabilitySlot,
  type OnlineConsultation,
  type OnlineLawyerProvidersStatus,
  type OnlineLegalRequest,
  type OnlineMatchCandidate,
  type ProviderHealth,
} from "../lib/online-lawyer";

export const ADVOGADO_ONLINE_TABS = [
  { href: "/app/advogado-online", label: "Visão geral" },
  { href: "/app/advogado-online/solicitacoes", label: "Solicitações" },
  { href: "/app/advogado-online/consultas", label: "Consultas" },
  { href: "/app/advogado-online/disponibilidade", label: "Disponibilidade" },
];

type Tone = "neutral" | "success" | "warning" | "error";

function statusTone(status: string): Tone {
  if (
    status === "matched" ||
    status === "completed" ||
    status === "accepted" ||
    status === "paid_manual"
  ) {
    return "success";
  }
  if (
    status === "submitted" ||
    status === "matching" ||
    status === "awaiting_payment" ||
    status === "scheduled" ||
    status === "offered" ||
    status === "pending"
  ) {
    return "warning";
  }
  if (status === "cancelled" || status === "failed" || status === "declined") return "error";
  return "neutral";
}

export function OnlineLawyerProvidersBanner({
  status,
}: {
  status: OnlineLawyerProvidersStatus | null;
}) {
  if (!status) return null;
  const providers: Array<{ key: keyof OnlineLawyerProvidersStatus; label: string }> = [
    { key: "payment", label: "Pagamento" },
    { key: "video", label: "Vídeo" },
    { key: "oab", label: "OAB" },
    { key: "conflict", label: "Conflito" },
  ];
  const notConfigured = providers.filter((p) =>
    isProviderNotConfigured(status[p.key] as ProviderHealth),
  );
  if (notConfigured.length === 0) return null;
  return (
    <Alert tone="warning" title="Advogado Online">
      {ONLINE_LAWYER_NOT_CONFIGURED_MESSAGE}
      <ul className="vj-stack" style={{ marginTop: "0.5rem" }}>
        {notConfigured.map((p) => (
          <li key={p.key}>
            {p.label}: NOT_CONFIGURED ({(status[p.key] as ProviderHealth)?.status ?? "desconhecido"}
            )
          </li>
        ))}
      </ul>
    </Alert>
  );
}

export function OnlineRequestsTable({
  items,
  baseHref = "/app/advogado-online/solicitacoes",
}: {
  items: OnlineLegalRequest[];
  baseHref?: string;
}) {
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">Solicitações jurídicas online</caption>
        <thead>
          <tr>
            <th scope="col">UF</th>
            <th scope="col">Urgência</th>
            <th scope="col">Modo</th>
            <th scope="col">Situação</th>
            <th scope="col">Criada</th>
            <th scope="col">Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.stateCode}</td>
              <td>{ONLINE_URGENCY_LABELS[item.urgency] ?? item.urgency}</td>
              <td>{ONLINE_MODE_LABELS[item.preferredMode] ?? item.preferredMode}</td>
              <td>
                <Badge tone={statusTone(item.status)}>
                  {ONLINE_REQUEST_STATUS_LABELS[item.status] ?? item.status}
                </Badge>
              </td>
              <td>{formatDateTime(item.createdAt)}</td>
              <td>
                <a href={`${baseHref}/${item.id}`}>Abrir</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MatchCandidateCards({
  items,
  onAccept,
  onDecline,
  readOnly,
}: {
  items: OnlineMatchCandidate[];
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
  readOnly?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="vj-stack" aria-label="Candidatos de match">
      {items.map((match) => (
        <li key={match.id} className="vj-card vj-stack">
          <div className="vj-split" style={{ alignItems: "center" }}>
            <div>
              <strong>Advogado {match.lawyerProfileId.slice(0, 8)}…</strong>
              <p className="vj-meta">Pontuação: {Math.round(match.totalScore * 100) / 100}</p>
            </div>
            <Badge tone={statusTone(match.status)}>
              {ONLINE_MATCH_STATUS_LABELS[match.status] ?? match.status}
            </Badge>
          </div>
          {!readOnly && match.status === "offered" && onAccept && onDecline ? (
            <div className="vj-inline-actions">
              <button
                type="button"
                className="vj-button vj-button-primary"
                onClick={() => onAccept(match.id)}
              >
                Aceitar
              </button>
              <button
                type="button"
                className="vj-button vj-button-secondary"
                onClick={() => onDecline(match.id)}
              >
                Recusar
              </button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function ConsultationsTable({
  items,
  linkPrefix = "/app/advogado-online/consultas",
}: {
  items: OnlineConsultation[];
  linkPrefix?: string;
}) {
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">Consultas online</caption>
        <thead>
          <tr>
            <th scope="col">Modo</th>
            <th scope="col">Situação</th>
            <th scope="col">Agendada</th>
            <th scope="col">Valor</th>
            <th scope="col">Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id}>
              <td>{ONLINE_MODE_LABELS[c.mode] ?? c.mode}</td>
              <td>
                <Badge tone={statusTone(c.status)}>
                  {ONLINE_CONSULTATION_STATUS_LABELS[c.status] ?? c.status}
                </Badge>
              </td>
              <td>{c.scheduledAt ? formatDateTime(c.scheduledAt) : "—"}</td>
              <td>{c.priceCents != null ? formatMoneyCents(c.priceCents) : "—"}</td>
              <td>
                <a href={`${linkPrefix}/${c.id}`}>Abrir</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ConsultationRatingForm({
  disabled,
  onSubmit,
}: {
  disabled?: boolean;
  onSubmit: (rating: number, comment: string) => void;
}) {
  return (
    <form
      className="vj-stack"
      aria-label="Avaliar consulta"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const rating = Number((form.elements.namedItem("rating") as HTMLSelectElement).value);
        const comment = (form.elements.namedItem("comment") as HTMLTextAreaElement).value.trim();
        onSubmit(rating, comment);
      }}
    >
      <label htmlFor="consultation-rating">Nota (1 a 5)</label>
      <select
        id="consultation-rating"
        name="rating"
        className="vj-select"
        required
        disabled={disabled}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <label htmlFor="consultation-comment">Comentário (opcional)</label>
      <textarea
        id="consultation-comment"
        name="comment"
        className="vj-textarea"
        rows={3}
        maxLength={2000}
        disabled={disabled}
      />
      <button type="submit" className="vj-button vj-button-primary" disabled={disabled}>
        Enviar avaliação
      </button>
    </form>
  );
}

export function AvailabilitySlotsList({ items }: { items: LawyerAvailabilitySlot[] }) {
  const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  if (items.length === 0) return null;
  return (
    <ul className="vj-stack">
      {items.map((slot) => (
        <li key={slot.id} className="vj-card">
          {weekdays[slot.dayOfWeek ?? 0] ?? slot.dayOfWeek}: {slot.startTime} – {slot.endTime} (
          {slot.timezone}){!slot.active ? " · inativo" : ""}
        </li>
      ))}
    </ul>
  );
}

export function VideoNotConfiguredNotice({
  videoProvider,
}: {
  videoProvider: ProviderHealth | null;
}) {
  if (!videoProvider || !isProviderNotConfigured(videoProvider)) return null;
  return (
    <Alert tone="warning" title="Vídeo">
      A sala de vídeo não está configurada. Não exibimos botão de entrar na chamada enquanto o
      provedor estiver NOT_CONFIGURED.
    </Alert>
  );
}
