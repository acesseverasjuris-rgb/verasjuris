"use client";

import { CSRF_HEADER } from "@verasjuris/security/constants";
import { Menu } from "@verasjuris/ui";
import {
  BookOpen,
  BrainCircuit,
  Briefcase,
  Building2,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  Columns3,
  ContactRound,
  Gavel,
  Handshake,
  HardHat,
  Hourglass,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  ScrollText,
  Shield,
  SlidersHorizontal,
  FilePen,
  FileSignature,
  FileText,
  GitCompare,
  GraduationCap,
  Scale,
  Tags,
  UserRound,
  Users,
  UsersRound,
  MessageSquare,
  Store,
  Video,
  Wallet,
} from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import type { Membership } from "../lib/types";
import { roleLabel } from "../lib/types";

type NavItem = {
  href: string;
  label: string;
  icon:
    | "painel"
    | "conta"
    | "organizacao"
    | "participantes"
    | "auditoria"
    | "crm"
    | "leads"
    | "clientes"
    | "contatos"
    | "tags"
    | "atendimentos"
    | "pipeline"
    | "casos"
    | "documentos"
    | "tarefas"
    | "agenda"
    | "prazos"
    | "ia"
    | "configuracoes-ia"
    | "oportunidades"
    | "pesquisa"
    | "leiloes"
    | "documentos-juridicos"
    | "comparador"
    | "previdenciario"
    | "trabalhista"
    | "tributario"
    | "areas"
    | "contratos"
    | "comunicacao"
    | "advogado-online"
    | "marketplace"
    | "educacao"
    | "financeiro"
    | "perfis";
};

const icons = {
  painel: LayoutDashboard,
  conta: UserRound,
  organizacao: Building2,
  participantes: Users,
  auditoria: ScrollText,
  atendimentos: ClipboardList,
  pipeline: Columns3,
  casos: Briefcase,
  documentos: FileText,
  tarefas: CheckSquare,
  agenda: CalendarDays,
  prazos: Hourglass,
  crm: Handshake,
  leads: ContactRound,
  clientes: UsersRound,
  contatos: ContactRound,
  tags: Tags,
  perfis: UserRound,
  ia: BrainCircuit,
  "configuracoes-ia": SlidersHorizontal,
  oportunidades: Landmark,
  pesquisa: BookOpen,
  leiloes: Gavel,
  "documentos-juridicos": FilePen,
  comparador: GitCompare,
  previdenciario: Shield,
  trabalhista: HardHat,
  tributario: Landmark,
  areas: Scale,
  contratos: FileSignature,
  comunicacao: MessageSquare,
  "advogado-online": Video,
  marketplace: Store,
  educacao: GraduationCap,
  financeiro: Wallet,
};

function NavLinks({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <nav className="vj-nav" aria-label="Áreas">
      {items.map((item) => {
        const Icon = icons[item.icon];
        const current =
          item.href === "/app" || item.href === "/app/crm"
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <a key={item.href} href={item.href} aria-current={current ? "page" : undefined}>
            <Icon size={20} aria-hidden="true" />
            <span>{item.label}</span>
            {current ? <span className="vj-visually-hidden">, página atual</span> : null}
          </a>
        );
      })}
    </nav>
  );
}

export function AppShell({
  brand,
  userName,
  email,
  organization,
  organizations,
  items,
  children,
}: {
  brand: ReactNode;
  userName: string;
  email: string;
  organization: Membership | null;
  organizations: Membership[];
  items: NavItem[];
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
    window.location.assign("/app");
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
        <a href="/app" className="vj-brand-text vj-brand-text-inverse">
          {brand}
        </a>
        <NavLinks items={items} pathname={pathname} />
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
                  Organização ativa
                  <select
                    className="vj-select"
                    aria-label="Organização ativa"
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
                  Organização ativa: <strong>{organization.organizationName}</strong>
                </p>
              )
            ) : (
              <p className="vj-meta">Nenhuma organização ativa</p>
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
              Papel: {organization.roles.map(roleLabel).join(", ") || "não informado"}
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
          <aside className="vj-sidebar" role="dialog" aria-modal="true" aria-label="Menu">
            {brand}
            <NavLinks items={items} pathname={pathname} />
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
