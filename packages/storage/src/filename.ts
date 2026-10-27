/**
 * Remove componentes de caminho e caracteres de controle do nome original.
 */
export function sanitizeOriginalFilename(filename: string): string {
  const basename = filename.replace(/\\/g, "/").split("/").pop() ?? "";
  let withoutControls = "";
  for (const char of basename) {
    const code = char.charCodeAt(0);
    if (code <= 0x1f || code === 0x7f) continue;
    withoutControls += char;
  }
  const collapsed = withoutControls.replace(/\s+/g, " ").trim();
  return collapsed.slice(0, 255);
}

/**
 * Nome seguro para exibição/UI: sem separadores de caminho e sem traversal.
 */
export function safeDisplayFilename(filename: string): string {
  const sanitized = sanitizeOriginalFilename(filename);
  const noSeparators = sanitized.replace(/[\\/]/g, "_");
  const noDotsOnly = noSeparators.replace(/^\.+/, "");
  const cleaned = noDotsOnly.length > 0 ? noDotsOnly : "arquivo";
  return cleaned.slice(0, 255);
}
