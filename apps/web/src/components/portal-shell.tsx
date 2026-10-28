"use client";

import { CSRF_HEADER } from "@verasjuris/security/constants";
import { Menu } from "@verasjuris/ui";
import { LogOut, Menu as MenuIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import { PORTAL_NAV } from "./client-portal-ui";
import type { Membership } from "../lib/types";
import { roleLabel } from "../lib/types";

function NavLinks({ pathname }: { pathname: string }) {
  return (
    <nav className="vj-nav" aria-label="Portal do cliente">
      {PORTAL_NAV.map((item) => {
        const current =
          item.href === "/portal"
            ? pathname === "/portal"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <a key={item.href} href={item.href} aria-current={current ? "page" : undefined}>
            <span>{item.label}</span>
            {current ? <span className="vj-visually-hidden">, página atual</span> : null}
          </a>
        );
      })}
    </nav>
  );
}

export function PortalShell({
  brand,
  userName,
  email,
  organization,
  organizations,
  children,
}: {
  brand: ReactNode;
  userName: string;
  email: string;
  organization: Membership | null;
  organizations: Membership[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  async function chooseOrganization(organizationId: string) {
    await fetch("/session/organizacao", {
      method: "POST",
      headers: { "content-type": "application/json", [CSRF_HEADER]: "1" },
      body: JSON.stringify({ organizationId }),
    });
    window.location.assign("/portal");
  }

  async function logout() {
    await fetch("/api/v1/auth/logout", {
      method: "POST",
      headers: { [CSRF_HEADER]: "1" },
    });
    await fetch("/session/organizacao", {
      method: "DELETE",
      headers: { [CSRF_HEADER]: "1" },
    });
    window.location.assign("/");
  }

  return (
    <div className="vj-shell">
      <aside className="vj-sidebar vj-sidebar-desktop">
        <a href="/portal" className="vj-brand-text vj-brand-text-inverse">
          {brand}
        </a>
        <p className="vj-meta">Portal do Cliente</p>
        <NavLinks pathname={pathname} />
        <a href="/app" className="vj-link">
          Voltar ao escritório
        </a>
      </aside>
      <div className="vj-main">
        <header className="vj-topbar">
          <div className="vj-header-actions">
            <button
              type="button"
              className="vj-button vj-button-secondary vj-menu-button"
              onClick={() => setOpen(true)}
            >
              <MenuIcon size={20} aria-hidden="true" />
              Menu
            </button>
            {organization ? (
              organizations.length > 1 ? (
                <label className="vj-meta">
                  Organização
                  <select
                    className="vj-select"
                    aria-label="Organização do portal"
                    value={organization.organizationId}
                    onChange={(event) => void chooseOrganization(event.target.value)}
                  >
                    {organizations.map((item) => (
                      <option key={item.organizationId} value={item.organizationId}>
                        {item.organizationName}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="vj-meta">
                  Organização: <strong>{organization.organizationName}</strong>
                </p>
              )
            ) : (
              <p className="vj-meta">Nenhuma organização selecionada</p>
            )}
          </div>
          <Menu label={userName}>
            <p className="vj-meta" role="presentation">
              {email}
            </p>
            <button type="button" role="menuitem" onClick={() => void logout()}>
              <LogOut size={16} aria-hidden="true" /> Sair
            </button>
          </Menu>
        </header>
        <div className="vj-content" id="conteudo">
          {organization ? (
            <p className="vj-meta">
              Papel: {organization.roles.map(roleLabel).join(", ") || "cliente"}
            </p>
          ) : null}
          {children}
        </div>
      </div>
      {open ? (
        <div className="vj-overlay">
          <button
            type="button"
            className="vj-overlay-dismiss"
            aria-label="Fechar menu"
            onClick={() => setOpen(false)}
          />
          <aside className="vj-sidebar" role="dialog" aria-modal="true" aria-label="Menu do portal">
            {brand}
            <NavLinks pathname={pathname} />
            <button
              type="button"
              className="vj-button vj-button-secondary"
              onClick={() => setOpen(false)}
            >
              Fechar menu
            </button>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
