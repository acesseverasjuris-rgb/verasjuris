import { Breadcrumb, PageHeader } from "@verasjuris/ui";
import { chartTableAlternativeHint } from "../../lib/accessibility";

export default function AccessibilityPage() {
  return (
    <main className="vj-page" id="conteudo">
      <div className="vj-stack">
        <Breadcrumb items={[{ label: "Início", href: "/" }, { label: "Acessibilidade" }]} />
        <PageHeader
          title="Acessibilidade"
          description="Preferências persistentes, perfis rápidos e declaração pública."
        />
        <p>
          Use o botão flutuante de acessibilidade em qualquer página para ajustar contraste, escala
          de texto, daltonismo, redução de movimento, guia de leitura e suporte cognitivo.
        </p>
        <ul>
          <li>
            <a href="/acessibilidade/declaracao">Declaração de acessibilidade</a>
          </li>
          <li>Skip links: conteúdo, navegação e busca (quando houver).</li>
          <li>Anunciador de região viva para erros, sucesso e navegação.</li>
          <li>{chartTableAlternativeHint()}</li>
        </ul>
      </div>
    </main>
  );
}
