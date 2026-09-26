import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import th from "./locales/th";

export type Lang = "th" | "en";
export const LANGS: Lang[] = ["th", "en"];
const STORAGE_KEY = "tookbaht-lang";

// Pages prerender in Thai; the saved/device language is applied after mount (see AppShell).
// English is a separate chunk, fetched the first time it's needed.
void i18n.use(initReactI18next).init({
  resources: { th: { translation: th } },
  lng: "th",
  fallbackLng: "th",
  interpolation: { escapeValue: false },
  returnNull: false,
});

// Dev hot reload re-runs this module with edited strings, but init() keeps the
// first bundles; refresh them in place so new keys don't show up as raw keys.
i18n.addResourceBundle("th", "translation", th, true, true);
if (i18n.hasResourceBundle("en", "translation")) void loadBundle("en");

async function loadBundle(lang: Lang) {
  if (lang === "en") i18n.addResourceBundle("en", "translation", (await import("./locales/en")).default, true, true);
}

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

/** Switch the UI language (loading its strings first) and remember it on this device. */
export function applyLang(lang: Lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Not persisted; still switch for this session.
  }
  document.documentElement.lang = lang;
  if (i18n.language === lang) return;
  const ready = i18n.hasResourceBundle(lang, "translation") ? Promise.resolve() : loadBundle(lang);
  // The latest choice wins if the user switches again while English loads.
  pending = lang;
  ready
    .then(() => {
      if (pending === lang) void i18n.changeLanguage(lang);
    })
    // Offline before English was ever loaded: stay in Thai.
    .catch((e) => console.error(e));
}
let pending: Lang | null = null;

export default i18n;
