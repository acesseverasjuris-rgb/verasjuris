"use client";

import { ErrorState } from "@verasjuris/ui";

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      title="Não foi possível carregar esta área."
      action={
        <button className="vj-button vj-button-primary" type="button" onClick={reset}>
          Tentar novamente
        </button>
      }
    >
      Nenhuma alteração foi confirmada. Os dados já salvos permanecem como estavam.
    </ErrorState>
  );
}
