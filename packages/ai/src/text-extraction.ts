import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";

/**
 * Extração de texto local, sem rede e sem OCR. Quando o arquivo não tem camada de texto utilizável,
 * o resultado é `{ method: "unavailable", ocrRequired: true }` — nunca texto inventado.
 * Os valores de `method` são um subconjunto de `document_extraction_method` do banco.
 *
 * Mapeamento de páginas:
 * - texto plano com form-feed (`\f`) → páginas 1-indexadas honestas;
 * - PDF sem mapeamento nativo confiável → `pages: []` + warning `page_mapping_unavailable`
 *   / constante `PAGE_MAPPING_NOT_AVAILABLE` — nunca inventar page numbers a partir do binário.
 */

/** Capability/aviso explícito: mapeamento PDF por página não disponível nesta extração. */
export const PAGE_MAPPING_NOT_AVAILABLE = "PAGE_MAPPING_NOT_AVAILABLE" as const;

export type TextExtractionMethod = "plain_text" | "native_text" | "unavailable";

export type TextExtractionInput = {
  data: Uint8Array;
  mimeType: string;
  /** Limite de caracteres devolvidos (padrão 2.000.000). */
  maxChars?: number;
};

export type ExtractedPage = { pageNumber: number; text: string };

export type TextExtractionResult = {
  method: TextExtractionMethod;
  text: string;
  /** Mapeamento por página só quando confiável; vazio caso contrário. */
  pages: ExtractedPage[];
  pageCount: number | null;
  charCount: number;
  /** SHA-256 hexadecimal do texto normalizado; null quando não há texto. */
  textHash: string | null;
  /** true quando é preciso OCR para obter o texto (arquivo escaneado/imagem/camada esparsa). */
  ocrRequired: boolean;
  warnings: string[];
};

export interface DocumentTextExtractor {
  readonly id: string;
  supports(mimeType: string): boolean;
  extract(input: TextExtractionInput): Promise<TextExtractionResult>;
}

const DEFAULT_MAX_CHARS = 2_000_000;
const DEFAULT_MAX_BYTES = 50 * 1024 * 1024;

export function normalizeMimeType(mimeType: string): string {
  return (mimeType.split(";")[0] ?? "").trim().toLowerCase();
}

function hashText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function normalizeText(raw: string): string {
  return (
    raw
      .replace(/^\uFEFF/, "")
      .replace(/\r\n?/g, "\n")
      // biome-ignore lint/suspicious/noControlCharactersInRegex: remoção intencional de controles.
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/ ?\n ?/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

function unavailable(
  warnings: string[],
  options: { ocrRequired: boolean; pageCount?: number | null },
): TextExtractionResult {
  return {
    method: "unavailable",
    text: "",
    pages: [],
    pageCount: options.pageCount ?? null,
    charCount: 0,
    textHash: null,
    ocrRequired: options.ocrRequired,
    warnings,
  };
}

/**
 * Divide texto plano por form-feed (`\f`) em páginas 1-indexadas.
 * Seguro apenas para texto já decodificado — não aplica a binários PDF.
 */
export function splitPlainTextPagesByFormFeed(text: string): ExtractedPage[] {
  if (!text.includes("\f")) return [];
  const parts = text.split("\f");
  const pages: ExtractedPage[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    const pageText = normalizeText(parts[i] ?? "");
    if (pageText.length === 0 && i === parts.length - 1 && parts.length > 1) continue;
    pages.push({ pageNumber: pages.length + 1, text: pageText });
  }
  return pages.length > 1 ? pages : [];
}

function finalize(
  method: "plain_text" | "native_text",
  text: string,
  base: {
    pageCount: number | null;
    ocrRequired: boolean;
    warnings: string[];
    pages?: ExtractedPage[];
  },
  maxChars: number,
): TextExtractionResult {
  const warnings = [...base.warnings];
  let finalText = text;
  if (finalText.length > maxChars) {
    finalText = finalText.slice(0, maxChars);
    warnings.push("text_truncated");
  }
  const pages = base.pages ?? [];
  return {
    method,
    text: finalText,
    pages,
    pageCount: base.pageCount ?? (pages.length > 0 ? pages.length : null),
    charCount: finalText.length,
    textHash: finalText.length > 0 ? hashText(finalText) : null,
    ocrRequired: base.ocrRequired,
    warnings,
  };
}

/* -------------------------------------------------------------------------- */
/* Texto simples                                                               */
/* -------------------------------------------------------------------------- */

export const PLAIN_TEXT_MIME_TYPES = ["text/plain", "text/markdown", "text/csv"] as const;

export class PlainTextExtractor implements DocumentTextExtractor {
  readonly id = "plain_text";

  supports(mimeType: string): boolean {
    return (PLAIN_TEXT_MIME_TYPES as readonly string[]).includes(normalizeMimeType(mimeType));
  }

  async extract(input: TextExtractionInput): Promise<TextExtractionResult> {
    const maxChars = input.maxChars ?? DEFAULT_MAX_CHARS;
    if (input.data.byteLength > DEFAULT_MAX_BYTES) {
      return unavailable(["file_too_large"], { ocrRequired: false });
    }
    const head = input.data.subarray(0, 8192);
    if (head.includes(0)) {
      return unavailable(["binary_content"], { ocrRequired: false });
    }
    let decoded = new TextDecoder("utf-8", { fatal: false }).decode(input.data);
    const replacements = decoded.split("\uFFFD").length - 1;
    const warnings: string[] = [];
    if (replacements > 0 && replacements / Math.max(decoded.length, 1) > 0.02) {
      decoded = new TextDecoder("windows-1252").decode(input.data);
      warnings.push("decoded_as_windows_1252");
    }
    // Preserva \f para split de páginas; normalizeText remove form-feed via controles.
    const rawForPages = decoded.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
    const pages = splitPlainTextPagesByFormFeed(rawForPages);
    const text =
      pages.length > 0
        ? normalizeText(pages.map((page) => page.text).join("\n\n"))
        : normalizeText(decoded);
    if (text.length === 0) {
      return unavailable([...warnings, "empty_text"], { ocrRequired: false });
    }
    return finalize(
      "plain_text",
      text,
      {
        pageCount: pages.length > 0 ? pages.length : null,
        ocrRequired: false,
        warnings,
        pages,
      },
      maxChars,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* PDF com camada de texto (sem dependências)                                  */
/* -------------------------------------------------------------------------- */

const MAX_STREAM_INFLATED_BYTES = 16 * 1024 * 1024;
const MAX_TOTAL_STREAMS = 20_000;
const MIN_LETTERS_FOR_TEXT_LAYER = 10;
const MIN_LETTERS_PER_PAGE = 20;
const DELIMITERS = new Set(["(", ")", "<", ">", "[", "]", "{", "}", "/", "%"]);
const WHITESPACE = new Set([" ", "\n", "\r", "\t", "\f", "\0"]);

type ContentScan = { text: string; hexTextSeen: boolean };

function readLiteralString(source: string, start: number): { value: string; next: number } {
  let depth = 1;
  let i = start + 1;
  let out = "";
  while (i < source.length && depth > 0) {
    const ch = source[i] as string;
    if (ch === "\\") {
      const esc = source[i + 1] ?? "";
      i += 2;
      switch (esc) {
        case "n":
          out += "\n";
          break;
        case "r":
          out += "\r";
          break;
        case "t":
          out += "\t";
          break;
        case "b":
          out += "\b";
          break;
        case "f":
          out += "\f";
          break;
        case "(":
        case ")":
        case "\\":
          out += esc;
          break;
        case "\r":
          if (source[i] === "\n") i += 1;
          break;
        case "\n":
          break;
        default: {
          if (esc >= "0" && esc <= "7") {
            let octal = esc;
            while (octal.length < 3 && (source[i] ?? "") >= "0" && (source[i] ?? "") <= "7") {
              octal += source[i];
              i += 1;
            }
            out += String.fromCharCode(Number.parseInt(octal, 8) & 0xff);
          } else {
            out += esc;
          }
        }
      }
      continue;
    }
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) {
        i += 1;
        break;
      }
    }
    out += ch;
    i += 1;
  }
  return { value: out, next: i };
}

function scanTextBlock(block: string): ContentScan {
  let out = "";
  let pending: string[] = [];
  let inArray = false;
  let hexTextSeen = false;
  let i = 0;
  while (i < block.length) {
    const ch = block[i] as string;
    if (WHITESPACE.has(ch)) {
      i += 1;
    } else if (ch === "(") {
      const { value, next } = readLiteralString(block, i);
      pending.push(value);
      i = next;
    } else if (ch === "<" && block[i + 1] !== "<") {
      const end = block.indexOf(">", i);
      if (end === -1) break;
      hexTextSeen = true;
      i = end + 1;
    } else if (ch === "[") {
      inArray = true;
      i += 1;
    } else if (ch === "]") {
      inArray = false;
      i += 1;
    } else if (ch === "/") {
      i += 1;
      while (
        i < block.length &&
        !WHITESPACE.has(block[i] as string) &&
        !DELIMITERS.has(block[i] as string)
      )
        i += 1;
    } else if (DELIMITERS.has(ch)) {
      i += 1;
    } else {
      let token = "";
      while (
        i < block.length &&
        !WHITESPACE.has(block[i] as string) &&
        !DELIMITERS.has(block[i] as string)
      ) {
        token += block[i];
        i += 1;
      }
      const numeric = Number(token);
      if (inArray && token !== "" && Number.isFinite(numeric)) {
        if (numeric < -250) pending.push(" ");
        continue;
      }
      switch (token) {
        case "Tj":
        case "TJ":
          out += pending.join("");
          pending = [];
          break;
        case "'":
        case '"':
          out += `\n${pending.join("")}`;
          pending = [];
          break;
        case "Td":
        case "TD":
        case "T*":
          out += "\n";
          pending = [];
          break;
        case "Tm":
          out += " ";
          pending = [];
          break;
        default:
          if (!Number.isFinite(numeric)) pending = [];
      }
    }
  }
  return { text: out, hexTextSeen };
}

function scanContentStream(content: string): ContentScan {
  let text = "";
  let hexTextSeen = false;
  const blocks = content.matchAll(/\bBT\b([\s\S]*?)\bET\b/g);
  for (const match of blocks) {
    const scan = scanTextBlock(match[1] ?? "");
    text += `${scan.text}\n`;
    hexTextSeen ||= scan.hexTextSeen;
  }
  return { text, hexTextSeen };
}

function countLetters(text: string): number {
  return (text.match(/\p{L}/gu) ?? []).length;
}

function isReadable(text: string): boolean {
  const visible = text.replace(/\s/g, "");
  if (visible.length === 0) return false;
  const printable = (visible.match(/[\p{L}\p{N}\p{P}\p{S}]/gu) ?? []).length;
  const letters = countLetters(visible);
  return printable / visible.length >= 0.9 && letters / visible.length >= 0.5;
}

export class PdfTextLayerExtractor implements DocumentTextExtractor {
  readonly id = "pdf_text_layer";

  supports(mimeType: string): boolean {
    return normalizeMimeType(mimeType) === "application/pdf";
  }

  async extract(input: TextExtractionInput): Promise<TextExtractionResult> {
    const maxChars = input.maxChars ?? DEFAULT_MAX_CHARS;
    if (input.data.byteLength > DEFAULT_MAX_BYTES) {
      return unavailable(["file_too_large"], { ocrRequired: false });
    }
    const buffer = Buffer.from(input.data.buffer, input.data.byteOffset, input.data.byteLength);
    const raw = buffer.toString("latin1");
    if (!raw.startsWith("%PDF-") && !raw.slice(0, 1024).includes("%PDF-")) {
      return unavailable(["not_a_pdf"], { ocrRequired: false });
    }
    const pageMatches = raw.match(/\/Type\s*\/Page(?![A-Za-z])/g);
    const pageCount = pageMatches ? pageMatches.length : null;
    if (/\/Encrypt\b/.test(raw)) {
      return unavailable(["pdf_encrypted", "text_layer_unreadable"], {
        ocrRequired: true,
        pageCount,
      });
    }

    const warnings: string[] = [];
    let collected = "";
    let hexTextSeen = false;
    let skippedStreams = 0;
    let streams = 0;
    const streamStart = /stream\r?\n/g;
    for (let match = streamStart.exec(raw); match; match = streamStart.exec(raw)) {
      if (raw.slice(Math.max(0, match.index - 3), match.index) === "end") continue;
      streams += 1;
      if (streams > MAX_TOTAL_STREAMS) {
        warnings.push("too_many_streams");
        break;
      }
      const dataStart = match.index + match[0].length;
      const dataEnd = raw.indexOf("endstream", dataStart);
      if (dataEnd === -1) break;
      streamStart.lastIndex = dataEnd + "endstream".length;

      const headerWindow = raw.slice(Math.max(0, match.index - 800), match.index);
      const dict = headerWindow.slice(Math.max(0, headerWindow.lastIndexOf("obj")));
      const hasFilter = /\/Filter\b/.test(dict);
      let bytes: Buffer = buffer.subarray(dataStart, dataEnd);
      if (hasFilter) {
        if (
          !/\/FlateDecode\b/.test(dict) ||
          /\/(DCTDecode|JPXDecode|CCITTFaxDecode|JBIG2Decode)\b/.test(dict)
        ) {
          continue;
        }
        try {
          bytes = inflateSync(bytes, { maxOutputLength: MAX_STREAM_INFLATED_BYTES });
        } catch {
          skippedStreams += 1;
          continue;
        }
      }
      const content = bytes.toString("latin1");
      if (!content.includes("BT") || !content.includes("ET")) continue;
      const scan = scanContentStream(content);
      collected += `${scan.text}\n`;
      hexTextSeen ||= scan.hexTextSeen;
    }
    if (skippedStreams > 0) warnings.push("some_streams_unreadable");

    const text = normalizeText(collected);
    const letters = countLetters(text);
    if (letters < MIN_LETTERS_FOR_TEXT_LAYER || !isReadable(text)) {
      if (hexTextSeen) warnings.push("pdf_text_uses_encoded_fonts");
      return unavailable([...warnings, "no_text_layer"], { ocrRequired: true, pageCount });
    }
    // Sem mapeamento nativo confiável de conteúdo→página: não inventar page numbers.
    warnings.push(
      "text_decoding_best_effort",
      "page_mapping_unavailable",
      PAGE_MAPPING_NOT_AVAILABLE,
    );
    const sparse =
      pageCount !== null && pageCount > 0 && letters / pageCount < MIN_LETTERS_PER_PAGE;
    if (sparse) warnings.push("sparse_text_layer");
    return finalize(
      "native_text",
      text,
      { pageCount, ocrRequired: sparse, warnings, pages: [] },
      maxChars,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Orquestração                                                                */
/* -------------------------------------------------------------------------- */

export function defaultTextExtractors(): DocumentTextExtractor[] {
  return [new PlainTextExtractor(), new PdfTextLayerExtractor()];
}

/**
 * Escolhe o extrator pelo MIME. Imagens e tipos sem extrator local resultam em `unavailable`;
 * imagens marcam `ocrRequired` (precisam de OCR real, que não é simulado).
 */
export async function extractDocumentText(
  input: TextExtractionInput,
  extractors: readonly DocumentTextExtractor[] = defaultTextExtractors(),
): Promise<TextExtractionResult> {
  const extractor = extractors.find((candidate) => candidate.supports(input.mimeType));
  if (extractor) return extractor.extract(input);
  const mime = normalizeMimeType(input.mimeType);
  return unavailable(["unsupported_mime_type"], { ocrRequired: mime.startsWith("image/") });
}
