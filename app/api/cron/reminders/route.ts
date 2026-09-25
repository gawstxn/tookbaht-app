import webpush from "web-push";
import { NextResponse, type NextRequest } from "next/server";
import { formatMoney } from "@/lib/fx";
import { refreshUsdRate } from "@/lib/rates";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

interface PendingReminder {
  subscription_id: string;
  user_id: string;
  name: string;
  amount: number | string;
  currency: "THB" | "USD";
  due_date: string;
  account_name: string;
}
/** Browser push services (mirrors public.is_push_endpoint in the database). */
const PUSH_ENDPOINT = /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)\//;

interface PushTarget {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Daily job (vercel.json): push a reminder for every subscription that bills
 * tomorrow. Called by Vercel Cron with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { NEXT_PUBLIC_VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey, VAPID_SUBJECT: subject } = process.env;
  if (!publicKey || !privateKey || !subject) {
    return NextResponse.json({ error: "VAPID keys are not configured" }, { status: 500 });
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const db = createSupabaseAdmin();
  // Daily job: also keep the USD rate fresh for auto-logging foreign subscriptions.
  await refreshUsdRate(db).catch((e) => console.error("rate refresh failed", e));
  const { data, error } = await db.rpc("pending_reminders");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const pending = (data ?? []) as PendingReminder[];
  if (!pending.length) return NextResponse.json({ reminders: 0, sent: 0 });

  const userIds = [...new Set(pending.map((r) => r.user_id))];
  // Each user's chosen language (profiles.settings.lang); Thai when unset.
  const { data: profiles } = await db.from("profiles").select("id, settings").in("id", userIds);
  const langOf = new Map((profiles ?? []).map((p: { id: string; settings: { lang?: string } | null }) => [p.id, p.settings?.lang === "en" ? "en" : "th"]));
  const { data: targets, error: targetsError } = await db
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", userIds)
    .returns<PushTarget[]>();
  if (targetsError) return NextResponse.json({ error: targetsError.message }, { status: 500 });

  let sent = 0;
  const gone = new Set<string>();
  const delivered: { subscription_id: string; due_date: string }[] = [];

  for (const r of pending) {
    const payload = JSON.stringify({
      ...reminderText(langOf.get(r.user_id) ?? "th", r),
      url: `/subscriptions/${r.subscription_id}`,
      tag: `due-${r.subscription_id}-${r.due_date}`,
    });
    let ok = false;
    for (const t of targets.filter((x) => x.user_id === r.user_id && !gone.has(x.id) && PUSH_ENDPOINT.test(x.endpoint))) {
      try {
        await webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, payload, { TTL: 60 * 60 * 12 });
        ok = true;
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // The browser dropped this subscription; stop sending to it.
        if (status === 404 || status === 410) gone.add(t.id);
        else console.error("push failed", status, e);
      }
    }
    if (ok) delivered.push({ subscription_id: r.subscription_id, due_date: r.due_date });
  }

  if (gone.size) await db.from("push_subscriptions").delete().in("id", [...gone]);
  if (delivered.length) {
    const { error: logError } = await db.from("reminders_sent").upsert(delivered, { ignoreDuplicates: true });
    if (logError) console.error(logError);
  }
  return NextResponse.json({ reminders: pending.length, sent, removed: gone.size });
}

/** Push text in the user's language (the server has no i18n instance). */
function reminderText(lang: string, r: PendingReminder) {
  const amount = formatMoney(Number(r.amount), r.currency ?? "THB");
  return lang === "en"
    ? { title: `${r.name} bills tomorrow`, body: `${amount} from ${r.account_name}` }
    : { title: `${r.name} ตัดบัญชีพรุ่งนี้`, body: `${amount} จาก${r.account_name}` };
}
