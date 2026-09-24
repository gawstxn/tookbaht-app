"use client";

import { useState, useSyncExternalStore } from "react";
import { getSupabase } from "@/lib/supabase/client";

const noop = () => () => {};
/** /auth/callback sends failed sign-ins back here with ?error=auth. */
const callbackFailed = () => new URLSearchParams(window.location.search).has("error");

/** Google-only sign-in via Supabase Auth; Google redirects back to /auth/callback. */
export default function LoginPage() {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<boolean | null>(null);
  const urlError = useSyncExternalStore(noop, callbackFailed, () => false);
  const error = failed ?? urlError;

  const handleGoogle = async () => {
    setBusy(true);
    setFailed(false);
    const { error } = await getSupabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      console.error(error);
      setBusy(false);
      setFailed(true);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col gap-6 px-6 pb-[calc(36px+env(safe-area-inset-bottom))] pt-6">
      <section className="flex grow flex-col justify-between gap-8 rounded-[28px] bg-ink px-6 py-7 text-on-ink shadow-hero">
        <span aria-hidden="true" className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-lime font-mono text-[26px] font-semibold text-ink">
          ฿
        </span>

        <div aria-hidden="true" className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-2 rounded-2xl bg-ink-2 p-3.5">
            <div className="flex justify-between text-xs text-on-ink-muted">
              <span>คงเหลือเดือนนี้</span>
              <span>ตัวอย่าง</span>
            </div>
            <span className="font-mono text-[26px] font-semibold tracking-tight">
              ฿21,930<span className="text-[15px] text-on-ink-faint">.00</span>
            </span>
            <div className="h-1 overflow-hidden rounded-full bg-ink-3">
              <div className="h-1 w-[55%] rounded-full bg-lime" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex items-center gap-2.5 rounded-2xl bg-ink-2 px-3.5 py-3">
              <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-[#8a2e22] text-[13px] font-bold text-white">N</span>
              <span className="flex flex-col text-[11px] text-on-ink-muted">
                ตัดบัญชีอีก 9 วัน
                <span className="font-mono text-[13px] font-semibold text-on-ink">฿419</span>
              </span>
            </div>
            <div className="flex flex-col justify-center gap-1.5 rounded-2xl bg-ink-2 px-3.5 py-3">
              <span className="flex justify-between text-[11px] text-on-ink-muted">
                เป้ารายรับ<span className="font-semibold text-lime">97%</span>
              </span>
              <div className="h-1 overflow-hidden rounded-full bg-ink-3">
                <div className="h-1 w-[97%] rounded-full bg-lime" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="font-serif text-[34px] font-bold leading-[1.25]">
            ทุกบาท
            <br />
            <span className="text-lime">อยู่ในมือคุณ</span>
          </h1>
          <p className="text-sm text-on-ink-muted">รายรับ รายจ่าย การโอน subscriptions และเป้าหมาย ครบในที่เดียว</p>
        </div>
      </section>

      <div className="flex flex-col gap-3.5">
        <button
          type="button"
          onClick={handleGoogle}
          disabled={busy}
          className="flex min-h-14 items-center justify-center gap-3 rounded-2xl border border-line bg-card text-base font-semibold shadow-[0_1px_2px_rgba(28,30,27,0.06)]"
        >
          <GoogleMark />
          {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบด้วย Google"}
        </button>
        {error ? (
          <p role="alert" className="text-center text-sm text-danger">
            เข้าสู่ระบบไม่สำเร็จ ลองอีกครั้ง
          </p>
        ) : null}
        <p className="text-center text-xs leading-relaxed text-muted">
          เมื่อเข้าสู่ระบบ ถือว่าคุณยอมรับ{" "}
          <a href="#" className="font-semibold text-ink underline">
            ข้อกำหนดการใช้งาน
          </a>
          <br />
          และ{" "}
          <a href="#" className="font-semibold text-ink underline">
            นโยบายความเป็นส่วนตัว
          </a>
        </p>
      </div>
    </main>
  );
}

/** Placeholder slot — replace with Google's official "G" asset per their branding guidelines. */
function GoogleMark() {
  return (
    <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-faint text-[9px] text-muted">
      G
    </span>
  );
}
