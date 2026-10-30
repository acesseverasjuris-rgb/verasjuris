"use client";

import { useLocale } from "./locale-provider";

export function SkipLinks({ includeSearch = false }: { includeSearch?: boolean }) {
  const { t } = useLocale();
  return (
    <div className="vj-skip-links">
      <a className="vj-skip-link" href="#conteudo">
        {t("nav.content")}
      </a>
      <a className="vj-skip-link" href="#navegacao">
        {t("nav.navigation")}
      </a>
      {includeSearch ? (
        <a className="vj-skip-link" href="#busca">
          {t("nav.search")}
        </a>
      ) : null}
    </div>
  );
}
