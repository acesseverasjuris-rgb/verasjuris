"use client";

import { Accessibility } from "lucide-react";
import { useEffect, useState } from "react";
import {
  DEFAULT_A11Y,
  QUICK_PROFILES,
  applyAccessibilityToDocument,
  fetchAccessibilityPreferences,
  loadLocalAccessibility,
  saveLocalAccessibility,
  updateAccessibilityPreferences,
  type AccessibilityPreferences,
  type ContrastMode,
  type ColorVisionMode,
} from "../lib/accessibility";
import { isApiFailure } from "../lib/ai";
import { useLocale } from "./locale-provider";
import { useAnnouncer } from "./live-announcer";

export function AccessibilityPanel() {
  const { t } = useLocale();
  const { announce } = useAnnouncer();
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<AccessibilityPreferences>(DEFAULT_A11Y);

  useEffect(() => {
    const local = loadLocalAccessibility();
    setPrefs(local);
    applyAccessibilityToDocument(local);
    let cancelled = false;
    void (async () => {
      const remote = await fetchAccessibilityPreferences();
      if (cancelled || isApiFailure(remote)) return;
      setPrefs(remote);
      saveLocalAccessibility(remote);
      applyAccessibilityToDocument(remote);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!prefs.readingGuide) return;
    function onMove(event: MouseEvent) {
      const guide = document.querySelector<HTMLElement>(".vj-reading-guide");
      if (!guide) return;
      guide.style.top = `${Math.max(0, event.clientY - 20)}px`;
    }
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [prefs.readingGuide]);

  async function commit(next: AccessibilityPreferences) {
    setPrefs(next);
    applyAccessibilityToDocument(next);
    saveLocalAccessibility(next);
    announce(t("a11y.title"));
    const remote = await updateAccessibilityPreferences(next);
    if (!isApiFailure(remote)) {
      setPrefs(remote);
      saveLocalAccessibility(remote);
      applyAccessibilityToDocument(remote);
    }
  }

  function patch(partial: Partial<AccessibilityPreferences>) {
    void commit({ ...prefs, ...partial, activeProfile: partial.activeProfile ?? null });
  }

  return (
    <>
      <button
        type="button"
        className="vj-fab vj-fab-a11y"
        aria-label={t("a11y.open")}
        aria-expanded={open}
        aria-controls="vj-a11y-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <Accessibility size={22} aria-hidden="true" />
      </button>
      {open ? (
        <div
          id="vj-a11y-panel"
          className="vj-a11y-panel"
          role="dialog"
          aria-modal="false"
          aria-label={t("a11y.panel")}
        >
          <div className="vj-a11y-panel-header">
            <h2 className="vj-section-title">{t("a11y.title")}</h2>
            <button
              type="button"
              className="vj-button vj-button-secondary"
              onClick={() => setOpen(false)}
            >
              {t("common.close")}
            </button>
          </div>
          <p className="vj-meta">
            <a href="/acessibilidade">{t("a11y.title")}</a>
            {" · "}
            <a href="/acessibilidade/declaracao">{t("a11y.statement")}</a>
          </p>

          <fieldset className="vj-stack">
            <legend>{t("a11y.profiles")}</legend>
            <div className="vj-chip-grid">
              {QUICK_PROFILES.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  className="vj-button vj-button-secondary"
                  aria-pressed={prefs.activeProfile === profile.id}
                  onClick={() => void commit({ ...DEFAULT_A11Y, ...profile.patch })}
                >
                  {profile.label}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="vj-stack">
            <span>{t("a11y.fontScale")}</span>
            <input
              type="range"
              min={100}
              max={250}
              step={10}
              value={Number.parseInt(prefs.fontScale, 10) || 100}
              onChange={(event) => patch({ fontScale: event.target.value })}
            />
            <span className="vj-meta">{prefs.fontScale}%</span>
          </label>

          <label>
            <span>{t("a11y.contrast")}</span>
            <select
              className="vj-select"
              value={prefs.contrastMode}
              onChange={(event) => patch({ contrastMode: event.target.value as ContrastMode })}
            >
              <option value="default">Normal</option>
              <option value="high">Alto</option>
              <option value="extra_high">Extra alto</option>
              <option value="dark_high_contrast">Escuro alto contraste</option>
              <option value="inverted">Invertido</option>
            </select>
          </label>

          <label>
            <span>{t("a11y.colorVision")}</span>
            <select
              className="vj-select"
              value={prefs.colorVisionMode}
              onChange={(event) =>
                patch({ colorVisionMode: event.target.value as ColorVisionMode })
              }
            >
              <option value="none">Nenhum</option>
              <option value="protanopia">Protanopia</option>
              <option value="deuteranopia">Deuteranopia</option>
              <option value="tritanopia">Tritanopia</option>
              <option value="achromatopsia">Acromatopsia</option>
            </select>
          </label>

          {(
            [
              ["reducedMotion", "a11y.reducedMotion"],
              ["cognitiveSupportMode", "a11y.cognitive"],
              ["readingGuide", "a11y.readingGuide"],
              ["dyslexiaFriendlyMode", "a11y.dyslexia"],
              ["simplifiedLanguage", "a11y.simplified"],
              ["focusEnhancement", "Foco reforçado"],
              ["largeControls", "Controles maiores"],
              ["keyboardOnly", "Somente teclado"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="vj-check-row">
              <input
                type="checkbox"
                checked={Boolean(prefs[key as keyof AccessibilityPreferences])}
                onChange={(event) => patch({ [key]: event.target.checked })}
              />
              <span>
                {typeof label === "string" && label.startsWith("a11y.") ? t(label) : label}
              </span>
            </label>
          ))}

          <button
            type="button"
            className="vj-button"
            onClick={() => void commit({ ...DEFAULT_A11Y })}
          >
            {t("a11y.reset")}
          </button>
        </div>
      ) : null}
      {prefs.readingGuide ? <div className="vj-reading-guide" aria-hidden="true" /> : null}
    </>
  );
}
