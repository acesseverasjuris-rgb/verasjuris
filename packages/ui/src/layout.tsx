import type { ReactNode } from "react";

export function Card({ children, calm = false }: { children: ReactNode; calm?: boolean }) {
  return <section className={calm ? "vj-card vj-card-calm" : "vj-card"}>{children}</section>;
}

export function Divider() {
  return <hr className="vj-divider" />;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="vj-stack">
      {eyebrow ? <p className="vj-meta">{eyebrow}</p> : null}
      <div className="vj-header-actions">
        <div>
          <h1 className="vj-title">{title}</h1>
          {description ? <p className="vj-prose">{description}</p> : null}
        </div>
        {actions}
      </div>
    </header>
  );
}

export function Breadcrumb({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav className="vj-breadcrumb" aria-label="Trilha">
      <ol>
        {items.map((item, index) => {
          const current = index === items.length - 1;
          return (
            <li key={item.label}>
              {item.href && !current ? (
                <a href={item.href}>{item.label}</a>
              ) : (
                <span aria-current={current ? "page" : undefined}>{item.label}</span>
              )}
              {current ? null : <span aria-hidden="true"> / </span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span className="vj-avatar" aria-hidden="true">
      {initials || "VJ"}
    </span>
  );
}
