/** Chrome/Edge/Samsung on Android fire this when the app can be installed. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * hidden: already installed or a desktop browser · native: the browser's own prompt ·
 * ios / android: step-by-step help · inApp: LINE, Facebook, … can't install, open a real browser first.
 */
export type InstallMode = "hidden" | "native" | "ios" | "android" | "inApp";

export interface InstallEnv {
  ua: string;
  maxTouchPoints: number;
  standalone: boolean;
  canPrompt: boolean;
}

const IN_APP = /\bLine\/|FBAN|FBAV|FB_IAB|Instagram|TikTok|musical_ly|Messenger|MicroMessenger|Twitter|; wv\)/i;

export const isLineApp = (ua: string) => /\bLine\//i.test(ua);

export function installMode({ ua, maxTouchPoints, standalone, canPrompt }: InstallEnv): InstallMode {
  if (standalone) return "hidden";
  if (canPrompt) return "native";
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  if (!ios && !android) return "hidden";
  if (IN_APP.test(ua)) return "inApp";
  return ios ? "ios" : "android";
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/**
 * Chrome fires beforeinstallprompt once, early in the page load. This module is
 * imported from the root layout so the event is caught on whichever page the
 * visitor lands on, not only once the login chunk has loaded.
 */
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

export const subscribeInstall = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export function currentInstallMode(): InstallMode {
  return installMode({
    ua: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone: window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true,
    canPrompt: deferred !== null,
  });
}

/** Shows the browser's install prompt; false when there is none to show. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  await e.prompt();
  notify();
  return true;
}
