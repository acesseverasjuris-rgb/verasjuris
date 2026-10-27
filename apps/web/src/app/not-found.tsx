import { ButtonLink } from "@verasjuris/ui";

export default function NotFound() {
  return (
    <main className="vj-page" id="conteudo">
      <h1 className="vj-title">Não encontramos esta página.</h1>
      <p>O endereço não corresponde a uma área desta versão. A navegação continua disponível.</p>
      <ButtonLink href="/">Voltar ao início</ButtonLink>
    </main>
  );
}
