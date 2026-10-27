import { LoadingState } from "@verasjuris/ui";

export default function Loading() {
  return (
    <main className="vj-page" id="conteudo">
      <LoadingState label="Carregando a página." />
    </main>
  );
}
