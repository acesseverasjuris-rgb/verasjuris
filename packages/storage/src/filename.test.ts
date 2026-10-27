import { describe, expect, it } from "vitest";
import { safeDisplayFilename, sanitizeOriginalFilename } from "./filename.js";

describe("sanitizeOriginalFilename", () => {
  it("remove componentes de caminho", () => {
    expect(sanitizeOriginalFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeOriginalFilename("C:\\\\Users\\\\doc.pdf")).toBe("doc.pdf");
    expect(sanitizeOriginalFilename("pasta/sub/arquivo.pdf")).toBe("arquivo.pdf");
  });
});

describe("safeDisplayFilename", () => {
  it("não retém separadores de caminho", () => {
    const name = safeDisplayFilename("relatório final.pdf");
    expect(name).toBe("relatório final.pdf");
    expect(name.includes("/")).toBe(false);
    expect(name.includes("\\")).toBe(false);

    expect(safeDisplayFilename("../segredo.txt")).toBe("segredo.txt");
    expect(safeDisplayFilename("...")).toBe("arquivo");
  });
});
