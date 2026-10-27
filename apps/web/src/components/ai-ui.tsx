import { Alert, Badge } from "@verasjuris/ui";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  CircleSlash,
  Clock3,
  Loader2,
  PencilLine,
  ShieldQuestion,
  XCircle,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  AI_NOT_CONFIGURED_MESSAGE,
  JOB_STATUS_LABELS,
  normalizeReview,
  REVIEW_BADGE_LABELS,
  type AiProviderStatus,
  type ReviewState,
} from "../lib/ai";

type Tone = "neutral" | "success" | "warning" | "error";

/** Estado semântico: sempre ícone + texto (nunca só cor). */
export function StatePill({
  tone = "neutral",
  icon,
  children,
}: {
  tone?: Tone;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Badge tone={tone}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
        {icon}
        {children}
      </span>
    </Badge>
  );
}

const reviewVisual: Record<ReviewState, { tone: Tone; icon: ReactNode }> = {
  unreviewed: { tone: "warning", icon: <ShieldQuestion size={14} aria-hidden="true" /> },
  reviewed: { tone: "success", icon: <CheckCircle2 size={14} aria-hidden="true" /> },
  corrected: { tone: "neutral", icon: <PencilLine size={14} aria-hidden="true" /> },
  rejected: { tone: "error", icon: <CircleSlash size={14} aria-hidden="true" /> },
};

/** "IA · Não revisado" / "IA · Revisado" / "IA · Corrigido" — nunca "Verificado". */
export function ReviewBadge({ status }: { status: string | null | undefined }) {
  const state = normalizeReview(status);
  const visual = reviewVisual[state];
  return (
    <StatePill tone={visual.tone} icon={visual.icon}>
      {REVIEW_BADGE_LABELS[state]}
    </StatePill>
  );
}

export function jobStatusVisual(status: string): { tone: Tone; icon: ReactNode } {
  switch (status) {
    case "requires_review":
      return { tone: "warning", icon: <ShieldQuestion size={14} aria-hidden="true" /> };
    case "reviewed":
    case "succeeded":
      return { tone: "success", icon: <CheckCircle2 size={14} aria-hidden="true" /> };
    case "failed":
      return { tone: "error", icon: <XCircle size={14} aria-hidden="true" /> };
    case "running":
      return { tone: "neutral", icon: <Loader2 size={14} aria-hidden="true" /> };
    case "not_configured":
      return { tone: "warning", icon: <CircleDashed size={14} aria-hidden="true" /> };
    case "cancelled":
      return { tone: "neutral", icon: <CircleSlash size={14} aria-hidden="true" /> };
    default:
      return { tone: "neutral", icon: <Clock3 size={14} aria-hidden="true" /> };
  }
}

export function JobStatusBadge({
  status,
  labels = JOB_STATUS_LABELS,
}: {
  status: string;
  labels?: Record<string, string>;
}) {
  const visual = jobStatusVisual(status);
  return (
    <StatePill tone={visual.tone} icon={visual.icon}>
      {labels[status] ?? status}
    </StatePill>
  );
}

export function ProviderStatusBadge({ status }: { status: AiProviderStatus | null | undefined }) {
  if (!status) {
    return (
      <StatePill icon={<CircleDashed size={14} aria-hidden="true" />}>
        Status indisponível
      </StatePill>
    );
  }
  if (status.state === "degraded") {
    return (
      <StatePill tone="warning" icon={<AlertTriangle size={14} aria-hidden="true" />}>
        Configurado, com instabilidade
      </StatePill>
    );
  }
  if (status.state === "unavailable") {
    return (
      <StatePill tone="error" icon={<XCircle size={14} aria-hidden="true" />}>
        Indisponível
      </StatePill>
    );
  }
  return status.configured ? (
    <StatePill tone="success" icon={<CheckCircle2 size={14} aria-hidden="true" />}>
      Configurado
    </StatePill>
  ) : (
    <StatePill tone="warning" icon={<CircleDashed size={14} aria-hidden="true" />}>
      Não configurado
    </StatePill>
  );
}

/** Aviso padrão quando o provedor de IA/OCR não está configurado — nunca "Erro inesperado". */
export function NotConfiguredNotice({
  message = AI_NOT_CONFIGURED_MESSAGE,
  children,
}: {
  message?: string;
  children?: string;
}) {
  return (
    <Alert tone="info" title={message}>
      {children ??
        "Nenhuma análise foi gerada e nenhum dado foi enviado a terceiros. Peça a um administrador para revisar as configurações de IA."}
    </Alert>
  );
}

/** Aviso de uso responsável para conteúdo gerado em análise assistida. */
export function AssistedNotice() {
  return (
    <Alert tone="info" title="Análise assistida">
      Resultado ainda não revisado: use como apoio e confira cada ponto nos documentos do caso. A
      revisão e a decisão são sempre de uma pessoa habilitada.
    </Alert>
  );
}

/** "Confiança do modelo: 82%" — nunca "precisão garantida". */
export function ModelConfidence({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="vj-meta">Confiança do modelo: não informada</span>;
  const pct = value <= 1 ? Math.round(value * 100) : Math.round(value);
  return <span className="vj-meta">Confiança do modelo: {pct}%</span>;
}

export function SourceReference({
  label,
  pageNumber,
}: {
  label?: string | null;
  pageNumber?: number | null;
}) {
  if (!label && pageNumber == null) {
    return <span className="vj-meta">Não localizado nos documentos analisados</span>;
  }
  return (
    <span className="vj-meta">
      Fonte: {label ?? "documento"}
      {pageNumber != null ? `, p. ${pageNumber}` : ""}
    </span>
  );
}

export function SectionTabs({
  label,
  items,
  current,
}: {
  label: string;
  items: Array<{ href: string; label: string }>;
  current: string;
}) {
  return (
    <nav aria-label={label}>
      <ul className="vj-inline-actions" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {items.map((item) => {
          const active = item.href === current;
          return (
            <li key={item.href}>
              <a
                className={`vj-button ${active ? "vj-button-primary" : "vj-button-secondary"}`}
                href={item.href}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export const IA_TABS = [
  { href: "/app/ia", label: "Visão geral" },
  { href: "/app/ia/uso", label: "Uso" },
  { href: "/app/ia/jobs", label: "Jobs" },
  { href: "/app/ia/analises", label: "Análises" },
  { href: "/app/ia/revisao", label: "Revisão" },
];

export const OPPORTUNITY_TABS = [
  { href: "/app/oportunidades-publicas", label: "Oportunidades" },
  { href: "/app/oportunidades-publicas/salvas", label: "Salvas" },
  { href: "/app/oportunidades-publicas/nova", label: "Cadastro manual" },
];

export function NoPermission({ children }: { children: string }) {
  return (
    <Alert tone="warning" title="Sem permissão">
      {children}
    </Alert>
  );
}
