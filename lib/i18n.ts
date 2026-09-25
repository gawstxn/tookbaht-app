import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en";
import th from "./locales/th";

export type Lang = "th" | "en";
export const LANGS: Lang[] = ["th", "en"];
const STORAGE_KEY = "tookbaht-lang";

// Pages prerender in Thai; the saved/device language is applied after mount (see AppShell).
void i18n.use(initReactI18next).init({
  resources: { th: { translation: th }, en: { translation: en } },
  lng: "th",
  fallbackLng: "th",
  interpolation: { escapeValue: false },
  returnNull: false,
});

/** Translate outside React (lib code, toasts). Components use useTranslation(). */
export const t = i18n.t.bind(i18n);

export function currentLang(): Lang {
  return i18n.language === "en" ? "en" : "th";
}

/** Saved choice, else the device language (Thai devices → th, everything else → en). */
export function preferredLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "th" || saved === "en") return saved;
  } catch {
    // Storage unavailable — fall back to the device language.
  }
  return navigator.language?.toLowerCase().startsWith("th") ? "th" : "en";
}

export function applyLang(lang: Lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Not persisted; still switch for this session.
  }
  document.documentElement.lang = lang;
  if (i18n.language !== lang) void i18n.changeLanguage(lang);
}

export default i18n;
