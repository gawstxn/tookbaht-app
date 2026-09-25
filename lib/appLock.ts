/**
 * App lock for this device: a 4-digit PIN (stored only as a salted SHA-256
 * hash) and optionally Face ID / Touch ID through WebAuthn. It keeps people
 * who pick up the phone out of the app; it is not encryption — the data
 * itself is protected by the Google sign-in and row-level security.
 */

export const LOCK_STORAGE_KEY = "tookbaht-lock";
export const PIN_LENGTH = 4;
/** Lock again after the app has been in the background this long. */
export const RELOCK_AFTER_MS = 60_000;

export interface LockConfig {
  salt: string;
  pinHash: string;
  /** WebAuthn credential id (base64url) when Face ID / Touch ID is on. */
  credentialId?: string;
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const b64url = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));

export async function hashPin(pin: string, salt: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${pin}`)));
}

export async function makeLock(pin: string): Promise<LockConfig> {
  const salt = hex(randomBytes(16).buffer);
  return { salt, pinHash: await hashPin(pin, salt) };
}

export async function checkPin(config: LockConfig, pin: string): Promise<boolean> {
  return (await hashPin(pin, config.salt)) === config.pinHash;
}

/* ---------- storage (per device, never synced) ---------- */

export function readLock(): LockConfig | null {
  try {
    const raw = localStorage.getItem(LOCK_STORAGE_KEY);
    const c = raw ? (JSON.parse(raw) as LockConfig) : null;
    return c?.salt && c.pinHash ? c : null;
  } catch {
    return null;
  }
}

export function writeLock(config: LockConfig | null) {
  try {
    if (config) localStorage.setItem(LOCK_STORAGE_KEY, JSON.stringify(config));
    else localStorage.removeItem(LOCK_STORAGE_KEY);
  } catch {
    // Storage unavailable: the lock simply isn't kept.
  }
  emit();
}

/* ---------- lock state for React (useSyncExternalStore) ---------- */

export interface LockState {
  config: LockConfig | null;
  locked: boolean;
}
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
let unlocked = false;
let cached: { key: string; state: LockState } | null = null;
export const SERVER_LOCK_STATE: LockState = { config: null, locked: false };

export function subscribeLock(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Current lock state; the same object until something changes. */
export function getLockState(): LockState {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(LOCK_STORAGE_KEY);
  } catch {
    // No storage, no lock.
  }
  const key = `${raw}|${unlocked}`;
  if (cached?.key !== key) {
    const config = readLock();
    cached = { key, state: { config, locked: !!config && !unlocked } };
  }
  return cached.state;
}

/** Unlock (after a PIN / Face ID, or when the user just set the lock), or lock again. */
export function setUnlocked(value: boolean) {
  unlocked = value;
  emit();
}

/** Runs in <head> before paint: hide the app while a lock is set, so nothing shows before the lock screen mounts. */
export const LOCK_BOOT_SCRIPT = `(function(){try{if(localStorage.getItem("${LOCK_STORAGE_KEY}"))document.documentElement.dataset.locked=""}catch(e){}})()`;

/* ---------- Face ID / Touch ID ---------- */

export async function biometricAvailable(): Promise<boolean> {
  try {
    return !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

/** Register a platform credential on this device; returns its id. */
export async function registerBiometric(): Promise<string> {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: { name: "Tookbaht", id: location.hostname },
      user: { id: randomBytes(16), name: "tookbaht-lock", displayName: "Tookbaht" },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("no credential");
  return b64url(cred.rawId);
}

/** Ask for Face ID / Touch ID with the registered credential. Resolves true when the user passed. */
export async function unlockWithBiometric(credentialId: string): Promise<boolean> {
  try {
    const cred = await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32),
        allowCredentials: [{ type: "public-key", id: fromB64url(credentialId) }],
        userVerification: "required",
        timeout: 60_000,
      },
    });
    return !!cred;
  } catch {
    return false;
  }
}
