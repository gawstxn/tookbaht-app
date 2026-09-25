"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PushScreen } from "@/components/app";
import { NOTIF_STYLE, useNotifications } from "@/components/notifications";
import { Icon } from "@/components/ui/Icon";
import { Chip, Empty, ListCard, PushHeader } from "@/components/ui/primitives";
import { shortDate, toISO, todayISO } from "@/lib/format";
import { dayBucket, isUnread, type AppNotification } from "@/lib/notifications";
import { useStore } from "@/lib/store";

const GROUPS = [
  ["today", "วันนี้"],
  ["yesterday", "เมื่อวาน"],
  ["earlier", "ก่อนหน้านี้"],
] as const;

export default function NotificationsPage() {
  const router = useRouter();
  const { items, unread, settings } = useNotifications();
  const markRead = useStore((s) => s.markNotificationRead);
  const markAll = useStore((s) => s.markAllNotificationsRead);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const today = todayISO();
  const shown = onlyUnread ? unread : items;

  const open = (n: AppNotification) => {
    markRead(n.id);
    router.push(n.href);
  };

  return (
    <PushScreen>
      <PushHeader
        title="การแจ้งเตือน"
        onBack={() => router.back()}
        action={
          <button
            type="button"
            onClick={markAll}
            disabled={!unread.length}
            className="min-h-11 whitespace-nowrap px-1 text-[13px] font-semibold text-transfer disabled:text-faint"
          >
            อ่านทั้งหมด
          </button>
        }
      />

      <div className="flex gap-2">
        <Chip on={!onlyUnread} onClick={() => setOnlyUnread(false)}>
          ทั้งหมด
        </Chip>
        <Chip on={onlyUnread} onClick={() => setOnlyUnread(true)}>
          ยังไม่อ่าน ({unread.length})
        </Chip>
      </div>

      {shown.length === 0 ? <Empty>{onlyUnread ? "อ่านครบทุกรายการแล้ว" : "ยังไม่มีการแจ้งเตือน"}</Empty> : null}

      {GROUPS.map(([key, label]) => {
        const group = shown.filter((n) => dayBucket(n.at, today) === key);
        if (!group.length) return null;
        return (
          <section key={key} className="flex flex-col gap-2">
            <h2 className="text-[13px] font-semibold text-muted">{label}</h2>
            <ListCard>
              {group.map((n) => (
                <Row key={n.id} n={n} unread={isUnread(n, settings)} time={key === "earlier" ? shortDate(toISO(new Date(n.at)), false) : clock(n.at)} onOpen={() => open(n)} />
              ))}
            </ListCard>
          </section>
        );
      })}
    </PushScreen>
  );
}

function clock(ms: number) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function Row({ n, unread, time, onOpen }: { n: AppNotification; unread: boolean; time: string; onOpen: () => void }) {
  const style = NOTIF_STYLE[n.kind];
  return (
    <button type="button" onClick={onOpen} className="flex min-h-[72px] w-full items-start gap-3 py-3 text-left">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]" style={{ background: style.bg, color: style.fg }}>
        <Icon name={style.icon} size={20} strokeWidth={2} />
      </span>
      <span className="flex min-w-0 grow flex-col gap-0.5">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[15px] font-semibold">{n.title}</span>
          <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
            {time}
            {unread ? <span aria-label="ยังไม่อ่าน" className="h-2 w-2 rounded-full bg-danger" /> : <span className="h-2 w-2" />}
          </span>
        </span>
        <span className="text-[13px] text-muted">{n.body}</span>
      </span>
    </button>
  );
}
