export type ThemePref = "light" | "dark" | "system";
export const THEME_STORAGE_KEY = "tookbaht-theme";

/** Browser/status bar colour per resolved theme (matches --color-paper). */
const THEME_COLOR = { light: "#f3f0e8", dark: "#121412" } as const;

/**
 * Runs inline in <head> before first paint so a dark-theme user never sees a
 * cream flash. Keep it dependency-free; it is serialised into the page.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");var d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";var m=document.querySelector('meta[name="theme-color"]');if(m)m.content=d?"${THEME_COLOR.dark}":"${THEME_COLOR.light}"}catch(e){}})()`;

export function themePref(): ThemePref {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "dark" || saved === "system") return saved;
  } catch {
    // Storage unavailable — light, like before themes existed.
  }
  return "light";
}

const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

/** Set <html data-theme> and the status bar colour from a preference. */
export function applyTheme(pref: ThemePref) {
  const theme = pref === "dark" || (pref === "system" && systemDark()) ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
}

export function setThemePref(pref: ThemePref) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Not persisted; still switch for this session.
  }
  applyTheme(pref);
}

/** Re-apply when the OS switches light/dark while "system" is chosen. */
export function followSystemTheme() {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (themePref() === "system") applyTheme("system");
  };
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
