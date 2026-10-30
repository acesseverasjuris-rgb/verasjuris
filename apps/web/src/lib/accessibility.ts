import { CSRF_HEADER } from "@verasjuris/security/constants";
import type { AiApiFailure } from "./ai";
import { isApiFailure } from "./ai";

export type ContrastMode =
  | "default"
  | "high"
  | "inverted"
  | "custom"
  | "extra_high"
  | "dark_high_contrast";
export type ColorVisionMode =
  | "none"
  | "protanopia"
  | "deuteranopia"
  | "tritanopia"
  | "achromatopsia";
export type InterfaceDensity = "comfortable" | "compact" | "spacious";

export type AccessibilityPreferences = {
  fontScale: string;
  lineSpacing: string;
  contrastMode: ContrastMode;
  colorVisionMode: ColorVisionMode;
  reducedMotion: boolean;
  reducedTransparency: boolean;
  focusEnhancement: boolean;
  screenReaderOptimized: boolean;
  simplifiedLanguage: boolean;
  dyslexiaFriendlyMode: boolean;
  cognitiveSupportMode: boolean;
  captionsPreferred: boolean;
  signLanguagePreferred: boolean;
  keyboardOnly: boolean;
  highVisibilityCursor: boolean;
  readingGuide: boolean;
  interfaceDensity: InterfaceDensity;
  activeProfile: string | null;
  largeControls?: boolean;
};

export const DEFAULT_A11Y: AccessibilityPreferences = {
  fontScale: "100",
  lineSpacing: "normal",
  contrastMode: "default",
  colorVisionMode: "none",
  reducedMotion: false,
  reducedTransparency: false,
  focusEnhancement: false,
  screenReaderOptimized: false,
  simplifiedLanguage: false,
  dyslexiaFriendlyMode: false,
  cognitiveSupportMode: false,
  captionsPreferred: true,
  signLanguagePreferred: false,
  keyboardOnly: false,
  highVisibilityCursor: false,
  readingGuide: false,
  interfaceDensity: "comfortable",
  activeProfile: null,
  largeControls: false,
};

export type QuickProfileId =
  | "screen_reader"
  | "low_vision"
  | "color_blind"
  | "reduced_mobility"
  | "keyboard"
  | "autism"
  | "dyslexia"
  | "adhd"
  | "reduced_motion"
  | "high_contrast"
  | "simplified";

export const QUICK_PROFILES: Array<{
  id: QuickProfileId;
  label: string;
  patch: Partial<AccessibilityPreferences>;
}> = [
  {
    id: "screen_reader",
    label: "Cegueira / leitor de tela",
    patch: {
      screenReaderOptimized: true,
      focusEnhancement: true,
      activeProfile: "screen_reader",
    },
  },
  {
    id: "low_vision",
    label: "Baixa visão",
    patch: {
      fontScale: "150",
      contrastMode: "high",
      largeControls: true,
      focusEnhancement: true,
      interfaceDensity: "spacious",
      activeProfile: "low_vision",
    },
  },
  {
    id: "color_blind",
    label: "Daltonismo",
    patch: { colorVisionMode: "deuteranopia", activeProfile: "color_blind" },
  },
  {
    id: "reduced_mobility",
    label: "Mobilidade reduzida",
    patch: {
      largeControls: true,
      keyboardOnly: true,
      focusEnhancement: true,
      interfaceDensity: "spacious",
      activeProfile: "reduced_mobility",
    },
  },
  {
    id: "keyboard",
    label: "Teclado",
    patch: {
      keyboardOnly: true,
      focusEnhancement: true,
      activeProfile: "keyboard",
    },
  },
  {
    id: "autism",
    label: "Autismo / neurodivergência",
    patch: {
      cognitiveSupportMode: true,
      reducedMotion: true,
      simplifiedLanguage: true,
      activeProfile: "autism",
    },
  },
  {
    id: "dyslexia",
    label: "Dislexia",
    patch: {
      dyslexiaFriendlyMode: true,
      lineSpacing: "relaxed",
      readingGuide: true,
      fontScale: "120",
      activeProfile: "dyslexia",
    },
  },
  {
    id: "adhd",
    label: "TDAH / foco",
    patch: {
      cognitiveSupportMode: true,
      reducedMotion: true,
      readingGuide: true,
      activeProfile: "adhd",
    },
  },
  {
    id: "reduced_motion",
    label: "Redução de movimento",
    patch: { reducedMotion: true, activeProfile: "reduced_motion" },
  },
  {
    id: "high_contrast",
    label: "Alto contraste",
    patch: { contrastMode: "high", activeProfile: "high_contrast" },
  },
  {
    id: "simplified",
    label: "Linguagem simplificada",
    patch: {
      simplifiedLanguage: true,
      cognitiveSupportMode: true,
      activeProfile: "simplified",
    },
  },
];

const STORAGE_KEY = "vj.accessibility.preferences";

export function loadLocalAccessibility(): AccessibilityPreferences {
  if (typeof window === "undefined") return { ...DEFAULT_A11Y };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_A11Y };
    return { ...DEFAULT_A11Y, ...(JSON.parse(raw) as Partial<AccessibilityPreferences>) };
  } catch {
    return { ...DEFAULT_A11Y };
  }
}

export function saveLocalAccessibility(prefs: AccessibilityPreferences): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

/** Aplica preferências em <html> via CSS variables e data-attributes. */
export function applyAccessibilityToDocument(prefs: AccessibilityPreferences): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const scale = Number.parseInt(prefs.fontScale, 10);
  root.style.setProperty("--vj-a11y-font-scale", Number.isFinite(scale) ? `${scale / 100}` : "1");
  root.dataset.contrast = prefs.contrastMode;
  root.dataset.colorVision = prefs.colorVisionMode;
  root.dataset.reducedMotion = prefs.reducedMotion ? "true" : "false";
  root.dataset.cognitiveSupport = prefs.cognitiveSupportMode ? "true" : "false";
  root.dataset.readingGuide = prefs.readingGuide ? "true" : "false";
  root.dataset.dyslexia = prefs.dyslexiaFriendlyMode ? "true" : "false";
  root.dataset.lineSpacing = prefs.lineSpacing;
  root.dataset.focusEnhancement = prefs.focusEnhancement ? "true" : "false";
  root.dataset.largeControls = prefs.largeControls ? "true" : "false";
  root.dataset.simplifiedLanguage = prefs.simplifiedLanguage ? "true" : "false";
  root.dataset.keyboardOnly = prefs.keyboardOnly ? "true" : "false";
  root.dataset.density = prefs.interfaceDensity;
  root.dataset.a11yProfile = prefs.activeProfile ?? "";
}

async function request<T>(path: string, init?: RequestInit): Promise<T | AiApiFailure> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...(init?.method && init.method !== "GET" ? { [CSRF_HEADER]: "1" } : {}),
        ...init?.headers,
      },
      cache: "no-store",
    });
  } catch {
    return { httpStatus: 0, error: { code: "network", message: "Falha de rede." } };
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as AiApiFailure;
    return { httpStatus: response.status, ...body };
  }
  if (response.status === 204) return {} as T;
  return (await response.json()) as T;
}

export async function fetchAccessibilityPreferences(): Promise<
  AccessibilityPreferences | AiApiFailure
> {
  const res = await request<{ preferences: AccessibilityPreferences }>(
    "/api/v1/me/accessibility-preferences",
  );
  if (isApiFailure(res)) return res;
  return { ...DEFAULT_A11Y, ...res.preferences };
}

export async function updateAccessibilityPreferences(
  patch: Partial<AccessibilityPreferences>,
): Promise<AccessibilityPreferences | AiApiFailure> {
  const res = await request<{ preferences: AccessibilityPreferences }>(
    "/api/v1/me/accessibility-preferences",
    { method: "PUT", body: JSON.stringify(patch) },
  );
  if (isApiFailure(res)) return res;
  return { ...DEFAULT_A11Y, ...res.preferences };
}

/** Documentação: gráficos devem oferecer tabela alternativa (padrão control-ui). */
export function chartTableAlternativeHint(): string {
  return "Todo gráfico deve expor descrição textual e tabela de dados equivalente (não depender só de cor).";
}
