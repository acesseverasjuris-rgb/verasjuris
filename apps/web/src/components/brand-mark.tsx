import { existsSync } from "node:fs";
import path from "node:path";

export function BrandMark({ variant = "positive" }: { variant?: "positive" | "negative" }) {
  const file = variant === "negative" ? "logo-negative.svg" : "logo-positive.svg";
  const absolute = path.join(process.cwd(), "public", "brand", file);
  if (existsSync(absolute)) {
    return (
      // The master logo must be displayed as the supplied file, without an optimizer rewriting the asset.
      // biome-ignore lint/performance/noImgElement: official brand file
      <img className="vj-logo" src={`/brand/${file}`} alt="VerasJuris" />
    );
  }
  return (
    <span
      className={variant === "negative" ? "vj-brand-text vj-brand-text-inverse" : "vj-brand-text"}
    >
      <span>VerasJuris</span>
      <span className="vj-visually-hidden">
        Identificação textual provisória. A assinatura oficial será exibida quando o arquivo mestre
        estiver disponível.
      </span>
    </span>
  );
}
