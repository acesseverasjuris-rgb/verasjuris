export function relativeLuminance(hex: string): number {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((start) => {
    const channel = Number.parseInt(value.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const [red, green, blue] = channels;
  if (red === undefined || green === undefined || blue === undefined) {
    throw new Error("Cor inválida.");
  }
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

export const TEXT_PAIRS = [
  ["--vj-ink", "--vj-white"],
  ["--vj-gray", "--vj-white"],
  ["--vj-white", "--vj-navy"],
  ["--vj-white", "--vj-blue"],
  ["--vj-white", "--vj-blue-hover"],
  ["--vj-ink", "--vj-blue-light"],
  ["--vj-navy", "--vj-blue-light"],
  ["--vj-blue", "--vj-white"],
  ["--vj-blue", "--vj-blue-light"],
  ["--vj-success", "--vj-white"],
  ["--vj-warning", "--vj-white"],
  ["--vj-error", "--vj-white"],
  ["--vj-blue-light", "--vj-navy"],
] as const;

export const CONTROL_BORDER = ["--vj-border-strong", "--vj-white"] as const;
