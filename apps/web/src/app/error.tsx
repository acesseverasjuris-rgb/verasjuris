"use client";

import { ErrorState } from "@verasjuris/ui";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="vj-page" id="conteudo">
      <ErrorState
        title="Não foi possível abrir esta página."
        action={
          <button className="vj-button vj-button-primary" type="button" onClick={reset}>
            Tentar novamente
          </button>
        }
      >
        Nenhuma alteração foi confirmada.{" "}
        {error.digest ? `Código: ${error.digest}.` : "Tente novamente."}
      </ErrorState>
    </main>
  );
}
