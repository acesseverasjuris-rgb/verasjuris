import { ButtonLink } from "@verasjuris/ui";
import { BrandMark } from "../components/brand-mark";

export default function HomePage() {
  return (
    <>
      <header className="vj-public-header">
        <a href="/" aria-label="VerasJuris, início">
          <BrandMark />
        </a>
        <div className="vj-header-actions">
          <ButtonLink href="/entrar" variant="ghost">
            Entrar
          </ButtonLink>
          <ButtonLink href="/cadastro">Criar conta</ButtonLink>
        </div>
      </header>
      <main className="vj-page" id="conteudo">
        <div className="vj-stack">
          <p className="vj-meta">
            Plataforma de gestão, serviços e conhecimento jurídico com IA supervisionada
          </p>
          <h1 className="vj-display">O Direito em movimento.</h1>
          <p className="vj-subtitle">Você no controle.</p>
          <p className="vj-lead">
            VerasJuris reúne recursos para entender uma demanda, organizar o trabalho e acompanhar a
            próxima providência. A prestação de serviços jurídicos cabe aos profissionais
            habilitados.
          </p>
          <div className="vj-form-actions">
            <ButtonLink href="/cadastro">Criar conta</ButtonLink>
            <ButtonLink href="/entrar" variant="secondary">
              Entrar
            </ButtonLink>
          </div>
          <div className="vj-split">
            <section className="vj-card">
              <h2 className="vj-section-title">Disponível nesta versão</h2>
              <ul>
                <li>Criar conta e entrar com senha.</li>
                <li>Criar uma organização e participar dela.</li>
                <li>Definir papéis e consultar a auditoria do que aconteceu aqui.</li>
              </ul>
            </section>
            <section className="vj-card vj-card-calm">
              <h2 className="vj-section-title">Ainda não disponível</h2>
              <p>
                Processos, clientes, prazos, documentos, peticionamento, pagamentos, marketplace,
                cursos e cartórios não fazem parte desta versão. Nenhuma dessas funções está ativa,
                mesmo que apareça no roteiro do produto.
              </p>
            </section>
          </div>
        </div>
      </main>
      <footer className="vj-footer">
        <p>
          A Café Platine desenvolve a plataforma VerasJuris. O VerasJuris é independente de
          escritórios, autoridades e órgãos públicos.
        </p>
      </footer>
    </>
  );
}
