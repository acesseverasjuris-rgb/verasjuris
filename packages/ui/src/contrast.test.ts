import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { contrastRatio, CONTROL_BORDER, TEXT_PAIRS } from "./contrast.js";

function readTokens(): Record<string, string> {
  const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "styles.css");
  const css = readFileSync(file, "utf8");
  // Baseline WCAG pairs audit only the :root design tokens (not a11y mode overrides).
  const rootBlock = css.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? css;
  const tokens: Record<string, string> = {};
  for (const match of rootBlock.matchAll(/(--vj-[\w-]+)\s*:\s*(#[0-9A-Fa-f]{6})/g)) {
    const name = match[1];
    const color = match[2];
    if (name && color) tokens[name] = color;
  }
  return tokens;
}

describe("contraste dos tokens", () => {
  const tokens = readTokens();

  it("mantém texto normal em pelo menos 4,5:1", () => {
    for (const [foreground, background] of TEXT_PAIRS) {
      const fg = tokens[foreground];
      const bg = tokens[background];
      expect(fg, foreground).toBeDefined();
      expect(bg, background).toBeDefined();
      if (!fg || !bg) continue;
      expect(contrastRatio(fg, bg), `${foreground} sobre ${background}`).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });

  it("mantém borda de controle em pelo menos 3:1", () => {
    const [foreground, background] = CONTROL_BORDER;
    const fg = tokens[foreground];
    const bg = tokens[background];
    expect(fg).toBeDefined();
    expect(bg).toBeDefined();
    if (!fg || !bg) return;
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(3);
  });
});
