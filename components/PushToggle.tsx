"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { useStore } from "@/lib/store";
import { SwitchRow } from "./ui/primitives";

type PushState = "loading" | "unsupported" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** The service worker is only registered in production builds (and needs an installed PWA on iOS). */
async function getRegistration() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return null;
  return (await navigator.serviceWorker.getRegistration("/")) ?? null;
}

/** Turns subscription reminders on this device on or off. */
export function PushToggle() {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const reg = await getRegistration();
      let next: PushState;
      if (!reg || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) next = "unsupported";
      else if (Notification.permission === "denied") next = "denied";
      else next = (await reg.pushManager.getSubscription()) ? "on" : "off";
      if (!cancelled) setState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fail = () => useStore.getState().notify("ตั้งค่าการแจ้งเตือนไม่สำเร็จ ลองอีกครั้ง", { tone: "error" });

  const enable = async () => {
    const reg = await getRegistration();
    if (!reg) return setState("unsupported");
    if ((await Notification.requestPermission()) !== "granted") return setState("denied");
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
    });
    const json = sub.toJSON();
    const { error } = await getSupabase().rpc("save_push_subscription", {
      p_endpoint: sub.endpoint,
      p_p256dh: json.keys?.p256dh,
      p_auth: json.keys?.auth,
      p_user_agent: navigator.userAgent.slice(0, 300),
    });
    if (error) {
      console.error(error);
      await sub.unsubscribe();
      return fail();
    }
    setState("on");
    useStore.getState().notify("เปิดการแจ้งเตือนบนเครื่องนี้แล้ว");
  };

  const disable = async () => {
    const sub = await (await getRegistration())?.pushManager.getSubscription();
    if (sub) {
      await getSupabase().from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
    setState("off");
    useStore.getState().notify("ปิดการแจ้งเตือนบนเครื่องนี้แล้ว");
  };

  const hint =
    state === "unsupported"
      ? "ใช้ได้เมื่อติดตั้งแอปลงหน้าจอหลัก (iPhone ต้อง iOS 16.4 ขึ้นไป)"
      : state === "denied"
        ? "ถูกปิดไว้ในการตั้งค่าเบราว์เซอร์ เปิดอนุญาตการแจ้งเตือนก่อน"
        : "เตือนล่วงหน้า 1 วันก่อนตัดบัญชี บนเครื่องนี้";

  return (
    <SwitchRow
      label="แจ้งเตือน subscriptions"
      hint={hint}
      checked={state === "on"}
      onChange={async (on) => {
        if (busy || state === "loading" || state === "unsupported" || state === "denied") return;
        setBusy(true);
        try {
          await (on ? enable() : disable());
        } catch (e) {
          console.error(e);
          fail();
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}
