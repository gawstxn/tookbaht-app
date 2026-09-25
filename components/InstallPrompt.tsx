"use client";

import { useState, useSyncExternalStore } from "react";
import { Icon } from "./ui/Icon";
import { PrimaryButton, Sheet } from "./ui/primitives";

/** Chrome/Edge/Android fire this when the app can be installed. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

type Mode = "hidden" | "native" | "ios";
function currentMode(): Mode {
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  if (standalone) return "hidden";
  if (deferred) return "native";
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);
  return ios ? "ios" : "hidden";
}

/**
 * "Add to home screen" for visitors using the browser: the native prompt where
 * the browser offers one, step-by-step instructions on iPhone/iPad (Safari
 * can't be prompted from a page). Hidden once installed.
 */
export function InstallPrompt() {
  const mode = useSyncExternalStore(subscribe, currentMode, () => "hidden" as Mode);
  const [help, setHelp] = useState(false);
  if (mode === "hidden") return null;

  const install = async () => {
    if (mode === "ios") return setHelp(true);
    await deferred?.prompt();
    deferred = null;
    listeners.forEach((l) => l());
  };

  return (
    <>
      <button
        type="button"
        onClick={install}
        className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-line bg-paper text-sm font-semibold"
      >
        <Icon name="addSquare" size={18} strokeWidth={2} />
        เพิ่ม Tookbaht ลงหน้าจอหลัก
      </button>
      <Sheet open={help} onClose={() => setHelp(false)} title="เพิ่มลงหน้าจอหลัก">
        <p className="text-sm text-muted">เปิดจากไอคอนบนหน้าจอหลักแล้วจะใช้งานเหมือนแอป และเปิดการแจ้งเตือนก่อนตัดบัญชีได้</p>
        <ol className="flex flex-col gap-3">
          <Step n={1} icon="share">
            ใน Safari แตะปุ่ม <b>แชร์</b> (อยู่ในเมนู <b>⋯</b> บน iOS รุ่นใหม่)
          </Step>
          <Step n={2} icon="addSquare">
            เลือก <b>เพิ่มไปยังหน้าจอโฮม</b> (Add to Home Screen)
          </Step>
          <Step n={3} icon="check">
            แตะ <b>เพิ่ม</b> แล้วเปิด Tookbaht จากไอคอนบนหน้าจอหลัก
          </Step>
        </ol>
        <PrimaryButton onClick={() => setHelp(false)}>เข้าใจแล้ว</PrimaryButton>
      </Sheet>
    </>
  );
}

function Step({ n, icon, children }: { n: number; icon: "share" | "addSquare" | "check"; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3 text-sm">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-on-ink">{n}</span>
      <span className="grow">{children}</span>
      <Icon name={icon} size={20} strokeWidth={2} className="shrink-0 text-muted" />
    </li>
  );
}
