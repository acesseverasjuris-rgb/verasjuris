import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { ReactNode } from "react";

const tones = {
  info: { className: "vj-alert-info", icon: Info, label: "Informação" },
  success: { className: "vj-alert-success", icon: CheckCircle2, label: "Concluído" },
  warning: { className: "vj-alert-warning", icon: AlertTriangle, label: "Pendência" },
  error: { className: "vj-alert-error", icon: XCircle, label: "Falha" },
} as const;

export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: keyof typeof tones;
  title: string;
  children?: ReactNode;
}) {
  const current = tones[tone];
  const Icon = current.icon;
  return (
    <div
      className={`vj-alert ${current.className}`}
      role={tone === "error" || tone === "warning" ? "alert" : "status"}
    >
      <Icon size={20} aria-hidden="true" />
      <div>
        <strong>
          {title}
          <span className="vj-visually-hidden">. {current.label}.</span>
        </strong>
        {children ? <p>{children}</p> : null}
      </div>
    </div>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "success" | "warning" | "error";
  children: ReactNode;
}) {
  return (
    <span className={tone === "neutral" ? "vj-badge" : `vj-badge vj-badge-${tone}`}>
      {children}
    </span>
  );
}

export function Skeleton({ width = "100%" }: { width?: string }) {
  return <div className="vj-skeleton" style={{ width }} aria-hidden="true" />;
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="vj-stack" role="status" aria-live="polite">
      <span className="vj-visually-hidden">{label}</span>
      <Skeleton width="40%" />
      <Skeleton />
      <Skeleton width="72%" />
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="vj-card">
      <h2 className="vj-section-title">{title}</h2>
      <div className="vj-prose">{children}</div>
      {action ? <div className="vj-form-actions">{action}</div> : null}
    </section>
  );
}

export function ErrorState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="vj-stack">
      <Alert tone="error" title={title}>
        {children}
      </Alert>
      {action}
    </div>
  );
}
