import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "../../components/app-shell";
import { BrandMark } from "../../components/brand-mark";
import { activeOrganizationId, getSession } from "../../lib/session";

export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (session.state === "anonymous") redirect("/entrar");
  if (session.state === "unavailable") {
    return (
      <main className="vj-page" id="conteudo">
        <h1 className="vj-title">Não foi possível carregar sua sessão.</h1>
        <p>{session.message}</p>
      </main>
    );
  }
  const activeId = await activeOrganizationId(session.account);
  const organization =
    session.account.memberships.find((item) => item.organizationId === activeId) ?? null;
  const permissions = new Set(organization?.permissions ?? []);
  const showProfiles =
    Boolean(organization) ||
    session.account.memberships.some(
      (membership) =>
        membership.permissions.includes("profiles.read") ||
        membership.permissions.includes("profiles.update_self") ||
        membership.permissions.includes("profiles.manage"),
    );
  const items = [
    { href: "/app", label: "Painel", icon: "painel" as const },
    { href: "/app/conta", label: "Conta", icon: "conta" as const },
    ...(showProfiles ? [{ href: "/app/perfis", label: "Perfis", icon: "perfis" as const }] : []),
    ...(organization
      ? [
          { href: "/app/organizacao", label: "Organização", icon: "organizacao" as const },
          ...(permissions.has("member.read")
            ? [
                {
                  href: "/app/participantes",
                  label: "Participantes",
                  icon: "participantes" as const,
                },
              ]
            : []),
          ...(permissions.has("audit.read")
            ? [{ href: "/app/auditoria", label: "Auditoria", icon: "auditoria" as const }]
            : []),
          ...(permissions.has("intake.read")
            ? [{ href: "/app/atendimentos", label: "Atendimentos", icon: "atendimentos" as const }]
            : []),
          ...(permissions.has("pipeline.read")
            ? [{ href: "/app/pipeline", label: "Pipeline", icon: "pipeline" as const }]
            : []),
          ...(permissions.has("matter.read")
            ? [{ href: "/app/casos", label: "Casos", icon: "casos" as const }]
            : []),
          ...(permissions.has("document.read")
            ? [{ href: "/app/documentos", label: "Documentos", icon: "documentos" as const }]
            : []),
          ...(permissions.has("legal_template.read") || permissions.has("legal_draft.read")
            ? [
                {
                  href: "/app/documentos-juridicos",
                  label: "Documentos jurídicos",
                  icon: "documentos-juridicos" as const,
                },
              ]
            : []),
          ...(permissions.has("legal_comparison.read")
            ? [{ href: "/app/comparador", label: "Comparador", icon: "comparador" as const }]
            : []),
          ...(permissions.has("task.read")
            ? [{ href: "/app/tarefas", label: "Tarefas", icon: "tarefas" as const }]
            : []),
          ...(permissions.has("calendar.read")
            ? [{ href: "/app/agenda", label: "Agenda", icon: "agenda" as const }]
            : []),
          ...(permissions.has("deadline.read")
            ? [{ href: "/app/prazos", label: "Prazos", icon: "prazos" as const }]
            : []),
          ...([
            "ai.use",
            "ai.usage.read",
            "ai.jobs.read",
            "legal_analysis.read",
            "legal_review.read",
          ].some((key) => permissions.has(key))
            ? [{ href: "/app/ia", label: "IA assistiva", icon: "ia" as const }]
            : []),
          ...(permissions.has("legal_research.read")
            ? [{ href: "/app/pesquisa", label: "Pesquisa jurídica", icon: "pesquisa" as const }]
            : []),
          ...(permissions.has("auction.read")
            ? [{ href: "/app/leiloes", label: "Leilões", icon: "leiloes" as const }]
            : []),
          ...(permissions.has("previdentiary.read")
            ? [
                {
                  href: "/app/previdenciario",
                  label: "Previdenciário",
                  icon: "previdenciario" as const,
                },
              ]
            : []),
          ...(permissions.has("labor.read")
            ? [{ href: "/app/trabalhista", label: "Trabalhista", icon: "trabalhista" as const }]
            : []),
          ...(permissions.has("tax.read")
            ? [{ href: "/app/tributario", label: "Tributário", icon: "tributario" as const }]
            : []),
          ...(permissions.has("matter.read") || permissions.has("legal_area_module.read")
            ? [{ href: "/app/areas", label: "Áreas jurídicas", icon: "areas" as const }]
            : []),
          ...(permissions.has("contract.read")
            ? [{ href: "/app/contratos", label: "Contratos", icon: "contratos" as const }]
            : []),
          ...(permissions.has("communication.read")
            ? [{ href: "/app/comunicacao", label: "Comunicação", icon: "comunicacao" as const }]
            : []),
          ...([
            "online_lawyer.match.read",
            "online_lawyer.consultation.read",
            "online_lawyer.availability.manage",
          ].some((key) => permissions.has(key))
            ? [
                {
                  href: "/app/advogado-online",
                  label: "Advogado Online",
                  icon: "advogado-online" as const,
                },
              ]
            : []),
          ...(permissions.has("professional_verification.read_own") ||
          permissions.has("professional_verification.review")
            ? [{ href: "/app/verificacoes", label: "Verificações", icon: "perfis" as const }]
            : []),
          ...(permissions.has("diligence.read")
            ? [{ href: "/app/diligencias", label: "Diligências", icon: "tarefas" as const }]
            : []),
          ...(permissions.has("extrajudicial.read")
            ? [{ href: "/app/extrajudicial", label: "Extrajudicial", icon: "documentos" as const }]
            : []),
          ...([
            "marketplace.read",
            "marketplace.proposal.create",
            "marketplace.service.manage",
          ].some((key) => permissions.has(key))
            ? [
                {
                  href: "/app/marketplace",
                  label: "Marketplace",
                  icon: "marketplace" as const,
                },
              ]
            : []),
          ...(permissions.has("public_opportunity.read")
            ? [
                {
                  href: "/app/oportunidades-publicas",
                  label: "Oportunidades públicas",
                  icon: "oportunidades" as const,
                },
              ]
            : []),
          ...(["ai.config.manage", "ai.models.manage", "ai.prompts.read"].some((key) =>
            permissions.has(key),
          )
            ? [
                {
                  href: "/app/configuracoes/ia",
                  label: "Configurações de IA",
                  icon: "configuracoes-ia" as const,
                },
              ]
            : []),
          ...(permissions.has("crm.read")
            ? [
                { href: "/app/crm", label: "Visão geral", icon: "crm" as const },
                { href: "/app/crm/leads", label: "Leads", icon: "leads" as const },
                { href: "/app/crm/clientes", label: "Clientes", icon: "clientes" as const },
                { href: "/app/crm/contatos", label: "Contatos", icon: "contatos" as const },
                { href: "/app/crm/tags", label: "Tags", icon: "tags" as const },
              ]
            : []),
        ]
      : []),
  ];
  return (
    <AppShell
      brand={<BrandMark variant="negative" />}
      userName={session.account.user.displayName}
      email={session.account.user.email}
      organization={organization}
      organizations={session.account.memberships}
      items={items}
    >
      {children}
    </AppShell>
  );
}
