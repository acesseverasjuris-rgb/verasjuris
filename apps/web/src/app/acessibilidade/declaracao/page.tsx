import { Breadcrumb, PageHeader } from "@verasjuris/ui";

export default function AccessibilityStatementPage() {
  return (
    <main className="vj-page" id="conteudo">
      <div className="vj-stack">
        <Breadcrumb
          items={[
            { label: "Início", href: "/" },
            { label: "Acessibilidade", href: "/acessibilidade" },
            { label: "Declaração" },
          ]}
        />
        <PageHeader
          title="Declaração de acessibilidade"
          description="Compromisso com WCAG 2.2 AA+ e melhorias contínuas."
        />
        <div className="vj-prose">
          <p>
            O VerasJuris busca conformidade com WCAG 2.2 nível AA e recursos adicionais (daltonismo,
            suporte cognitivo, Libras via provider quando configurado).
          </p>
          <p>
            Testes automatizados (axe ou equivalente) e manuais (VoiceOver/NVDA) devem ser
            registrados. Quando um teste não foi executado no ambiente atual:{" "}
            <strong>NÃO HOMOLOGADO</strong>.
          </p>
          <p>
            Braille: compatibilidade via HTML semântico e leitores de tela — não renderizamos
            braille visual como substituto.
          </p>
          <p>
            Problemas: use o <a href="/institucional/contato">contato institucional</a> ou o canal
            de suporte.
          </p>
        </div>
      </div>
    </main>
  );
}
